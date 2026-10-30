/** bootstrap مدیر نخست با secret یک‌بارمصرف runtime و بدون hard-code شناسه کاربر. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { bootstrapFirstAdmin } from "@/lib/phase3b-admin";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

const emptyBodySchema = z.object({}).strict();

export async function POST(request: Request) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-bootstrap");
  if (!mutation.ok) return mutation.response;
  const account = await getAccountContext(user.userId);
  if (!account || account.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rateLimit = await consumeRateLimit("admin-bootstrap", user.userId, 5, 15 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId);
  if (!body.ok) return body.response;
  if (!emptyBodySchema.safeParse(body.value).success) return privateJson({ code: "INVALID_REQUEST", requestId }, { status: 400 });
  const secret = request.headers.get("x-shahedi-bootstrap-secret") ?? "";
  const result = await bootstrapFirstAdmin(account, secret, requestId);
  if (!result.ok) {
    const status = result.code === "BOOTSTRAP_NOT_CONFIGURED" ? 503 : result.code === "BOOTSTRAP_SECRET_INVALID" ? 403 : 409;
    return privateJson({ code: result.code, requestId }, { status });
  }
  return privateJson({ account: result.value, requestId }, { status: 201 });
}
