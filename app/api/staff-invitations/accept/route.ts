/** پذیرش دعوت با ایمیل تأییدشده Sites، token یک‌بارمصرف و تأیید بزرگسالی. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { acceptStaffInvitation, isCurrentPrivacyNotice } from "@/lib/phase3b-admin";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { ACCOUNT_PRIVACY_NOTICE_VERSION } from "@/lib/phase3b-policy";
import { consumeRateLimit } from "@/lib/rate-limit";

const acceptanceSchema = z.object({ token: z.string().min(40).max(128), adultConfirmed: z.literal(true), privacyNoticeVersion: z.string().max(80) }).strict();

export async function POST(request: Request) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "staff-invitation-accept");
  if (!mutation.ok) return mutation.response;
  const rateLimit = await consumeRateLimit("staff-invitation-accept", user.userId, 10, 15 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId);
  if (!body.ok) return body.response;
  const parsed = acceptanceSchema.safeParse(body.value);
  if (!parsed.success || !isCurrentPrivacyNotice(parsed.data.privacyNoticeVersion)) return privateJson({ code: "INVALID_ACCEPTANCE_REQUEST", requestId, expectedPrivacyNoticeVersion: ACCOUNT_PRIVACY_NOTICE_VERSION }, { status: 400 });
  const result = await acceptStaffInvitation({ externalSubject: user.userId, verifiedEmail: user.email, token: parsed.data.token, privacyNoticeVersion: parsed.data.privacyNoticeVersion, requestId });
  if (!result.ok) return privateJson({ code: result.code, requestId }, { status: result.code === "ACCOUNT_SUSPENDED" ? 423 : result.code === "ACCOUNT_CLOSED" ? 410 : 409 });
  return privateJson({ account: result.value, requestId }, { status: 201 });
}
