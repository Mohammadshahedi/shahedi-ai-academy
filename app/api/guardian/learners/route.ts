/** دروازه کودک تا تصویب سیاست رضایت و اثبات سرپرستی، هیچ payloadای دریافت نمی‌کند. */
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext, recordAuditEvent } from "@/lib/accounts";
import { createRequestId, privateJson, validateTrustedMutation } from "@/lib/http-security";
import { MINOR_DATA_COLLECTION_ENABLED } from "@/lib/phase3b-policy";
export async function POST(request: Request) {
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED", requestId }, { status: 401 });
  const mutation = validateTrustedMutation(request, "guardian-learner-request");
  if (!mutation.ok) return mutation.response;
  const account = await getAccountContext(user.userId);
  if (!account || account.status !== "ACTIVE" || !account.roles.includes("GUARDIAN")) return privateJson({ code: "GUARDIAN_ROLE_REQUIRED", requestId }, { status: 403 });
  if (!MINOR_DATA_COLLECTION_ENABLED) {
    await recordAuditEvent({ actorAccountId: account.accountId, actionCode: "guardian.learner.create", targetType: "MINOR_LEARNER_PROFILE", outcomeCode: "DENIED", reasonCode: "POLICY_GATE_NOT_APPROVED", requestId });
    return privateJson({ code: "MINOR_POLICY_APPROVAL_REQUIRED", requestId }, { status: 423 });
  }
  /* این شاخه تا تصویب حقوقی عمداً قابل‌دسترسی نیست و پیش از فعال‌سازی باید تکمیل و آزمون شود. */
  return privateJson({ code: "NOT_IMPLEMENTED", requestId }, { status: 501 });
}
