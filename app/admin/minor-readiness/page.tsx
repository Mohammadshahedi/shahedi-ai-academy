/** صفحه فقط‌خواندنی آمادگی ۳B.۳؛ هیچ تصمیم حقوقی یا داده کودک در این مسیر ثبت نمی‌شود. */
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { getAccountContext, hasPermission } from "@/lib/accounts";
import { MINOR_DATA_COLLECTION_ENABLED, MINOR_READINESS_ITEMS, MINOR_READINESS_STATUS } from "@/lib/phase3b-policy";

export const dynamic = "force-dynamic";

export default async function MinorReadinessPage() {
  const user = await requireChatGPTUser("/admin/minor-readiness/");
  const account = await getAccountContext(user.userId);
  if (!account) redirect("/account/");
  if (!account.roles.includes("ADMIN") || !hasPermission(account, "guardian_links.review")) return (
    <PortalShell signedIn>
      <section className="portal-hero">
        <p className="portal-kicker">دسترسی محدود</p>
        <h1 className="portal-title">مجوز بازبینی آمادگی وجود ندارد</h1>
        <p className="portal-lead">این صفحه فقط برای حساب فعال دارای نقش مدیر و permission صریح <bdi dir="ltr">guardian_links.review</bdi> نمایش داده می‌شود.</p>
      </section>
    </PortalShell>
  );

  const blockedCount = MINOR_READINESS_ITEMS.filter((item) => item.state === "BLOCKED").length;
  return (
    <PortalShell signedIn showAdmin={hasPermission(account, "accounts.read")} showMinorReadiness>
      <section className="portal-hero">
        <p className="portal-kicker">۳B.۳ — آمادگی امن</p>
        <h1 className="portal-title">دروازه داده زیر ۱۸ سال بسته است</h1>
        <p className="portal-lead">این نمای فقط‌خواندنی، تصمیم‌های لازم را نشان می‌دهد. هیچ پرونده کودک، مدرک سرپرستی یا رضایتی در این صفحه دریافت یا ذخیره نمی‌شود.</p>
        <div className="status-row" aria-label="وضعیت آمادگی"><span className="status-chip status-chip--locked">وضعیت: {MINOR_READINESS_STATUS}</span><span className="status-chip">{blockedCount.toLocaleString("fa-IR")} مانع باز</span></div>
      </section>

      <section className="notice readiness-lock" aria-labelledby="minor-lock-title">
        <h2 id="minor-lock-title">قفل فنی فعال است</h2>
        <p><bdi dir="ltr">MINOR_DATA_COLLECTION_ENABLED = {String(MINOR_DATA_COLLECTION_ENABLED)}</bdi> و endpoint ایجاد پرونده پیش از خواندن payload با پاسخ <bdi dir="ltr">423</bdi> متوقف می‌شود.</p>
      </section>

      <section className="readiness-grid" aria-labelledby="readiness-title">
        <div className="readiness-heading"><h2 id="readiness-title">چک‌لیست تصمیم‌ها</h2><p>موارد مسدود فقط پس از تصمیم ثبت‌شده مدیر و بازبینی حقوقی در یک فاز مستقل قابل تغییرند.</p></div>
        {MINOR_READINESS_ITEMS.map((item) => (
          <article className="portal-card readiness-item" key={item.code}>
            <div className="readiness-item__header"><h3>{item.title}</h3><span className={`status-chip ${item.state === "READY" ? "status-chip--ready" : "status-chip--locked"}`}>{item.state === "READY" ? "آماده" : "مسدود"}</span></div>
            <p>{item.detail}</p>
            <small><bdi dir="ltr">{item.code}</bdi></small>
          </article>
        ))}
      </section>

      <section className="portal-card portal-card--navy readiness-boundary">
        <h2>مرز این فاز</h2>
        <p>این مرحله اجرای کامل ۳B.۳ نیست. فعال‌سازی دریافت داده، آپلود مدرک، تأیید سرپرستی، ثبت رضایت و ایجاد پرونده کودک خارج از دامنه‌اند.</p>
      </section>
    </PortalShell>
  );
}
