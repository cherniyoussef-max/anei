import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { formatDate, formatMillimes, t } from "@/lib/i18n";
import { getCourseVisual } from "@/lib/visuals";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";

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
  const c = t(locale);
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
              {categories.map((item) => <option value={item} key={item}>{item.replaceAll("-", " ")}</option>)}
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
        <div><span>{ar ? "التكوين" : en ? "Learning paths" : "Parcours"}</span><h2>{ar ? `${total} دورة` : en ? `${total} course${total === 1 ? "" : "s"}` : `${total} formation${total === 1 ? "" : "s"}`}</h2></div>
        <p>{filters.q ? (ar ? `نتائج البحث عن «${filters.q}»` : en ? `Search results for “${filters.q}”` : `Résultats pour « ${filters.q} »`) : (ar ? "دورتان مختارتان لبناء ممارسة دامجة." : en ? "Two focused pathways for inclusive practice." : "Deux parcours ciblés pour la pratique inclusive.")}</p>
      </div>

      <div className="course-grid catalog-course-grid">
        {courses.map((course) => (
          <article className={`course-card premium-card course-card-human ${course.featured ? "featured-course" : ""}`} key={course.id}>
            <div className="course-photo catalog-course-photo">
              <Image src={getCourseVisual(course.slug)} alt="" fill sizes="(max-width: 900px) 100vw, 33vw" />
              <div className="course-photo-overlay" aria-hidden="true"/>
              <span>{course.mode === "online" ? (ar ? "عن بعد" : en ? "Online" : "En ligne") : course.mode === "hybrid" ? (ar ? "هجين" : en ? "Hybrid" : "Hybride") : (ar ? "حضوري" : en ? "On site" : "Présentiel")}</span>
              {course.featured ? <em>{ar ? "موصى به" : en ? "Recommended" : "Recommandé"}</em> : null}
            </div>
            <div className="course-card-body">
              <div className="course-card-topline"><span className="course-category-label">{course.category.replaceAll("-", " ")}</span><span className="course-level-label">{course.level}</span></div>
              <h3>{course.title}</h3>
              <p>{course.summary}</p>
              <div className="meta-row">
                <span><Icon name="clock" size={15} />{Math.max(1, Math.round(course.durationMinutes / 60))} h</span>
                {course.startAt ? <span><Icon name="calendar" size={15} />{formatDate(course.startAt, locale)}</span> : null}
              </div>
              <div className="trainer-row"><span className="mini-avatar">{course.trainerName.split(" ").slice(-2).map((part) => part[0]).join("")}</span><span>{course.trainerName}</span></div>
              <div className="card-footer"><strong>{formatMillimes(course.priceMillimes, locale)}</strong><Link className="text-link" href={`/${locale}/formations/${course.slug}`}>{c.actions.details}<Icon name="arrow" size={16} /></Link></div>
            </div>
          </article>
        ))}
      </div>
      {!courses.length ? <div className="empty-state">{ar ? "لا توجد دورة مطابقة لهذه المعايير." : en ? "No courses match these filters." : "Aucune formation ne correspond à ces critères."}</div> : null}
      <Pagination locale={locale} basePath={`/${locale}/formations`} page={page} totalPages={totalPages} params={filters} />
    </div>
  );
}
