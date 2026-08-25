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
      <form className="catalog-discovery library-discovery" method="get" role="search">
        <div className="catalog-search-group">
          <label htmlFor="resource-search">{ar ? "ما المورد الذي تبحث عنه؟" : en ? "What resource are you looking for?" : "Quelle ressource recherchez-vous ?"}</label>
          <div className="catalog-search-control">
            <Icon name="search" size={21} />
            <input
              id="resource-search"
              name="q"
              maxLength={100}
              defaultValue={filters.q}
              autoComplete="off"
              placeholder={ar ? "مثال: الملاحظة داخل القسم" : en ? "For example: classroom observation" : "Exemple : observation en classe"}
            />
            <button className="btn btn-primary catalog-search-submit" type="submit">
              {ar ? "بحث" : en ? "Search" : "Rechercher"}
            </button>
          </div>
        </div>

        <div className="catalog-filter-row" aria-label={ar ? "تصفية النتائج" : en ? "Filter results" : "Filtrer les résultats"}>
          <strong>{ar ? "تصفية حسب" : en ? "Refine by" : "Affiner par"}</strong>
          <label>
            <span>{ar ? "النوع" : en ? "Type" : "Type"}</span>
            <select name="type" defaultValue={filters.type ?? ""}>
              <option value="">{ar ? "كل الموارد" : en ? "All resources" : "Toutes les ressources"}</option>
              {types.map((item) => <option key={item} value={item}>{TYPE_LABEL[item]?.[locale] ?? item}</option>)}
            </select>
          </label>
          <label>
            <span>{ar ? "السعر" : en ? "Price" : "Prix"}</span>
            <select name="price" defaultValue={filters.price ?? ""}>
              <option value="">{ar ? "كل الأسعار" : en ? "All prices" : "Tous les prix"}</option>
              <option value="free">{ar ? "مجاني" : en ? "Free" : "Gratuit"}</option>
              <option value="paid">{ar ? "مدفوع" : en ? "Paid" : "Payant"}</option>
            </select>
          </label>
          <label>
            <span>{ar ? "الترتيب" : en ? "Sort" : "Trier"}</span>
            <select name="sort" defaultValue={filters.sort ?? "relevance"}>
              <option value="relevance">{ar ? "الأكثر صلة" : en ? "Most relevant" : "Plus pertinents"}</option>
              <option value="newest">{ar ? "الأحدث" : en ? "Newest" : "Plus récents"}</option>
              <option value="price-asc">{ar ? "السعر تصاعديًا" : en ? "Price: low to high" : "Prix croissant"}</option>
              <option value="price-desc">{ar ? "السعر تنازليًا" : en ? "Price: high to low" : "Prix décroissant"}</option>
            </select>
          </label>
          <button className="btn btn-secondary catalog-filter-submit" type="submit">{ar ? "تطبيق" : en ? "Apply filters" : "Appliquer les filtres"}</button>
          {hasFilters ? <Link className="catalog-reset-link" href={`/${locale}/bibliotheque`}>{ar ? "مسح الفلاتر" : en ? "Clear filters" : "Effacer les filtres"}</Link> : null}
        </div>
      </form>

      <div className="catalog-results-heading">
        <div>
          <span>{ar ? "المكتبة" : en ? "Library" : "Bibliothèque"}</span>
          <h2>{resultLabel}</h2>
        </div>
        {filters.q ? <p>{ar ? `نتائج البحث عن «${filters.q}»` : en ? `Search results for “${filters.q}”` : `Résultats pour « ${filters.q} »`}</p> : <p>{ar ? "موارد مختارة للممارسة المهنية." : en ? "A concise selection for professional practice." : "Une sélection concise pour la pratique professionnelle."}</p>}
      </div>

      <div className="resource-grid resource-grid-editorial">
        {resources.map((resource, index) => {
          const typeLabel = TYPE_LABEL[resource.type]?.[locale] ?? resource.type;
          return (
            <article className="resource-card resource-card-editorial" key={resource.id}>
              {resource.coverImageUrl ? (
                <div className="resource-cover resource-cover-image">
                  <Image src={resource.coverImageUrl} alt="" fill sizes="(max-width: 767px) 100vw, 34vw" unoptimized />
                </div>
              ) : (
                <div className={`resource-cover resource-cover-${index + 1}`}>
                  <span className="resource-cover-type">{typeLabel}</span>
                  <Icon name="book" size={38} />
                  <small>ANEI</small>
                </div>
              )}
              <div className="resource-card-body">
                <div className="resource-meta-row">
                  <span>{typeLabel}</span>
                  <span>{LEVEL_LABEL[resource.level]?.[locale] ?? resource.level}</span>
                </div>
                <h3>{resource.title}</h3>
                <p>{resource.description}</p>
                <dl className="resource-facts">
                  <div><dt>{ar ? "موجّه إلى" : en ? "For" : "Pour"}</dt><dd>{resource.audience}</dd></div>
                  <div><dt>{ar ? "السعر" : en ? "Price" : "Prix"}</dt><dd>{formatMillimes(resource.priceMillimes, locale)}</dd></div>
                </dl>
                <CheckoutButton itemType="resource" itemId={resource.id} locale={locale} capabilities={capabilities} label={ar ? "شراء المورد" : en ? "Purchase resource" : "Acheter la ressource"} />
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
