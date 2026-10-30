/** انتشار یا rollback صریح revision با optimistic concurrency و دلیل بسته. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { publishLessonRevision } from "@/lib/phase3c-lms";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  expectedLessonVersion: z.number().int().min(1),
  reasonCode: z.enum(["CONTENT_UPDATE", "CONTENT_ROLLBACK"]),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ lessonId: string; revisionId: string }> }) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const trusted = validateTrustedMutation(request, "admin-lms-lesson-revision-publish");
  if (!trusted.ok) return trusted.response;
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rate = await consumeRateLimit("admin-lms-lesson-revision-publish", user.userId, 40, 15 * 60);
  if (!rate.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return privateJson({ code: "INVALID_PUBLICATION", requestId }, { status: 400 });
  const { lessonId, revisionId } = await context.params;
  const result = await publishLessonRevision(actor, lessonId, revisionId, parsed.data, requestId);
  return result.ok
    ? privateJson({ ok: true, requestId })
    : privateJson({ code: result.code, requestId }, { status: result.code === "VERSION_CONFLICT" ? 409 : 403 });
}
