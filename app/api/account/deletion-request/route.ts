/** درخواست/لغو حذف حساب بدون purge تا تصویب نسخه نگهداری داده. */
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { cancelAccountDeletion, requestAccountDeletion } from "@/lib/phase3b-admin";
import { createRequestId, privateJson, validateTrustedMutation } from "@/lib/http-security";
import { ACCOUNT_PURGE_ENABLED } from "@/lib/phase3b-policy";
import { consumeRateLimit } from "@/lib/rate-limit";

async function currentAccount() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const account = await getAccountContext(user.userId);
  return account?.status === "ACTIVE" ? { user, account } : null;
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const current = await currentAccount();
  if (!current) return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const mutation = validateTrustedMutation(request, "account-deletion-request");
  if (!mutation.ok) return mutation.response;
  const rateLimit = await consumeRateLimit("account-deletion-request", current.user.userId, 5, 24 * 60 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const result = await requestAccountDeletion(current.account, requestId);
  if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ lifecycleRequestId: result.value.lifecycleRequestId, purgeEnabled: ACCOUNT_PURGE_ENABLED, code: "RETENTION_POLICY_APPROVAL_REQUIRED", requestId }, { status: 202 });
}

export async function DELETE(request: Request) {
  const requestId = createRequestId();
  const current = await currentAccount();
  if (!current) return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const mutation = validateTrustedMutation(request, "account-deletion-cancel");
  if (!mutation.ok) return mutation.response;
  const rateLimit = await consumeRateLimit("account-deletion-cancel", current.user.userId, 10, 24 * 60 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const result = await cancelAccountDeletion(current.account, requestId);
  if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ ok: true, requestId });
}
