/** تاریخچه read-only، paginated و بدون PII/متن آموزشی. */
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { LIFECYCLE_RESOURCE_TYPES, listLifecycleEvents } from "@/lib/phase3c-lms";
import { privateJson } from "@/lib/http-security";
const querySchema = z.object({ resourceType: z.enum(LIFECYCLE_RESOURCE_TYPES), resourceId: z.uuid(), offset: z.coerce.number().int().min(0).default(0) }).strict();
export async function GET(request: Request) {
  const user = await getChatGPTUser(); if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const actor = await getAccountContext(user.userId); if (!actor || actor.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED" }, { status: 403 });
  const url = new URL(request.url); const parsed = querySchema.safeParse({ resourceType: url.searchParams.get("resourceType"), resourceId: url.searchParams.get("resourceId"), offset: url.searchParams.get("offset") ?? "0" });
  if (!parsed.success) return privateJson({ code: "INVALID_HISTORY_QUERY" }, { status: 400 });
  const result = await listLifecycleEvents(actor, parsed.data.resourceType, parsed.data.resourceId, parsed.data.offset); if (!result.ok) return privateJson({ code: result.code }, { status: 403 });
  return privateJson(result.value);
}
