import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { SpecialistFilter, type SpecialistProfileItem } from "@/components/interactive/SpecialistFilter";
import { searchVisibleSpecialists } from "@/server/queries/catalog";
import { publicDataOr } from "@/server/queries/public-fallback";

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function pageNumber(value?: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar
      ? "دليل الأخصائيين المعتمدين في التربية الدامجة | ANEI"
      : "Annuaire des Spécialistes du Développement et du Soutien Scolaire | ANEI",
    description: ar
      ? "ابحث عن أخصائي تقويم نطق، أخصائي نفسي، علاج حركي أو وظيفي معتمد في تونس. استشارات بالعيادة أو عن بعد."
      : "Consultez l'annuaire certifié ANEI d'orthophonistes, psychologues, psychomotriciens et ergothérapeutes en Tunisie.",
  };
}

export default async function SpecialistesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";

  const raw = await searchParams;
  const filters = {
    q: one(raw.q)?.slice(0, 100),
    category: one(raw.category)?.slice(0, 100),
    governorate: one(raw.governorate)?.slice(0, 100),
    city: one(raw.city)?.slice(0, 100),
    certified: one(raw.certified) === "true",
  };
  const page = pageNumber(one(raw.page));

  const data = await publicDataOr(
    "specialists",
    () =>
      searchVisibleSpecialists({
        q: filters.q,
        category: filters.category,
        governorate: filters.governorate,
        city: filters.city,
        certified: filters.certified,
        page,
        pageSize: 36,
      }),
    {
      items: [],
      total: 0,
      page,
      pageSize: 36,
      totalPages: 1,
      governorates: [],
    },
  );

  const profiles: SpecialistProfileItem[] = data.items.map((item) => ({
    id: item.id,
    displayName: item.displayName,
    slug: item.slug,
    directoryType: item.directoryType,
    category: item.category,
    cityFr: item.cityFr,
    cityAr: item.cityAr,
    governorateFr: item.governorateFr,
    governorateAr: item.governorateAr,
    specialtyFr: item.specialtyFr,
    specialtyAr: item.specialtyAr,
    workplaceName: item.workplaceName,
    workplaceAddress: item.workplaceAddress,
    licenseOrOrderNumber: item.licenseOrOrderNumber,
    universityDegree: item.universityDegree,
    contactPhone: item.contactPhone,
    whatsappPhone: item.whatsappPhone,
    showPhonePublicly: item.showPhonePublicly,
    inPersonPriceMillimes: item.inPersonPriceMillimes,
    onlineVisioPriceMillimes: item.onlineVisioPriceMillimes,
    consultationDurationMinutes: item.consultationDurationMinutes,
    rating: item.rating,
    reviewCount: item.reviewCount,
    certified: item.certified,
    image: item.image,
    bioFr: item.bioFr,
    bioAr: item.bioAr,
  }));

  return (
    <div className="min-h-screen bg-[#FDFDFC]">
      <PageHero
        eyebrow={ar ? "الشبكة الوطنية للأخصائيين" : "Réseau National des Praticiens"}
        title={
          ar
            ? "دليل الأخصائيين في التربية الدامجة وتأهيل الطفل"
            : "Annuaire des Spécialistes du Développement & du Soutien Scolaire"
        }
        description={
          ar
            ? "ابحث عن أخصائي تقويم نطق، أخصائي نفسي، علاج حركي أو وظيفي معتمد في تونس. احجز موعدك بالعيادة أو عبر استشارة مرئية آمنة."
            : "Trouvez un orthophoniste, psychologue, psychomotricien ou ergothérapeute qualifié. Prenez rendez-vous en cabinet ou en téléconsultation sécurisée."
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <SpecialistFilter
          locale={locale}
          initialProfiles={profiles}
          governorates={data.governorates}
        />
      </main>
    </div>
  );
}
