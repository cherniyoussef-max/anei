import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { AvsFilter, type AvsDirectoryProfile } from "@/components/interactive/AvsFilter";
import { Icon } from "@/components/ui/Icon";
import { searchVisibleAvs } from "@/server/queries/catalog";

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function pageNumber(value?: string) { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1; }

export const dynamic = "force-dynamic";
export default async function AvsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const raw = await searchParams;
  const filters = { q: one(raw.q)?.slice(0, 100), city: one(raw.city)?.slice(0, 100), certified: one(raw.certified) === "true" ? "true" : undefined };
  const data = await searchVisibleAvs({ q: filters.q, city: filters.city, certified: filters.certified === "true", page: pageNumber(one(raw.page)) });
  const profiles: AvsDirectoryProfile[] = data.items.map((profile) => ({ id: profile.id, name: profile.displayName, city: ar ? profile.cityAr : profile.cityFr, specialty: ar ? profile.specialtyAr : profile.specialtyFr, availability: ar ? profile.availabilityAr : profile.availabilityFr, certified: profile.certified, initials: profile.displayName.split(" ").slice(0, 2).map((part) => part[0]).join("") }));
  return <><PageHero eyebrow={ar ? "شبكة المرافقين" : "Réseau AVS"} title={ar ? "اعثر على مرافق مدرسي مناسب" : "Trouver un AVS certifié, proche et qualifié"} description={ar ? "بحث حسب المنطقة والاختصاص والتوفر مع إشارة واضحة إلى الاعتماد." : "Recherche par région, spécialité et disponibilité, avec statut de certification explicite."} /><section className="section"><div className="container"><AvsFilter locale={locale} profiles={profiles} cities={data.cities} filters={filters} page={data.page} totalPages={data.totalPages} total={data.total} /></div></section><section className="section section-tint"><div className="container certification-band"><div className="certification-icon"><Icon name="award" size={32} /></div><div><span className="eyebrow">{ar ? "اعتماد ANEI" : "Certification ANEI"}</span><h2>{ar ? "ملف مهني أوضح للعائلات والمؤسسات" : "Un repère professionnel pour familles et établissements"}</h2><p>{ar ? "يظهر الاعتماد فقط عندما يتم توثيقه في المنصة من طرف الإدارة." : "Le badge n’est affiché que lorsque la certification est enregistrée et validée dans la plateforme."}</p></div></div></section></>;
}
