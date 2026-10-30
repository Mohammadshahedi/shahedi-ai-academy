/** نمای مدرس فقط کلاس‌های assignment فعال را نشان می‌دهد و عمداً roster یا ایمیل ندارد. */
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { getAccountContext } from "@/lib/accounts";
import { listInstructorClasses } from "@/lib/phase3c-lms";
export const dynamic = "force-dynamic";
export default async function TeachPage({ searchParams }: { searchParams: Promise<{ offset?: string }> }) {
  const user = await requireChatGPTUser("/teach/"); const account = await getAccountContext(user.userId); if (!account) redirect("/account/");
  const rawOffset = (await searchParams).offset ?? "0"; const parsedOffset = Number(rawOffset); const offset = /^\d{1,15}$/u.test(rawOffset) && Number.isSafeInteger(parsedOffset) ? parsedOffset : 0;
  const result = await listInstructorClasses(account, offset);
  if (!result.ok) return <PortalShell signedIn><section className="portal-hero"><p className="portal-kicker">فضای مدرس</p><h1 className="portal-title">نقش مدرس فعال لازم است</h1><p className="portal-lead">این مسیر فقط برای حساب فعال دارای نقش <bdi dir="ltr">INSTRUCTOR</bdi> است.</p></section></PortalShell>;
  return <PortalShell signedIn showTeaching><section className="portal-hero"><p className="portal-kicker">۳C.۱</p><h1 className="portal-title">کلاس‌های تخصیص‌یافته</h1><p className="portal-lead">این نمای فقط‌خواندنی است و هیچ roster، ایمیل، نمره یا داده دانشجو نمایش نمی‌دهد.</p></section><section className="portal-grid">{result.value.items.length ? result.value.items.map((item) => <article className="portal-card" key={item.classId}><p className="portal-kicker">{item.courseTitle}</p><h2>{item.title}</h2><div className="status-row"><span className="status-chip">تخصیص فعال</span></div></article>) : <article className="portal-card portal-card--wide"><h2>کلاس فعالی تخصیص نیافته است</h2><p>فقط assignment فعال روی کلاس و دوره فعال در این صفحه ظاهر می‌شود.</p></article>}</section><nav className="pagination" aria-label="صفحه‌بندی کلاس‌های مدرس">{offset > 0 ? <Link className="portal-button portal-button--secondary" href={`/teach/?offset=${Math.max(0, offset - 25)}`}>صفحه قبل</Link> : null}{result.value.nextOffset !== null ? <Link className="portal-button portal-button--secondary" href={`/teach/?offset=${result.value.nextOffset}`}>صفحه بعد</Link> : null}</nav></PortalShell>;
}
