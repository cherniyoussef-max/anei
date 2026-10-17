"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import {
  SPECIALIST_CATEGORY_LIST,
  getSpecialistCategoryMeta,
} from "@/lib/specialist-categories";

export interface SpecialistProfileItem {
  id: string;
  displayName: string;
  slug: string | null;
  directoryType: string;
  category: string | null;
  cityFr: string;
  cityAr: string;
  governorateFr: string;
  governorateAr: string;
  specialtyFr: string;
  specialtyAr: string;
  workplaceName: string | null;
  workplaceAddress: string | null;
  licenseOrOrderNumber: string | null;
  universityDegree: string | null;
  contactPhone: string | null;
  whatsappPhone: string | null;
  showPhonePublicly: boolean;
  inPersonPriceMillimes: number;
  onlineVisioPriceMillimes: number;
  consultationDurationMinutes: number;
  rating: number;
  reviewCount: number;
  certified: boolean;
  image: string | null;
  bioFr: string;
  bioAr: string;
}

export type SpecialistFilterProps = {
  locale: Locale;
  initialProfiles: SpecialistProfileItem[];
  governorates: Array<{ fr: string; ar: string }>;
};

export function SpecialistFilter({
  locale,
  initialProfiles,
  governorates,
}: SpecialistFilterProps) {
  const ar = locale === "ar";

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [modeFilter, setModeFilter] = useState<"ALL" | "IN_PERSON" | "ONLINE_VISIO">("ALL");

  const filteredProfiles = useMemo(() => {
    return initialProfiles.filter((p) => {
      // Category filter
      if (selectedCategory !== "ALL" && p.category !== selectedCategory) {
        return false;
      }
      // Governorate filter
      if (
        selectedGovernorate !== "ALL" &&
        p.governorateFr !== selectedGovernorate &&
        p.governorateAr !== selectedGovernorate
      ) {
        return false;
      }
      // Mode filter
      if (modeFilter === "IN_PERSON" && (!p.inPersonPriceMillimes || p.inPersonPriceMillimes <= 0)) {
        return false;
      }
      if (modeFilter === "ONLINE_VISIO" && (!p.onlineVisioPriceMillimes || p.onlineVisioPriceMillimes <= 0)) {
        return false;
      }
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.displayName.toLowerCase().includes(q);
        const matchesWorkplace = (p.workplaceName || "").toLowerCase().includes(q);
        const matchesAddress = (p.workplaceAddress || "").toLowerCase().includes(q);
        const matchesCity = p.cityFr.toLowerCase().includes(q) || p.cityAr.toLowerCase().includes(q);
        const matchesSpecialty = p.specialtyFr.toLowerCase().includes(q) || p.specialtyAr.toLowerCase().includes(q);
        const matchesDegree = (p.universityDegree || "").toLowerCase().includes(q);
        if (!matchesName && !matchesWorkplace && !matchesAddress && !matchesCity && !matchesSpecialty && !matchesDegree) {
          return false;
        }
      }
      return true;
    });
  }, [initialProfiles, selectedCategory, selectedGovernorate, modeFilter, searchQuery]);

  return (
    <div className="space-y-8" dir={ar ? "rtl" : "ltr"}>
      {/* Category Pills Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          type="button"
          onClick={() => setSelectedCategory("ALL")}
          className={`shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55] ${
            selectedCategory === "ALL"
              ? "bg-[#082D55] text-white shadow-xs font-bold"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          {ar ? "جميع التخصصات" : "Toutes les disciplines"}
        </button>
        {SPECIALIST_CATEGORY_LIST.map((cat) => {
          const isSelected = selectedCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55] ${
                isSelected
                  ? "bg-[#082D55] text-white shadow-xs font-bold"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {ar ? cat.badgeAr : cat.labelFr}
            </button>
          );
        })}
      </div>

      {/* Filter Bar: Search + Governorate + Mode */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
        {/* Search */}
        <div className="md:col-span-5 relative">
          <Icon
            name="search"
            size={18}
            className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              ar
                ? "ابحث بالاسم، العيادة، المدينة، أو التخصص..."
                : "Rechercher par praticien, cabinet, ville..."
            }
            className="w-full ps-10 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#082D55] focus:bg-white transition-all"
          />
        </div>

        {/* Governorate */}
        <div className="md:col-span-4">
          <select
            value={selectedGovernorate}
            onChange={(e) => setSelectedGovernorate(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55] focus:bg-white transition-all"
            aria-label={ar ? "تصفية حسب الولاية" : "Filtrer par gouvernorat"}
          >
            <option value="ALL">
              {ar ? "كل الولايات (تونس)" : "Tous les gouvernorats"}
            </option>
            {governorates.map((gov) => (
              <option key={gov.fr} value={gov.fr}>
                {ar ? gov.ar : gov.fr}
              </option>
            ))}
          </select>
        </div>

        {/* Consultation Mode */}
        <div className="md:col-span-3">
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as "ALL" | "IN_PERSON" | "ONLINE_VISIO")}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55] focus:bg-white transition-all"
            aria-label={ar ? "صيغة الاستشارة" : "Modalité de consultation"}
          >
            <option value="ALL">{ar ? "كل الصيغ" : "Toutes modalités"}</option>
            <option value="IN_PERSON">{ar ? "حضوري بالعيادة (0% عمولة)" : "Cabinet (Présentiel)"}</option>
            <option value="ONLINE_VISIO">{ar ? "عن بعد (تطبيب عن بعد)" : "Téléconsultation (Visio)"}</option>
          </select>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500">
        <div>
          {ar ? (
            <span>
              عرض <strong className="text-slate-900">{filteredProfiles.length}</strong> أخصائي معتمد
            </span>
          ) : (
            <span>
              <strong className="text-slate-900">{filteredProfiles.length}</strong> spécialiste(s) qualifié(s) trouvé(s)
            </span>
          )}
        </div>
        {(selectedCategory !== "ALL" || selectedGovernorate !== "ALL" || searchQuery || modeFilter !== "ALL") && (
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("ALL");
              setSelectedGovernorate("ALL");
              setSearchQuery("");
              setModeFilter("ALL");
            }}
            className="text-[#082D55] hover:underline font-semibold"
          >
            {ar ? "إعادة ضبط الفلاتر" : "Réinitialiser les filtres"}
          </button>
        )}
      </div>

      {/* Specialists Grid */}
      {filteredProfiles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <Icon name="search" size={22} />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {ar ? "لم يتم العثور على أخصائيين" : "Aucun spécialiste correspondant"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {ar
              ? "جرّب تغيير معايير البحث أو اختيار ولاية وتخصص آخر."
              : "Essayez d'élargir votre recherche ou de réinitialiser les filtres."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProfiles.map((specialist) => {
            const catMeta = getSpecialistCategoryMeta(specialist.category);
            const detailHref = `/${locale}/specialistes/${specialist.slug || specialist.id}`;
            const inPersonTnd = Math.round((specialist.inPersonPriceMillimes || 45000) / 1000);
            const onlineTnd = Math.round((specialist.onlineVisioPriceMillimes || 40000) / 1000);

            return (
              <div
                key={specialist.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Top: Avatar + Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#082D55]/10 text-[#082D55] font-bold text-base flex items-center justify-center shrink-0 border border-[#082D55]/20">
                        {specialist.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={specialist.image}
                            alt={specialist.displayName}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span>
                            {specialist.displayName
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <Link href={detailHref} className="hover:underline">
                          <h3 className="font-bold text-slate-900 text-[15px] sm:text-base leading-snug group-hover:text-[#082D55] transition-colors">
                            {specialist.displayName}
                          </h3>
                        </Link>
                        <span className="inline-block px-2.5 py-0.5 mt-1 rounded-md bg-blue-50 text-[#082D55] text-[11px] font-semibold border border-blue-100">
                          {ar ? catMeta.badgeAr : catMeta.labelFr}
                        </span>
                      </div>
                    </div>

                    {specialist.certified && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold shrink-0"
                        title={ar ? "أخصائي معتمد من الأكاديمية" : "Spécialiste Certifié ANEI"}
                      >
                        <Icon name="check" size={11} className="text-emerald-600" />
                        <span>{ar ? "معتمد" : "Certifié"}</span>
                      </span>
                    )}
                  </div>

                  {/* University Degree / Order Number */}
                  {(specialist.universityDegree || specialist.licenseOrOrderNumber) && (
                    <div className="text-xs text-slate-600 space-y-0.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      {specialist.universityDegree && (
                        <div className="flex items-center gap-1.5 font-medium truncate">
                          <Icon name="award" size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{specialist.universityDegree}</span>
                        </div>
                      )}
                      {specialist.licenseOrOrderNumber && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          {ar ? "رقم الاعتماد/العمادة : " : "N° Ordre/Agrément : "}
                          {specialist.licenseOrOrderNumber}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Workplace & Location */}
                  <div className="text-xs text-slate-600 space-y-1">
                    {specialist.workplaceName && (
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Icon name="map" size={13} className="text-slate-400 shrink-0" />
                        <span>{specialist.workplaceName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Icon name="map" size={13} className="text-slate-400 shrink-0" />
                      <span>
                        {ar
                          ? `${specialist.cityAr} (${specialist.governorateAr})`
                          : `${specialist.cityFr} (${specialist.governorateFr})`}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Dual Mode Badge */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">
                        {ar ? "بالعيادة" : "Au cabinet"}
                      </div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {inPersonTnd} <span className="text-[10px] font-normal text-slate-500">DT</span>
                      </div>
                      <div className="text-[9px] text-emerald-700 font-medium mt-0.5">
                        {ar ? "0% عمولة منصة" : "0% frais ANEI"}
                      </div>
                    </div>

                    <div className="bg-blue-50/50 p-2 rounded-xl text-center border border-blue-100/60">
                      <div className="text-[10px] text-[#082D55] uppercase font-semibold">
                        {ar ? "عن بعد (فيديو)" : "Visio en ligne"}
                      </div>
                      <div className="font-bold text-[#082D55] mt-0.5">
                        {onlineTnd} <span className="text-[10px] font-normal text-slate-500">DT</span>
                      </div>
                      <div className="text-[9px] text-[#082D55] font-medium mt-0.5">
                        {ar ? "سداد مؤمّن" : "Séquestre sécurisé"}
                      </div>
                    </div>
                  </div>

                  {/* Direct Contact Buttons if public */}
                  {specialist.showPhonePublicly && (specialist.contactPhone || specialist.whatsappPhone) && (
                    <div className="pt-2 flex items-center gap-2">
                      {specialist.contactPhone && (
                        <a
                          href={`tel:${specialist.contactPhone}`}
                          className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                          title={ar ? "اتصال هاتفي مباشر" : "Appeler directement"}
                        >
                          <Icon name="phone" size={13} className="text-emerald-600" />
                          <span className="truncate">{specialist.contactPhone}</span>
                        </a>
                      )}
                      {specialist.whatsappPhone && (
                        <a
                          href={`https://wa.me/${specialist.whatsappPhone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                          title="WhatsApp"
                        >
                          <Icon name="messenger" size={13} className="text-emerald-600" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Card Action */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Icon name="clock" size={13} className="text-slate-400" />
                    <span>{specialist.consultationDurationMinutes} min</span>
                  </div>

                  <Link
                    href={detailHref}
                    className="py-2 px-4 bg-[#082D55] hover:bg-[#0E3B6C] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55]"
                  >
                    <span>{ar ? "حجز موعد" : "Prendre RDV"}</span>
                    <Icon name="arrow" size={12} className="rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
