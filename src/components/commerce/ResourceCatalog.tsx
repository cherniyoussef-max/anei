"use client";

import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import type { PaymentProvider } from "@/server/payments/types";
import { formatMillimes } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { CheckoutButton } from "@/components/commerce/CheckoutButton";
import { Pagination } from "@/components/ui/Pagination";

export type CatalogResource = {
  id: string;
  title: string;
  description: string;
  audience: string;
  type: string;
  level: string;
  priceMillimes: number;
  coverImageUrl?: string | null;
  downloadUrl?: string | null;
};

const LEVEL_LABEL: Record<string, { en: string; fr: string; ar: string }> = {
  beginner: { en: "Beginner", fr: "Débutant", ar: "مبتدئ" },
  intermediate: { en: "Intermediate", fr: "Intermédiaire", ar: "متوسط" },
  advanced: { en: "Advanced", fr: "Avancé", ar: "متقدم" },
};

const TYPE_LABEL: Record<string, { en: string; fr: string; ar: string }> = {
  guide: { en: "Practical guide", fr: "Guide pratique", ar: "دليل عملي" },
  sheet: { en: "Working framework", fr: "Grille de travail", ar: "شبكة عمل" },
  tool: { en: "Toolkit", fr: "Boîte à outils", ar: "حقيبة أدوات" },
  manual: { en: "Professional manual", fr: "Manuel professionnel", ar: "دليل مهني" },
};

