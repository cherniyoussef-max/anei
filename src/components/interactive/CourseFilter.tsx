import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { formatDate, formatMillimes } from "@/lib/i18n";
import { getCourseVisual } from "@/lib/visuals";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  localizeCourseCategory,
  localizeCourseLevel,
  localizeCourseMode,
  localizeTrainerName,
  localizeTrainerInitials,
} from "@/lib/arabic-locale";

export type CatalogCourse = {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  trainerName: string;
  durationMinutes: number;
  priceMillimes: number;
  mode: string;
  level: string;
  startAt: string | null;
  featured: boolean;
  enrollment?: { progressPercent: number; completed: boolean } | null;
};

export function CourseFilter({
  locale,
  courses,
  categories,
  filters,
  page,
  totalPages,
  total,
}: {
  locale: Locale;
  courses: CatalogCourse[];
  categories: string[];
  filters: { q?: string; category?: string; level?: string; mode?: string; price?: string; sort?: string };
  page: number;
  totalPages: number;
  total: number;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  const hasFilters = Boolean(filters.q || filters.category || filters.level || filters.mode || filters.price || (filters.sort && filters.sort !== "featured"));
  return (
    <div className="course-catalog-premium">
      <form className="catalog-discovery course-discovery" method="get" role="search">
        <div className="catalog-search-group">
          <label htmlFor="course-search">{ar ? "ما المهارة التي تريد تطويرها؟" : en ? "What skill do you want to develop?" : "Quelle compétence souhaitez-vous développer ?"}</label>
          <div className="catalog-search-control">
            <Icon name="search" size={21} />
            <input id="course-search" name="q" defaultValue={filters.q} maxLength={100} autoComplete="off" placeholder={ar ? "مثال: المرافقة المدرسية" : en ? "For example: learner support" : "Exemple : accompagnement scolaire"} />
            <button className="btn btn-primary catalog-search-submit" type="submit">{ar ? "بحث" : en ? "Search" : "Rechercher"}</button>
          </div>
        </div>
        <details className="catalog-advanced-filters" open={hasFilters || undefined}>
          <summary>{ar ? "الفلاتر والترتيب" : en ? "Filters and sorting" : "Filtres et tri"}</summary>
          <div className="catalog-filter-row catalog-course-filter-row">
            <label><span>{ar ? "الفئة" : en ? "Category" : "Catégorie"}</span><select name="category" defaultValue={filters.category ?? ""}>
              <option value="">{ar ? "كل الفئات" : en ? "All categories" : "Toutes les catégories"}</option>
              {categories.map((item) => <option value={item} key={item}>{localizeCourseCategory(item, locale)}</option>)}
            </select></label>
            <label><span>{ar ? "المستوى" : en ? "Level" : "Niveau"}</span><select name="level" defaultValue={filters.level ?? ""}>
              <option value="">{ar ? "كل المستويات" : en ? "All levels" : "Tous les niveaux"}</option>
              <option value="beginner">{ar ? "مبتدئ" : en ? "Beginner" : "Débutant"}</option>
              <option value="intermediate">{ar ? "متوسط" : en ? "Intermediate" : "Intermédiaire"}</option>
              <option value="advanced">{ar ? "متقدم" : en ? "Advanced" : "Avancé"}</option>
            </select></label>
            <label><span>{ar ? "الصيغة" : en ? "Format" : "Modalité"}</span><select name="mode" defaultValue={filters.mode ?? ""}>
              <option value="">{ar ? "كل الصيغ" : en ? "All formats" : "Toutes les modalités"}</option>
              <option value="online">{ar ? "عن بعد" : en ? "Online" : "En ligne"}</option>
              <option value="hybrid">{ar ? "هجين" : en ? "Hybrid" : "Hybride"}</option>
              <option value="onsite">{ar ? "حضوري" : en ? "On site" : "Présentiel"}</option>
            </select></label>
            <label><span>{ar ? "السعر" : en ? "Price" : "Prix"}</span><select name="price" defaultValue={filters.price ?? ""}>
              <option value="">{ar ? "كل الأسعار" : en ? "All prices" : "Tous les prix"}</option>
              <option value="free">{ar ? "مجاني" : en ? "Free" : "Gratuit"}</option>
              <option value="paid">{ar ? "مدفوع" : en ? "Paid" : "Payant"}</option>
            </select></label>
            <label><span>{ar ? "الترتيب" : en ? "Sort" : "Trier"}</span><select name="sort" defaultValue={filters.sort ?? "relevance"}>
              <option value="relevance">{ar ? "الأكثر صلة" : en ? "Most relevant" : "Plus pertinentes"}</option>
              <option value="featured">{ar ? "موصى به" : en ? "Recommended" : "Recommandées"}</option>
              <option value="newest">{ar ? "الأحدث" : en ? "Newest" : "Plus récentes"}</option>
              <option value="price-asc">{ar ? "السعر تصاعديًا" : en ? "Price: low to high" : "Prix croissant"}</option>
              <option value="price-desc">{ar ? "السعر تنازليًا" : en ? "Price: high to low" : "Prix décroissant"}</option>
            </select></label>
            <button className="btn btn-secondary catalog-filter-submit" type="submit">{ar ? "تطبيق الفلاتر" : en ? "Apply filters" : "Appliquer les filtres"}</button>
            {hasFilters ? <Link className="catalog-reset-link" href={`/${locale}/formations`}>{ar ? "مسح الفلاتر" : en ? "Clear filters" : "Effacer les filtres"}</Link> : null}
          </div>
        </details>
      </form>

      <div className="catalog-results-heading" role="status">
        <div><span>{ar ? "التكوين" : en ? "Learning paths" : "Parcours"}</span><h2 className="font-sans font-semibold tracking-[-0.02em] text-slate-900 tabular-nums">{ar ? `${total} دورة` : en ? `${total} course${total === 1 ? "" : "s"}` : `${total} formation${total === 1 ? "" : "s"}`}</h2></div>
        <p>
          {filters.q
            ? ar
              ? `نتائج البحث عن «${filters.q}»`
              : en
              ? `Search results for “${filters.q}”`
              : `Résultats pour « ${filters.q} »`
            : total === 0
            ? ar
              ? "لا توجد دورات مطابقة لمعايير البحث المحددة حاليًا."
              : "Aucune formation ne correspond actuellement aux critères sélectionnés."
            : total === 1
            ? ar
              ? "مسار تدريبي معتمد مصمم للممارسة الدامجة الميدانية."
              : "Un parcours certifiant conçu pour la pratique inclusive de terrain."
            : total === 2
            ? ar
              ? "مساران تدريبيان معتمدان لبناء ممارسة دامجة مستدامة."
              : "Deux parcours certifiants pour développer une pratique inclusive rigoureuse."
            : ar
            ? `${total} مسارات تدريبية مصادق عليها للتربية الدامجة.`
            : `${total} parcours certifiants pour développer une pratique inclusive rigoureuse.`}
        </p>
      </div>

      {courses.length > 0 ? (
        <div className={`course-grid catalog-course-grid ${courses.length === 1 ? "!grid-cols-1 max-w-xl mx-auto" : ""}`}>
          {courses.map((course) => (
            <article className={`group course-card premium-card course-card-human ${course.featured ? "featured-course" : ""}`} key={course.id}>
              <div className="course-photo catalog-course-photo relative aspect-[16/9] h-52 w-full overflow-hidden">
                <Image
                  src={getCourseVisual(course.slug)}
                  alt=""
                  fill
                  sizes="(max-width: 900px) 100vw, 33vw"
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
                <div className="course-photo-overlay" aria-hidden="true"/>
                <span>{localizeCourseMode(course.mode, locale)}</span>
                {course.featured ? <em>{ar ? "موصى به" : en ? "Recommended" : "Recommandé"}</em> : null}
              </div>
              <div className="course-card-body">
                <div className="course-card-topline">
                  <span className="course-category-label">{localizeCourseCategory(course.category, locale)}</span>
                  <span className="course-level-label">{localizeCourseLevel(course.level, locale)}</span>
                </div>
                <h3 className="font-sans font-semibold text-lg md:text-xl tracking-[-0.015em] leading-snug text-slate-900 hover:text-slate-700 transition-colors">{course.title}</h3>
                <p>{course.summary}</p>
                <div className="meta-row">
                  <span>
                    <Icon name="clock" size={15} />
                    {Math.max(1, Math.round(course.durationMinutes / 60))} {ar ? "ساعة" : "h"}
                  </span>
                  {course.startAt ? <span><Icon name="calendar" size={15} />{formatDate(course.startAt, locale)}</span> : null}
                </div>
                <div className="trainer-row">
                  <span className="mini-avatar">{localizeTrainerInitials(course.trainerName, locale)}</span>
                  <span>{localizeTrainerName(course.trainerName, locale)}</span>
                </div>
                {course.enrollment ? (
                  <div className="progress slim" role="status" aria-label={`${ar ? "التقدم" : en ? "Progress" : "Progression"} ${course.enrollment.progressPercent}%`}>
                    <span style={{ width: `${Math.min(100, Math.max(0, course.enrollment.progressPercent))}%` }} />
                  </div>
                ) : null}
                <div className="card-footer flex items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
                  {course.enrollment ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold text-xs px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        {course.enrollment.completed
                          ? (ar ? "مكتمل • 100%" : en ? "Completed • 100%" : "Terminé • 100%")
                          : (ar ? `مسجل • ${course.enrollment.progressPercent}%` : en ? `Enrolled • ${course.enrollment.progressPercent}%` : `Inscrit • ${course.enrollment.progressPercent}% complété`)}
                      </span>
                      <Link className="btn btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold py-2 px-4 rounded-full" href={`/${locale}/apprendre/${course.slug}`}>
                        <span>{course.enrollment.completed ? (ar ? "مراجعة الدورة" : en ? "Review course" : "Revoir") : (ar ? "متابعة التعلم" : en ? "Continue learning" : "Continuer la formation")}</span>
                        <Icon className="directional-icon" name="arrow" size={14} />
                      </Link>
                    </>
                  ) : (
                    <>
                      <strong className="font-bold text-lg text-[#142B47]">{formatMillimes(course.priceMillimes, locale)}</strong>
                      <Link className="btn btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold py-2 px-4 rounded-full" href={`/${locale}/formations/${course.slug}`}>
                        <span>{ar ? "اكتشف الدورة" : en ? "Explore course" : "Découvrir la formation"}</span>
                        <Icon className="directional-icon" name="arrow" size={14} />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          locale={locale}
          icon="book"
          title={ar ? "لا توجد دورات مطابقة" : "Aucune formation trouvée"}
          description={
            ar
              ? "لم يتم العثور على برامج تكوينية تطابق خيارات التصفية الحالية. يمكنك إعادة ضبط الفلاتر لاستعراض كامل البرامج."
              : "Aucun programme de formation ne correspond à vos filtres actuels. Réinitialisez la recherche pour découvrir l'ensemble des parcours certifiants."
          }
          action={{
            label: ar ? "عرض جميع المسارات" : "Voir tous les parcours",
            href: `/${locale}/formations`,
          }}
        />
      )}
      <Pagination locale={locale} basePath={`/${locale}/formations`} page={page} totalPages={totalPages} params={filters} />
    </div>
  );
}
