/** ساخت دعوت کارکنان با token تک‌نمایش و بدون ذخیره ایمیل خام. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { createStaffInvitation, isStaffRole, listPendingStaffInvitations } from "@/lib/phase3b-admin";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

const invitationSchema = z.object({ email: z.email().max(254), role: z.string().min(1).max(20) }).strict();

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED" }, { status: 403 });
  const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
  const offset = /^\d{1,5}$/u.test(rawOffset) ? Math.min(Number(rawOffset), 10_000) : 0;
  const result = await listPendingStaffInvitations(actor, offset);
  if (!result.ok) return privateJson({ code: result.code }, { status: 403 });
  return privateJson(result.value);
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-staff-invitation-create");
  if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rateLimit = await consumeRateLimit("admin-staff-invitation-create", user.userId, 20, 60 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId);
  if (!body.ok) return body.response;
  const parsed = invitationSchema.safeParse(body.value);
  if (!parsed.success || !isStaffRole(parsed.data.role)) return privateJson({ code: "INVALID_INVITATION_REQUEST", requestId }, { status: 400 });
  const result = await createStaffInvitation(actor, parsed.data.email, parsed.data.role, requestId);
  if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 403 });
  return privateJson({ invitation: result.value, delivery: "MANUAL_SECURE_CHANNEL", requestId }, { status: 201 });
}
