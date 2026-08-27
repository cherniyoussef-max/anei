import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { CourseFilter, type CatalogCourse } from "@/components/interactive/CourseFilter";
import { searchPublishedCourses, type CourseSearchInput } from "@/server/queries/catalog";
import { courses as courseTranslations } from "@/lib/data";
import { publicDataOr } from "@/server/queries/public-fallback";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function pageNumber(value: string | undefined) { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1; }

export default async function CoursesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const raw = await searchParams;
  const ar = locale === "ar";
  const en = locale === "en";
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
    sort: sort === "relevance" || sort === "newest" || sort === "price-asc" || sort === "price-desc" || sort === "featured"
      ? sort
      : undefined,
  };
  const page = pageNumber(one(raw.page));
  const data = await publicDataOr("courses", () => searchPublishedCourses({ ...filters, page }), {
    items: [], total: 0, page, pageSize: 12, totalPages: 1, categories: [],
  });
  const items: CatalogCourse[] = data.items.map((course) => {
    const translated = courseTranslations.find((item) => item.slug === course.slug);
    return ({
    id: course.id,
    slug: course.slug,
    category: course.category,
    title: ar ? course.titleAr : en ? translated?.title.en ?? course.titleFr : course.titleFr,
    summary: ar ? course.summaryAr : en ? translated?.description.en ?? course.summaryFr : course.summaryFr,
    trainerName: course.trainerName,
    durationMinutes: course.durationMinutes,
    priceMillimes: course.priceMillimes,
    mode: course.mode,
    level: course.level,
    startAt: course.startAt?.toISOString() ?? null,
    featured: course.featured,
  }); });
  return <><PageHero eyebrow={ar ? "مسارات تكوينية" : en ? "Certificate course catalog" : "Catalogue certifiant"} title={ar ? "طوّر مهارات تصنع فرقًا في التربية الدامجة" : en ? "Build skills that make inclusion work" : "Développez des compétences qui transforment l’inclusion"} description={ar ? "مسارات منظمة وفيديوهات وموارد عملية وندوات وتتبع للتقدم في مساحة واحدة." : en ? "Structured pathways, practical resources, webinars and progress tracking in one learning environment." : "Des parcours structurés, des vidéos, des documents pratiques, des webinaires et un suivi de progression dans un même espace."} /><section className="section"><div className="container"><CourseFilter locale={locale} courses={items} categories={data.categories} filters={filters} page={data.page} totalPages={data.totalPages} total={data.total} /></div></section></>;
}
