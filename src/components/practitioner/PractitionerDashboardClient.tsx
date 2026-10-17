"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";

export interface PractitionerBookingItem {
  id: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  childName: string;
  childAge: number | null;
  needDescription: string;
  requestedDate: string;
  requestedTimeSlot: string;
  meetingType: string;
  paymentMode: string;
  platformCommissionPercent: number;
  amountMillimes: number;
  netPractitionerPayoutMillimes: number;
  status: string;
  escrowStatus: string;
  liveSessionId: string | null;
  createdAt: Date | string;
}

export type PractitionerDashboardClientProps = {
  locale: Locale;
  profile: {
    id: string;
    displayName: string;
    directoryType: string;
    category: string | null;
    cityFr: string;
    cityAr: string;
    governorateFr: string;
    governorateAr: string;
    contactPhone: string | null;
    whatsappPhone: string | null;
    showPhonePublicly: boolean;
    inPersonPriceMillimes: number;
    onlineVisioPriceMillimes: number;
    consultationDurationMinutes: number;
    workplaceName: string | null;
    workplaceAddress: string | null;
    bioFr: string;
    bioAr: string;
  };
  initialBookings: PractitionerBookingItem[];
};

export function PractitionerDashboardClient({
  locale,
  profile,
  initialBookings,
}: PractitionerDashboardClientProps) {
  const ar = locale === "ar";
  const [activeTab, setActiveTab] = useState<"bookings" | "profile">("bookings");
  const [bookings, setBookings] = useState<PractitionerBookingItem[]>(initialBookings);

  // Profile Form state
  const [contactPhone, setContactPhone] = useState(profile.contactPhone || "+216 ");
  const [whatsappPhone, setWhatsappPhone] = useState(profile.whatsappPhone || "+216 ");
  const [showPhonePublicly, setShowPhonePublicly] = useState(profile.showPhonePublicly);
  const [inPersonPriceTnd, setInPersonPriceTnd] = useState(Math.round(profile.inPersonPriceMillimes / 1000));
  const [onlinePriceTnd, setOnlinePriceTnd] = useState(Math.round(profile.onlineVisioPriceMillimes / 1000));
  const [workplaceName, setWorkplaceName] = useState(profile.workplaceName || "");
  const [workplaceAddress, setWorkplaceAddress] = useState(profile.workplaceAddress || "");
  const [bioFr, setBioFr] = useState(profile.bioFr || "");
  const [bioAr, setBioAr] = useState(profile.bioAr || "");

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Financial Metrics
  const completedBookings = bookings.filter((b) => b.status === "COMPLETED");
  const inPersonCount = bookings.filter((b) => b.meetingType === "IN_PERSON" || b.paymentMode === "PAY_ON_SITE").length;
  const onlineVisioCount = bookings.filter((b) => b.meetingType === "ONLINE" || b.meetingType === "ONLINE_VISIO").length;

  const totalNetEarningsTnd = Math.round(
    completedBookings.reduce((sum, b) => sum + (b.netPractitionerPayoutMillimes || b.amountMillimes), 0) / 1000
  );

  const heldInEscrowTnd = Math.round(
    bookings
      .filter((b) => b.escrowStatus === "HELD_IN_ESCROW" && b.status !== "DECLINED")
      .reduce((sum, b) => sum + (b.netPractitionerPayoutMillimes || b.amountMillimes), 0) / 1000
  );

  async function handleBookingAction(bookingId: string, action: "CONFIRM" | "DECLINE" | "COMPLETE") {
    setActionLoadingId(bookingId);
    try {
      const res = await fetch(`/api/practitioner/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status: data.booking.status,
                  escrowStatus: data.booking.escrowStatus,
                }
              : b
          )
        );
      }
    } catch {
      // Keep state
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg("");

    try {
      const res = await fetch("/api/practitioner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactPhone: contactPhone.trim() !== "+216" ? contactPhone : null,
          whatsappPhone: whatsappPhone.trim() !== "+216" ? whatsappPhone : null,
          showPhonePublicly,
          inPersonPriceMillimes: inPersonPriceTnd * 1000,
          onlineVisioPriceMillimes: onlinePriceTnd * 1000,
          workplaceName: workplaceName || null,
          workplaceAddress: workplaceAddress || null,
          bioFr,
          bioAr,
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        setProfileMsg(ar ? "تم حفظ التعديلات بنجاح." : "Profil et tarifs mis à jour avec succès.");
      } else {
        setProfileMsg(json.message || "Erreur de sauvegarde");
      }
    } catch {
      setProfileMsg("Erreur réseau");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="space-y-8" dir={ar ? "rtl" : "ltr"}>
      {/* Top Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#082D55] text-xs font-bold mb-2">
              <Icon name="check" size={13} />
              <span>{profile.directoryType === "SPECIALIST" ? (ar ? "فضاء الأخصائي المعتمد" : "Console Praticien Agréé") : (ar ? "فضاء المرافق المدرسي" : "Console AVS Certifié")}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {profile.displayName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {ar
                ? "إدارة مواعيد الاستشارات الحضورية (0% عمولة) والجلسات المرئية المؤمنة تحت الضمان المالي."
                : "Pilotage de vos consultations en cabinet (0% frais) et téléconsultations sécurisées."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/${profile.directoryType === "SPECIALIST" ? "specialistes" : "avs"}`}
              className="py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors inline-flex items-center gap-1.5"
            >
              <Icon name="user" size={14} />
              <span>{ar ? "معاينة ملفي في الدليل" : "Voir ma fiche publique"}</span>
            </Link>
          </div>
        </div>

        {/* 4 Financial KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {ar ? "الحصص بالعيادة" : "Séances Cabinet"}
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {inPersonCount}
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold mt-0.5 block">
              {ar ? "0% اقتطاع (على عين المكان)" : "0% commission ANEI"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#082D55]">
              {ar ? "استشارات مرئية" : "Téléconsultations"}
            </span>
            <div className="text-2xl font-bold text-[#082D55] mt-1">
              {onlineVisioCount}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
              {ar ? "15% عمولة تحت الضمان" : "15% frais de séquestre"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              {ar ? "إجمالي المقابيض الصافية" : "Gains nets perçus"}
            </span>
            <div className="text-2xl font-bold text-emerald-900 mt-1">
              {totalNetEarningsTnd} <span className="text-sm font-normal text-emerald-700">DT</span>
            </div>
            <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
              {ar ? "حصص مكتملة" : `${completedBookings.length} séance(s) validée(s)`}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              {ar ? "تحت الضمان (Séquestre)" : "Fonds sous séquestre"}
            </span>
            <div className="text-2xl font-bold text-amber-900 mt-1">
              {heldInEscrowTnd} <span className="text-sm font-normal text-amber-700">DT</span>
            </div>
            <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">
              {ar ? "يُصرَف فور إنهاء الحصة" : "Déblocage après séance"}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("bookings")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === "bookings"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {ar ? "المواعيد والحجوزات" : "Rendez-vous & Consultations"} ({bookings.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === "profile"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {ar ? "بيانات الملف والأسعار" : "Mon Profil & Tarifs"}
        </button>
      </div>

      {/* Tab 1: Bookings List */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {bookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Icon name="calendar" size={22} />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {ar ? "لا توجد حجوزات مواعيد بعد" : "Aucun rendez-vous pour le moment"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {ar
                  ? "ستظهر هنا كافة طلبات الأولياء فور حجز موعد عبر ملفك في الدليل الوطني."
                  : "Les demandes de consultations des familles apparaîtront ici en temps réel."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {bookings.map((booking) => {
                const isOnline = booking.meetingType === "ONLINE" || booking.meetingType === "ONLINE_VISIO";
                const isCompleted = booking.status === "COMPLETED";
                const isDeclined = booking.status === "DECLINED";
                const isConfirmed = booking.status === "CONFIRMED";
                const isLoading = actionLoadingId === booking.id;

                return (
                  <div
                    key={booking.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                          {booking.requestedDate} · {booking.requestedTimeSlot}
                        </span>

                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#082D55] border border-blue-200">
                            <Icon name="video" size={11} />
                            <span>{ar ? "عن بعد (فيديو)" : "Téléconsultation Visio"}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Icon name="map" size={11} />
                            <span>{ar ? "حضوري بالعيادة (0% عمولة)" : "Au Cabinet (Présentiel · 0%)"}</span>
                          </span>
                        )}

                        {isCompleted ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">
                            {ar ? "منتهية ومصروفة" : "Séance réalisée"}
                          </span>
                        ) : isDeclined ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            {ar ? "ملغاة" : "Annulée"}
                          </span>
                        ) : isConfirmed ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900">
                            {ar ? "مؤكدة" : "Confirmée"}
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-slate-900">
                          {booking.childName} {booking.childAge ? `(${booking.childAge} ans)` : ""}
                        </h4>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 mt-1">
                          <span>
                            <strong>{ar ? "الولي : " : "Parent : "}</strong>
                            {booking.parentName}
                          </span>
                          <span>
                            <strong>{ar ? "الهاتف : " : "Tél : "}</strong>
                            <a href={`tel:${booking.parentPhone}`} className="text-emerald-700 hover:underline font-mono">
                              {booking.parentPhone}
                            </a>
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                        {booking.needDescription}
                      </p>
                    </div>

                    {/* Financial details & Action Buttons */}
                    <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="text-end">
                        <div className="text-xs text-slate-500">
                          {booking.paymentMode === "PAY_ON_SITE"
                            ? ar ? "الدفع مباشر على عين المكان" : "Paiement direct sur place"
                            : ar ? "تحت الضمان (Séquestre)" : "Paiement sous séquestre"}
                        </div>
                        <div className="text-base font-bold text-slate-900">
                          {Math.round((booking.netPractitionerPayoutMillimes || booking.amountMillimes) / 1000)} DT net
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isOnline && (
                          <a
                            href={`https://meet.jit.si/anei-visio-${booking.id.slice(0, 8)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2 px-3 bg-[#082D55] hover:bg-[#0E3B6C] text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all"
                          >
                            <Icon name="video" size={13} />
                            <span>{ar ? "دخول قاعة الفيديو" : "Rejoindre la visio"}</span>
                          </a>
                        )}

                        {!isCompleted && !isDeclined && (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleBookingAction(booking.id, "COMPLETE")}
                            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            <Icon name="check" size={13} />
                            <span>{ar ? "تأكيد إتمام الحصة" : "Séance effectuée"}</span>
                          </button>
                        )}

                        {!isCompleted && !isDeclined && (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleBookingAction(booking.id, "DECLINE")}
                            className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                          >
                            <span>{ar ? "إلغاء" : "Annuler"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Profile & Tariffs Self-Service */}
      {activeTab === "profile" && (
        <form onSubmit={handleProfileSave} className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-900">
              {ar ? "إعدادات الملف المهني والتسعيرة" : "Paramètres de votre profil public & Tarification"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ar
                ? "تحكم في رقم هاتفك المنشور، والأسعار المعتمدة للاستشارات الحضورية وعن بعد."
                : "Ajustez vos coordonnées professionnelles, visibilité publique et honoraires."}
            </p>
          </div>

          {profileMsg && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-[#082D55] text-xs font-bold">
              {profileMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {ar ? "الهاتف المهني" : "Téléphone pro"}
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {ar ? "واتساب العيادة" : "WhatsApp professionnel"}
              </label>
              <input
                type="tel"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {ar ? "سعر الاستشارة بالعيادة (DT) — 0% عمولة" : "Tarif Séance Cabinet (DT) — 0% frais ANEI"}
              </label>
              <input
                type="number"
                min={0}
                value={inPersonPriceTnd}
                onChange={(e) => setInPersonPriceTnd(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {ar ? "سعر الاستشارة المرئية (DT) — 15% ضمان" : "Tarif Téléconsultation Visio (DT) — 15% séquestre"}
              </label>
              <input
                type="number"
                min={0}
                value={onlinePriceTnd}
                onChange={(e) => setOnlinePriceTnd(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {ar ? "اسم العيادة / المركز" : "Nom du cabinet / centre"}
              </label>
              <input
                type="text"
                value={workplaceName}
                onChange={(e) => setWorkplaceName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {ar ? "العنوان الفعلي" : "Adresse physique"}
              </label>
              <input
                type="text"
                value={workplaceAddress}
                onChange={(e) => setWorkplaceAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="showPhonePubliclyUser"
              checked={showPhonePublicly}
              onChange={(e) => setShowPhonePublicly(e.target.checked)}
              className="rounded text-[#082D55] focus:ring-[#082D55]"
            />
            <label htmlFor="showPhonePubliclyUser" className="text-xs text-slate-700">
              {ar
                ? "إظهار رقم الهاتف وواتساب مباشرة على بطاقتي في الدليل الوطني"
                : "Afficher directement mon numéro de téléphone et WhatsApp sur ma fiche publique"}
            </label>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {ar ? "النبذة المهنية (بالفرنسية)" : "Présentation & Bio (Français)"}
              </label>
              <textarea
                rows={3}
                value={bioFr}
                onChange={(e) => setBioFr(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {ar ? "النبذة المهنية (بالعربية)" : "Présentation & Bio (Arabe)"}
              </label>
              <textarea
                rows={3}
                value={bioAr}
                onChange={(e) => setBioAr(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="py-2.5 px-6 bg-[#082D55] hover:bg-[#0E3B6C] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55] disabled:opacity-50"
            >
              <Icon name="check" size={14} />
              <span>{savingProfile ? (ar ? "جاري الحفظ..." : "Enregistrement...") : (ar ? "حفظ التغييرات" : "Enregistrer les modifications")}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
