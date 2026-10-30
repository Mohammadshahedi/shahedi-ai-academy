/** لغو دعوت در انتظار با permission تازه و audit حداقلی. */
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { revokeStaffInvitation } from "@/lib/phase3b-admin";
import { createRequestId, privateJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ invitationId: string }> }) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-staff-invitation-revoke");
  if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rateLimit = await consumeRateLimit("admin-staff-invitation-revoke", user.userId, 30, 15 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const { invitationId } = await context.params;
  const result = await revokeStaffInvitation(actor, invitationId, requestId);
  if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ ok: true, requestId });
}
