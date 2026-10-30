/** فهرست حساب‌ها برای مدیر مجاز، بدون ایمیل و شناسه هویت پلتفرم. */
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccountContext } from "@/lib/accounts";
import { listManagedAccounts } from "@/lib/phase3b-admin";
import { privateJson } from "@/lib/http-security";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return privateJson({ code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const account = await getAccountContext(user.userId);
  if (!account || account.status !== "ACTIVE") return privateJson({ code: "ACTIVE_ACCOUNT_REQUIRED" }, { status: 403 });
  const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
  const offset = /^\d{1,5}$/u.test(rawOffset) ? Number(rawOffset) : 0;
  const result = await listManagedAccounts(account, offset);
  if (!result.ok) return privateJson({ code: result.code }, { status: 403 });
  return privateJson(result.value);
}
