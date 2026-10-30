"use client";

/** فرم کلاینت فقط انتخاب نقش بزرگسال و تأیید اطلاعیه جاری را ارسال می‌کند. */
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_PRIVACY_NOTICE_VERSION, type SelfServiceRole } from "@/lib/phase3b-policy";

export function OnboardingForm() {
  const router = useRouter();
  const [role, setRole] = useState<SelfServiceRole>("ADULT_STUDENT");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  /* پاسخ موفق با ناوبری کامل، داده احراز هویت صفحه را از سرور تازه می‌کند. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adultConfirmed || pending) return;
    setPending(true);
    setHasError(false);
    setMessage("در حال ساخت حساب امن…");
    try {
      const response = await fetch("/api/account/onboarding", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Shahedi-Action": "account-onboarding" },
        body: JSON.stringify({ role, adultConfirmed: true, privacyNoticeVersion: ACCOUNT_PRIVACY_NOTICE_VERSION }),
      });
      if (!response.ok) {
        setHasError(true);
        setMessage(response.status === 429 ? "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید." : "ساخت حساب انجام نشد. دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.");
        return;
      }
      setMessage("حساب ساخته شد؛ در حال ورود به داشبورد…");
      router.push("/dashboard/");
      router.refresh();
    } catch {
      setHasError(true);
      setMessage("ارتباط امن برقرار نشد. اتصال خود را بررسی و دوباره تلاش کنید.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit} noValidate>
      <fieldset className="account-form" disabled={pending}>
        <legend><strong>نوع حساب بزرگسال</strong></legend>
        <div className="role-options">
          <label className="role-option"><input type="radio" name="role" value="ADULT_STUDENT" checked={role === "ADULT_STUDENT"} onChange={() => setRole("ADULT_STUDENT")} /><span><strong>دانشجوی بزرگسال</strong><small>برای مشاهده مسیر و پرونده آموزشی خود</small></span></label>
          <label className="role-option"><input type="radio" name="role" value="GUARDIAN" checked={role === "GUARDIAN"} onChange={() => setRole("GUARDIAN")} /><span><strong>والد یا سرپرست</strong><small>برای آغاز مسیر والد‌محور پس از تصویب سیاست مربوط</small></span></label>
        </div>
        <label className="check-row"><input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} required /><span>تأیید می‌کنم ۱۸ سال یا بیشتر دارم و <a href="/privacy/" target="_blank" rel="noopener">اطلاعیه حریم خصوصی نسخه آزمایشی داخلی</a> را خوانده‌ام.</span></label>
        <button className="portal-button" type="submit" disabled={!adultConfirmed || pending}>{pending ? "در حال پردازش…" : "ساخت حساب بزرگسال"}</button>
      </fieldset>
      <p className={`form-message ${hasError ? "form-message--error" : "form-message--success"}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}
