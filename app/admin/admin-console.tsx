"use client";

/** پنل مدیریت فاز ۳B.2؛ همه تصمیم‌های دسترسی دوباره در سرور اجرا می‌شوند. */
import { FormEvent, useState } from "react";
import type { ManagedAccount, ManagedInvitation } from "@/lib/phase3b-admin";
import { ACCOUNT_PERMISSIONS, ACCOUNT_ROLES, STAFF_ROLES, type AccountPermission, type AccountRole, type StaffRole } from "@/lib/phase3b-policy";

const roleLabels: Record<AccountRole, string> = { ADULT_STUDENT: "دانشجوی بزرگسال", GUARDIAN: "والد/سرپرست", INSTRUCTOR: "مدرس", ADMIN: "مدیر" };
const permissionLabels: Record<AccountPermission, string> = {
  "accounts.read": "مشاهده حساب‌ها",
  "accounts.status.manage": "مدیریت وضعیت حساب",
  "accounts.roles.manage": "مدیریت نقش و مجوز",
  "staff_invitations.manage": "مدیریت دعوت کارکنان",
  "retention.manage": "مدیریت سیاست نگهداری",
  "guardian_links.review": "بازبینی پیوند سرپرستی (قفل)",
  "courses.manage": "مدیریت دوره و درس بزرگسالان",
  "classes.manage": "مدیریت کلاس‌های بزرگسالان",
  "classes.assign_instructor": "تخصیص مدرس به کلاس",
  "enrollments.manage": "مدیریت ثبت‌نام بزرگسالان",
};

