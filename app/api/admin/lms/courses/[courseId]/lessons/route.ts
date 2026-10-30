/** افزودن درس text-only به دوره موجود. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { createLesson } from "@/lib/phase3c-lms";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";
const noHtml = (value: string) => !/<\/?[a-z][^>]*>/iu.test(value);
const schema = z.object({ title: z.string().trim().min(2).max(120), bodyText: z.string().trim().min(1).max(20_000).refine(noHtml), position: z.number().int().min(1).max(5_000) }).strict();
export async function POST(request: Request, context: { params: Promise<{ courseId: string }> }) {
  const requestId = createRequestId(); const user = await getChatGPTUser(); if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-lms-lesson-create"); if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId); if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rate = await consumeRateLimit("admin-lms-lesson-create", user.userId, 40, 15 * 60); if (!rate.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId, 64_000); if (!body.ok) return body.response; const parsed = schema.safeParse(body.value); if (!parsed.success) return privateJson({ code: "INVALID_LESSON", requestId }, { status: 400 });
  const { courseId } = await context.params; const result = await createLesson(actor, courseId, parsed.data, requestId); if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ lessonId: result.value.lessonId, requestId }, { status: 201 });
}
