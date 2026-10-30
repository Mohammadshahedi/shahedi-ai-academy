/** لغو permission با منع تغییر خود و حفاظت permission حیاتی آخرین مدیر. */
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { isAccountPermission, revokeAccountPermission } from "@/lib/phase3b-admin";
import { createRequestId, privateJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function DELETE(request: Request, context: { params: Promise<{ accountId: string; permissionCode: string }> }) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-account-permission-revoke");
  if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rateLimit = await consumeRateLimit("admin-account-permission-revoke", user.userId, 30, 15 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const { accountId, permissionCode } = await context.params;
  if (!isAccountPermission(permissionCode)) return privateJson({ code: "INVALID_PERMISSION", requestId }, { status: 400 });
  const result = await revokeAccountPermission(actor, accountId, permissionCode, requestId);
  if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ ok: true, requestId });
}
