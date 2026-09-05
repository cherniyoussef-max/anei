import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, X, BookOpen } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearnerCoursesPage } from "@/server/queries/account";
import { LearnerCourseList, LearnerEmptyState, LearnerPageHeader } from "@/components/student/LearnerPages";

export const dynamic = "force-dynamic";

type Filter = "toutes" | "encours" | "terminees";

export default async function LearnerCoursesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ etat?: string; q?: string; categorie?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const query = await searchParams;
  const filter: Filter = query.etat === "terminees" ? "terminees" : query.etat === "encours" ? "encours" : "toutes";
  const q = (query.q ?? "").trim().toLowerCase().slice(0, 80);
  const category = (query.categorie ?? "").trim().slice(0, 80);

  const rows = await getLearnerCoursesPage(session.user.id);
  const allCourses = rows.map(({ enrollment, course }) => ({ id: enrollment.id, slug: course.slug, title: ar ? course.titleAr : course.titleFr, category: course.category, progress: enrollment.progressPercent, status: enrollment.status }));
  const categories = Array.from(new Set(allCourses.map((course) => course.category))).sort();

  const byState = allCourses.filter((course) => filter === "terminees" ? course.progress >= 100 : filter === "encours" ? course.progress < 100 : true);
  const byCategory = category ? byState.filter((course) => course.category === category) : byState;
  const courses = q ? byCategory.filter((course) => course.title.toLowerCase().includes(q)) : byCategory;

  const countFor = (state: Filter) => allCourses.filter((course) => state === "terminees" ? course.progress >= 100 : state === "encours" ? course.progress < 100 : true).length;

  function tabHref(state: Filter) {
    const params2 = new URLSearchParams();
    if (state !== "toutes") params2.set("etat", state);
    if (q) params2.set("q", query.q ?? "");
    if (category) params2.set("categorie", category);
    const search = params2.toString();
    return `/${locale}/dashboard/formations${search ? `?${search}` : ""}`;
  }

  function categoryHref(next: string | null) {
    const params2 = new URLSearchParams();
    if (filter !== "toutes") params2.set("etat", filter);
    if (q) params2.set("q", query.q ?? "");
    if (next) params2.set("categorie", next);
    const search = params2.toString();
    return `/${locale}/dashboard/formations${search ? `?${search}` : ""}`;
  }

  return <div className="learner-page space-y-5">
    <LearnerPageHeader
      title={ar ? "دوراتي" : "Mes formations"}
      description={ar ? "تابع مساراتك النشطة وارجع إلى الدورات التي أكملتها." : "Continuez vos parcours actifs et retrouvez les formations terminées."}
      action={<Link className="student-secondary-action" href={`/${locale}/formations`}>{ar ? "استكشف الكتالوج" : "Explorer le catalogue"}</Link>}
    />

    <form className="flex items-center gap-2" method="get">
      {filter !== "toutes" ? <input type="hidden" name="etat" value={filter} /> : null}
      {category ? <input type="hidden" name="categorie" value={category} /> : null}
      <div className="relative flex-1 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a39c8a]" size={16} strokeWidth={1.75} />
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder={ar ? "ابحث عن دورة..." : "Rechercher une formation..."}
          className="w-full rounded-xl border border-[#E7E0D3] py-2.5 ps-9 pe-9 text-sm text-[#082D55] transition-all duration-200 ease-in-out focus:border-[#C9913F] focus:outline-none"
        />
        {q ? <Link href={categoryHref(category || null)} aria-label={ar ? "مسح البحث" : "Effacer la recherche"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a39c8a] hover:text-[#082D55]"><X size={15} strokeWidth={1.75} /></Link> : null}
      </div>
      <button type="submit" className="rounded-xl border border-[#E7E0D3] px-3 py-2.5 text-sm font-medium text-[#082D55] transition-all duration-200 ease-in-out hover:border-[#C9913F]">{ar ? "بحث" : "Rechercher"}</button>
    </form>

    <div className="flex flex-wrap items-center gap-3">
      <nav className="inline-flex w-fit gap-1 rounded-xl border border-[#E7E0D3] bg-white p-1" aria-label={ar ? "تصفية الدورات" : "Filtrer les formations"}>
        {([
          ["toutes", ar ? "الكل" : "Toutes"],
          ["encours", ar ? "قيد التقدم" : "En cours"],
          ["terminees", ar ? "مكتملة" : "Terminées"],
        ] as [Filter, string][]).map(([state, label]) => (
          <Link
            key={state}
            href={tabHref(state)}
            aria-current={filter === state ? "page" : undefined}
            className={filter === state
              ? "rounded-lg bg-[#082D55] px-3.5 py-2 text-sm font-semibold text-white"
              : "rounded-lg px-3.5 py-2 text-sm font-medium text-[#7a7261] transition-all duration-200 ease-in-out hover:text-[#082D55]"}
          >
            {label} ({countFor(state)})
          </Link>
        ))}
      </nav>

      {categories.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={categoryHref(null)}
            className={!category
              ? "rounded-full bg-[#F6F1E7] border border-[#e9d3ab] px-3 py-1.5 text-xs font-semibold text-[#a9752f]"
              : "rounded-full border border-[#E7E0D3] px-3 py-1.5 text-xs font-medium text-[#7a7261] transition-all duration-200 ease-in-out hover:border-[#C9913F]"}
          >
            {ar ? "كل الفئات" : "Toutes catégories"}
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={categoryHref(cat)}
              className={category === cat
                ? "rounded-full bg-[#F6F1E7] border border-[#e9d3ab] px-3 py-1.5 text-xs font-semibold text-[#a9752f]"
                : "rounded-full border border-[#E7E0D3] px-3 py-1.5 text-xs font-medium text-[#7a7261] transition-all duration-200 ease-in-out hover:border-[#C9913F]"}
            >
              {cat.replaceAll("-", " ")}
            </Link>
          ))}
        </div>
      ) : null}
    </div>

    {courses.length ? <LearnerCourseList locale={locale} courses={courses} /> : <LearnerEmptyState
      icon={BookOpen}
      title={q || category ? (ar ? "لا توجد نتائج" : "Aucun résultat") : filter === "terminees" ? (ar ? "لم تكمل أي دورة بعد" : "Vous n’avez pas encore terminé de formation") : filter === "encours" ? (ar ? "لا توجد دورة نشطة" : "Aucune formation en cours") : (ar ? "لم تبدأ أي دورة بعد" : "Vous n’avez pas encore commencé de formation")}
      body={ar ? "استكشف الكتالوج واختر المسار الذي يناسب أهدافك." : "Explorez notre catalogue pour développer de nouvelles compétences certifiantes."}
      action={{ href: `/${locale}/formations`, label: ar ? "استكشف الدورات" : "Découvrir les formations" }}
    />}
  </div>;
}
