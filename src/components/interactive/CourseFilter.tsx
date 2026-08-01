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
  return (
    <>
      <form className="catalog-toolbar catalog-toolbar-advanced" method="get">
        <label className="search-field">
          <Icon name="search" size={19} />
          <input name="q" defaultValue={filters.q} maxLength={100} placeholder={ar ? "ابحث عن دورة..." : "Rechercher une formation..."} />
        </label>
        <select name="category" defaultValue={filters.category ?? ""} aria-label={ar ? "الفئة" : "Catégorie"}>
          <option value="">{ar ? "كل الفئات" : "Toutes les catégories"}</option>
          {categories.map((item) => <option value={item} key={item}>{item.replaceAll("-", " ")}</option>)}
        </select>
        <select name="level" defaultValue={filters.level ?? ""} aria-label={ar ? "المستوى" : "Niveau"}>
          <option value="">{ar ? "كل المستويات" : "Tous les niveaux"}</option>
          <option value="beginner">{ar ? "مبتدئ" : "Débutant"}</option>
          <option value="intermediate">{ar ? "متوسط" : "Intermédiaire"}</option>
          <option value="advanced">{ar ? "متقدم" : "Avancé"}</option>
        </select>
        <select name="mode" defaultValue={filters.mode ?? ""} aria-label={ar ? "الصيغة" : "Modalité"}>
          <option value="">{ar ? "كل الصيغ" : "Toutes les modalités"}</option>
          <option value="online">{ar ? "عن بعد" : "En ligne"}</option>
          <option value="hybrid">{ar ? "هجين" : "Hybride"}</option>
          <option value="onsite">{ar ? "حضوري" : "Présentiel"}</option>
        </select>
        <select name="price" defaultValue={filters.price ?? ""} aria-label={ar ? "السعر" : "Prix"}>
          <option value="">{ar ? "مجاني ومدفوع" : "Gratuit et payant"}</option>
          <option value="free">{ar ? "مجاني" : "Gratuit"}</option>
          <option value="paid">{ar ? "مدفوع" : "Payant"}</option>
        </select>
        <select name="sort" defaultValue={filters.sort ?? "featured"} aria-label={ar ? "الترتيب" : "Tri"}>
          <option value="featured">{ar ? "موصى به" : "Recommandés"}</option>
          <option value="newest">{ar ? "الأحدث" : "Plus récents"}</option>
          <option value="price-asc">{ar ? "السعر تصاعديًا" : "Prix croissant"}</option>
          <option value="price-desc">{ar ? "السعر تنازليًا" : "Prix décroissant"}</option>
        </select>
        <button className="btn btn-primary" type="submit">{ar ? "تطبيق" : "Appliquer"}</button>
        <Link className="btn btn-ghost" href={`/${locale}/formations`}>{ar ? "إعادة ضبط" : "Réinitialiser"}</Link>
      </form>

      <div className="catalog-result-summary" role="status">
        {ar ? `${total} دورة` : `${total} formation${total > 1 ? "s" : ""}`}
      </div>

      <div className="course-grid catalog-course-grid">
        {courses.map((course) => (
          <article className={`course-card premium-card course-card-human ${course.featured ? "featured-course" : ""}`} key={course.id}>
            <div className="course-photo catalog-course-photo">
              <Image src={getCourseVisual(course.slug)} alt="" fill sizes="(max-width: 900px) 100vw, 33vw" />
              <div className="course-photo-overlay" aria-hidden="true"/>
              <span>{course.mode === "online" ? (ar ? "عن بعد" : "En ligne") : course.mode === "hybrid" ? (ar ? "هجين" : "Hybride") : (ar ? "حضوري" : "Présentiel")}</span>
              {course.featured ? <em>{ar ? "موصى به" : "Recommandé"}</em> : null}
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
      {!courses.length ? <div className="empty-state">{ar ? "لا توجد دورة مطابقة لهذه المعايير." : "Aucune formation ne correspond à ces critères."}</div> : null}
      <Pagination locale={locale} basePath={`/${locale}/formations`} page={page} totalPages={totalPages} params={filters} />
    </>
  );
}
