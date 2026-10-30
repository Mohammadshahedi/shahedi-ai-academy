/** گذار وضعیت کلاس با gate دوره و رابطه‌های فعال. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { CLASS_STATUSES, LIFECYCLE_REASON_CODES, transitionClass } from "@/lib/phase3c-lms";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";
const schema = z.object({ toStatus: z.enum(CLASS_STATUSES), expectedVersion: z.number().int().min(1), reasonCode: z.enum(LIFECYCLE_REASON_CODES) }).strict();
export async function POST(request: Request, context: { params: Promise<{ classId: string }> }) {
  const requestId = createRequestId(); const user = await getChatGPTUser(); if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-lms-class-transition"); if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId); if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rate = await consumeRateLimit("admin-lms-class-transition", user.userId, 50, 15 * 60); if (!rate.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId); if (!body.ok) return body.response; const parsed = schema.safeParse(body.value); if (!parsed.success) return privateJson({ code: "INVALID_TRANSITION", requestId }, { status: 400 });
  const { classId } = await context.params; const result = await transitionClass(actor, classId, parsed.data, requestId); if (!result.ok) return privateJson({ code: result.code, requestId }, { status: result.code === "VERSION_CONFLICT" ? 409 : 403 });
  return privateJson({ ok: true, requestId });
}
