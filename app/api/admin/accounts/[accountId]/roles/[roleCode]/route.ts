/** لغو نقش با حفاظت آخرین مدیر و بستن permissionهای مدیریتی بدون نقش. */
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { isAccountRole, revokeAccountRole } from "@/lib/phase3b-admin";
import { createRequestId, privateJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function DELETE(request: Request, context: { params: Promise<{ accountId: string; roleCode: string }> }) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-account-role-revoke");
  if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rateLimit = await consumeRateLimit("admin-account-role-revoke", user.userId, 30, 15 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const { accountId, roleCode } = await context.params;
  if (!isAccountRole(roleCode)) return privateJson({ code: "INVALID_ROLE", requestId }, { status: 400 });
  const result = await revokeAccountRole(actor, accountId, roleCode, requestId);
  if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ ok: true, requestId });
}
