/** صفحه خصوصی مدیریت revisionهای محتوای یک درس. */
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { getAccountContext } from "@/lib/accounts";
import { listLessonRevisions } from "@/lib/phase3c-lms";
import { LessonRevisionConsole } from "./revision-console";

export const dynamic = "force-dynamic";

export default async function LessonRevisionsPage({ params, searchParams }: { params: Promise<{ lessonId: string }>; searchParams: Promise<{ offset?: string }> }) {
  const { lessonId } = await params;
  const user = await requireChatGPTUser(`/admin/lms/lessons/${lessonId}/revisions/`);
  const actor = await getAccountContext(user.userId);
  if (!actor) redirect("/account/");
  const rawOffset = (await searchParams).offset ?? "0";
  const offset = /^\d{1,15}$/u.test(rawOffset) && Number.isSafeInteger(Number(rawOffset)) ? Number(rawOffset) : 0;
  const result = await listLessonRevisions(actor, lessonId, offset);
  if (!result.ok) return <PortalShell signedIn showAdmin showLms><section className="portal-card" role="alert"><h1>دسترسی رد شد</h1><p>حساب فعال، نقش مدیر و permission صریح مدیریت دوره برای مشاهده revisionها لازم است.</p></section></PortalShell>;
  return <PortalShell signedIn showAdmin showLms>
    <section className="portal-hero"><p className="portal-kicker">۳C.۳ — انتشار محتوا</p><h1 className="portal-title">نسخه‌های محتوای درس</h1><p className="portal-lead">ساخت revision محتوای دانشجو را تغییر نمی‌دهد؛ انتشار یا بازگردانی فقط با تأیید صریح و نسخه جاری درس انجام می‌شود.</p></section>
    <LessonRevisionConsole data={result.value} offset={offset} />
  </PortalShell>;
}
