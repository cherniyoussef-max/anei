import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { getSpecialistByIdOrSlug } from "@/server/queries/catalog";
import { Icon } from "@/components/ui/Icon";
import { SpecialistProfileBookingSection } from "@/components/interactive/SpecialistProfileBookingSection";
import { getSpecialistCategoryMeta } from "@/lib/specialist-categories";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const profile = await getSpecialistByIdOrSlug(slug);
  if (!profile) return { title: "Spécialiste introuvable | ANEI" };

  const ar = locale === "ar";
  const catMeta = getSpecialistCategoryMeta(profile.category);
  const specialty = ar ? catMeta.labelAr : catMeta.labelFr;
  return {
    title: `${profile.displayName} - ${specialty} à ${ar ? profile.cityAr : profile.cityFr} | ANEI`,
    description: ar
      ? `الملف المهني للأخصائي(ة) ${profile.displayName} (${specialty}) في ${profile.cityAr}. حجز موعد بالعيادة أو استشارة عن بعد.`
      : `Consultez le profil de ${profile.displayName}, ${specialty} à ${profile.cityFr}. Prenez rendez-vous en cabinet ou en téléconsultation.`,
  };
}

export default async function SpecialistDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";

  const profile = await getSpecialistByIdOrSlug(slug);
  if (!profile) notFound();

  const catMeta = getSpecialistCategoryMeta(profile.category);
  const specialtyLabel = ar ? catMeta.labelAr : catMeta.labelFr;
  const bio = ar ? profile.bioAr || catMeta.descriptionAr : profile.bioFr || catMeta.descriptionFr;
  const inPersonTnd = Math.round((profile.inPersonPriceMillimes || 45000) / 1000);
  const onlineTnd = Math.round((profile.onlineVisioPriceMillimes || 40000) / 1000);
  const initials = (profile.displayName || "")
    .trim()
    .split(/\s+/)
    .map((n) => n[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "SP";

  return (
    <div className="min-h-screen bg-[#FDFDFC] pb-16" dir={ar ? "rtl" : "ltr"}>
      {/* Top Breadcrumb & Back Link */}
      <div className="bg-[#082D55] text-slate-200 py-6 border-b border-blue-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
            <Link href={`/${locale}`} className="hover:text-white transition-colors">
              {ar ? "الرئيسية" : "Accueil"}
            </Link>
            <span className="text-slate-500">/</span>
            <Link href={`/${locale}/specialistes`} className="hover:text-white transition-colors">
              {ar ? "دليل الأخصائيين" : "Spécialistes"}
            </Link>
            <span className="text-slate-500">/</span>
            <span className="text-white font-semibold truncate max-w-xs">{profile.displayName}</span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Info Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Practitioner Header Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-[#082D55]/10 text-[#082D55] font-bold text-2xl flex items-center justify-center shrink-0 border border-[#082D55]/20 overflow-hidden shadow-inner">
                  {profile.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.image}
                      alt={profile.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-[#082D55] text-xs font-bold border border-blue-100">
                      {specialtyLabel}
                    </span>
                    {profile.certified && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                        <Icon name="check" size={13} className="text-emerald-600" />
                        <span>{ar ? "أخصائي معتمد ANEI" : "Praticien Agréé ANEI"}</span>
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                    {profile.displayName}
                  </h1>

                  <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Icon name="map" size={15} className="text-slate-400" />
                      <span>
                        {ar
                          ? `${profile.cityAr} (${profile.governorateAr})`
                          : `${profile.cityFr} (${profile.governorateFr})`}
                      </span>
                    </div>
                    {profile.consultationDurationMinutes && (
                      <div className="flex items-center gap-1.5">
                        <Icon name="clock" size={15} className="text-slate-400" />
                        <span>{profile.consultationDurationMinutes} min / séance</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Direct Verification & Contact Band */}
              {profile.showPhonePublicly && (profile.contactPhone || profile.whatsappPhone) && (
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold">
                      {ar ? "رقم العيادة مفعل ومتاح للاتصال المباشر" : "Ligne directe du cabinet vérifiée"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {profile.contactPhone && (
                      <a
                        href={`tel:${profile.contactPhone}`}
                        className="py-2 px-3.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2 transition-all"
                      >
                        <Icon name="phone" size={14} className="text-emerald-600" />
                        <span>{profile.contactPhone}</span>
                      </a>
                    )}
                    {profile.whatsappPhone && (
                      <a
                        href={`https://wa.me/${profile.whatsappPhone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-2 transition-all"
                      >
                        <Icon name="messenger" size={14} />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Academic & Practice Details */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
                {ar ? "المؤهلات ومقر الممارسة المهنية" : "Qualifications & Lieu d'exercice"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {ar ? "الشهادة الجامعية والكلية" : "Diplôme universitaire"}
                  </span>
                  <div className="font-semibold text-slate-800">
                    {profile.universityDegree || (ar ? "دبلوم وطني في الاختصاص" : "Diplôme d'État reconnu")}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {ar ? "رقم التسجيل بالعمادة / الاعتماد" : "N° Ordre / Agrément professionnel"}
                  </span>
                  <div className="font-mono font-semibold text-slate-800">
                    {profile.licenseOrOrderNumber || "ANEI-TUN-PRO-2026"}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 sm:col-span-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {ar ? "عنوان ومقر العيادة" : "Cabinet & Adresse physique"}
                  </span>
                  <div className="font-semibold text-slate-800">
                    {profile.workplaceName ? `${profile.workplaceName} — ` : ""}
                    {profile.workplaceAddress ||
                      (ar
                        ? `${profile.cityAr}، ${profile.governorateAr}، تونس`
                        : `${profile.cityFr}, ${profile.governorateFr}, Tunisie`)}
                  </div>
                </div>
              </div>
            </div>

            {/* Presentation Bio */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
                {ar ? "النهج العلاجي والتأهيلي" : "Présentation & Approche clinique"}
              </h2>
              <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed whitespace-pre-line">
                {bio}
              </p>
            </div>

            {/* Financial Transparency Box */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
                <span>{ar ? "الشفافية المالية والتسعير" : "Tarification & Modalités financières"}</span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {ar ? "ميثاق الشفافية ANEI" : "Charte Transparence ANEI"}
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 text-sm">
                      {ar ? "استشارة حضورية (بالعيادة)" : "Au cabinet (Présentiel)"}
                    </span>
                    <span className="text-base font-bold text-emerald-900">{inPersonTnd} DT</span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    {ar
                      ? "الدفع مباشرة عند المقابلة بالعيادة. لا تطبق المنصة أي اقتطاع أو عمولة (0% عمولة ANEI)."
                      : "Paiement direct sur place au cabinet. Zéro commission retenue par ANEI (0% frais plateforme)."}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#082D55] text-sm">
                      {ar ? "استشارة مرئية (عن بعد)" : "Téléconsultation (Visio)"}
                    </span>
                    <span className="text-base font-bold text-[#082D55]">{onlineTnd} DT</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {ar
                      ? "سداد مؤمّن ومحمي عبر المنصة بواسطة الترتيب المالي (Séquestre) ورابط فيديو مشفر."
                      : "Paiement sécurisé sous séquestre ANEI. Salle visio chiffrée provisionnée automatiquement."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Widget Column */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <SpecialistProfileBookingSection
              locale={locale}
              specialist={{
                id: profile.id,
                name: profile.displayName,
                specialty: specialtyLabel,
                city: ar ? profile.cityAr : profile.cityFr,
                governorate: ar ? profile.governorateAr : profile.governorateFr,
                inPersonPriceTnd: inPersonTnd,
                onlinePriceTnd: onlineTnd,
                consultationDurationMinutes: profile.consultationDurationMinutes || 45,
                initials,
                workplaceName: profile.workplaceName,
                workplaceAddress: profile.workplaceAddress,
                contactPhone: profile.contactPhone,
                whatsappPhone: profile.whatsappPhone,
                showPhonePublicly: profile.showPhonePublicly,
                email: profile.email,
                availabilityStatusLabel: profile.availabilityStatusLabel,
                acceptedModalities: profile.acceptedModalities,
                availableLocationsText: profile.availableLocationsText,
                weeklySchedule: profile.weeklySchedule as Record<string, { enabled: boolean; slots: string[] }>,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
