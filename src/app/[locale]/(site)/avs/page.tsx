import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { AvsFilter, type AvsDirectoryProfile } from "@/components/interactive/AvsFilter";
import { Icon } from "@/components/ui/Icon";
import { searchVisibleAvs } from "@/server/queries/catalog";
import { avsProfiles as avsTranslations } from "@/lib/data";
import { publicDataOr } from "@/server/queries/public-fallback";

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function pageNumber(value?: string) { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1; }

export const dynamic = "force-dynamic";
export default async function AvsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const en = locale === "en";
  const raw = await searchParams;
  const filters = { q: one(raw.q)?.slice(0, 100), city: one(raw.city)?.slice(0, 100), certified: one(raw.certified) === "true" ? "true" : undefined };
  const page = pageNumber(one(raw.page));
  const data = await publicDataOr("avs", () => searchVisibleAvs({ q: filters.q, city: filters.city, certified: filters.certified === "true", page }), {
    items: [], total: 0, page, pageSize: 12, totalPages: 1, cities: [],
  });
  const profiles: AvsDirectoryProfile[] = data.items.map((profile) => { const translated = avsTranslations.find((item) => item.name === profile.displayName); return ({ id: profile.id, name: profile.displayName, city: ar ? profile.cityAr : en ? translated?.city.en ?? profile.cityFr : profile.cityFr, specialty: ar ? profile.specialtyAr : en ? translated?.specialty.en ?? profile.specialtyFr : profile.specialtyFr, availability: ar ? profile.availabilityAr : en ? translated?.availability.en ?? profile.availabilityFr : profile.availabilityFr, certified: profile.certified, initials: profile.displayName.split(" ").slice(0, 2).map((part) => part[0]).join("") }); });
  return <><PageHero eyebrow={ar ? "شبكة المرافقين" : en ? "AVS network" : "Réseau AVS"} title={ar ? "اعثر على مرافق مدرسي مناسب" : en ? "Find a qualified AVS professional" : "Trouver un AVS certifié, proche et qualifié"} description={ar ? "بحث حسب المنطقة والاختصاص والتوفر مع إشارة واضحة إلى الاعتماد." : en ? "Search by region, specialty and availability, with clearly identified certification status." : "Recherche par région, spécialité et disponibilité, avec statut de certification explicite."} /><section className="section"><div className="container"><AvsFilter locale={locale} profiles={profiles} cities={data.cities} filters={filters} page={data.page} totalPages={data.totalPages} total={data.total} /></div></section><section className="section section-tint"><div className="container certification-band"><div className="certification-icon"><Icon name="award" size={32} /></div><div><span className="eyebrow">{ar ? "اعتماد ANEI" : en ? "ANEI certification" : "Certification ANEI"}</span><h2>{ar ? "ملف مهني أوضح للعائلات والمؤسسات" : en ? "A clearer professional reference for families and schools" : "Un repère professionnel pour familles et établissements"}</h2><p>{ar ? "يظهر الاعتماد فقط عندما يتم توثيقه في المنصة من طرف الإدارة." : en ? "The indicator appears only when certification has been recorded and validated on the platform." : "Le badge n’est affiché que lorsque la certification est enregistrée et validée dans la plateforme."}</p></div></div></section></>;
}
