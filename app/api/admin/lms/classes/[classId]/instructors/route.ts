/** تخصیص مدرس فعال به کلاس، بدون بازگرداندن roster یا ایمیل. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { assignInstructor } from "@/lib/phase3c-lms";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";
const schema = z.object({ instructorAccountId: z.uuid() }).strict();
export async function POST(request: Request, context: { params: Promise<{ classId: string }> }) {
  const requestId = createRequestId(); const user = await getChatGPTUser(); if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-lms-instructor-assign"); if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId); if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rate = await consumeRateLimit("admin-lms-instructor-assign", user.userId, 40, 15 * 60); if (!rate.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId); if (!body.ok) return body.response; const parsed = schema.safeParse(body.value); if (!parsed.success) return privateJson({ code: "INVALID_INSTRUCTOR", requestId }, { status: 400 });
  const { classId } = await context.params; const result = await assignInstructor(actor, classId, parsed.data.instructorAccountId, requestId); if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ ok: true, requestId }, { status: 201 });
}
