/** اعطای permission فقط به حساب فعال دارای نقش ADMIN و توسط مدیر دیگر. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { grantAccountPermission, isAccountPermission } from "@/lib/phase3b-admin";
import { createRequestId, privateJson, readLimitedJson, validateTrustedMutation } from "@/lib/http-security";
import { consumeRateLimit } from "@/lib/rate-limit";

const permissionSchema = z.object({ permission: z.string().min(1).max(80) }).strict();

export async function POST(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "admin-account-permission-add");
  if (!mutation.ok) return mutation.response;
  const actor = await getAccountContext(user.userId);
  if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED", requestId }, { status: 403 });
  const rateLimit = await consumeRateLimit("admin-account-permission-add", user.userId, 30, 15 * 60);
  if (!rateLimit.allowed) return privateJson({ code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const body = await readLimitedJson(request, requestId);
  if (!body.ok) return body.response;
  const parsed = permissionSchema.safeParse(body.value);
  if (!parsed.success || !isAccountPermission(parsed.data.permission)) return privateJson({ code: "INVALID_PERMISSION", requestId }, { status: 400 });
  const { accountId } = await context.params;
  const result = await grantAccountPermission(actor, accountId, parsed.data.permission, requestId);
  if (!result.ok) return privateJson({ code: result.code, requestId }, { status: 409 });
  return privateJson({ ok: true, requestId }, { status: 201 });
}
