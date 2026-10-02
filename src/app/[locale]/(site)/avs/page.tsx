import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { AvsFilter, type AvsDirectoryProfile } from "@/components/interactive/AvsFilter";
import { Icon } from "@/components/ui/Icon";
import { searchVisibleAvs } from "@/server/queries/catalog";
import { avsProfiles as avsTranslations } from "@/lib/data";
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "دليل وحجوزات المرافقين المدرسيين (AVS) | ANEI" : "Annuaire & Rendez-vous AVS en Tunisie | ANEI",
    description: ar
      ? "ابحث عن مرافق مدرسي مؤهل ومعتمد في تونس حسب الولاية والاختصاص، واحجز موعد مقابلة أو مرافقة مباشرة."
      : "Trouvez un accompagnant scolaire (AVS) certifié en Tunisie selon vos besoins (TSA, DYS, TDAH) et prenez rendez-vous directement.",
  };
}

export default async function AvsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const en = locale === "en";

  const raw = await searchParams;
  const filters = {
    q: one(raw.q)?.slice(0, 100),
    city: one(raw.city)?.slice(0, 100),
    governorate: one(raw.governorate)?.slice(0, 100),
    specialty: one(raw.specialty)?.slice(0, 100),
    availability: one(raw.availability)?.slice(0, 100),
    certified: one(raw.certified) === "true" ? "true" : undefined,
  };
  const page = pageNumber(one(raw.page));

  const data = await publicDataOr(
    "avs",
    () =>
      searchVisibleAvs({
        q: filters.q,
        city: filters.city,
        governorate: filters.governorate,
        specialty: filters.specialty,
        availability: filters.availability,
        certified: filters.certified === "true",
        page,
      }),
    {
      items: [],
      total: 0,
      page,
      pageSize: 12,
      totalPages: 1,
      cities: [],
      governorates: [],
      specialties: [],
    }
  );

  const profiles: AvsDirectoryProfile[] = data.items.map((profile) => {
    const translated = avsTranslations.find(
      (item) => item.name === profile.displayName || item.slug === profile.slug
    );

    const city = ar
      ? profile.cityAr
      : en
      ? translated?.city.en ?? profile.cityFr
      : profile.cityFr;

    const governorate = ar
      ? profile.governorateAr
      : en
      ? translated?.governorate?.en ?? profile.governorateFr
      : profile.governorateFr;

    const specialty = ar
      ? profile.specialtyAr
      : en
      ? translated?.specialty.en ?? profile.specialtyFr
      : profile.specialtyFr;

    const availability = ar
      ? profile.availabilityAr
      : en
      ? translated?.availability.en ?? profile.availabilityFr
      : profile.availabilityFr;

    const schoolsCovered = ar
      ? profile.schoolsCoveredAr
      : en
      ? translated?.schoolsCovered?.en ?? profile.schoolsCoveredFr
      : profile.schoolsCoveredFr;

    const bio = ar
      ? profile.bioAr
      : en
      ? translated?.bio?.en ?? profile.bioFr
      : profile.bioFr;

    const hourlyRateTnd =
      profile.hourlyRateMillimes > 0 ? Math.round(profile.hourlyRateMillimes / 1000) : 25;

    return {
      id: profile.id,
      name: profile.displayName,
      slug: profile.slug,
      city,
      governorate,
      specialty,
      availability,
      certified: profile.certified,
      initials: profile.displayName
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join(""),
      rating: profile.rating,
      reviewCount: profile.reviewCount,
      experienceYears: profile.experienceYears,
      hourlyRateTnd,
      interventionDomains: profile.interventionDomains ?? translated?.interventionDomains ?? [],
      pedagogicalMethods: profile.pedagogicalMethods ?? translated?.pedagogicalMethods ?? [],
      schoolsCovered,
      phone: profile.phone,
      email: profile.email,
      bio,
    };
  });

  return (
    <>
      <PageHero
        eyebrow={ar ? "الشبكة الوطنية للمرافقة المدرسية" : en ? "National AVS Network" : "Réseau National des AVS"}
        title={
          ar
            ? "اعثر على مرافق مدرسي معتمد واحجز موعدك مباشرة"
            : en
            ? "Find a certified AVS professional and book an appointment"
            : "Trouvez un AVS certifié et réservez votre rendez-vous en ligne"
        }
        description={
          ar
            ? "دليل موثوق ومفصل حسب الولاية، نوع الاضطراب (طيف التوحد، صعوبات التعلم، تشتت الانتباه...) مع إمكانية جدولة المقابلة الاستكشافية ومتابعة الطلب مباشرة."
            : en
            ? "Verified directory by governorate and disorder (Autism, DYS, ADHD, motor needs). Schedule preliminary meetings and communicate securely."
            : "Annuaire vérifié par gouvernorat, besoin spécifique (TSA, DYS, TDAH, handicap moteur) et disponibilité. Planifiez votre premier échange et coordonnez l'accompagnement de votre enfant."
        }
      />

      <section className="bg-[#fcfbf8] py-8 lg:py-10 border-b border-slate-200/80">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6">
          <AvsFilter
            locale={locale}
            profiles={profiles}
            cities={data.cities}
            governorates={data.governorates}
            specialties={data.specialties}
            filters={filters}
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
          />
        </div>
      </section>

      {/* Trust & Guarantee Banner */}
      <section className="bg-white py-12 lg:py-14 border-t border-slate-200/80">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
            <span className="text-[11px] font-bold text-[#082D55] uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              {ar ? "معايير الجودة والموثوقية" : "Garanties d'accompagnement ANEI"}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#082D55] font-[family-name:var(--font-fraunces)]">
              {ar ? "شبكة مهنية منظمة تضمن حق طفلك في تعليم دامج" : "Un réseau rigoureusement encadré pour la réussite de l'élève"}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#fcfbf8] rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100/80 text-[#082D55] flex items-center justify-center flex-none">
                <Icon name="award" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#082D55] font-[family-name:var(--font-fraunces)]">
                  {ar ? "اعتماد ANEI الموثوق" : "Certification ANEI rigoureuse"}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {ar
                    ? "ملفات مهنية يتم تدقيق شهاداتها وخبراتها الميدانية من طرف الهيئة البيداغوجية للأكاديمية."
                    : "Diplômes, formations continues et pratiques de terrain vérifiés par la commission pédagogique de l'académie."}
                </p>
              </div>
            </div>

            <div className="bg-[#fcfbf8] rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center flex-none">
                <Icon name="calendar" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#082D55] font-[family-name:var(--font-fraunces)]">
                  {ar ? "حجز مباشر وتنسيق مرن" : "Rendez-vous et suivi transparent"}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {ar
                    ? "حدد موعد المقابلة الاستكشافية وفق توفر المرافق والمؤسسة التربوية مع إشعار فوري."
                    : "Planifiez des entretiens préliminaires ou d'observation selon vos créneaux et ceux de l'école."}
                </p>
              </div>
            </div>

            <div className="bg-[#fcfbf8] rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center flex-none">
                <Icon name="shield" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#082D55] font-[family-name:var(--font-fraunces)]">
                  {ar ? "حماية الخصوصية ومصلحة الطفل" : "Confidentialité & éthique"}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {ar
                    ? "معلومات التلميذ وملفه التربوي محفوظة وفق معايير الأمان وحماية المعطيات الشخصية."
                    : "Données de santé et besoins de l'enfant protégés. Aucun partage sans le consentement explicite des familles."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
