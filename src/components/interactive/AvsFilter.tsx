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
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<{ date?: string; slot?: string }>({});

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

  // Pre-generate sample available slots for card preview
  const today = new Date();
  const slotDays = [1, 2, 3].map((offset) => {
    const d = new Date();
    d.setDate(today.getDate() + offset);
    return {
      iso: d.toISOString().split("T")[0],
      dayName: d.toLocaleDateString(ar ? "ar-TN" : "fr-TN", { weekday: "short" }),
      dateText: d.toLocaleDateString(ar ? "ar-TN" : "fr-TN", { day: "numeric", month: "short" }),
      morningSlot: offset % 2 === 0 ? "09:30" : "10:00",
      afternoonSlot: offset % 2 === 0 ? "14:30" : "15:00",
    };
  });

  const popularSpecialties = [
    { key: "TSA", label: ar ? "طيف التوحد (TSA)" : "Autisme (TSA)" },
    { key: "DYS", label: ar ? "اضطرابات التعلم (DYS)" : "Troubles DYS" },
    { key: "TDAH", label: ar ? "تشتت الانتباه (TDAH)" : "TDAH" },
    { key: "Trisomie", label: ar ? "متلازمة داون" : "Trisomie 21" },
    { key: "Moteur", label: ar ? "إعاقة حركية" : "Handicap moteur" },
  ];

  return (
    <div className="space-y-6">
      {/* Med.tn-style Multi-field Search Hero Box */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 p-5 lg:p-6 transition-all">
        <form className="space-y-4" method="get">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* 1. Keyword / Name input */}
            <div className="md:col-span-4 relative">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                {ar ? "البحث بالاسم أو التخصص" : "Nom, mot-clé ou compétence"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-3 flex items-center pointer-events-none text-slate-400">
                  <Icon name="search" size={18} />
                </span>
                <input
                  id="avs-search-input"
                  name="q"
                  maxLength={100}
                  defaultValue={filters.q}
                  placeholder={ar ? "مثال: سلمى، توحد، إدماج..." : "Ex: Salma, autisme, DYS..."}
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55] transition-all"
                />
              </div>
            </div>

            {/* 2. Specialty Domain Dropdown */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                {ar ? "نوع الاضطراب / التخصص" : "Spécialité / Besoin"}
              </label>
              <select
                id="avs-specialty-select"
                name="specialty"
                defaultValue={filters.specialty ?? ""}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55] transition-all"
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
            </div>

            {/* 3. Governorate Dropdown */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                {ar ? "الولاية / المنطقة" : "Gouvernorat / Ville"}
              </label>
              <select
                id="avs-gov-select"
                name="governorate"
                defaultValue={filters.governorate ?? ""}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55] transition-all"
              >
                <option value="">{ar ? "كامل الجمهورية (تونس)" : "Toute la Tunisie"}</option>
                {governorates.map((item) => (
                  <option value={ar ? item.ar : item.fr} key={item.fr}>
                    {ar ? item.ar : item.fr}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Action Buttons */}
            <div className="md:col-span-2 flex items-end gap-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#082D55] hover:bg-[#061f3b] text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Icon name="search" size={16} />
                <span>{ar ? "بحث" : "Trouver"}</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Tags & Certification Checkbox */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-medium me-1">{ar ? "اختصاصات شائعة:" : "Besoins fréquents :"}</span>
              {popularSpecialties.map((spec) => {
                const isActive = filters.specialty === spec.key;
                return (
                  <button
                    key={spec.key}
                    type="button"
                    onClick={() => updateParam("specialty", isActive ? undefined : spec.key)}
                    className={`avs-filter-pill px-3 py-1 rounded-full border text-xs font-medium transition-all ${
                      isActive
                        ? "bg-[#082D55] text-white border-[#082D55]"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
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
                <span className="font-semibold text-xs flex items-center gap-1">
                  <Icon name="award" size={14} className="text-amber-600" />
                  <span>{ar ? "المعتمدون من ANEI فقط" : "Certifiés ANEI uniquement"}</span>
                </span>
              </label>

              {(filters.q || filters.governorate || filters.specialty || filters.city || filters.certified) && (
                <Link
                  href={`/${locale}/avs`}
                  className="text-xs text-slate-500 hover:text-slate-900 underline font-medium"
                >
                  {ar ? "إعادة الضبط" : "Réinitialiser les filtres"}
                </Link>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {ar
              ? `${total} مرافق(ة) مدرسي(ة) متاح(ة) للتواصل والحجز`
              : `${total} accompagnant${total > 1 ? "s" : ""} scolaire${total > 1 ? "s" : ""} (AVS) qualifié${total > 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="text-xs text-slate-500">
          {ar ? "تحديث فوري للمواعيد" : "Prise de rendez-vous en ligne immédiate"}
        </div>
      </div>

      {/* Med.tn-style Rich Professional Cards Grid */}
      <div className="space-y-4">
        {profiles.map((profile) => {
          const profileSlugOrId = profile.slug || profile.id;
          return (
            <article
              key={profile.id}
              className="avs-card bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden p-5 lg:p-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Left Identity Column (7 cols) */}
                <div className="lg:col-span-7 space-y-3.5">
                  <div className="flex items-start gap-4">
                    {/* Avatar with status indicator */}
                    <div className="relative flex-none">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#082D55] to-[#0d4177] text-white flex items-center justify-center font-bold text-xl shadow-md border border-white/20">
                        {profile.initials}
                      </div>
                      <span
                        className="avs-status-available absolute -bottom-1 -end-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                        title={ar ? "متاح للمرافقة" : "Disponible pour accompagnement"}
                      />
                    </div>

                    {/* Name, Badges & Specialty */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/${locale}/avs/${profileSlugOrId}`}
                          className="avs-card-name text-lg font-bold text-[#082D55] hover:text-amber-700 transition-colors"
                        >
                          {profile.name}
                        </Link>
                        {profile.certified && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-xs">
                            <Icon name="award" size={12} className="text-amber-600" />
                            <span>{ar ? "معتمد ANEI" : "Certifié ANEI"}</span>
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-slate-700 mt-0.5">{profile.specialty}</p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Icon name="map" size={14} className="text-[#a9752f]" />
                          <span>{profile.city}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-amber-700 font-bold">
                          <span>★ {((profile.rating || 48) / 10).toFixed(1)}</span>
                          <span className="text-slate-400 font-normal">({profile.reviewCount || 15} {ar ? "تقييم" : "avis"})</span>
                        </span>
                        <span>•</span>
                        <span>{profile.experienceYears || 4} {ar ? "سنوات خبرة" : "ans d'exp."}</span>
                      </div>
                    </div>
                  </div>

                  {/* Intervention Domain Pills */}
                  {profile.interventionDomains && profile.interventionDomains.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {profile.interventionDomains.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Hourly Rate & Covered schools info */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{ar ? "التعريفة:" : "Tarif indicatif :"}</span>
                      <span className="avs-rate-pill px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        {profile.hourlyRateTnd || 25} TND / h
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">{profile.availability}</span>
                    </div>

                    <Link
                      href={`/${locale}/avs/${profileSlugOrId}`}
                      className="text-[#082D55] hover:text-amber-700 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <span>{ar ? "عرض الملف بالتفصيل" : "Voir profil complet"}</span>
                      <Icon name="arrow" size={14} className="directional-icon" />
                    </Link>
                  </div>
                </div>

                {/* Right Quick Slot Booking Column (5 cols, exact med.tn / Doctolib layout) */}
                <div className="avs-slot-picker lg:col-span-5 bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Icon name="calendar" size={14} className="text-[#082D55]" />
                      <span>{ar ? "أقرب المواعيد المتاحة" : "Prochains créneaux disponibles"}</span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-semibold">{ar ? "تأكيد فوري" : "Réservation directe"}</span>
                  </div>

                  {/* 3-day slot strip */}
                  <div className="grid grid-cols-3 gap-2">
                    {slotDays.map((sd) => (
                      <div key={sd.iso} className="text-center space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-600 bg-white py-1 rounded border border-slate-200">
                          {sd.dayName} {sd.dateText}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSlotForBooking({ date: sd.iso, slot: `${sd.morningSlot} - 10:30` });
                            setActiveBookingAvs(profile);
                          }}
                          className="avs-slot-btn w-full py-1 px-1 rounded bg-white hover:bg-blue-50 text-xs font-semibold text-[#082D55] border border-blue-200 hover:border-[#082D55] transition-all shadow-2xs"
                        >
                          {sd.morningSlot}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSlotForBooking({ date: sd.iso, slot: `${sd.afternoonSlot} - 15:30` });
                            setActiveBookingAvs(profile);
                          }}
                          className="avs-slot-btn w-full py-1 px-1 rounded bg-white hover:bg-blue-50 text-xs font-semibold text-[#082D55] border border-blue-200 hover:border-[#082D55] transition-all shadow-2xs"
                        >
                          {sd.afternoonSlot}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Main CTAs */}
                  <div className="pt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSlotForBooking({ date: slotDays[0].iso, slot: "09:30 - 10:30" });
                        setActiveBookingAvs(profile);
                      }}
                      className="flex-1 py-2 px-3 bg-[#082D55] hover:bg-[#061f3b] text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5"
                    >
                      <Icon name="calendar" size={14} />
                      <span>{ar ? "حجز موعد" : "Prendre RDV"}</span>
                    </button>
                    <Link
                      href={`/${locale}/avs/${profileSlugOrId}`}
                      className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center"
                    >
                      {ar ? "الملف" : "Profil"}
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Empty State */}
      {!profiles.length && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Icon name="search" size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {ar ? "لا توجد ملفات تطابق معايير البحث الحالية." : "Aucun accompagnant ne correspond à ces critères."}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {ar
              ? "جرّب توسيع نطاق البحث باختيار ولاية مجاورة أو مسح تصفية الاختصاص."
              : "Essayez d'élargir votre recherche en sélectionnant toute la Tunisie ou en réinitialisant la spécialité."}
          </p>
          <div>
            <Link href={`/${locale}/avs`} className="btn btn-secondary text-xs font-semibold px-6 py-2.5">
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
