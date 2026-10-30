"use client";

/** کنترل درخواست حذف فقط lifecycle را تغییر می‌دهد و درباره نبود purge مصوب شفاف است. */
import { useState } from "react";

export function DeletionControls() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  /* درخواست و لغو از یک تابع با action header مستقل ارسال می‌شوند. */
  async function mutate(method: "POST" | "DELETE") {
    if (pending) return;
    if (method === "POST" && !window.confirm("درخواست حذف حساب ثبت شود؟ حذف نهایی فعلاً انجام نمی‌شود و تا تصویب سیاست نگهداری می‌توانید درخواست را لغو کنید.")) return;
    setPending(true);
    setHasError(false);
    setMessage("در حال ثبت درخواست…");
    try {
      const response = await fetch("/api/account/deletion-request", { method, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Shahedi-Action": method === "POST" ? "account-deletion-request" : "account-deletion-cancel" }, body: "{}" });
      if (!response.ok) {
        setHasError(true);
        setMessage("تغییر وضعیت درخواست انجام نشد؛ ممکن است درخواست بازی برای لغو وجود نداشته باشد.");
        return;
      }
      setMessage(method === "POST" ? "درخواست ثبت شد؛ حذف نهایی تا تصویب سیاست نگهداری انجام نمی‌شود." : "درخواست حذف لغو شد.");
    } catch {
      setHasError(true);
      setMessage("ارتباط امن برقرار نشد؛ دوباره تلاش کنید.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="account-form">
      <p>اکنون فقط درخواست و لغو ثبت می‌شود. زمان حذف و نگهداری audit هنوز تصویب نشده و داده‌ای خودکار پاک نمی‌شود.</p>
      <div className="action-row"><button className="portal-button portal-button--danger" type="button" onClick={() => mutate("POST")} disabled={pending}>درخواست حذف حساب</button><button className="portal-button portal-button--secondary" type="button" onClick={() => mutate("DELETE")} disabled={pending}>لغو درخواست</button></div>
      <p className={`form-message ${hasError ? "form-message--error" : "form-message--success"}`} role="status" aria-live="polite">{message}</p>
    </div>
  );
}