export function ResourceCatalog({
  locale,
  resources,
  capabilities,
  types,
  filters,
  page,
  totalPages,
  total,
}: {
  locale: Locale;
  resources: CatalogResource[];
  capabilities: Array<{ provider: PaymentProvider; configured: boolean }>;
  types: string[];
  filters: { q?: string; type?: string; price?: string; sort?: string };
  page: number;
  totalPages: number;
  total: number;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  const hasFilters = Boolean(filters.q || filters.type || filters.price || (filters.sort && filters.sort !== "newest"));
  const resultLabel = ar
    ? `${total} ${total === 1 ? "مورد" : "موارد"}`
    : en
      ? `${total} resource${total === 1 ? "" : "s"}`
      : `${total} ressource${total === 1 ? "" : "s"}`;

  return (
    <>
      <form className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 mb-8" method="get" role="search">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 block" htmlFor="resource-search">
            {ar ? "ما المورد الذي تبحث عنه؟" : en ? "What resource are you looking for?" : "Quelle ressource recherchez-vous ?"}
          </label>
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-slate-400">
              <Icon name="search" size={20} />
            </div>
            <input
              id="resource-search"
              name="q"
              maxLength={100}
              defaultValue={filters.q}
              autoComplete="off"
              className="w-full h-11 !ps-11 !pe-28 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#142B47] focus:border-transparent transition-all"
              placeholder={ar ? "مثال: الملاحظة داخل القسم" : en ? "For example: classroom observation" : "Exemple : observation en classe"}
            />
            <button className="absolute end-1.5 top-1.5 bottom-1.5 px-4 bg-[#142B47] hover:bg-[#1E3F66] text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center cursor-pointer" type="submit">
              {ar ? "بحث" : en ? "Search" : "Rechercher"}
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label={ar ? "تصفية النتائج" : en ? "Filter results" : "Filtrer les résultats"}>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                {ar ? "النوع" : en ? "Type" : "Type"}
              </label>
              <select
                name="type"
                defaultValue={filters.type ?? ""}
                onChange={(e) => e.target.form?.requestSubmit()}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#142B47] focus:border-transparent transition-all cursor-pointer"
              >
                <option value="">{ar ? "كل الموارد" : en ? "All resources" : "Toutes les ressources"}</option>
                {types.map((item) => <option key={item} value={item}>{TYPE_LABEL[item]?.[locale] ?? item}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                {ar ? "السعر" : en ? "Price" : "Prix"}
              </label>
              <select
                name="price"
                defaultValue={filters.price ?? ""}
                onChange={(e) => e.target.form?.requestSubmit()}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#142B47] focus:border-transparent transition-all cursor-pointer"
              >
                <option value="">{ar ? "كل الأسعار" : en ? "All prices" : "Tous les prix"}</option>
                <option value="free">{ar ? "مجاني" : en ? "Free" : "Gratuit"}</option>
                <option value="paid">{ar ? "مدفوع" : en ? "Paid" : "Payant"}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                {ar ? "الترتيب" : en ? "Sort" : "Trier"}
              </label>
              <select
                name="sort"
                defaultValue={filters.sort ?? "relevance"}
                onChange={(e) => e.target.form?.requestSubmit()}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#142B47] focus:border-transparent transition-all cursor-pointer"
              >
                <option value="relevance">{ar ? "الأكثر صلة" : en ? "Most relevant" : "Plus pertinents"}</option>
                <option value="newest">{ar ? "الأحدث" : en ? "Newest" : "Plus récents"}</option>
                <option value="price-asc">{ar ? "السعر تصاعديًا" : en ? "Price: low to high" : "Prix croissant"}</option>
                <option value="price-desc">{ar ? "السعر تنازليًا" : en ? "Price: high to low" : "Prix décroissant"}</option>
              </select>
            </div>
          </div>
          {hasFilters ? (
            <div className="mt-3 flex justify-end">
              <Link className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#142B47] transition-colors underline underline-offset-4" href={`/${locale}/bibliotheque`}>
                <Icon name="close" size={14} />
                {ar ? "مسح الفلاتر" : en ? "Clear filters" : "Effacer les filtres"}
              </Link>
            </div>
          ) : null}
        </div>
      </form>

      <div className="catalog-results-heading">
        <div>
          <span>{ar ? "المكتبة" : en ? "Library" : "Bibliothèque"}</span>
          <h2 className="font-sans font-semibold tracking-[-0.02em] text-slate-900 tabular-nums">{resultLabel}</h2>
        </div>
        {filters.q ? <p>{ar ? `نتائج البحث عن «${filters.q}»` : en ? `Search results for “${filters.q}”` : `Résultats pour « ${filters.q} »`}</p> : <p>{ar ? "موارد مختارة للممارسة المهنية." : en ? "A concise selection for professional practice." : "Une sélection concise pour la pratique professionnelle."}</p>}
      </div>

      <div className="resource-grid resource-grid-editorial">
        {resources.map((resource) => {
          const typeLabel = TYPE_LABEL[resource.type]?.[locale] ?? resource.type;
          return (
            <article className="resource-card resource-card-editorial" key={resource.id}>
              {resource.coverImageUrl ? (
                <div className="resource-cover resource-cover-image w-44 sm:w-48 shrink-0 relative">
                  <Image src={resource.coverImageUrl} alt="" fill sizes="(max-width: 767px) 100vw, 34vw" unoptimized />
                </div>
              ) : (
                <div className="resource-cover resource-cover-master w-44 sm:w-48 shrink-0 flex flex-col justify-between p-5 bg-gradient-to-br from-[#142B47] to-[#0D1E33]">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-white/10 text-[#E5C158] border border-white/15 backdrop-blur-xs !w-fit !h-auto">
                    {typeLabel}
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center my-auto mx-auto shadow-inner">
                    <Icon name="book" size={24} className="text-[#E5C158]" />
                  </div>
                  <small className="tracking-[0.2em] text-[10px] text-white/60 font-medium uppercase text-center block">
                    ANEI · ÉDITIONS
                  </small>
                </div>
              )}
              <div className="resource-card-body">
                <div className="resource-meta-row">
                  <span>{typeLabel}</span>
                  <span>{LEVEL_LABEL[resource.level]?.[locale] ?? resource.level}</span>
                </div>
                <h3 className="font-sans font-semibold text-lg md:text-xl tracking-[-0.015em] leading-snug text-slate-900 hover:text-slate-700 transition-colors">{resource.title}</h3>
                <p>{resource.description}</p>
                <dl className="resource-facts">
                  <div><dt>{ar ? "موجّه إلى" : en ? "For" : "Pour"}</dt><dd>{resource.audience}</dd></div>
                  <div><dt>{ar ? "السعر" : en ? "Price" : "Prix"}</dt><dd>{formatMillimes(resource.priceMillimes, locale)}</dd></div>
                </dl>
                <div className="resource-checkout-wrap mt-auto">
                  {resource.priceMillimes === 0 ? (
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full pt-1">
                      <a
                        href={resource.downloadUrl || "/documents/guide-complet-autisme-accompagnement-scolaire-anei.pdf"}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0056D2] hover:bg-[#00419e] text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Icon name="download" size={15} />
                        <span>{ar ? "تحميل الدليل (PDF مجاني)" : "Télécharger le guide (PDF gratuit)"}</span>
                      </a>
                      <a
                        href="/documents/guide-complet-autisme-accompagnement-scolaire-anei.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                        title={ar ? "قراءة أونلاين" : "Consulter en ligne"}
                      >
                        <Icon name="eye" size={15} />
                        <span className="whitespace-nowrap">{ar ? "قراءة" : "Consulter"}</span>
                      </a>
                    </div>
                  ) : (
                    <CheckoutButton itemType="resource" itemId={resource.id} locale={locale} capabilities={capabilities} label={ar ? "شراء المورد" : en ? "Purchase resource" : "Acheter la ressource"} />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-2">
                  <Icon name="shield" size={12} className="text-emerald-700 flex-none" />
                  <span>{ar ? "تحميل فوري وآمن بصيغة PDF عالية الدقة" : "Téléchargement immédiat et sécurisé au format PDF"}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!resources.length ? <div className="empty-state">{ar ? "لا توجد موارد مطابقة. جرّب كلمات أقل أو امسح الفلاتر." : en ? "No resources match. Try fewer words or clear the filters." : "Aucune ressource ne correspond. Essayez moins de mots ou effacez les filtres."}</div> : null}
      <Pagination locale={locale} basePath={`/${locale}/bibliotheque`} page={page} totalPages={totalPages} params={filters} />
    </>
  );
}
