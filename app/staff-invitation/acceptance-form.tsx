"use client";

/** فرم پذیرش، token را فقط برای درخواست جاری نگه می‌دارد و با ایمیل هویت Sites تطبیق می‌دهد. */
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_PRIVACY_NOTICE_VERSION } from "@/lib/phase3b-policy";

export function StaffInvitationAcceptanceForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  /* پاسخ موفق با ناوبری کامل، نقش و permission تازه را از سرور بازخوانی می‌کند. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || token.length < 40 || !adultConfirmed) return;
    setPending(true);
    setHasError(false);
    setMessage("در حال اعتبارسنجی دعوت…");
    try {
      const response = await fetch("/api/staff-invitations/accept", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Shahedi-Action": "staff-invitation-accept" },
        body: JSON.stringify({ token, adultConfirmed: true, privacyNoticeVersion: ACCOUNT_PRIVACY_NOTICE_VERSION }),
      });
      if (!response.ok) {
        setHasError(true);
        setMessage("دعوت معتبر، فعال یا منطبق با ایمیل این حساب نیست.");
        return;
      }
      setToken("");
      setMessage("دعوت پذیرفته شد؛ در حال ورود به داشبورد…");
      router.push("/dashboard/");
      router.refresh();
    } catch {
      setHasError(true);
      setMessage("ارتباط امن برقرار نشد؛ دوباره تلاش کنید.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <label className="field-row"><span>توکن دعوت</span><input value={token} onChange={(event) => setToken(event.target.value.trim())} minLength={40} maxLength={128} autoComplete="off" required /></label>
      <label className="check-row"><input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} required /><span>تأیید می‌کنم ۱۸ سال یا بیشتر دارم و اطلاعیه حریم خصوصی جاری را خوانده‌ام.</span></label>
      <button className="portal-button" type="submit" disabled={pending || token.length < 40 || !adultConfirmed}>{pending ? "در حال بررسی…" : "پذیرش دعوت"}</button>
      <p className={`form-message ${hasError ? "form-message--error" : "form-message--success"}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}
