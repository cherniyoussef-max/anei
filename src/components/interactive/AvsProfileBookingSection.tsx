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
  };
};

const SLOTS = ["09:00", "10:30", "14:00", "15:30", "17:00"];

export function AvsProfileBookingSection({ locale, avs }: AvsProfileBookingSectionProps) {
  const ar = locale === "ar";
  const today = new Date();

  // 7 next days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() + i + 1);
    return {
      iso: d.toISOString().split("T")[0],
      dayName: d.toLocaleDateString(ar ? "ar-TN" : "fr-TN", { weekday: "short" }),
      dateText: d.toLocaleDateString(ar ? "ar-TN" : "fr-TN", { day: "numeric", month: "numeric" }),
    };
  });

  const [selectedDate, setSelectedDate] = useState(days[0].iso);
  const [selectedSlot, setSelectedSlot] = useState(SLOTS[1]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDirectContact, setShowDirectContact] = useState(false);

  return (
    <div className="avs-booking-widget bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">
          {ar ? "حجز موعد فوري" : "Prise de rendez-vous en ligne"}
        </div>
        <h3 className="text-lg font-bold text-[#082D55] mt-1">
          {ar ? "اختر التوقيت المناسب" : "Disponibilités de l'accompagnant"}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {ar
            ? "احجز مقابلة استكشافية أو زيارة متابعة دون وسطاء."
            : "Sélectionnez un créneau pour un entretien préliminaire ou une visite d'observation."}
        </p>
      </div>

      {/* 7-day horizontal strip */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-2">
          {ar ? "1. حدد اليوم" : "1. Jour souhaité"}
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {days.map((d) => {
            const isSelected = selectedDate === d.iso;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => setSelectedDate(d.iso)}
                className={`py-2 px-1 rounded-xl border text-center transition-all ${
                  isSelected
                    ? "border-[#082D55] bg-[#082D55] text-white shadow-xs font-bold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700 text-xs"
                }`}
              >
                <div className="text-[10px] uppercase opacity-80">{d.dayName}</div>
                <div className="font-semibold text-xs mt-0.5">{d.dateText}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots picker */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-2">
          {ar ? "2. اختر ساعة المقابلة" : "2. Horaire disponible"}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {SLOTS.map((slot) => {
            const isSelected = selectedSlot === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className={`py-2 px-2 rounded-lg border text-xs font-semibold text-center transition-all ${
                  isSelected
                    ? "border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Action: Open Booking Modal */}
      <div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full py-3 px-4 bg-[#082D55] hover:bg-[#061f3b] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Icon name="calendar" size={17} />
          <span>{ar ? "تأكيد الموعد ومتابعة الطلب" : "Prendre ce rendez-vous"}</span>
        </button>
        <div className="text-[11px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
          <Icon name="shield" size={12} />
          <span>{ar ? "خدمة آمنة ومجانية لعائلات المنصة" : "Service de mise en relation vérifié ANEI"}</span>
        </div>
      </div>

      {/* Secondary: Phone or Question Toggle */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowDirectContact(!showDirectContact)}
          className="w-full text-xs font-semibold text-slate-700 hover:text-[#082D55] flex items-center justify-between py-1"
        >
          <span className="flex items-center gap-2">
            <Icon name="phone" size={14} className="text-[#a9752f]" />
            <span>{ar ? "معلومات الاتصال المباشر" : "Coordonnées de l'accompagnant"}</span>
          </span>
          <Icon name="chevron" size={14} className={`transition-transform ${showDirectContact ? "rotate-180" : ""}`} />
        </button>

        {showDirectContact && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs animate-in fade-in duration-150">
            {avs.phone ? (
              <a
                href={`tel:${avs.phone}`}
                className="flex items-center gap-2 text-emerald-800 font-bold hover:underline"
              >
                <Icon name="phone" size={14} />
                <span>{avs.phone}</span>
              </a>
            ) : null}
            {avs.email ? (
              <a
                href={`mailto:${avs.email}`}
                className="flex items-center gap-2 text-slate-700 hover:underline"
              >
                <Icon name="mail" size={14} />
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
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
