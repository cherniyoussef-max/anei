"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import { AvsBookingModal } from "@/components/interactive/AvsBookingModal";

export type SpecialistProfileBookingSectionProps = {
  locale: Locale;
  specialist: {
    id: string;
    name: string;
    specialty: string;
    city: string;
    governorate?: string;
    inPersonPriceTnd: number;
    onlinePriceTnd: number;
    consultationDurationMinutes: number;
    initials: string;
    workplaceName?: string | null;
    workplaceAddress?: string | null;
    contactPhone?: string | null;
    whatsappPhone?: string | null;
    showPhonePublicly?: boolean;
    email?: string | null;
    availabilityStatusLabel?: string | null;
    acceptedModalities?: string | null;
    availableLocationsText?: string | null;
    weeklySchedule?: Record<string, { enabled: boolean; slots: string[] }> | null;
  };
};

const SLOTS = ["09:00", "10:30", "14:00", "15:30", "17:00"];

export function SpecialistProfileBookingSection({
  locale,
  specialist,
}: SpecialistProfileBookingSectionProps) {
  const ar = locale === "ar";
  const today = new Date();

  const schedule = specialist.weeklySchedule;
  const isUnavailable = specialist.availabilityStatusLabel === "UNAVAILABLE";
  const modalities = specialist.acceptedModalities || "BOTH";
  const showInPerson = modalities === "BOTH" || modalities === "IN_PERSON_ONLY";
  const showOnline = modalities === "BOTH" || modalities === "ONLINE_ONLY";

  // 7 next days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() + i + 1);
    const dayOfWeek = String(d.getDay());
    const dayConfig = schedule?.[dayOfWeek];
    const isDayActive = dayConfig !== undefined ? dayConfig.enabled : d.getDay() !== 0;
    const daySlots = dayConfig?.slots && dayConfig.slots.length > 0 ? dayConfig.slots : SLOTS;

    return {
      iso: d.toISOString().split("T")[0],
      dayOfWeek,
      dayName: d.toLocaleDateString(ar ? "ar-TN" : "fr-TN", { weekday: "short" }),
      dateText: d.toLocaleDateString(ar ? "ar-TN" : "fr-TN", { day: "numeric", month: "numeric" }),
      isEnabled: isDayActive && !isUnavailable,
      slots: daySlots,
    };
  });

  const firstAvailableDay = days.find((d) => d.isEnabled) || days[0];
  const [selectedDate, setSelectedDate] = useState(firstAvailableDay.iso);
  const currentDayConfig = days.find((d) => d.iso === selectedDate) || firstAvailableDay;
  const availableSlotsForDay = currentDayConfig.slots;
  const [selectedSlot, setSelectedSlot] = useState(availableSlotsForDay[0] || SLOTS[1]);

  const [meetingType, setMeetingType] = useState<"IN_PERSON" | "ONLINE">(
    modalities === "ONLINE_ONLY" ? "ONLINE" : "IN_PERSON"
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDirectContact, setShowDirectContact] = useState(false);

  function handleDateSelect(dateIso: string) {
    setSelectedDate(dateIso);
    const dayObj = days.find((d) => d.iso === dateIso);
    if (dayObj && dayObj.slots.length > 0) {
      if (!dayObj.slots.includes(selectedSlot)) {
        setSelectedSlot(dayObj.slots[0]);
      }
    }
  }

  const currentPriceTnd =
    meetingType === "IN_PERSON" ? specialist.inPersonPriceTnd : specialist.onlinePriceTnd;

  return (
    <div className="specialist-booking-widget bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-7 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#082D55]">
          {ar ? "حجز موعد استشارة" : "Prise de rendez-vous praticien"}
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] mt-1">
          {ar ? "حدد صيغة الموعد والتوقيت" : "Planifier une consultation"}
        </h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {ar
            ? "اختر صيغة المقابلة (بالعيادة أو عن بعد)، وحدد اليوم والساعة المناسبين لطفلك."
            : "Choisissez la modalité (au cabinet ou téléconsultation), puis le créneau souhaité."}
        </p>

        {isUnavailable && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2">
            <span>⏳</span>
            <span>
              {ar
                ? "الممارس غير متاح حالياً لاستقبال مواعيد جديدة."
                : "Le praticien est actuellement indisponible pour de nouvelles demandes."}
            </span>
          </div>
        )}

        {specialist.availableLocationsText && (
          <div className="mt-2 text-xs text-slate-600 flex items-center gap-1.5">
            <Icon name="map" size={13} className="text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700">{ar ? "المناطق المتاحة :" : "Zones :"}</span>
            <span className="truncate">{specialist.availableLocationsText}</span>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-[11px] font-bold text-[#082D55]">
            <Icon name="clock" size={13} className="text-[#082D55]" />
            <span>{specialist.consultationDurationMinutes} min</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-800">
            <span>{currentPriceTnd} DT</span>
          </span>
        </div>
      </div>

      {/* 1. Modality Selector: Cabinet (0%) vs Visio (Séquestre) */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          <span>{ar ? "1. صيغة الاستشارة" : "1. Modalité de la consultation"}</span>
          <span className="text-[11px] font-semibold text-[#082D55]">
            {meetingType === "IN_PERSON"
              ? ar ? "بالعيادة" : "Au cabinet"
              : ar ? "تطبيب عن بعد" : "Téléconsultation"}
          </span>
        </div>

        <div className={`grid gap-2 ${showInPerson && showOnline ? "grid-cols-2" : "grid-cols-1"}`}>
          {showInPerson && (
            <button
              type="button"
              onClick={() => setMeetingType("IN_PERSON")}
              className={`p-3.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55] ${
                meetingType === "IN_PERSON"
                  ? "border-[#082D55] bg-[#082D55] text-white shadow-xs font-bold"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon name="map" size={15} className={meetingType === "IN_PERSON" ? "text-blue-200" : "text-slate-400"} />
                <span>{ar ? "بالعيادة" : "Au cabinet"}</span>
              </div>
              <span className={`text-[10px] ${meetingType === "IN_PERSON" ? "text-blue-100" : "text-emerald-700 font-bold"}`}>
                {specialist.inPersonPriceTnd} DT · {ar ? "0% عمولة" : "0% frais ANEI"}
              </span>
            </button>
          )}

          {showOnline && (
            <button
              type="button"
              onClick={() => setMeetingType("ONLINE")}
              className={`p-3.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55] ${
                meetingType === "ONLINE"
                  ? "border-[#082D55] bg-[#082D55] text-white shadow-xs font-bold"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon name="video" size={15} className={meetingType === "ONLINE" ? "text-blue-200" : "text-slate-400"} />
                <span>{ar ? "عن بعد (فيديو)" : "Téléconsultation"}</span>
              </div>
              <span className={`text-[10px] ${meetingType === "ONLINE" ? "text-blue-100" : "text-slate-500 font-medium"}`}>
                {specialist.onlinePriceTnd} DT · {ar ? "سداد مؤمّن" : "Séquestre sécurisé"}
              </span>
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-none" />
          <span>
            {meetingType === "IN_PERSON"
              ? ar
                ? "استشارة حضورية بالعيادة. الدفع مباشر على عين المكان (بدون عمولة منصة)."
                : "Consultation en présentiel au cabinet. Règlement direct sur place (0% commission)."
              : ar
                ? "استشارة مرئية مباشرة عبر رابط فيديو مشفر ومحمي بضمان ANEI."
                : "Téléconsultation vidéo sécurisée via l'espace ANEI avec garantie de séquestre."}
          </span>
        </div>
      </div>

      {/* 2. Date Selector */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
          <span>{ar ? "2. حدد اليوم" : "2. Jour souhaité"}</span>
          <span className="text-[11px] font-medium text-slate-400 capitalize">{selectedDate}</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {days.map((d) => {
            const isSelected = selectedDate === d.iso;
            return (
              <button
                key={d.iso}
                type="button"
                disabled={!d.isEnabled}
                onClick={() => handleDateSelect(d.iso)}
                aria-pressed={isSelected}
                className={`py-2 px-1 rounded-xl border text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55] ${
                  isSelected
                    ? "border-[#082D55] bg-[#082D55] text-white shadow-xs font-bold"
                    : !d.isEnabled
                    ? "border-slate-100 bg-slate-50/50 text-slate-300 cursor-not-allowed line-through"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className={`text-[10px] uppercase tracking-wider font-semibold ${isSelected ? "text-blue-100" : !d.isEnabled ? "text-slate-300" : "text-slate-400"}`}>
                  {d.dayName}
                </div>
                <div className={`text-xs mt-0.5 ${isSelected ? "font-bold text-white" : !d.isEnabled ? "text-slate-300" : "font-semibold text-slate-700"}`}>
                  {d.dateText}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Time Slot Selector */}
      <div>
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
          {ar ? "3. التوقيت المتاح" : "3. Créneau horaire"}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {availableSlotsForDay.map((slot) => {
            const isSelected = selectedSlot === slot;
            return (
              <button
                key={slot}
                type="button"
                disabled={isUnavailable}
                onClick={() => setSelectedSlot(slot)}
                aria-pressed={isSelected}
                className={`py-2.5 px-2 rounded-xl border text-xs text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55] ${
                  isSelected
                    ? "border-[#082D55] bg-[#082D55] text-white shadow-xs font-bold"
                    : isUnavailable
                    ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
                }`}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>

      {/* Booking CTA Action */}
      <div className="space-y-2.5 pt-1">
        <button
          type="button"
          disabled={isUnavailable}
          onClick={() => setIsModalOpen(true)}
          className="w-full py-3.5 px-4 bg-[#082D55] hover:bg-[#0E3B6C] text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55] focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="calendar" size={16} />
          <span>{ar ? "حجز هذا الموعد" : "Prendre ce rendez-vous"}</span>
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center">
          <Icon name="shield" size={13} className="text-emerald-600 flex-none" />
          <span>
            {meetingType === "IN_PERSON"
              ? ar ? "موعد مؤكد وموثق لدى العيادة" : "Rendez-vous confirmé auprès du praticien (0% frais)"
              : ar ? "خدمة مؤمّنة بضمان الترتيب المالي ANEI" : "Garantie Tiers de Confiance ANEI (Fonds sous séquestre)"}
          </span>
        </div>
      </div>

      {/* Direct Contact Accordion if authorized */}
      {specialist.showPhonePublicly && (specialist.contactPhone || specialist.whatsappPhone) && (
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <button
            type="button"
            onClick={() => setShowDirectContact(!showDirectContact)}
            className="w-full text-xs font-semibold text-slate-600 hover:text-[#082D55] flex items-center justify-between py-1 transition-colors group"
          >
            <span className="flex items-center gap-2">
              <Icon name="phone" size={14} className="text-emerald-600" />
              <span>{ar ? "معلومات الاتصال المباشر بالعيادة" : "Coordonnées directes du cabinet"}</span>
            </span>
            <Icon
              name="chevron"
              size={14}
              className={`text-slate-400 transition-transform duration-200 ${showDirectContact ? "rotate-180" : ""}`}
            />
          </button>

          {showDirectContact && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs animate-in fade-in duration-150">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                <Icon name="check" size={11} className="text-emerald-600" />
                <span>{ar ? "رقم موثق ومعتمد من المنصة" : "Numéro professionnel vérifié ANEI"}</span>
              </div>

              {specialist.contactPhone && (
                <a
                  href={`tel:${specialist.contactPhone}`}
                  className="flex items-center gap-2 text-emerald-800 font-bold hover:underline"
                >
                  <Icon name="phone" size={14} className="text-emerald-600" />
                  <span>{specialist.contactPhone}</span>
                </a>
              )}

              {specialist.whatsappPhone && (
                <a
                  href={`https://wa.me/${specialist.whatsappPhone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-800 font-bold hover:underline"
                >
                  <Icon name="messenger" size={14} className="text-emerald-600" />
                  <span>WhatsApp : {specialist.whatsappPhone}</span>
                </a>
              )}

              {specialist.workplaceAddress && (
                <div className="text-[11px] text-slate-600 pt-1">
                  <span className="font-semibold">{ar ? "العنوان : " : "Adresse : "}</span>
                  <span>{specialist.workplaceAddress}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Booking Modal */}
      <AvsBookingModal
        locale={locale}
        avs={{
          id: specialist.id,
          name: specialist.name,
          specialty: specialist.specialty,
          city: specialist.city,
          governorate: specialist.governorate,
          hourlyRateTnd: currentPriceTnd,
          initials: specialist.initials,
          domains: [specialist.specialty],
        }}
        initialDate={selectedDate}
        initialTimeSlot={`${selectedSlot} (${specialist.consultationDurationMinutes}m)`}
        initialMeetingType={meetingType}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
