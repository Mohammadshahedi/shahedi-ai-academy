/** ساخت و فهرست revisionهای immutable درس؛ خواندن و نوشتن هر دو permission تازه می‌خواهند. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { createLessonRevision, listLessonRevisions } from "@/lib/phase3c-lms";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  bodyText: z.string().trim().min(1).max(20_000).refine((value) => !/<\/?[a-z][^>]*>/iu.test(value)),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ lessonId: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED" }, { status: 403 });
  const rate = await consumeRateLimit("admin-lms-lesson-revision-read", user.userId, 120, 15 * 60);
  if (!rate.allowed) return privateJson({ code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const { lessonId } = await context.params;
  const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
  const offset = /^\d{1,15}$/u.test(rawOffset) && Number.isSafeInteger(Number(rawOffset)) ? Number(rawOffset) : 0;
  const result = await listLessonRevisions(actor, lessonId, offset);
  return result.ok ? privateJson(result.value) : privateJson({ code: result.code }, { status: 403 });
}

export async function POST(request: Request, context: { params: Promise<{ lessonId: string }> }) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const trusted = validateTrustedMutation(request, "admin-lms-lesson-revision-create");
  if (!trusted.ok) return trusted.response;
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rate = await consumeRateLimit("admin-lms-lesson-revision-create", user.userId, 40, 15 * 60);
  if (!rate.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId, 64_000);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return privateJson({ code: "INVALID_REVISION", requestId }, { status: 400 });
  const { lessonId } = await context.params;
  const result = await createLessonRevision(actor, lessonId, parsed.data, requestId);
  return result.ok
    ? privateJson({ revisionId: result.value.revisionId, requestId }, { status: 201 })
    : privateJson({ code: result.code, requestId }, { status: 403 });
}