export function AdminConsole({ initialAccounts, initialInvitations, offset, nextOffset, invitationOffset, nextInvitationOffset }: { initialAccounts: ManagedAccount[]; initialInvitations: ManagedInvitation[]; offset: number; nextOffset: number | null; invitationOffset: number; nextInvitationOffset: number | null }) {
  const [email, setEmail] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole>("INSTRUCTOR");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [invitation, setInvitation] = useState<{ invitationId: string; token: string; expiresAt: string } | null>(null);

  /* پاسخ خطای عمومی از افشای جزئیات مجوز یا وضعیت داخلی جلوگیری می‌کند. */
  async function send(path: string, method: "POST" | "PATCH" | "DELETE", action: string, body: unknown) {
    const response = await fetch(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Shahedi-Action": action }, body: JSON.stringify(body) });
    const result = await response.json() as { code?: string; invitation?: { invitationId: string; token: string; expiresAt: string } };
    if (!response.ok) throw new Error(result.code ?? "REQUEST_FAILED");
    return result;
  }

  /* دعوت token را یک‌بار نمایش می‌دهد و ارسال واقعی ایمیل را ادعا نمی‌کند. */
  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setHasError(false); setMessage("در حال ساخت دعوت…"); setInvitation(null);
    try {
      const result = await send("/api/admin/staff-invitations", "POST", "admin-staff-invitation-create", { email, role: staffRole });
      if (result.invitation) setInvitation(result.invitation);
      setEmail("");
      setMessage("دعوت ساخته شد. توکن را فقط از کانال امن در اختیار فرد دعوت‌شده بگذارید.");
    } catch {
      setHasError(true); setMessage("ساخت دعوت مجاز نبود یا ورودی معتبر نیست.");
    } finally { setPending(false); }
  }

  /* عملیات حساب پس از موفقیت صفحه را تازه می‌کند تا state معتبر سرور جایگزین شود. */
  async function accountAction(path: string, method: "POST" | "PATCH" | "DELETE", action: string, body: unknown, success: string, confirmation: string) {
    if (pending) return;
    if (!window.confirm(confirmation)) return;
    setPending(true); setHasError(false); setMessage("در حال ثبت تغییر…");
    try {
      await send(path, method, action, body);
      setMessage(success);
      window.location.reload();
    } catch {
      setHasError(true); setMessage("تغییر رد شد؛ مجوز، وضعیت هدف یا حفاظت آخرین مدیر اجازه این عملیات را نمی‌دهد.");
      setPending(false);
    }
  }

  return (
    <div className="admin-stack">
      <article className="portal-card">
        <h2>دعوت مدرس یا مدیر</h2>
        <form className="admin-form" onSubmit={createInvitation}>
          <label className="field-row"><span>ایمیل تأییدشده فرد</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
          <label className="field-row"><span>نقش دعوت</span><select value={staffRole} onChange={(event) => setStaffRole(event.target.value as StaffRole)}>{STAFF_ROLES.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
          <button className="portal-button" type="submit" disabled={pending}>ساخت دعوت ۲۴ ساعته</button>
        </form>
        {invitation ? <div className="secret-output" role="status"><strong>توکن یک‌بارنمایش</strong><code dir="ltr">{invitation.token}</code><small>شناسه دعوت: <bdi dir="ltr">{invitation.invitationId}</bdi> — انقضا: {new Date(invitation.expiresAt).toLocaleString("fa-IR")}</small></div> : null}
      </article>
      <p className={`form-message ${hasError ? "form-message--error" : "form-message--success"}`} role="status" aria-live="polite">{message}</p>
      <section className="portal-card">
        <h2>دعوت‌های باز</h2>
        {initialInvitations.length ? <div className="pending-invitations">{initialInvitations.map((item) => <div className="pending-invitation" key={item.invitationId}><div><strong>{roleLabels[item.role]}</strong><small><bdi dir="ltr">{item.invitationId}</bdi> — انقضا: {new Date(item.expiresAt).toLocaleString("fa-IR")}</small></div><button className="portal-button portal-button--danger" type="button" disabled={pending} onClick={() => accountAction(`/api/admin/staff-invitations/${item.invitationId}/revoke`, "POST", "admin-staff-invitation-revoke", {}, "دعوت لغو شد.", "این دعوت تک‌مصرف لغو شود؟")}>لغو دعوت</button></div>)}</div> : <p>دعوت بازی وجود ندارد.</p>}
        <nav className="pagination" aria-label="صفحه‌بندی دعوت‌ها">{invitationOffset > 0 ? <a className="portal-button portal-button--secondary" href={`/admin/?offset=${offset}&invitationOffset=${Math.max(0, invitationOffset - 25)}`}>دعوت‌های قبل</a> : null}{nextInvitationOffset !== null ? <a className="portal-button portal-button--secondary" href={`/admin/?offset=${offset}&invitationOffset=${nextInvitationOffset}`}>دعوت‌های بعد</a> : null}</nav>
      </section>
      <section className="admin-accounts" aria-label="مدیریت حساب‌ها">
        {initialAccounts.map((account) => <article className="portal-card admin-account" key={account.accountId}>
          <div className="admin-account__header"><div><h2>حساب <bdi dir="ltr">{account.accountId.slice(0, 8)}…</bdi></h2><p>{account.category === "STAFF_INVITED" ? "کارمند دعوت‌شده" : "حساب بزرگسال"} — {account.status}</p></div><div className="status-row">{account.roles.map((role) => <span className="status-chip" key={role}>{roleLabels[role]}</span>)}</div></div>
          <div className="admin-controls">
            <button className="portal-button portal-button--secondary" type="button" disabled={pending} onClick={() => accountAction(`/api/admin/accounts/${account.accountId}/status`, "PATCH", "admin-account-status", { status: account.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED" }, "وضعیت حساب تغییر کرد.", account.status === "SUSPENDED" ? "این حساب دوباره فعال شود؟" : "این حساب و همه عملیات حساس آن تعلیق شود؟")}>{account.status === "SUSPENDED" ? "فعال‌سازی" : "تعلیق"}</button>
            <label className="field-row"><span>افزودن نقش</span><select defaultValue="" onChange={(event) => { const role = event.target.value; if (role) accountAction(`/api/admin/accounts/${account.accountId}/roles`, "POST", "admin-account-role-add", { role }, "نقش افزوده شد.", `نقش ${role} به این حساب افزوده شود؟`); }}><option value="">انتخاب کنید</option>{ACCOUNT_ROLES.filter((role) => !account.roles.includes(role)).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
            <label className="field-row"><span>لغو نقش</span><select defaultValue="" onChange={(event) => { const role = event.target.value; if (role) accountAction(`/api/admin/accounts/${account.accountId}/roles/${role}`, "DELETE", "admin-account-role-revoke", {}, "نقش لغو شد.", `نقش ${role} لغو شود؟`); }}><option value="">انتخاب کنید</option>{account.roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
            <label className="field-row"><span>افزودن مجوز</span><select defaultValue="" onChange={(event) => { const permission = event.target.value; if (permission) accountAction(`/api/admin/accounts/${account.accountId}/permissions`, "POST", "admin-account-permission-add", { permission }, "مجوز افزوده شد.", `مجوز ${permission} افزوده شود؟`); }}><option value="">انتخاب کنید</option>{ACCOUNT_PERMISSIONS.filter((permission) => !account.permissions.includes(permission)).map((permission) => <option key={permission} value={permission}>{permissionLabels[permission]}</option>)}</select></label>
            <label className="field-row"><span>لغو مجوز</span><select defaultValue="" onChange={(event) => { const permission = event.target.value; if (permission) accountAction(`/api/admin/accounts/${account.accountId}/permissions/${encodeURIComponent(permission)}`, "DELETE", "admin-account-permission-revoke", {}, "مجوز لغو شد.", `مجوز ${permission} لغو شود؟`); }}><option value="">انتخاب کنید</option>{account.permissions.map((permission) => <option key={permission} value={permission}>{permissionLabels[permission]}</option>)}</select></label>
          </div>
        </article>)}
      </section>
      <nav className="pagination" aria-label="صفحه‌بندی حساب‌ها">{offset > 0 ? <a className="portal-button portal-button--secondary" href={`/admin/?offset=${Math.max(0, offset - 25)}&invitationOffset=${invitationOffset}`}>صفحه قبل</a> : null}{nextOffset !== null ? <a className="portal-button portal-button--secondary" href={`/admin/?offset=${nextOffset}&invitationOffset=${invitationOffset}`}>صفحه بعد</a> : null}</nav>
    </div>
  );
}
