import Link from "next/link";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";

export type AvsDirectoryProfile = {
  id: string;
  name: string;
  city: string;
  specialty: string;
  availability: string;
  certified: boolean;
  initials: string;
};

export function AvsFilter({ locale, profiles, cities, filters, page, totalPages, total }: { locale: Locale; profiles: AvsDirectoryProfile[]; cities: string[]; filters: { q?: string; city?: string; certified?: string }; page: number; totalPages: number; total: number }) {
  const ar = locale === "ar";
  const en = locale === "en";
  return <><form className="avs-search-panel compact-search directory-filter" method="get"><label className="search-field"><Icon name="search" size={19} /><input name="q" maxLength={100} defaultValue={filters.q} placeholder={ar ? "الاسم أو الاختصاص..." : en ? "Name or specialty..." : "Nom ou spécialité..."} /></label><select name="city" defaultValue={filters.city ?? ""} aria-label={ar ? "الجهة" : en ? "Region" : "Ville"}><option value="">{ar ? "كل الجهات" : en ? "All regions" : "Toutes les régions"}</option>{cities.map((item) => <option value={item} key={item}>{item}</option>)}</select><label className="checkbox-filter"><input type="checkbox" name="certified" value="true" defaultChecked={filters.certified === "true"} /><span>{ar ? "معتمد فقط" : en ? "Certified only" : "Certifiés uniquement"}</span></label><button className="btn btn-primary" type="submit">{ar ? "بحث" : en ? "Search" : "Rechercher"}</button><Link className="btn btn-ghost" href={`/${locale}/avs`}>{ar ? "إعادة ضبط" : en ? "Reset" : "Réinitialiser"}</Link></form><div className="catalog-result-summary" role="status">{ar ? `${total} ملف` : en ? `${total} profile${total === 1 ? "" : "s"}` : `${total} profil${total > 1 ? "s" : ""}`}</div><div className="avs-grid">{profiles.map((profile) => <article className="avs-card premium-card" key={profile.id}><div className="avs-avatar">{profile.initials}</div><div className="avs-card-main"><div className="avs-name-row"><h3>{profile.name}</h3>{profile.certified ? <span className="certified"><Icon name="check" size={13} />{ar ? "معتمد ANEI" : en ? "ANEI certified" : "Certifié ANEI"}</span> : null}</div><p className="avs-specialty">{profile.specialty}</p><div className="meta-row"><span><Icon name="map" size={15} />{profile.city}</span><span className="available-dot">{profile.availability}</span></div></div><Link className="btn btn-secondary" href={`/${locale}/contact?avs=${encodeURIComponent(profile.name)}`}>{ar ? "تواصل" : en ? "Contact" : "Contacter"}</Link></article>)}</div>{!profiles.length ? <div className="empty-state">{ar ? "لا توجد ملفات مطابقة لهذه المعايير." : en ? "No profiles match these filters." : "Aucun profil ne correspond à ces critères."}</div> : null}<Pagination locale={locale} basePath={`/${locale}/avs`} page={page} totalPages={totalPages} params={filters} /></>;
}
