import Link from "next/link";
import type { Locale } from "@/types";
import type { PaymentProvider } from "@/server/payments/types";
import { formatMillimes } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { CheckoutButton } from "@/components/commerce/CheckoutButton";
import { Pagination } from "@/components/ui/Pagination";

export type CatalogResource = { id: string; title: string; description: string; audience: string; type: string; priceMillimes: number };

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
  return (
    <>
      <form className="catalog-toolbar catalog-toolbar-advanced library-toolbar" method="get">
        <label className="search-field"><Icon name="search" size={19} /><input name="q" maxLength={100} defaultValue={filters.q} placeholder={ar ? "ابحث في المكتبة..." : "Rechercher dans la librairie..."} /></label>
        <select name="type" defaultValue={filters.type ?? ""} aria-label={ar ? "نوع المورد" : "Type de ressource"}>
          <option value="">{ar ? "كل الموارد" : "Toutes les ressources"}</option>
          {types.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select name="price" defaultValue={filters.price ?? ""} aria-label={ar ? "السعر" : "Prix"}>
          <option value="">{ar ? "مجاني ومدفوع" : "Gratuit et payant"}</option>
          <option value="free">{ar ? "مجاني" : "Gratuit"}</option>
          <option value="paid">{ar ? "مدفوع" : "Payant"}</option>
        </select>
        <select name="sort" defaultValue={filters.sort ?? "newest"} aria-label={ar ? "الترتيب" : "Tri"}>
          <option value="newest">{ar ? "الأحدث" : "Plus récents"}</option>
          <option value="price-asc">{ar ? "السعر تصاعديًا" : "Prix croissant"}</option>
          <option value="price-desc">{ar ? "السعر تنازليًا" : "Prix décroissant"}</option>
        </select>
        <button className="btn btn-primary" type="submit">{ar ? "تطبيق" : "Appliquer"}</button>
        <Link className="btn btn-ghost" href={`/${locale}/bibliotheque`}>{ar ? "إعادة ضبط" : "Réinitialiser"}</Link>
      </form>
      <div className="catalog-result-summary" role="status">{ar ? `${total} مورد` : `${total} ressource${total > 1 ? "s" : ""}`}</div>
      <div className="resource-grid">
        {resources.map((resource, index) => (
          <article className="resource-card premium-card" key={resource.id}>
            <div className={`resource-cover course-art-${["blue", "cyan", "green", "violet"][index % 4]}`}><span><Icon name="book" size={30} /></span><small>ANEI · {resource.type}</small></div>
            <div className="resource-card-body">
              <span className="resource-audience">{resource.audience}</span>
              <h3>{resource.title}</h3><p>{resource.description}</p>
              <div className="resource-price"><strong>{formatMillimes(resource.priceMillimes, locale)}</strong></div>
              <CheckoutButton itemType="resource" itemId={resource.id} locale={locale} capabilities={capabilities} label={ar ? "شراء" : "Acheter"} />
            </div>
          </article>
        ))}
      </div>
      {!resources.length ? <div className="empty-state">{ar ? "لا توجد موارد مطابقة لهذه المعايير." : "Aucune ressource ne correspond à ces critères."}</div> : null}
      <Pagination locale={locale} basePath={`/${locale}/bibliotheque`} page={page} totalPages={totalPages} params={filters} />
    </>
  );
}
