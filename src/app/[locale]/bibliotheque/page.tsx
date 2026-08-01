import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { ResourceCatalog, type CatalogResource } from "@/components/commerce/ResourceCatalog";
import { searchPublishedResources, type ResourceSearchInput } from "@/server/queries/catalog";
import { getPaymentCapabilities } from "@/server/payments";
import { Icon } from "@/components/ui/Icon";

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function pageNumber(value?: string) { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1; }

export const dynamic = "force-dynamic";
export default async function LibraryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const raw = await searchParams;
  const price = one(raw.price);
  const sort = one(raw.sort);
  const filters: Omit<ResourceSearchInput, "page" | "pageSize"> = {
    q: one(raw.q)?.slice(0, 100),
    type: one(raw.type)?.slice(0, 80),
    price: price === "free" || price === "paid" ? price : undefined,
    sort: sort === "price-asc" || sort === "price-desc" || sort === "newest" ? sort : "newest" as const,
  };
  const data = await searchPublishedResources({ ...filters, page: pageNumber(one(raw.page)) });
  const items: CatalogResource[] = data.items.map((resource) => ({ id: resource.id, title: ar ? resource.titleAr : resource.titleFr, description: ar ? resource.descriptionAr : resource.descriptionFr, audience: ar ? resource.audienceAr : resource.audienceFr, type: resource.type, priceMillimes: resource.priceMillimes }));
  return <><PageHero eyebrow={ar ? "المكتبة الرقمية" : "Librairie pédagogique"} title={ar ? "موارد مهنية موثوقة وقابلة للتحميل" : "Des ressources professionnelles, utiles et accessibles"} description={ar ? "أدلة وشبكات وأدوات عملية، مع وصول محمي بعد الشراء." : "Guides, grilles et outils pratiques avec téléchargement protégé après achat."} /><section className="section"><div className="container"><ResourceCatalog locale={locale} resources={items} capabilities={getPaymentCapabilities()} types={data.types} filters={filters} page={data.page} totalPages={data.totalPages} total={data.total} /><div className="purchase-note"><Icon name="shield" size={22} /><div><strong>{ar ? "تنزيل محمي" : "Téléchargement protégé"}</strong><p>{ar ? "يتم التحقق من الجلسة وحق الشراء على الخادم قبل إرسال الملف." : "Le serveur vérifie la session et le droit d’achat avant chaque téléchargement."}</p></div></div></div></section></>;
}
