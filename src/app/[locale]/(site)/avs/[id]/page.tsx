import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { getAvsByIdOrSlug } from "@/server/queries/catalog";
import { avsProfiles as avsTranslations } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { AvsProfileBookingSection } from "@/components/interactive/AvsProfileBookingSection";
import {
  localizeAvsName,
  localizeAvsInitials,
  localizeDomain,
  localizeMethod,
} from "@/lib/arabic-locale";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const profile = await getAvsByIdOrSlug(id);
  if (!profile) return { title: "Profil introuvable | ANEI" };

  const ar = locale === "ar";
  const displayName = ar ? localizeAvsName(profile.displayName, locale) : profile.displayName;
  return {
    title: `${displayName} - ${ar ? profile.specialtyAr : profile.specialtyFr} | ANEI`,
    description: ar
      ? `الملف المهني للمرافق(ة) المدرسي(ة) ${displayName} في ${profile.cityAr} (${profile.governorateAr}). حجز موعد مقابلة مباشرة.`
      : `Profil professionnel de ${profile.displayName}, accompagnant(e) scolaire à ${profile.cityFr} (${profile.governorateFr}). Prenez rendez-vous en ligne.`,
  };
}

export default async function AvsProfileDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const en = locale === "en";

  const profile = await getAvsByIdOrSlug(id);
  if (!profile) notFound();

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

  const bio = ar
    ? profile.bioAr
    : en
    ? translated?.bio?.en ?? profile.bioFr
    : profile.bioFr;

  const schoolsCovered = ar
    ? profile.schoolsCoveredAr
    : en
    ? translated?.schoolsCovered?.en ?? profile.schoolsCoveredFr
    : profile.schoolsCoveredFr;

  const address = ar ? profile.addressAr : profile.addressFr;
  const hourlyRateTnd =
    profile.hourlyRateMillimes > 0 ? Math.round(profile.hourlyRateMillimes / 1000) : 25;

  const domains = profile.interventionDomains ?? translated?.interventionDomains ?? [
    "Accompagnement scolaire général",
    "Adaptations pédagogiques",
  ];

  const methods = profile.pedagogicalMethods ?? translated?.pedagogicalMethods ?? [
    "Guidance visuelle",
    "Renforcement positif",
  ];

  const displayName = ar ? localizeAvsName(profile.displayName, locale) : profile.displayName;
  const initials = localizeAvsInitials(profile.displayName, locale);
  const localizedDomains = domains.map((dom) => localizeDomain(dom, locale));
  const localizedMethods = methods.map((method) => localizeMethod(method, locale));

  return (
    <div className="bg-[#F4F7FA] min-h-screen py-8 lg:py-10">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Subtle Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 font-medium" aria-label="Breadcrumb">
          <Link href={`/${locale}`} className="hover:text-[#1B3A5C] transition-colors">
            {ar ? "الرئيسية" : "Accueil"}
          </Link>
          <span className="text-slate-300">/</span>
          <Link href={`/${locale}/avs`} className="hover:text-[#1B3A5C] transition-colors">
            {ar ? "دليل المرافقين (AVS)" : "Annuaire AVS"}
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 font-semibold">{displayName}</span>
        </nav>

        {/* Profile Hero Header Card */}
        <header className="bg-white rounded-2xl border border-[#E3E8EF] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-5 sm:gap-6">
              {/* Avatar with Status Indicator */}
              <div className="relative flex-none">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#1B3A5C] text-white flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-xs border-2 border-white ring-1 ring-[#E3E8EF]">
                  {initials}
                </div>
                <span
                  className="absolute -bottom-1 -end-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs"
                  title={ar ? "متاح للمرافقة" : "Disponible"}
                />
              </div>

              {/* Identity Details */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-bold font-editorial-serif text-[#1B3A5C] tracking-tight">
                    {displayName}
                  </h1>
                  {profile.certified && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F4F7FA] text-[#1B3A5C] border border-[#E3E8EF]">
                      <Icon name="award" size={13} className="text-[#B8925A]" />
                      <span>{ar ? "معتمد ANEI" : "Certifié ANEI"}</span>
                    </span>
                  )}
                </div>

                <p className="text-sm sm:text-base font-semibold text-slate-700">{specialty}</p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Icon name="map" size={14} className="text-slate-400" />
                    <span>{city} ({governorate})</span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <span className="text-amber-500">★</span>
                    <span>{((profile.rating || 49) / 10).toFixed(1)}</span>
                    <span className="text-slate-400 font-normal">
                      ({profile.reviewCount || 20} {ar ? "تقييم أولياء ومربين" : "avis vérifiés"})
                    </span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>{profile.experienceYears || 4} {ar ? "سنوات خبرة ميدانية" : "ans d'expérience"}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Two-Column Layout: Left Dossier (7 cols) + Right Sticky Booking (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Unified Professional Dossier */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-[#E3E8EF] shadow-xs divide-y divide-[#E3E8EF] overflow-hidden">
              {/* 1. Bio & Educational Approach */}
              <section className="p-6 sm:p-7 space-y-3">
                <h2 className="text-lg font-bold font-editorial-serif text-[#1B3A5C] tracking-tight">
                  {ar ? "نبذة عن المرافق والنهج البيداغوجي" : "Présentation & Démarche d'accompagnement"}
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line max-w-prose">
                  {bio}
                </p>
              </section>

              {/* 2. Needs & Specializations */}
              <section className="p-6 sm:p-7 space-y-3.5">
                <h2 className="text-lg font-bold font-editorial-serif text-[#1B3A5C] tracking-tight">
                  {ar ? "مجالات التدخل والاضطرابات المشمولة" : "Besoins pris en charge & Spécialisations"}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {localizedDomains.map((dom) => (
                    <div
                      key={dom}
                      className="p-3 rounded-xl bg-[#F4F7FA] border border-[#E3E8EF] flex items-center gap-2.5 text-xs font-semibold text-slate-800"
                    >
                      <Icon name="check" size={14} className="text-[#3A8DB5] flex-none" />
                      <span>{dom}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. Pedagogical Methods & Tools */}
              <section className="p-6 sm:p-7 space-y-3.5">
                <h2 className="text-lg font-bold font-editorial-serif text-[#1B3A5C] tracking-tight">
                  {ar ? "الأساليب والأدوات المعتمدة" : "Méthodes et outils pédagogiques"}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {localizedMethods.map((method) => (
                    <span
                      key={method}
                      className="px-3.5 py-1.5 rounded-lg border border-[#E3E8EF] bg-white text-slate-700 text-xs font-medium"
                    >
                      {method}
                    </span>
                  ))}
                </div>
              </section>

              {/* 4. Schools & Geographic Radius */}
              <section className="p-6 sm:p-7 space-y-3">
                <h2 className="text-lg font-bold font-editorial-serif text-[#1B3A5C] tracking-tight">
                  {ar ? "المؤسسات التعليمية ونطاق التنقل" : "Établissements scolaires & Rayon d'action"}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {schoolsCovered || (ar ? "المؤسسات التعليمية العمومية والخاصة بالمنطقة." : "Établissements primaires et collèges de la zone.")}
                </p>
                {address && (
                  <div className="pt-1 text-xs text-slate-500 flex items-center gap-1.5">
                    <Icon name="map" size={14} className="text-slate-400" />
                    <span>{address}</span>
                  </div>
                )}
              </section>
            </div>

            {/* 5. Institutional Reassurance & Ethical Charter */}
            <div className="bg-[#F4F7FA] border border-[#E3E8EF] rounded-2xl p-6 sm:p-7 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#B8925A] font-bold">
                <Icon name="shield" size={15} />
                <span>{ar ? "ضمانات منصة ANEI" : "Garanties d'accompagnement ANEI"}</span>
              </div>
              <h3 className="text-base font-bold font-editorial-serif text-[#1B3A5C]">
                {ar ? "مرافقة تربوية منظمة ومحمية قانونياً" : "Un cadre d'inclusion structuré et transparent"}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {ar
                  ? "جميع المواعيد والاتفاقيات تتبع إطار الميثاق الوطني للمرافقة المدرسية لضمان التنسيق الإيجابي بين الأسرة والمدرسة والمختصين مع حماية الدفع المالي تحت نظام الضمان التابع للأكاديمية."
                  : "Chaque mise en relation s'inscrit dans le cadre déontologique de l'ANEI. Un suivi coordonné entre la famille, l'équipe éducative et les spécialistes de santé, avec protection financière sous séquestre de l'Académie."}
              </p>
            </div>
          </div>

          {/* RIGHT: Sticky Booking Experience */}
          <div className="lg:col-span-5 sticky top-8">
            <AvsProfileBookingSection
              locale={locale}
              avs={{
                id: profile.id,
                name: displayName,
                specialty,
                city,
                governorate,
                hourlyRateTnd,
                initials,
                domains: localizedDomains,
                phone: profile.contactPhone || profile.phone,
                email: profile.email,
                availability: ar ? profile.availabilityAr : profile.availabilityFr,
                availabilityStatusLabel: profile.availabilityStatusLabel,
                acceptedModalities: profile.acceptedModalities,
                availableLocationsText: profile.availableLocationsText,
                weeklySchedule: profile.weeklySchedule as Record<string, { enabled: boolean; slots: string[] }>,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
