/** فهرست و ساخت دوره بزرگسالان با permission صریح courses.manage. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { createCourse, getAdminLmsOverview } from "@/lib/phase3c-lms";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

const courseSchema = z.object({ title: z.string().trim().min(2).max(120) }).strict();

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const offset = (name: string) => { const raw = params.get(name) ?? "0"; const parsed = Number(raw); return /^\d{1,15}$/u.test(raw) && Number.isSafeInteger(parsed) ? parsed : 0; };
  const result = await getAdminLmsOverview(actor, { course: offset("courseOffset"), class: offset("classOffset"), lesson: offset("lessonOffset"), assignment: offset("assignmentOffset"), enrollment: offset("enrollmentOffset") });
  if (!result.ok) return privateJson({ code: result.code }, { status: 403 });
  return privateJson(result.value);
}

export async function POST(request: Request) {
  const requestId = createRequestId(); const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-lms-course-create"); if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId); if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rate = await consumeRateLimit("admin-lms-course-create", user.userId, 20, 15 * 60); if (!rate.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId); if (!body.ok) return body.response;
  const parsed = courseSchema.safeParse(body.value); if (!parsed.success) return privateJson({ code: "INVALID_COURSE", requestId }, { status: 400 });
  const result = await createCourse(actor, parsed.data, requestId); if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 403 });
  return privateJson({ courseId: result.value.courseId, requestId }, { status: 201 });
}
