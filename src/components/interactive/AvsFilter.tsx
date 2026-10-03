"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { AvsBookingModal } from "@/components/interactive/AvsBookingModal";

export type AvsDirectoryProfile = {
  id: string;
  name: string;
  slug?: string | null;
  city: string;
  governorate?: string;
  specialty: string;
  availability: string;
  certified: boolean;
  initials: string;
  rating?: number;
  reviewCount?: number;
  experienceYears?: number;
  hourlyRateTnd?: number;
  interventionDomains?: string[];
  pedagogicalMethods?: string[];
  schoolsCovered?: string;
  phone?: string | null;
  email?: string | null;
  bio?: string;
};

export type AvsFilterProps = {
  locale: Locale;
  profiles: AvsDirectoryProfile[];
  cities: string[];
  governorates: Array<{ fr: string; ar: string }>;
  specialties: Array<{ fr: string; ar: string }>;
  filters: {
    q?: string;
    city?: string;
    governorate?: string;
    specialty?: string;
    availability?: string;
    certified?: string;
  };
  page: number;
  totalPages: number;
  total: number;
};

export function AvsFilter({
  locale,
  profiles,
  cities: _cities,
  governorates,
  specialties,
  filters,
  page,
  totalPages,
  total,
}: AvsFilterProps) {
  const ar = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();

  // Booking modal state
  const [activeBookingAvs, setActiveBookingAvs] = useState<AvsDirectoryProfile | null>(null);
  const [selectedSlotForBooking] = useState<{ date?: string; slot?: string }>({});

  // Quick filter helper
  function updateParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set("page", "1");
    router.push(`/${locale}/avs?${next.toString()}`);
  }

  const popularSpecialties = [
    { key: "TSA", label: ar ? "طيف التوحد (TSA)" : "Autisme (TSA)" },
    { key: "DYS", label: ar ? "اضطرابات التعلم (DYS)" : "Troubles DYS" },
    { key: "TDAH", label: ar ? "تشتت الانتباه (TDAH)" : "TDAH" },
    { key: "Trisomie", label: ar ? "متلازمة داون" : "Trisomie 21" },
    { key: "Moteur", label: ar ? "إعاقة حركية" : "Handicap moteur" },
  ];

  return (
    <div className="space-y-6">
      {/* Institutional Search Console */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 lg:p-6 transition-all">
        <form className="space-y-4" method="get">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            {/* 1. Keyword / Name input */}
            <div className="md:col-span-5 relative">
              <label htmlFor="avs-search-input" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {ar ? "البحث بالاسم أو التخصص" : "Nom, spécialité ou compétence"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-3.5 flex items-center pointer-events-none text-slate-400">
                  <Icon name="search" size={17} />
                </span>
                <input
                  id="avs-search-input"
                  name="q"
                  maxLength={100}
                  defaultValue={filters.q}
                  placeholder={ar ? "مثال: سلمى، توحد، إدماج..." : "Ex: Salma, autisme, troubles DYS..."}
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/20 focus:border-[#082D55] transition-all placeholder:text-slate-400 shadow-2xs"
                />
              </div>
            </div>

            {/* 2. Specialty Domain Dropdown */}
            <div className="md:col-span-3">
              <label htmlFor="avs-specialty-select" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {ar ? "نوع الاضطراب / الاحتياج" : "Besoin spécifique"}
              </label>
              <div className="relative">
                <select
                  id="avs-specialty-select"
                  name="specialty"
                  defaultValue={filters.specialty ?? ""}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/20 focus:border-[#082D55] transition-all shadow-2xs appearance-none pe-8"
                >
                  <option value="">{ar ? "كل الاختصاصات" : "Toutes les spécialités"}</option>
                  <option value="TSA">{ar ? "طيف التوحد (TSA)" : "Autisme / TSA"}</option>
                  <option value="DYS">{ar ? "صعوبات واضطرابات DYS" : "Troubles DYS (Dyslexie, Dyspraxie)"}</option>
                  <option value="TDAH">{ar ? "تشتت الانتباه وفرط الحركة (TDAH)" : "TDAH"}</option>
                  <option value="Trisomie">{ar ? "إعاقة ذهنية / تثلث الصبغي 21" : "Trisomie 21 / Déficience"}</option>
                  <option value="Moteur">{ar ? "إعاقة حركية وتيسير بيئة القسم" : "Handicap moteur"}</option>
                  <option value="Sensoriel">{ar ? "اضطرابات بصرية أو سمعية" : "Troubles sensoriels"}</option>
                  {specialties.map((item) => (
                    <option value={ar ? item.ar : item.fr} key={item.fr}>
                      {ar ? item.ar : item.fr}
                    </option>
                  ))}
                </select>
                <span className="absolute inset-y-0 end-3 flex items-center pointer-events-none text-slate-400">
                  <Icon name="arrow" size={14} className="rotate-90" />
                </span>
              </div>
            </div>

            {/* 3. Governorate Dropdown */}
            <div className="md:col-span-2">
              <label htmlFor="avs-gov-select" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {ar ? "الولاية / المنطقة" : "Gouvernorat"}
              </label>
              <div className="relative">
                <select
                  id="avs-gov-select"
                  name="governorate"
                  defaultValue={filters.governorate ?? ""}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/20 focus:border-[#082D55] transition-all shadow-2xs appearance-none pe-8"
                >
                  <option value="">{ar ? "كامل الجمهورية" : "Toute la Tunisie"}</option>
                  {governorates.map((item) => (
                    <option value={ar ? item.ar : item.fr} key={item.fr}>
                      {ar ? item.ar : item.fr}
                    </option>
                  ))}
                </select>
                <span className="absolute inset-y-0 end-3 flex items-center pointer-events-none text-slate-400">
                  <Icon name="arrow" size={14} className="rotate-90" />
                </span>
              </div>
            </div>

            {/* 4. Action Buttons */}
            <div className="md:col-span-2 flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#082D55] hover:bg-[#061f3b] text-white font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                <Icon name="search" size={16} />
                <span>{ar ? "بحث" : "Rechercher"}</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Tags & Certification Checkbox */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 font-semibold me-1">{ar ? "اختصاصات شائعة :" : "Besoins fréquents :"}</span>
              {popularSpecialties.map((spec) => {
                const isActive = filters.specialty === spec.key;
                return (
                  <button
                    key={spec.key}
                    type="button"
                    onClick={() => updateParam("specialty", isActive ? undefined : spec.key)}
                    className={`avs-filter-pill px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#082D55] text-white border-[#082D55] shadow-2xs"
                        : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {spec.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-700">
                <input
                  type="checkbox"
                  name="certified"
                  value="true"
                  defaultChecked={filters.certified === "true"}
                  className="rounded border-slate-300 text-[#082D55] focus:ring-[#082D55]"
                  onChange={(e) => updateParam("certified", e.target.checked ? "true" : undefined)}
                />
                <span className="font-semibold text-xs flex items-center gap-1.5 text-slate-800">
                  <Icon name="award" size={14} className="text-amber-600" />
                  <span>{ar ? "المعتمدون من ANEI فقط" : "Certifiés ANEI uniquement"}</span>
                </span>
              </label>

              {(filters.q || filters.governorate || filters.specialty || filters.city || filters.certified) && (
                <Link
                  href={`/${locale}/avs`}
                  className="text-xs text-rose-700 hover:text-rose-900 font-semibold underline flex items-center gap-1"
                >
                  <Icon name="close" size={12} />
                  <span>{ar ? "إعادة الضبط" : "Réinitialiser"}</span>
                </Link>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Results Header */}
      <div className="flex items-center gap-2.5 px-1 py-1">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
        <h2 className="text-base sm:text-lg font-bold text-[#082D55] font-[family-name:var(--font-fraunces)]">
          {ar
            ? `${total} مرافق(ة) مدرسي(ة) مؤهل(ة) للتواصل والمرافقة`
            : `${total} accompagnant${total > 1 ? "s" : ""} scolaire${total > 1 ? "s" : ""} (AVS) qualifié${total > 1 ? "s" : ""}`}
        </h2>
      </div>

      {/* Practitioner Cards Grid */}
      <div className="space-y-4">
        {profiles.map((profile) => {
          const profileSlugOrId = profile.slug || profile.id;
          return (
            <article
              key={profile.id}
              className="avs-card block bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all overflow-hidden p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
                {/* Identity Column */}
                <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
                  {/* Avatar with status indicator */}
                  <div className="relative flex-none">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-[#082D55] to-[#124275] text-white flex items-center justify-center font-bold text-lg sm:text-xl font-[family-name:var(--font-fraunces)] shadow-2xs border border-white/20">
                      {profile.initials}
                    </div>
                    <span
                      className="avs-status-available absolute -bottom-1 -end-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-2xs"
                      title={ar ? "متاح للمرافقة" : "Disponible pour accompagnement"}
                    />
                  </div>

                  {/* Name, Badges & Specialty */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/${locale}/avs/${profileSlugOrId}`}
                        className="avs-card-name text-lg sm:text-xl font-bold text-[#082D55] hover:text-[#a66f24] transition-colors font-[family-name:var(--font-fraunces)]"
                      >
                        {profile.name}
                      </Link>
                      {profile.certified && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300/80 shadow-2xs whitespace-nowrap">
                          <Icon name="award" size={12} className="text-amber-600 flex-none" />
                          <span>{ar ? "معتمد ANEI" : "Certifié ANEI"}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-800">{profile.specialty}</p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 pt-0.5">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
                        <Icon name="map" size={13} className="text-[#a66f24] flex-none" />
                        <span>{profile.city}</span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 text-amber-800 font-bold whitespace-nowrap">
                        <span>★ {((profile.rating || 48) / 10).toFixed(1)}</span>
                        <span className="text-slate-400 font-normal">
                          ({profile.reviewCount || 15} {ar ? "تقييم" : "avis"})
                        </span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-medium text-slate-600 whitespace-nowrap">
                        {profile.experienceYears || 4} {ar ? "سنوات خبرة" : "ans d'expérience"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Action: View Profile & Book */}
                <div className="flex-none pt-2 sm:pt-0">
                  <Link
                    href={`/${locale}/avs/${profileSlugOrId}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5 bg-[#082D55] hover:bg-[#061f3b] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-[0.98] whitespace-nowrap"
                  >
                    <span>{ar ? "عرض الملف وحجز موعد" : "Consulter le profil & réserver"}</span>
                    <Icon name="arrow" size={13} className="directional-icon" />
                  </Link>
                </div>
              </div>

              {/* Intervention Domains & Bio Snippet */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2.5">
                {profile.interventionDomains && profile.interventionDomains.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.interventionDomains.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-md bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200/80"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {profile.bio && (
                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {profile.bio}
                  </p>
                )}

                {/* Institutional Guarantee Snippet */}
                <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 pt-1">
                  <Icon name="shield" size={12} className="text-emerald-700 flex-none" />
                  <span>
                    {ar
                      ? "مرافقة تربوية منظمة • جلسة استكشافية أولى • ضمان مالي بنظام الحساب الوسيط ANEI"
                      : "Accompagnement pédagogique encadré • Entretien exploratoire sans engagement • Paiement sous séquestre ANEI"}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Empty State */}
      {!profiles.length && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Icon name="search" size={28} />
          </div>
          <h3 className="text-lg font-bold text-[#082D55] font-[family-name:var(--font-fraunces)]">
            {ar ? "لا توجد ملفات تطابق معايير البحث الحالية." : "Aucun accompagnant ne correspond à ces critères."}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {ar
              ? "جرّب توسيع نطاق البحث باختيار ولاية مجاورة أو مسح تصفية الاختصاص."
              : "Essayez d'élargir votre recherche en sélectionnant toute la Tunisie ou en réinitialisant la spécialité."}
          </p>
          <div>
            <Link href={`/${locale}/avs`} className="btn btn-secondary text-xs font-semibold px-6 py-2.5 rounded-xl">
              {ar ? "عرض جميع المرافقين" : "Voir tous les accompagnants"}
            </Link>
          </div>
        </div>
      )}

      {/* Pagination */}
      <Pagination locale={locale} basePath={`/${locale}/avs`} page={page} totalPages={totalPages} params={filters} />

      {/* Global Booking Modal */}
      {activeBookingAvs && (
        <AvsBookingModal
          locale={locale}
          avs={{
            id: activeBookingAvs.id,
            name: activeBookingAvs.name,
            specialty: activeBookingAvs.specialty,
            city: activeBookingAvs.city,
            governorate: activeBookingAvs.governorate,
            hourlyRateTnd: activeBookingAvs.hourlyRateTnd,
            initials: activeBookingAvs.initials,
            domains: activeBookingAvs.interventionDomains,
          }}
          initialDate={selectedSlotForBooking.date}
          initialTimeSlot={selectedSlotForBooking.slot}
          isOpen={Boolean(activeBookingAvs)}
          onClose={() => setActiveBookingAvs(null)}
        />
      )}
    </div>
  );
}
