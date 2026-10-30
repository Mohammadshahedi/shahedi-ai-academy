/** نمای خصوصی تاریخچه چرخه عمر؛ فقط UUID داخلی عامل و بدون متن درس، ایمیل، نام یا شناسه بیرونی. */
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { getAccountContext } from "@/lib/accounts";
import { isLmsId, LIFECYCLE_RESOURCE_TYPES, listLifecycleEvents, type LifecycleResourceType } from "@/lib/phase3c-lms";
export const dynamic = "force-dynamic";

export default async function LmsLifecyclePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireChatGPTUser("/admin/lms/lifecycle/"); const account = await getAccountContext(user.userId); if (!account) redirect("/account/");
  const params = await searchParams; const rawType = typeof params.resourceType === "string" ? params.resourceType : ""; const resourceId = typeof params.resourceId === "string" ? params.resourceId : "";
  const resourceType = LIFECYCLE_RESOURCE_TYPES.includes(rawType as LifecycleResourceType) ? rawType as LifecycleResourceType : null;
  const rawOffset = typeof params.offset === "string" ? params.offset : "0"; const offset = /^\d{1,15}$/u.test(rawOffset) && Number.isSafeInteger(Number(rawOffset)) ? Number(rawOffset) : 0;
  const result = resourceType && isLmsId(resourceId) ? await listLifecycleEvents(account, resourceType, resourceId, offset) : null;
  const href = (next: number) => `/admin/lms/lifecycle/?resourceType=${encodeURIComponent(resourceType ?? "")}&resourceId=${encodeURIComponent(resourceId)}&offset=${next}`;
  return <PortalShell signedIn showAdmin showLms>
    <section className="portal-hero"><p className="portal-kicker">۳C.۲ — تاریخچه</p><h1 className="portal-title">چرخه عمر منابع LMS</h1><p className="portal-lead">این نمای فقط‌خواندنی وضعیت، دلیل بسته، نسخه، زمان و UUID کوتاه عامل داخلی را نشان می‌دهد؛ متن درس، نام، ایمیل و شناسه هویت بیرونی در آن وجود ندارد.</p></section>
    <section className="portal-card"><form className="account-form" method="get"><label className="field-row"><span>نوع منبع</span><select name="resourceType" defaultValue={resourceType ?? "COURSE"}>{LIFECYCLE_RESOURCE_TYPES.map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label className="field-row"><span>شناسه داخلی منبع</span><input dir="ltr" name="resourceId" defaultValue={resourceId} required pattern="[0-9a-fA-F-]{36}" /></label><button className="portal-button">نمایش تاریخچه</button></form></section>
    {result && !result.ok ? <section className="portal-card" role="alert"><h2>دسترسی رد شد</h2><p>permission متناظر با این نوع منبع وجود ندارد یا شناسه معتبر نیست.</p></section> : null}
    {result?.ok ? <section className="admin-stack" aria-label="رخدادهای چرخه عمر"><h2>رخدادها</h2>{result.value.items.length ? result.value.items.map((event) => <article className="portal-card" key={event.eventId}><div className="admin-account__header"><div><h3>{event.fromStatus ?? "ایجاد"} ← {event.toStatus}</h3><small>دلیل: <bdi dir="ltr">{event.reasonCode}</bdi><br />عامل داخلی: <bdi dir="ltr">{event.actorAccountId.slice(0, 8)}…</bdi></small></div><span className="status-chip">نسخه {event.resourceVersion}</span></div><p><time dateTime={event.occurredAt}>{event.occurredAt}</time></p></article>) : <article className="portal-card"><p>برای این منبع رخدادی ثبت نشده است.</p></article>}<nav className="pagination" aria-label="صفحه‌بندی تاریخچه">{offset > 0 ? <a className="portal-button portal-button--secondary" href={href(Math.max(0, offset - 25))}>صفحه قبل</a> : null}{result.value.nextOffset !== null ? <a className="portal-button portal-button--secondary" href={href(result.value.nextOffset)}>صفحه بعد</a> : null}</nav></section> : null}
  </PortalShell>;
}
