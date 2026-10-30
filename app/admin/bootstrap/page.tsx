/** صفحه bootstrap فقط برای حساب بزرگسال فعال و پیش از ساخت مدیر نخست استفاده می‌شود. */
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { getAccountContext } from "@/lib/accounts";
import { BootstrapForm } from "./bootstrap-form";
export const dynamic = "force-dynamic";

export default async function AdminBootstrapPage() {
  const user = await requireChatGPTUser("/admin/bootstrap/");
  const account = await getAccountContext(user.userId);
  if (!account) redirect("/account/");
  if (account.status !== "ACTIVE") redirect("/account/");
  if (account.roles.includes("ADMIN")) redirect("/admin/");
  return (
    <PortalShell signedIn>
      <section className="portal-hero"><p className="portal-kicker">راه‌اندازی یک‌بارمصرف</p><h1 className="portal-title">ساخت مدیر نخست</h1><p className="portal-lead">این مسیر فقط یک‌بار و با راز تنظیم‌شده در میزبانی کار می‌کند. راز در مرورگر یا پایگاه داده ذخیره نمی‌شود.</p></section>
      <article className="portal-card"><BootstrapForm /></article>
    </PortalShell>
  );
}
