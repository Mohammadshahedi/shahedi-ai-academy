"use client";

/** فرم bootstrap راز را فقط در همان درخواست نگه می‌دارد و در storage مرورگر ذخیره نمی‌کند. */
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function BootstrapForm() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  /* درخواست bootstrap پس از موفقیت secret را از state پاک و صفحه را تازه می‌کند. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || secret.length < 32) return;
    setPending(true);
    setHasError(false);
    setMessage("در حال بررسی bootstrap…");
    try {
      const response = await fetch("/api/admin/bootstrap", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Shahedi-Action": "admin-bootstrap", "X-Shahedi-Bootstrap-Secret": secret },
        body: "{}",
      });
      const result = await response.json() as { code?: string };
      if (!response.ok) {
        setHasError(true);
        setMessage(result.code === "BOOTSTRAP_NOT_CONFIGURED" ? "راز bootstrap در محیط میزبانی تنظیم نشده است." : "bootstrap انجام نشد؛ وضعیت یا راز واردشده معتبر نیست.");
        return;
      }
      setSecret("");
      setMessage("مدیر نخست ساخته شد؛ در حال انتقال به پنل مدیریت…");
      router.push("/admin/");
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
      <label className="field-row"><span>راز یک‌بارمصرف bootstrap</span><input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} minLength={32} autoComplete="off" required /></label>
      <button className="portal-button" type="submit" disabled={pending || secret.length < 32}>{pending ? "در حال بررسی…" : "ساخت مدیر نخست"}</button>
      <p className={`form-message ${hasError ? "form-message--error" : "form-message--success"}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}
