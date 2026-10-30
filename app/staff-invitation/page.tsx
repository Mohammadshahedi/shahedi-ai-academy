/** صفحه پذیرش دعوت، کاربر را برای استفاده از ایمیل تأییدشده پلتفرم راهنمایی می‌کند. */
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { StaffInvitationAcceptanceForm } from "./acceptance-form";
export const dynamic = "force-dynamic";

export default async function StaffInvitationPage() {
  const user = await requireChatGPTUser("/staff-invitation/");
  return (
    <PortalShell signedIn>
      <section className="portal-hero"><p className="portal-kicker">دعوت کارکنان</p><h1 className="portal-title">پذیرش دعوت امن</h1><p className="portal-lead">دعوت فقط زمانی پذیرفته می‌شود که ایمیل تأییدشده حساب فعلی با ایمیل دعوت مطابقت داشته باشد. ایمیل خام در پایگاه داده دعوت نگهداری نمی‌شود.</p></section>
      <div className="portal-grid"><article className="portal-card"><h2>واردکردن توکن</h2><StaffInvitationAcceptanceForm /></article><aside className="portal-card portal-card--navy"><h2>حساب فعلی</h2><p>{user.displayName}</p><p>توکن تک‌مصرف است و پس از ۲۴ ساعت یا لغو مدیریت کار نمی‌کند.</p></aside></div>
    </PortalShell>
  );
}
