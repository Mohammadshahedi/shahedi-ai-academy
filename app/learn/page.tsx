/** فضای یادگیری فقط کلاس‌های ثبت‌نام فعال دانشجوی بزرگسال را نشان می‌دهد. */
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { getAccountContext } from "@/lib/accounts";
import { listStudentClasses } from "@/lib/phase3c-lms";
export const dynamic = "force-dynamic";
export default async function LearnPage({ searchParams }: { searchParams: Promise<{ offset?: string }> }) {
  const user = await requireChatGPTUser("/learn/"); const account = await getAccountContext(user.userId); if (!account) redirect("/account/");
  const rawOffset = (await searchParams).offset ?? "0"; const parsedOffset = Number(rawOffset); const offset = /^\d{1,15}$/u.test(rawOffset) && Number.isSafeInteger(parsedOffset) ? parsedOffset : 0;
  const result = await listStudentClasses(account, offset);
  if (!result.ok) return <PortalShell signedIn><section className="portal-hero"><p className="portal-kicker">فضای یادگیری</p><h1 className="portal-title">دسترسی دانشجوی بزرگسال لازم است</h1><p className="portal-lead">این مسیر فقط برای حساب فعال دارای نقش <bdi dir="ltr">ADULT_STUDENT</bdi> است.</p></section></PortalShell>;
  return <PortalShell signedIn showLearning><section className="portal-hero"><p className="portal-kicker">۳C.۱</p><h1 className="portal-title">کلاس‌های من</h1><p className="portal-lead">فقط ثبت‌نام‌های فعال در دوره و کلاس فعال نمایش داده می‌شوند.</p></section><section className="portal-grid">{result.value.items.length ? result.value.items.map((item) => <article className="portal-card" key={item.classId}><p className="portal-kicker">{item.courseTitle}</p><h2>{item.title}</h2><Link className="portal-button" href={`/learn/classes/${item.classId}/`}>مشاهده درس‌ها</Link></article>) : <article className="portal-card portal-card--wide"><h2>کلاس فعالی ندارید</h2><p>ثبت‌نام عمومی یا self-enrollment در این فاز وجود ندارد. مدیر مجاز باید حساب بزرگسال را به کلاس فعال متصل کند.</p></article>}</section><nav className="pagination" aria-label="صفحه‌بندی کلاس‌های دانشجو">{offset > 0 ? <Link className="portal-button portal-button--secondary" href={`/learn/?offset=${Math.max(0, offset - 25)}`}>صفحه قبل</Link> : null}{result.value.nextOffset !== null ? <Link className="portal-button portal-button--secondary" href={`/learn/?offset=${result.value.nextOffset}`}>صفحه بعد</Link> : null}</nav></PortalShell>;
}
