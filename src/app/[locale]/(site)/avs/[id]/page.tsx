import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { getAvsByIdOrSlug } from "@/server/queries/catalog";
import { avsProfiles as avsTranslations } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { AvsProfileBookingSection } from "@/components/interactive/AvsProfileBookingSection";

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
  return {
    title: `${profile.displayName} - ${ar ? profile.specialtyAr : profile.specialtyFr} | ANEI`,
    description: ar
      ? `الملف المهني للمرافق(ة) المدرسي(ة) ${profile.displayName} في ${profile.cityAr} (${profile.governorateAr}). حجز موعد مقابلة مباشرة.`
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

  const availability = ar
    ? profile.availabilityAr
    : en
    ? translated?.availability.en ?? profile.availabilityFr
    : profile.availabilityFr;

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

  const initials = profile.displayName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500" aria-label="Breadcrumb">
          <Link href={`/${locale}`} className="hover:text-slate-900 transition-colors">
            {ar ? "الرئيسية" : "Accueil"}
          </Link>
          <span>/</span>
          <Link href={`/${locale}/avs`} className="hover:text-slate-900 transition-colors">
            {ar ? "دليل المرافقين (AVS)" : "Annuaire AVS"}
          </Link>
          <span>/</span>
          <span className="text-[#082D55] font-bold">{profile.displayName}</span>
        </nav>

        {/* Profile Hero Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-5">
              {/* Avatar with status indicator */}
              <div className="relative flex-none">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#082D55] to-[#15467b] text-white flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-md border-2 border-white">
                  {initials}
                </div>
                <span
                  className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                  title={ar ? "متاح للمرافقة" : "Disponible"}
                />
              </div>

              {/* Identity details */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#082D55]">{profile.displayName}</h1>
                  {profile.certified && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                      <Icon name="award" size={14} className="text-amber-600" />
                      <span>{ar ? "معتمد ANEI" : "Certifié ANEI"}</span>
                    </span>
                  )}
                </div>

                <p className="text-base font-semibold text-slate-700">{specialty}</p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Icon name="map" size={15} className="text-[#a9752f]" />
                    <span>{city} ({governorate})</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-700 font-bold">
                    <span>★ {((profile.rating || 49) / 10).toFixed(1)}</span>
                    <span className="text-slate-400 font-normal">({profile.reviewCount || 20} {ar ? "تقييم أولياء ومربين" : "avis vérifiés"})</span>
                  </span>
                  <span>•</span>
                  <span>{profile.experienceYears || 4} {ar ? "سنوات خبرة ميدانية" : "ans d'expérience"}</span>
                </div>
              </div>
            </div>

            {/* Price Badge */}
            <div className="flex-none bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center sm:text-end w-full sm:w-auto">
              <div className="text-xs text-slate-500">{ar ? "التعريفة الاسترشادية" : "Tarif indicatif"}</div>
              <div className="text-2xl font-extrabold text-[#082D55] mt-0.5">
                {hourlyRateTnd} <span className="text-sm font-semibold text-slate-600">TND / h</span>
              </div>
              <div className="text-xs text-emerald-700 font-medium mt-1">{availability}</div>
            </div>
          </div>
        </div>

        {/* Two-Column Layout: Left Details (7 cols) + Right Sticky Booking (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Profile Information */}
          <div className="lg:col-span-7 space-y-6">
            {/* Bio & Approach */}
            <div className="avs-approach-section bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-[#082D55] flex items-center gap-2">
                <Icon name="users" size={18} className="text-[#a9752f]" />
                <span>{ar ? "نبذة عن المرافق والنهج البيداغوجي" : "Présentation & Démarche d'accompagnement"}</span>
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{bio}</p>
            </div>

            {/* Intervention Domains */}
            <div className="avs-domains-section bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-[#082D55] flex items-center gap-2">
                <Icon name="check" size={18} className="text-[#a9752f]" />
                <span>{ar ? "مجالات التدخل والاضطرابات المشمولة" : "Besoins pris en charge & Spécialisations"}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {domains.map((dom) => (
                  <div
                    key={dom}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2 text-xs font-semibold text-slate-800"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#082D55] flex-none" />
                    <span>{dom}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pedagogical Methods */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-[#082D55] flex items-center gap-2">
                <Icon name="award" size={18} className="text-[#a9752f]" />
                <span>{ar ? "الأساليب والأدوات المعتمدة" : "Méthodes et outils pédagogiques"}</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {methods.map((method) => (
                  <span
                    key={method}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>

            {/* Schools & Geographic radius */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-[#082D55] flex items-center gap-2">
                <Icon name="map" size={18} className="text-[#a9752f]" />
                <span>{ar ? "المؤسسات التعليمية ونطاق التنقل" : "Établissements scolaires & Rayon d'action"}</span>
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {schoolsCovered || (ar ? "المؤسسات التعليمية العمومية والخاصة بالمنطقة." : "Établissements primaires et collèges de la zone.")}
              </p>
              {address && (
                <div className="pt-2 text-xs text-slate-500 flex items-center gap-1.5">
                  <Icon name="map" size={14} />
                  <span>{address}</span>
                </div>
              )}
            </div>

            {/* Verified Trust & Commitments */}
            <div className="bg-gradient-to-br from-slate-900 to-[#082D55] text-white rounded-2xl p-6 space-y-3 shadow-md">
              <div className="text-xs uppercase tracking-wider text-amber-300 font-bold">
                {ar ? "ضمانات منصة ANEI" : "Garanties d'accompagnement ANEI"}
              </div>
              <h3 className="text-lg font-bold">
                {ar ? "مرافقة تربوية منظمة وآمنة" : "Un cadre d'inclusion structuré et transparent"}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {ar
                  ? "جميع المواعيد والاتفاقيات تتبع إطار الميثاق الوطني للمرافقة المدرسية لضمان التنسيق الإيجابي بين الأسرة والمدرسة والمختصين."
                  : "Chaque mise en relation s'inscrit dans le cadre déontologique de l'ANEI. Un suivi coordonné entre la famille, l'équipe éducative et les spécialistes de santé."}
              </p>
            </div>
          </div>

          {/* RIGHT: Med.tn-style Sticky Booking & Interaction Widget */}
          <div className="lg:col-span-5 sticky top-6">
            <AvsProfileBookingSection
              locale={locale}
              avs={{
                id: profile.id,
                name: profile.displayName,
                specialty,
                city,
                governorate,
                hourlyRateTnd,
                initials,
                domains,
                phone: profile.phone,
                email: profile.email,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
