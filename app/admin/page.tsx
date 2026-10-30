/** پنل مدیر فقط با permission صریح accounts.read در سرور رندر می‌شود. */
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { getAccountContext, hasPermission } from "@/lib/accounts";
import { listManagedAccounts, listPendingStaffInvitations } from "@/lib/phase3b-admin";
import { AdminConsole } from "./admin-console";
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ offset?: string; invitationOffset?: string }> }) {
  const user = await requireChatGPTUser("/admin/");
  const account = await getAccountContext(user.userId);
  if (!account) redirect("/account/");
  if (!hasPermission(account, "accounts.read")) return (
    <PortalShell signedIn>
      <section className="portal-hero"><p className="portal-kicker">دسترسی مدیریت</p><h1 className="portal-title">مجوز مشاهده حساب‌ها وجود ندارد</h1><p className="portal-lead">نقش ADMIN به‌تنهایی میان‌بر دسترسی نیست. مدیر نخست باید از bootstrap یک‌بارمصرف ساخته شود یا permission صریح دریافت کند.</p></section>
      <a className="portal-button" href="/admin/bootstrap/">بررسی bootstrap مدیر نخست</a>
    </PortalShell>
  );
  const params = await searchParams;
  const rawOffset = params.offset ?? "0";
  const rawInvitationOffset = params.invitationOffset ?? "0";
  const offset = /^\d{1,5}$/u.test(rawOffset) ? Math.min(Number(rawOffset), 10_000) : 0;
  const invitationOffset = /^\d{1,5}$/u.test(rawInvitationOffset) ? Math.min(Number(rawInvitationOffset), 10_000) : 0;
  const [result, invitationResult] = await Promise.all([listManagedAccounts(account, offset), listPendingStaffInvitations(account, invitationOffset)]);
  if (!result.ok) throw new Error("Authorized account list could not be loaded");
  return (
    <PortalShell signedIn showAdmin showLms={account.roles.includes("ADMIN") && hasPermission(account, "courses.manage")}>
      <section className="portal-hero"><p className="portal-kicker">فاز ۳B.2</p><h1 className="portal-title">مدیریت حساب و دسترسی</h1><p className="portal-lead">تعلیق، نقش‌ها، permissionها و دعوت کارکنان در هر درخواست سمت سرور کنترل و audit می‌شوند. داده کودک همچنان قفل است.</p><div className="action-row">{account.roles.includes("ADMIN") && hasPermission(account, "guardian_links.review") ? <Link className="portal-button portal-button--secondary" href="/admin/minor-readiness/">مشاهده آمادگی ۳B.۳</Link> : null}{account.roles.includes("ADMIN") && hasPermission(account, "courses.manage") ? <Link className="portal-button portal-button--secondary" href="/admin/lms/">مدیریت LMS بزرگسالان</Link> : null}</div></section>
      <AdminConsole initialAccounts={result.value.accounts} initialInvitations={invitationResult.ok ? invitationResult.value.invitations : []} offset={offset} nextOffset={result.value.nextOffset} invitationOffset={invitationOffset} nextInvitationOffset={invitationResult.ok ? invitationResult.value.nextOffset : null} />
    </PortalShell>
  );
}
