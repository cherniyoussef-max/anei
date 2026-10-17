"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import { AvsBookingModal } from "@/components/interactive/AvsBookingModal";

export type AvsProfileBookingSectionProps = {
  locale: Locale;
  avs: {
    id: string;
    name: string;
    specialty: string;
    city: string;
    governorate?: string;
    hourlyRateTnd?: number;
    initials: string;
    domains?: string[];
    phone?: string | null;
    email?: string | null;
    availability?: string | null;
    availabilityStatusLabel?: string | null;
    acceptedModalities?: string | null;
    availableLocationsText?: string | null;
    weeklySchedule?: Record<string, { enabled: boolean; slots: string[] }> | null;
  };
};

const SLOTS = ["08:30", "09:30", "10:30", "11:30", "14:00", "15:00", "16:00", "17:00"];

export function AvsProfileBookingSection({ locale, avs }: AvsProfileBookingSectionProps) {
  const ar = locale === "ar";
  const today = new Date();

  const schedule = avs.weeklySchedule;
  const isUnavailable = avs.availabilityStatusLabel === "UNAVAILABLE";
  const modalities = avs.acceptedModalities || "BOTH";
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

  return (
    <div className="avs-booking-widget bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-7 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#1B3A5C]">
          {ar ? "حجز موعد فوري" : "Prise de rendez-vous en ligne"}
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] mt-1">
          {ar ? "حدد صيغة اللقاء والموعد المناسب" : "Planifier une rencontre"}
        </h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {ar
            ? "حدد صيغة المقابلة (حضوري على عين المكان أو عن بعد)، ثم اختر اليوم والساعة للاستكشاف أو المتابعة."
            : "Choisissez la modalité (sur place ou en ligne), puis le créneau souhaité pour votre premier échange."}
        </p>

        {isUnavailable && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2">
            <span>⏳</span>
            <span>
              {ar
                ? "المرافق المدرسي غير متاح حالياً لاستقبال طلبات مواعيد جديدة."
                : "L'accompagnant scolaire est actuellement indisponible pour de nouvelles demandes."}
            </span>
          </div>
        )}

        {avs.availableLocationsText && (
          <div className="mt-2 text-xs text-slate-600 flex items-center gap-1.5">
            <Icon name="map" size={13} className="text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700">{ar ? "المناطق المتاحة :" : "Zones :"}</span>
            <span className="truncate">{avs.availableLocationsText}</span>
          </div>
        )}

        {avs.availability ? (
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-[11px] font-bold text-emerald-800">
            <Icon name="clock" size={13} className="text-emerald-600" />
            <span>{avs.availability}</span>
          </div>
        ) : null}
      </div>

      {/* 1. Modality Selector: Sur place vs En ligne */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          <span>{ar ? "1. صيغة المقابلة" : "1. Modalité de la rencontre"}</span>
          <span className="text-[11px] font-semibold text-[#1B3A5C]">
            {meetingType === "IN_PERSON"
              ? ar ? "حضوري" : "Sur place"
              : ar ? "عن بعد" : "En ligne"}
          </span>
        </div>
        <div className={`grid gap-2 ${showInPerson && showOnline ? "grid-cols-2" : "grid-cols-1"}`}>
          {showInPerson && (
            <button
              type="button"
              onClick={() => setMeetingType("IN_PERSON")}
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A5C] ${
                meetingType === "IN_PERSON"
                  ? "border-[#1B3A5C] bg-[#1B3A5C] text-white shadow-xs font-bold"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <Icon name="map" size={15} className={meetingType === "IN_PERSON" ? "text-blue-100" : "text-slate-400"} />
              <span>{ar ? "على عين المكان" : "Sur place (Présentiel)"}</span>
            </button>
          )}

          {showOnline && (
            <button
              type="button"
              onClick={() => setMeetingType("ONLINE")}
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A5C] ${
                meetingType === "ONLINE"
                  ? "border-[#1B3A5C] bg-[#1B3A5C] text-white shadow-xs font-bold"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <Icon name="video" size={15} className={meetingType === "ONLINE" ? "text-blue-100" : "text-slate-400"} />
              <span>{ar ? "عن بعد (فيديو)" : "En ligne (Visioconférence)"}</span>
            </button>
          )}
        </div>
        <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-none" />
          <span>
            {meetingType === "IN_PERSON"
              ? ar
                ? "لقاء حضوري بالمدرسة أو بالمركز أو بالمكان المتفق عليه."
                : "Rencontre sur place (école, cabinet ou lieu convenu)."
              : ar
                ? "محادثة مرئية مباشرة عبر رابط استشارة مشفر وآمن."
                : "Échange en visioconférence sécurisée via l'espace ANEI."}
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
                className={`py-2 px-1 rounded-xl border text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A5C] ${
                  isSelected
                    ? "border-[#1B3A5C] bg-[#1B3A5C] text-white shadow-xs font-bold"
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
          {ar ? "3. اختر ساعة المقابلة" : "3. Horaire disponible"}
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
                className={`py-2.5 px-2 rounded-xl border text-xs text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A5C] ${
                  isSelected
                    ? "border-[#1B3A5C] bg-[#1B3A5C] text-white shadow-xs font-bold"
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
          className="w-full py-3.5 px-4 bg-[#1B3A5C] hover:bg-[#24476E] text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A5C] focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="calendar" size={16} />
          <span>{ar ? "تأكيد الموعد ومتابعة الطلب" : "Prendre ce rendez-vous"}</span>
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center">
          <Icon name="shield" size={13} className="text-emerald-600 flex-none" />
          <span>{ar ? "خدمة مؤمّنة بضمان الترتيب المالي (Séquestre ANEI)" : "Service vérifié · Protection tiers de confiance ANEI"}</span>
        </div>
      </div>

      {/* Direct Contact Accordion */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowDirectContact(!showDirectContact)}
          className="w-full text-xs font-semibold text-slate-600 hover:text-[#1B3A5C] flex items-center justify-between py-1 transition-colors group"
        >
          <span className="flex items-center gap-2">
            <Icon name="phone" size={14} className="text-slate-400 group-hover:text-[#1B3A5C]" />
            <span>{ar ? "معلومات الاتصال المباشر" : "Coordonnées de l'accompagnant"}</span>
          </span>
          <Icon
            name="chevron"
            size={14}
            className={`text-slate-400 transition-transform duration-200 ${showDirectContact ? "rotate-180" : ""}`}
          />
        </button>

        {showDirectContact && (
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs animate-in fade-in duration-150">
            {avs.phone ? (
              <a
                href={`tel:${avs.phone}`}
                className="flex items-center gap-2 text-emerald-800 font-bold hover:underline"
              >
                <Icon name="phone" size={14} className="text-emerald-600" />
                <span>{avs.phone}</span>
              </a>
            ) : null}
            {avs.email ? (
              <a
                href={`mailto:${avs.email}`}
                className="flex items-center gap-2 text-slate-700 hover:underline"
              >
                <Icon name="mail" size={14} className="text-slate-400" />
                <span>{avs.email}</span>
              </a>
            ) : null}
            <div className="text-[11px] text-slate-500 pt-1">
              {ar
                ? "يُفضّل حجز موعد رسمي لتأكيد توفر المرافق وتوثيق الطلب."
                : "La prise de rendez-vous en ligne garantit le créneau de consultation."}
            </div>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      <AvsBookingModal
        locale={locale}
        avs={avs}
        initialDate={selectedDate}
        initialTimeSlot={`${selectedSlot} - 1h`}
        initialMeetingType={meetingType}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
