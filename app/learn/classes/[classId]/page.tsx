/** نمایش text-only درس‌ها فقط پس از کنترل مالکیت enrollment در سرور. */
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { getAccountContext } from "@/lib/accounts";
import { getStudentClass } from "@/lib/phase3c-lms";
export const dynamic = "force-dynamic";
export default async function StudentClassPage({ params, searchParams }: { params: Promise<{ classId: string }>; searchParams: Promise<{ lessonOffset?: string }> }) {
  const { classId } = await params; const user = await requireChatGPTUser(`/learn/classes/${classId}/`); const account = await getAccountContext(user.userId); if (!account) redirect("/account/");
  const rawOffset = (await searchParams).lessonOffset ?? "0"; const parsedOffset = Number(rawOffset); const lessonOffset = /^\d{1,15}$/u.test(rawOffset) && Number.isSafeInteger(parsedOffset) ? parsedOffset : 0;
  const result = await getStudentClass(account, classId, lessonOffset);
  if (!result.ok) return <PortalShell signedIn showLearning><section className="portal-hero"><p className="portal-kicker">دسترسی محدود</p><h1 className="portal-title">این کلاس در دسترس نیست</h1><p className="portal-lead">شناسه کلاس، enrollment یا وضعیت دوره و کلاس اجازه نمایش نمی‌دهد.</p></section></PortalShell>;
  return <PortalShell signedIn showLearning><section className="portal-hero"><p className="portal-kicker">{result.value.classInfo.courseTitle}</p><h1 className="portal-title">{result.value.classInfo.title}</h1><p className="portal-lead">درس‌های منتشرشده به‌صورت متن ساده نمایش داده می‌شوند.</p></section><section className="lesson-stack">{result.value.lessons.length ? result.value.lessons.map((lesson) => <article className="portal-card lesson-card" key={lesson.lessonId}><div className="status-row"><span className="status-chip">درس {lesson.position.toLocaleString("fa-IR")}</span></div><h2>{lesson.title}</h2><div className="lesson-body">{lesson.bodyText}</div></article>) : <article className="portal-card"><h2>درسی در این صفحه وجود ندارد</h2><p>فقط درس با وضعیت منتشرشده قابل مشاهده است.</p></article>}</section><nav className="pagination" aria-label="صفحه‌بندی درس‌ها">{lessonOffset > 0 ? <a className="portal-button portal-button--secondary" href={`/learn/classes/${classId}/?lessonOffset=${Math.max(0, lessonOffset - 25)}`}>صفحه قبل</a> : null}{result.value.nextLessonOffset !== null ? <a className="portal-button portal-button--secondary" href={`/learn/classes/${classId}/?lessonOffset=${result.value.nextLessonOffset}`}>صفحه بعد</a> : null}</nav></PortalShell>;
}
