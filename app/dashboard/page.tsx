/** داشبورد اولیه فقط وضعیت حساب و قابلیت‌های مجاز نقش جاری را نمایش می‌دهد. */
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { DeletionControls } from "@/app/account/deletion-controls";
import { getAccountContext, hasPermission } from "@/lib/accounts";
import type { AccountRole } from "@/lib/phase3b-policy";
export const dynamic = "force-dynamic";
/* عنوان‌های فارسی نقش‌ها در یک نگاشت بسته نگه داشته می‌شوند. */
const roleLabels: Record<AccountRole, string> = { ADULT_STUDENT: "دانشجوی بزرگسال", GUARDIAN: "والد یا سرپرست", INSTRUCTOR: "مدرس", ADMIN: "مدیر" };

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard/");
  const account = await getAccountContext(user.userId);
  if (!account) redirect("/account/");
  if (account.status !== "ACTIVE") return (
    <PortalShell signedIn>
      <section className="portal-hero"><p className="portal-kicker">دسترسی محدود</p><h1 className="portal-title">{account.status === "SUSPENDED" ? "حساب شما موقتاً تعلیق شده است" : "این حساب بسته شده است"}</h1><p className="portal-lead">داشبورد، نقش‌ها و عملیات حساس برای این وضعیت در سمت سرور غیرفعال هستند.</p></section>
      <article className="portal-card"><h2>پیگیری وضعیت</h2><p>برای بررسی یا اصلاح وضعیت حساب، از کانال رسمی پشتیبانی آکادمی استفاده کنید.</p></article>
    </PortalShell>
  );
  const isGuardian = account.roles.includes("GUARDIAN");
  const canReadAccounts = hasPermission(account, "accounts.read");
  const canReviewMinorReadiness = account.roles.includes("ADMIN") && hasPermission(account, "guardian_links.review");
  const canManageLms = account.roles.includes("ADMIN") && hasPermission(account, "courses.manage");
  const isAdultStudent = account.roles.includes("ADULT_STUDENT");
  const isInstructor = account.roles.includes("INSTRUCTOR");
  return (
    <PortalShell signedIn showAdmin={canReadAccounts} showMinorReadiness={canReviewMinorReadiness} showLms={canManageLms} showLearning={isAdultStudent} showTeaching={isInstructor}>
      <section className="portal-hero"><p className="portal-kicker">داشبورد فاز ۳B</p><h1 className="portal-title">حساب شما فعال است</h1><p className="portal-lead">{user.displayName}، نقش‌ها و مجوزهای این صفحه در هر درخواست از سرور بررسی می‌شوند.</p><div className="status-row"><span className="status-chip status-chip--gold">وضعیت: فعال</span>{account.roles.map((role) => <span className="status-chip" key={role}>{roleLabels[role]}</span>)}</div></section>
      <div className="portal-grid portal-grid--three"><article className="portal-card"><h2>حساب و امنیت</h2><ul className="feature-list"><li>ورود مدیریت‌شده پلتفرم</li><li>بدون رمز ذخیره‌شده در آکادمی</li><li>پاسخ‌های حساب با no-store</li></ul></article><article className="portal-card"><h2>دسترسی نقش‌محور</h2><p>فقط قابلیت‌های صریح نقش جاری نمایش و در سمت سرور مجاز می‌شوند. نقش مدیر نیز دسترسی نامحدود ندارد.</p>{canReadAccounts ? <a className="portal-button" href="/admin/">ورود به پنل مدیریت</a> : null}</article><article className="portal-card"><h2>LMS بزرگسالان</h2><p>فقط دوره، کلاس، درس متنی و enrollment فعال بزرگسالان در فاز ۳C.۱ در دسترس است.</p><div className="action-row">{isAdultStudent ? <a className="portal-button" href="/learn/">کلاس‌های من</a> : null}{isInstructor ? <a className="portal-button portal-button--secondary" href="/teach/">فضای مدرس</a> : null}{canManageLms ? <a className="portal-button portal-button--secondary" href="/admin/lms/">مدیریت LMS</a> : null}</div></article>{isGuardian ? <article className="portal-card portal-card--wide"><h2>مسیر والد یا سرپرست</h2><p className="notice">دریافت اطلاعات دانش‌آموز زیر ۱۸ سال هنوز قفل است. ابتدا متن رضایت، روش اثبات سرپرستی، نگهداری و حذف داده باید تصویب و بازبینی حقوقی شود.</p></article> : null}<article className="portal-card portal-card--wide"><h2>درخواست حذف حساب</h2><DeletionControls /></article></div>
    </PortalShell>
  );
}
