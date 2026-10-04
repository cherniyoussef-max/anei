import { notFound } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Download,
  Search,
  CheckCircle2,
  ArrowRight,
  FileText,
  Sparkles,
  Layers,
} from "lucide-react";
import { isLocale, formatMillimes } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { searchPublishedResources, type ResourceSearchInput } from "@/server/queries/catalog";
import { getLearnerResourcesPage } from "@/server/queries/account";
import { getPaymentCapabilities } from "@/server/payments";
import { CheckoutButton } from "@/components/commerce/CheckoutButton";
import { PersonaMetricCard } from "@/modules/personas/components/PersonaPages";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const TYPE_LABEL: Record<string, { fr: string; ar: string }> = {
  guide: { fr: "Guide pratique", ar: "دليل عملي" },
  sheet: { fr: "Fiche d'activité / Grille", ar: "بطاقة نشاط / شبكة" },
  tool: { fr: "Boîte à outils", ar: "حقيبة أدوات" },
  manual: { fr: "Manuel professionnel", ar: "دليل مهني" },
};

export default async function ParentBibliothequePage({
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
  const tab = one(raw.tab) === "mes-achats" ? "mes-achats" : "catalogue";
  const q = one(raw.q)?.trim().toLowerCase() || "";
  const selectedType = one(raw.type)?.trim() || "";

  // 1. Fetch published resources
  const filters: Omit<ResourceSearchInput, "page" | "pageSize"> = {
    q: q || undefined,
    type: selectedType || undefined,
    sort: "newest",
  };

  const catalogData = await searchPublishedResources({ ...filters, page: 1, pageSize: 36 });

  // 2. Fetch parent's purchased resources
  const purchasedRows = await getLearnerResourcesPage(session.user.id);
  const purchasedIds = new Set(purchasedRows.map((r) => r.resource.id));

  // 3. Payment capabilities
  const capabilities = getPaymentCapabilities();

  // Filter based on selected tab
  const displayedResources =
    tab === "mes-achats"
      ? catalogData.items.filter((r) => purchasedIds.has(r.id))
      : catalogData.items;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0056D2]">
            {ar ? "مساحة الوالدين · المكتبة الرقمية" : "Espace Famille · Librairie"}
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
            {ar ? "المكتبة التربوية والموارد التطبيقية" : "Bibliothèque & Ressources pour parents"}
          </h1>
          <p className="mt-1 text-sm text-[#64748B] max-w-2xl">
            {ar
              ? "حمّل أدلة عملية، بطاقات أنشطة ملائمة، وأدوات تواصل مصممة لدعم طفلك ومساعدته في تخطي الصعوبات المدرسية."
              : "Guides pratiques, fiches d'activités adaptées et supports de communication pour accompagner le quotidien scolaire et familial de votre enfant."}
          </p>
        </div>

        <Link
          href={`/${locale}/bibliotheque`}
          target="_blank"
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition shadow-xs"
        >
          <span>{ar ? "المكتبة العامة للمنصة" : "Bibliothèque publique"}</span>
          <ArrowRight size={13} className="rtl:rotate-180" />
        </Link>
      </div>

      {/* Bento Metric Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PersonaMetricCard
          icon={BookOpen}
          tone="navy"
          label={ar ? "الموارد المتاحة" : "Ressources disponibles"}
          value={catalogData.total}
        />
        <PersonaMetricCard
          icon={Download}
          tone="gold"
          label={ar ? "مواردي المشتراة" : "Mes ressources achetées"}
          value={purchasedRows.length}
        />
        <PersonaMetricCard
          icon={Layers}
          tone="navy"
          label={ar ? "أنواع الأدوات" : "Types de supports"}
          value={catalogData.types.length || 4}
        />
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
        {/* Navigation Tabs */}
        <div className="flex rounded-lg border border-[#E2E8F0] bg-white p-1">
          <Link
            href={`/${locale}/parent/bibliotheque?tab=catalogue${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "catalogue"
                ? "bg-[#0056D2] text-white shadow-xs"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {ar ? `جميع الموارد (${catalogData.total})` : `Toutes les ressources (${catalogData.total})`}
          </Link>
          <Link
            href={`/${locale}/parent/bibliotheque?tab=mes-achats`}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "mes-achats"
                ? "bg-[#0056D2] text-white shadow-xs"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {ar ? `مواردي (${purchasedRows.length})` : `Mes ressources (${purchasedRows.length})`}
          </Link>
        </div>

        {/* Search */}
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
            placeholder={ar ? "بحث في الموارد والأدلة..." : "Rechercher une ressource..."}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2 ps-9 pe-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:outline-hidden"
          />
        </form>
      </div>

      {/* Resources Catalog Grid */}
      {displayedResources.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
          <BookOpen size={36} className="mx-auto text-[#94A3B8]" />
          <h3 className="mt-3 text-lg font-semibold text-[#0F172A]">
            {tab === "mes-achats"
              ? ar
                ? "لم تقم بشراء أو تحميل موارد بعد"
                : "Vous n'avez acheté aucune ressource pour le moment"
              : ar
                ? "لا توجد موارد مطابقة لبحثك"
                : "Aucune ressource ne correspond à votre recherche"}
          </h3>
          <p className="mt-1 text-xs text-[#64748B]">
            {tab === "mes-achats"
              ? ar
                ? "تصفح المكتبة لاقتناء أدلة ومطبوعات موجهة لمرافقة طفلك."
                : "Consultez le catalogue pour acquérir des outils d'accompagnement utiles."
              : ar
                ? "جرب البحث بكلمات أخرى أو تصفح كل الموارد."
                : "Essayez avec d'autres mots-clés."}
          </p>
          {tab === "mes-achats" && (
            <Link
              href={`/${locale}/parent/bibliotheque?tab=catalogue`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00419E] transition shadow-xs"
            >
              <Sparkles size={14} />
              <span>{ar ? "استكشاف المكتبة التربوية" : "Explorer la bibliothèque"}</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayedResources.map((resource) => {
            const isPurchased = purchasedIds.has(resource.id);
            const title = ar ? resource.titleAr : resource.titleFr;
            const description = ar ? resource.descriptionAr : resource.descriptionFr;
            const typeInfo = TYPE_LABEL[resource.type] ?? {
              fr: resource.type,
              ar: resource.type,
            };

            return (
              <div
                key={resource.id}
                className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs hover:border-[#0056D2]/40 transition"
              >
                <div>
                  {/* Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="rounded-md bg-[#F0F6FF] px-2 py-0.5 text-[11px] font-semibold text-[#0056D2]">
                      {ar ? typeInfo.ar : typeInfo.fr}
                    </span>
                    {isPurchased ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={11} />
                        {ar ? "مقتنى" : "Débloqué"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-[#0F172A]">
                        {formatMillimes(resource.priceMillimes, locale)}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-[#0F172A] line-clamp-2 leading-snug">
                    {title}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 text-xs text-[#64748B] line-clamp-3 leading-relaxed">
                    {description}
                  </p>

                  {/* Facts */}
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] pt-3 text-[11px] text-[#64748B]">
                    <span className="inline-flex items-center gap-1">
                      <FileText size={12} className="text-[#0056D2]" />
                      <span>{resource.audienceAr && ar ? resource.audienceAr : resource.audienceFr}</span>
                    </span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-5 border-t border-[#E2E8F0] pt-4">
                  {isPurchased ? (
                    <a
                      href={`/api/resources/${resource.id}/download`}
                      download
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0056D2] py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#00419E] transition"
                    >
                      <Download size={13} />
                      <span>{ar ? "تحميل المورد (PDF)" : "Télécharger le document"}</span>
                    </a>
                  ) : (
                    <CheckoutButton
                      itemType="resource"
                      itemId={resource.id}
                      locale={locale}
                      capabilities={capabilities}
                      label={
                        resource.priceMillimes === 0
                          ? ar
                            ? "تحميل مجاني"
                            : "Télécharger gratuitement"
                          : ar
                            ? `شراء المورد (${formatMillimes(resource.priceMillimes, locale)})`
                            : `Acheter la ressource (${formatMillimes(resource.priceMillimes, locale)})`
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
