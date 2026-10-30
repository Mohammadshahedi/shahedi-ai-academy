/** ویرایش محتوای دوره؛ تغییر وضعیت فقط از endpoint چرخه عمر انجام می‌شود. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { updateCourse } from "@/lib/phase3c-lms";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";
const schema = z.object({ title: z.string().trim().min(2).max(120), expectedVersion: z.number().int().min(1) }).strict();
export async function PATCH(request: Request, context: { params: Promise<{ courseId: string }> }) {
  const requestId = createRequestId(); const user = await getChatGPTUser(); if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-lms-course-update"); if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId); if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rate = await consumeRateLimit("admin-lms-course-update", user.userId, 40, 15 * 60); if (!rate.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId); if (!body.ok) return body.response; const parsed = schema.safeParse(body.value); if (!parsed.success) return privateJson({ code: "INVALID_COURSE", requestId }, { status: 400 });
  const { courseId } = await context.params; const result = await updateCourse(actor, courseId, parsed.data, requestId); if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ ok: true, requestId });
}
