import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearnerCoursesPage } from "@/server/queries/account";
import { LearnerCourseList, LearnerEmptyState, LearnerPageHeader } from "@/components/student/LearnerPages";

export const dynamic = "force-dynamic";

export default async function LearnerCoursesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ etat?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const filter = (await searchParams).etat === "terminees" ? "completed" : "active";
  const rows = await getLearnerCoursesPage(session.user.id);
  const courses = rows.map(({ enrollment, course }) => ({ id: enrollment.id, slug: course.slug, title: ar ? course.titleAr : course.titleFr, category: course.category, progress: enrollment.progressPercent, status: enrollment.status })).filter((course) => filter === "completed" ? course.progress >= 100 : course.progress < 100);

  return <div className="learner-page"><LearnerPageHeader title={ar ? "دوراتي" : "Mes formations"} description={ar ? "تابع مساراتك النشطة وارجع إلى الدورات التي أكملتها." : "Continuez vos parcours actifs et retrouvez les formations terminées."} action={<Link className="student-secondary-action" href={`/${locale}/formations`}>{ar ? "استكشف الكتالوج" : "Explorer le catalogue"}</Link>} />
    <nav className="learner-tabs" aria-label={ar ? "تصفية الدورات" : "Filtrer les formations"}><Link aria-current={filter === "active" ? "page" : undefined} className={filter === "active" ? "is-active" : undefined} href={`/${locale}/dashboard/formations`}>{ar ? "قيد التقدم" : "En cours"}</Link><Link aria-current={filter === "completed" ? "page" : undefined} className={filter === "completed" ? "is-active" : undefined} href={`/${locale}/dashboard/formations?etat=terminees`}>{ar ? "مكتملة" : "Terminées"}</Link></nav>
    {courses.length ? <LearnerCourseList locale={locale} courses={courses} /> : <LearnerEmptyState icon="graduation" title={filter === "completed" ? (ar ? "لم تكمل أي دورة بعد" : "Aucune formation terminée") : (ar ? "لا توجد دورة نشطة" : "Aucune formation en cours")} body={ar ? "استكشف الكتالوج واختر المسار الذي يناسب أهدافك." : "Explorez le catalogue et choisissez un parcours adapté à vos objectifs."} action={{ href: `/${locale}/formations`, label: ar ? "استكشف الدورات" : "Explorer les formations" }} />}
  </div>;
}
