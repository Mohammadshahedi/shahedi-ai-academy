/** API فقط اطلاعات حداقلی حساب کاربر احرازشده جاری را برمی‌گرداند. */
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { privateJson } from "@/lib/http-security";
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const account = await getAccountContext(user.userId);
  if (!account) return privateJson({ code: "ACCOUNT_ONBOARDING_REQUIRED" }, { status: 404 });
  if (account.status === "SUSPENDED") return privateJson({ code: "ACCOUNT_SUSPENDED" }, { status: 423 });
  if (account.status === "CLOSED") return privateJson({ code: "ACCOUNT_CLOSED" }, { status: 410 });
  return privateJson({ account: { id: account.accountId, status: account.status, roles: account.roles, permissions: account.permissions, displayName: user.displayName } });
}
