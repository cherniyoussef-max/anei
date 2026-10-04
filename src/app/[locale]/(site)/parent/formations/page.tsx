import { notFound } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap,
  Clock,
  Sparkles,
  BookOpen,
  Search,
  CheckCircle2,
  ArrowRight,
  User,
  Video,
} from "lucide-react";
import { isLocale, formatMillimes } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { searchPublishedCourses, type CourseSearchInput } from "@/server/queries/catalog";
import { getLearnerCoursesPage } from "@/server/queries/account";
import { getPaymentCapabilities } from "@/server/payments";
import { CheckoutButton } from "@/components/commerce/CheckoutButton";
import { PersonaMetricCard } from "@/modules/personas/components/PersonaPages";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ParentFormationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "PARENT");

  const raw = await searchParams;
  const tab = one(raw.tab) === "mes-formations" ? "mes-formations" : "catalogue";
  const q = one(raw.q)?.trim().toLowerCase() || "";
  const selectedCategory = one(raw.category)?.trim() || "";

  // 1. Fetch published courses
  const filters: Omit<CourseSearchInput, "page" | "pageSize"> = {
    q: q || undefined,
    category: selectedCategory || undefined,
    sort: "newest",
  };

  const catalogData = await searchPublishedCourses({ ...filters, page: 1, pageSize: 36 });

  // 2. Fetch parent's own enrollments
  const enrolledRows = await getLearnerCoursesPage(session.user.id);
  const enrolledCourseIds = new Set(enrolledRows.map((r) => r.course.id));
  const progressMap = new Map(
    enrolledRows.map((r) => [
      r.course.id,
      { progressPercent: r.enrollment.progressPercent, status: r.enrollment.status, slug: r.course.slug },
    ])
  );

  // 3. Payment capabilities
  const capabilities = getPaymentCapabilities();

  // Filter for display based on tab
  const displayedCourses =
    tab === "mes-formations"
      ? catalogData.items.filter((c) => enrolledCourseIds.has(c.id))
      : catalogData.items;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0056D2]">
            {ar ? "مساحة الوالدين · التكوين والمرافقة" : "Espace Famille · Formations"}
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
            {ar ? "الدورات والورشات التدريبية" : "Formations & Ateliers pour parents"}
          </h1>
          <p className="mt-1 text-sm text-[#64748B] max-w-2xl">
            {ar
              ? "مسارات تدريبية تطبيقية يؤطرها أخصائيون في التربية الدامجة لمرافقة طفلك ودعم احتياجاته اليومية والمدرسية."
              : "Des formations concrètes animées par des spécialistes pour mieux comprendre et accompagner les besoins éducatifs de votre enfant."}
          </p>
        </div>

        <Link
          href={`/${locale}/formations`}
          target="_blank"
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition shadow-xs"
        >
          <span>{ar ? "الكتالوج العام للأكاديمية" : "Catalogue public ANEI"}</span>
          <ArrowRight size={13} className="rtl:rotate-180" />
        </Link>
      </div>

      {/* Bento Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PersonaMetricCard
          icon={GraduationCap}
          tone="navy"
          label={ar ? "الدورات المتاحة" : "Formations disponibles"}
          value={catalogData.total}
        />
        <PersonaMetricCard
          icon={CheckCircle2}
          tone="gold"
          label={ar ? "دوراتي المسجلة" : "Mes formations inscrites"}
          value={enrolledRows.length}
        />
        <PersonaMetricCard
          icon={BookOpen}
          tone="navy"
          label={ar ? "ورشات تطبيقية مباشرة" : "Ateliers interactifs"}
          value={catalogData.categories.length}
        />
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
        {/* Navigation Tabs */}
        <div className="flex rounded-lg border border-[#E2E8F0] bg-white p-1">
          <Link
            href={`/${locale}/parent/formations?tab=catalogue${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "catalogue"
                ? "bg-[#0056D2] text-white shadow-xs"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {ar ? `جميع الدورات (${catalogData.total})` : `Toutes les formations (${catalogData.total})`}
          </Link>
          <Link
            href={`/${locale}/parent/formations?tab=mes-formations`}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "mes-formations"
                ? "bg-[#0056D2] text-white shadow-xs"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {ar ? `دوراتي المشتركة (${enrolledRows.length})` : `Mes formations (${enrolledRows.length})`}
          </Link>
        </div>

        {/* Search bar */}
        <form method="get" className="relative flex-1 max-w-xs">
          {tab !== "catalogue" && <input type="hidden" name="tab" value={tab} />}
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] rtl:left-auto rtl:right-3"
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={ar ? "بحث في الدورات..." : "Rechercher une formation..."}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2 ps-9 pe-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:outline-hidden"
          />
        </form>
      </div>

      {/* Courses Catalog Grid */}
      {displayedCourses.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
          <GraduationCap size={36} className="mx-auto text-[#94A3B8]" />
          <h3 className="mt-3 text-lg font-semibold text-[#0F172A]">
            {tab === "mes-formations"
              ? ar
                ? "لم تسجل في أي دورة بعد"
                : "Vous n'êtes inscrit à aucune formation pour le moment"
              : ar
                ? "لا توجد نتائج مطابقة لبحثك"
                : "Aucune formation ne correspond à votre recherche"}
          </h3>
          <p className="mt-1 text-xs text-[#64748B]">
            {tab === "mes-formations"
              ? ar
                ? "اختر من كتالوج الدورات أعلاه لبدء التعلم ومرافقة طفلك."
                : "Explorez le catalogue de formations pour vous inscrire et débuter votre apprentissage."
              : ar
                ? "جرب البحث بكلمات أخرى أو تصفح كل الكتالوج."
                : "Essayez avec d'autres termes de recherche."}
          </p>
          {tab === "mes-formations" && (
            <Link
              href={`/${locale}/parent/formations?tab=catalogue`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00419E] transition shadow-xs"
            >
              <Sparkles size={14} />
              <span>{ar ? "استكشاف كتالوج الدورات" : "Découvrir le catalogue"}</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayedCourses.map((course) => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            const enrollmentInfo = progressMap.get(course.id);
            const title = ar ? course.titleAr : course.titleFr;
            const summary = ar ? course.summaryAr : course.summaryFr;

            return (
              <div
                key={course.id}
                className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs hover:border-[#0056D2]/40 transition"
              >
                <div>
                  {/* Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="rounded-md bg-[#F0F6FF] px-2 py-0.5 text-[11px] font-semibold text-[#0056D2]">
                      {course.category}
                    </span>
                    {isEnrolled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={11} />
                        {ar ? "مسجل" : "Inscrit"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-[#0F172A]">
                        {formatMillimes(course.priceMillimes, locale)}
                      </span>
                    )}
                  </div>

                  {/* Course Title */}
                  <h3 className="text-sm font-semibold text-[#0F172A] line-clamp-2 leading-snug">
                    {title}
                  </h3>

                  {/* Summary */}
                  <p className="mt-2 text-xs text-[#64748B] line-clamp-3 leading-relaxed">
                    {summary}
                  </p>

                  {/* Meta facts */}
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] pt-3 text-[11px] text-[#64748B]">
                    {course.trainerName && (
                      <span className="inline-flex items-center gap-1">
                        <User size={12} className="text-[#0056D2]" />
                        <span>{course.trainerName}</span>
                      </span>
                    )}
                    {course.durationMinutes && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} className="text-[#0056D2]" />
                        <span>{Math.round(course.durationMinutes / 60)}h</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Video size={12} className="text-[#0056D2]" />
                      <span>{course.mode === "online" ? (ar ? "عن بعد" : "En ligne") : course.mode}</span>
                    </span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-5 border-t border-[#E2E8F0] pt-4">
                  {isEnrolled ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F172A]">
                        <span>{ar ? "نسبة التقدم" : "Progression"}</span>
                        <span dir="ltr" className="text-[#0056D2]">{enrollmentInfo?.progressPercent ?? 0}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                        <div
                          className="h-full bg-[#0056D2] transition-all"
                          style={{ width: `${enrollmentInfo?.progressPercent ?? 0}%` }}
                        />
                      </div>
                      <Link
                        href={`/${locale}/apprendre/${course.slug}`}
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0056D2] py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#00419E] transition"
                      >
                        <span>{ar ? "متابعة التكوين" : "Accéder à la formation"}</span>
                        <ArrowRight size={13} className="rtl:rotate-180" />
                      </Link>
                    </div>
                  ) : (
                    <CheckoutButton
                      itemType="course"
                      itemId={course.id}
                      locale={locale}
                      capabilities={capabilities}
                      label={
                        course.priceMillimes === 0
                          ? ar
                            ? "التسجيل المجاني الآن"
                            : "S'inscrire gratuitement"
                          : ar
                            ? `شراء الدورة (${formatMillimes(course.priceMillimes, locale)})`
                            : `Acheter la formation (${formatMillimes(course.priceMillimes, locale)})`
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
