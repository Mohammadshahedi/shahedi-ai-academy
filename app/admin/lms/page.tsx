/** پنل LMS برای مدیر دارای حداقل یک permission صریح LMS؛ هر بخش permission مستقل خود را دارد. */
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalShell } from "@/components/portal-shell";
import { getAccountContext, hasPermission } from "@/lib/accounts";
import { getAdminLmsOverview } from "@/lib/phase3c-lms";
import { LmsAdminConsole } from "./lms-admin-console";
export const dynamic = "force-dynamic";

export default async function LmsAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireChatGPTUser("/admin/lms/");
  const account = await getAccountContext(user.userId); if (!account) redirect("/account/");
  const params = await searchParams;
  const offset = (name: string) => { const value = params[name]; const raw = typeof value === "string" ? value : "0"; const parsed = Number(raw); return /^\d{1,15}$/u.test(raw) && Number.isSafeInteger(parsed) ? parsed : 0; };
  const offsets = { course: offset("courseOffset"), class: offset("classOffset"), lesson: offset("lessonOffset"), assignment: offset("assignmentOffset"), enrollment: offset("enrollmentOffset") };
  const result = await getAdminLmsOverview(account, offsets);
  if (!result.ok) return <PortalShell signedIn showAdmin><section className="portal-hero"><p className="portal-kicker">دسترسی LMS</p><h1 className="portal-title">مجوز مدیریت LMS وجود ندارد</h1><p className="portal-lead">نقش ADMIN به‌تنهایی کافی نیست؛ این صفحه حداقل یکی از permissionهای صریح مدیریت دوره، کلاس، تخصیص مدرس یا ثبت‌نام را می‌خواهد.</p></section></PortalShell>;
  return (
    <PortalShell signedIn showAdmin showLms>
      <section className="portal-hero"><p className="portal-kicker">۳C.۴ — عملیات فراداده</p><h1 className="portal-title">مدیریت نسخه‌دار LMS</h1><p className="portal-lead">عنوان دوره و کلاس و جایگاه درس از پنل با نسخه جاری اصلاح می‌شوند؛ عنوان و متن درس همچنان فقط از مسیر revision تغییر می‌کنند. پرداخت، ظرفیت، تاریخ، تمرین، نمره و داده کودک در این فاز وجود ندارند.</p></section>
      <LmsAdminConsole overview={result.value} permissions={{ courses: hasPermission(account, "courses.manage"), classes: hasPermission(account, "classes.manage"), assignments: hasPermission(account, "classes.assign_instructor"), enrollments: hasPermission(account, "enrollments.manage") }} offsets={offsets} />
    </PortalShell>
  );
}
