/** ویرایش فقط جایگاه درس؛ عنوان و متن فقط از revision منتشر می‌شوند. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { updateLesson } from "@/lib/phase3c-lms";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";
const schema = z.object({ position: z.number().int().min(1).max(5_000), expectedVersion: z.number().int().min(1) }).strict();
export async function PATCH(request: Request, context: { params: Promise<{ lessonId: string }> }) {
  const requestId = createRequestId(); const user = await getChatGPTUser(); if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-lms-lesson-update"); if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId); if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rate = await consumeRateLimit("admin-lms-lesson-update", user.userId, 60, 15 * 60); if (!rate.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId, 64_000); if (!body.ok) return body.response; const parsed = schema.safeParse(body.value); if (!parsed.success) return privateJson({ code: "INVALID_LESSON", requestId }, { status: 400 });
  const { lessonId } = await context.params; const result = await updateLesson(actor, lessonId, parsed.data, requestId); if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ ok: true, requestId });
}
