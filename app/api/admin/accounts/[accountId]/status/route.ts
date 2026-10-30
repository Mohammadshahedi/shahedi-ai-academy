/** تغییر وضعیت فقط بین ACTIVE و SUSPENDED و با حفاظت آخرین مدیر انجام می‌شود. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { changeAccountStatus } from "@/lib/phase3b-admin";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

const statusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-account-status");
  if (!mutation.ok) return mutation.response;
  const account = await getAccountContext(user.userId);
  if (!account || account.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rateLimit = await consumeRateLimit("admin-account-status", user.userId, 30, 15 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId);
  if (!body.ok) return body.response;
  const parsed = statusSchema.safeParse(body.value);
  if (!parsed.success) return privateJson({ code: "INVALID_STATUS_REQUEST", requestId }, { status: 400 });
  const { accountId } = await context.params;
  const result = await changeAccountStatus(account, accountId, parsed.data.status, requestId);
  if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ status: result.value.status, requestId });
}
