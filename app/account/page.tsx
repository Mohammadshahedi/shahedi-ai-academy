/** صفحه ورود و شروع حساب، هویت مدیریت‌شده Sites را به مدل نقش داخلی متصل می‌کند. */
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { getAccountContext } from "@/lib/accounts";
import { OnboardingForm } from "./onboarding-form";
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getChatGPTUser();
  if (!user) return (
    <PortalShell>
      <section className="portal-hero"><p className="portal-kicker">فاز ۳B — هویت مدیریت‌شده</p><h1 className="portal-title">ورود امن به حساب آکادمی</h1><p className="portal-lead">رمز عبور یا کد یک‌بارمصرف در سامانه آکادمی ذخیره نمی‌شود. ورود از مسیر امن پلتفرم انجام می‌شود.</p></section>
      <div className="portal-grid"><article className="portal-card"><h2>ورود یا ادامه</h2><p>پس از احراز هویت، فقط نقش و وضعیت حساب لازم برای ارائه خدمات آموزشی نگهداری می‌شود.</p><a className="portal-button" href={chatGPTSignInPath("/account/")} target="_top">ورود امن</a></article><article className="portal-card portal-card--navy"><h2>زیر ۱۸ سال</h2><p>دانش‌آموز حساب مستقل نمی‌سازد. شروع مسیر فقط از حساب والد یا سرپرست بزرگسال است و دریافت داده کودک تا تصویب سیاست رضایت غیرفعال می‌ماند.</p></article></div>
    </PortalShell>
  );
  const account = await getAccountContext(user.userId);
  if (account?.status === "ACTIVE") redirect("/dashboard/");
  if (account) return (
    <PortalShell signedIn>
      <section className="portal-hero"><p className="portal-kicker">وضعیت حساب</p><h1 className="portal-title">{account.status === "SUSPENDED" ? "حساب شما موقتاً تعلیق شده است" : "این حساب بسته شده است"}</h1><p className="portal-lead">{account.status === "SUSPENDED" ? "تا زمان بازبینی مدیریت، ساخت حساب دوباره یا دسترسی به خدمات حساس امکان‌پذیر نیست." : "این هویت نمی‌تواند حساب بسته‌شده را از مسیر ثبت‌نام عمومی دوباره فعال کند."}</p></section>
      <article className="portal-card"><h2>اقدام بعدی</h2><p>برای پیگیری وضعیت، از کانال رسمی پشتیبانی آکادمی استفاده کنید. جزئیات فنی یا اطلاعات حساب در این صفحه نمایش داده نمی‌شود.</p></article>
    </PortalShell>
  );
  return (
    <PortalShell signedIn>
      <section className="portal-hero"><p className="portal-kicker">حساب بزرگسال</p><h1 className="portal-title">خوش آمدید، {user.displayName}</h1><p className="portal-lead">برای ساخت حساب، فقط نقش پایه را انتخاب کنید. نقش مدرس و مدیر از مسیر دعوت سازمانی صادر می‌شود.</p></section>
      <div className="portal-grid"><article className="portal-card"><h2>انتخاب نقش پایه</h2><OnboardingForm /></article><aside className="portal-card portal-card--navy"><h2>مرزهای ایمنی</h2><ul className="feature-list"><li>بدون ذخیره رمز عبور در آکادمی</li><li>کنترل نقش در سمت سرور</li><li>ثبت رویدادهای حساس بدون payload شخصی</li><li>قفل کامل دریافت داده کودک در این برش</li></ul></aside></div>
    </PortalShell>
  );
}
