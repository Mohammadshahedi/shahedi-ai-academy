/** ثبت نقش پایه فقط برای بزرگسال احرازشده و با کنترل هم‌مبدأ انجام می‌شود. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createSelfServiceAccount } from "@/lib/accounts";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { ACCOUNT_PRIVACY_NOTICE_VERSION, SELF_SERVICE_ROLES } from "@/lib/phase3b-policy";
import { consumeRateLimit } from "@/lib/rate-limit";

/* schema اجازه افزودن فیلد پنهان، نقش کارکنان یا نسخه سیاست دلخواه را نمی‌دهد. */
const onboardingSchema = z.object({ role: z.enum(SELF_SERVICE_ROLES), adultConfirmed: z.literal(true), privacyNoticeVersion: z.literal(ACCOUNT_PRIVACY_NOTICE_VERSION) }).strict();

export async function POST(request: Request) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "account-onboarding");
  if (!mutation.ok) return mutation.response;
  const rateLimit = await consumeRateLimit("account-onboarding", user.userId, 5, 15 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId);
  if (!body.ok) return body.response;
  const parsed = onboardingSchema.safeParse(body.value);
  if (!parsed.success) return privateJson({ code: "INVALID_ONBOARDING_REQUEST", requestId }, { status: 400 });
  try {
    const result = await createSelfServiceAccount({ externalSubject: user.userId, role: parsed.data.role, privacyNoticeVersion: parsed.data.privacyNoticeVersion, requestId });
    if (result.account.status === "SUSPENDED") return privateJson({ code: "ACCOUNT_SUSPENDED", requestId }, { status: 423 });
    if (result.account.status === "CLOSED") return privateJson({ code: "ACCOUNT_CLOSED", requestId }, { status: 410 });
    return privateJson({ account: result.account, requestId }, { status: result.created ? 201 : 200 });
  } catch {
    /* خطای داخلی بدون payload، ایمیل یا جزئیات D1 ثبت/نمایش داده می‌شود. */
    console.error("phase3b.account_onboarding.failed", { requestId });
    return privateJson({ code: "ACCOUNT_CREATION_FAILED", requestId }, { status: 500 });
  }
}
