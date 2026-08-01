import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { CourseFilter, type CatalogCourse } from "@/components/interactive/CourseFilter";
import { searchPublishedCourses, type CourseSearchInput } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function pageNumber(value: string | undefined) { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1; }

export default async function CoursesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const raw = await searchParams;
  const level = one(raw.level);
  const mode = one(raw.mode);
  const price = one(raw.price);
  const sort = one(raw.sort);
  const filters: Omit<CourseSearchInput, "page" | "pageSize"> = {
    q: one(raw.q)?.slice(0, 100),
    category: one(raw.category)?.slice(0, 80),
    level: level === "beginner" || level === "intermediate" || level === "advanced" ? level : undefined,
    mode: mode === "online" || mode === "hybrid" || mode === "onsite" ? mode : undefined,
    price: price === "free" || price === "paid" ? price : undefined,
    sort: sort === "newest" || sort === "price-asc" || sort === "price-desc" || sort === "featured" ? sort : "featured" as const,
  };
  const data = await searchPublishedCourses({ ...filters, page: pageNumber(one(raw.page)) });
  const items: CatalogCourse[] = data.items.map((course) => ({
    id: course.id,
    slug: course.slug,
    category: course.category,
    title: locale === "fr" ? course.titleFr : course.titleAr,
    summary: locale === "fr" ? course.summaryFr : course.summaryAr,
    trainerName: course.trainerName,
    durationMinutes: course.durationMinutes,
    priceMillimes: course.priceMillimes,
    mode: course.mode,
    level: course.level,
    startAt: course.startAt?.toISOString() ?? null,
    featured: course.featured,
  }));
  return <><PageHero eyebrow={locale === "fr" ? "Catalogue certifiant" : "مسارات تكوينية"} title={locale === "fr" ? "Développez des compétences qui transforment l’inclusion" : "طوّر مهارات تصنع فرقًا في التربية الدامجة"} description={locale === "fr" ? "Des parcours structurés, des vidéos, des documents pratiques, des webinaires et un suivi de progression dans un même espace." : "مسارات منظمة وفيديوهات وموارد عملية وندوات وتتبع للتقدم في مساحة واحدة."} /><section className="section"><div className="container"><CourseFilter locale={locale} courses={items} categories={data.categories} filters={filters} page={data.page} totalPages={data.totalPages} total={data.total} /></div></section></>;
}
