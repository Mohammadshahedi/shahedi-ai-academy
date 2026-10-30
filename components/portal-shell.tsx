/** پوسته مشترک حساب و داشبورد با ناوبری کمینه و قابل‌فهم. */
import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import Link from "next/link";
export function PortalShell({ children, signedIn = false, showAdmin = false, showMinorReadiness = false, showLms = false, showLearning = false, showTeaching = false }: { children: React.ReactNode; signedIn?: boolean; showAdmin?: boolean; showMinorReadiness?: boolean; showLms?: boolean; showLearning?: boolean; showTeaching?: boolean }) {
  return (
    <>
      <header className="portal-header"><nav className="portal-nav" aria-label="ناوبری حساب"><Link className="portal-brand" href="/"><span className="portal-brand__mark" aria-hidden="true">ش</span><span>آکادمی شاهدی</span></Link><div className="portal-links"><Link href="/courses/">دوره‌ها</Link><Link href="/account/">حساب</Link>{signedIn ? <Link href="/dashboard/">داشبورد</Link> : null}{showLearning ? <Link href="/learn/">یادگیری</Link> : null}{showTeaching ? <Link href="/teach/">تدریس</Link> : null}{showAdmin ? <Link href="/admin/">مدیریت</Link> : null}{showLms ? <Link href="/admin/lms/">مدیریت LMS</Link> : null}{showMinorReadiness ? <Link href="/admin/minor-readiness/">آمادگی ۳B.۳</Link> : null}{signedIn ? <Link href="/staff-invitation/">پذیرش دعوت</Link> : null}{signedIn ? <a href={chatGPTSignOutPath("/")} target="_top">خروج امن</a> : null}</div></nav></header>
      <main className="portal-main">{children}</main>
    </>
  );
}
