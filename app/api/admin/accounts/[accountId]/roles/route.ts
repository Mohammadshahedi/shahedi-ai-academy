/** افزودن نقش با permission صریح و منع self-escalation. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { assignAccountRole, isAccountRole } from "@/lib/phase3b-admin";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

const roleSchema = z.object({ role: z.string().min(1).max(40) }).strict();

export async function POST(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-account-role-add");
  if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rateLimit = await consumeRateLimit("admin-account-role-add", user.userId, 30, 15 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId);
  if (!body.ok) return body.response;
  const parsed = roleSchema.safeParse(body.value);
  if (!parsed.success || !isAccountRole(parsed.data.role)) return privateJson({ code: "INVALID_ROLE", requestId }, { status: 400 });
  const { accountId } = await context.params;
  const result = await assignAccountRole(actor, accountId, parsed.data.role, requestId);
  if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ ok: true, requestId }, { status: 201 });
}
