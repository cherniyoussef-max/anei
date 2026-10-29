import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { ResourceCatalog, type CatalogResource } from "@/components/commerce/ResourceCatalog";
import { searchPublishedResources, type ResourceSearchInput } from "@/server/queries/catalog";
import { getPaymentCapabilities } from "@/server/payments";
import { resources as resourceTranslations } from "@/lib/data";
import { publicDataOr } from "@/server/queries/public-fallback";

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function pageNumber(value?: string) { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1; }

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar
      ? "المكتبة الرقمية والموارد البيداغوجية | ANEI"
      : "Bibliothèque de ressources & Guides pratiques | ANEI",
    description: ar
      ? "أدلة وشبكات تقييم وأدوات عمل ميدانية قابلة للتحميل مباشرة لدعم الممارسة الدامجة وتكييف الفصول المدرسية."
      : "Consultez et téléchargez gratuitement nos guides pratiques, grilles d'évaluation et fiches méthodologiques pour l'inclusion scolaire.",
    alternates: {
      canonical: `/${locale}/bibliotheque`,
      languages: { fr: "/fr/bibliotheque", ar: "/ar/bibliotheque" },
    },
  };
}

export default async function LibraryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const en = locale === "en";
  const raw = await searchParams;
  const price = one(raw.price);
  const sort = one(raw.sort);
  const filters: Omit<ResourceSearchInput, "page" | "pageSize"> = {
    q: one(raw.q)?.slice(0, 100),
    type: one(raw.type)?.slice(0, 80),
    price: price === "free" || price === "paid" ? price : undefined,
    sort: sort === "relevance" || sort === "price-asc" || sort === "price-desc" || sort === "newest"
      ? sort
      : undefined,
  };
  const page = pageNumber(one(raw.page));
  const data = await publicDataOr("resources", () => searchPublishedResources({ ...filters, page }), {
    items: [], total: 0, page, pageSize: 12, totalPages: 1, types: [],
  });
  const items: CatalogResource[] = data.items.map((resource) => {
    const translated = resourceTranslations.find((item) => item.title.fr === resource.titleFr);

    return {
      id: resource.id,
      title: ar ? resource.titleAr : en ? translated?.title.en ?? resource.titleFr : resource.titleFr,
      description: ar
        ? resource.descriptionAr
        : en
          ? translated?.description.en ?? resource.descriptionFr
          : resource.descriptionFr,
      audience: ar
        ? resource.audienceAr
        : en
          ? translated?.audience.en ?? resource.audienceFr
          : resource.audienceFr,
      type: resource.type,
      level: resource.level,
      priceMillimes: resource.priceMillimes,
      coverImageUrl: resource.coverImageUrl,
      downloadUrl: resource.downloadUrl,
    };
  });
  const breadcrumbs = [
    { label: ar ? "الرئيسية" : "Accueil", href: `/${locale}` },
    { label: ar ? "المكتبة" : "Bibliothèque" },
  ];

  return (
    <>
      <PageHero
        breadcrumbs={breadcrumbs}
        eyebrow={ar ? "المكتبة الرقمية" : en ? "Resource library" : "Bibliothèque pédagogique"}
        title={ar ? "موارد مهنية موثوقة وقابلة للتحميل" : en ? "Reliable resources for inclusive practice" : "Des ressources professionnelles, utiles et accessibles"}
        description={
          ar
            ? "أدلة وشبكات تقييم وأدوات عمل ميدانية قابلة للتحميل مباشرة لدعم الممارسة الدامجة."
            : en
            ? "Practical guides, assessment rubrics, and field toolkits available for instant download to support inclusive practice."
            : "Guides méthodologiques, grilles d'évaluation et fiches pratiques téléchargeables pour accompagner la scolarisation inclusive."
        }
      />
      <section className="section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ResourceCatalog
            locale={locale}
            resources={items}
            capabilities={getPaymentCapabilities()}
            types={data.types}
            filters={filters}
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
          />
        </div>
      </section>
    </>
  );
}
