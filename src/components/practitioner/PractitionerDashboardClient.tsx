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
  parentLocation?: string | null;
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
  practitionerNotes?: string | null;
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
    availabilityStatusLabel?: string;
    acceptedModalities?: string;
    availableLocationsText?: string;
    weeklySchedule?: Record<string, { enabled: boolean; slots: string[] }>;
    certified?: boolean;
    uniqueIdentifier?: string | null;
    verificationStatus?: string | null;
    verifiedAt?: Date | string | null;
    educationLevel?: string | null;
    specialtiesJson?: string[] | null;
    methodsJson?: string[] | null;
    coveredSchoolsOrZones?: string | null;
    certifications?: Array<{
      id: string;
      courseTitleFr: string;
      courseTitleAr: string;
      scorePercent: number;
      certificateHash: string;
      issuedAt: Date | string;
    }>;
  };
  initialBookings: PractitionerBookingItem[];
};

const DEFAULT_WEEKLY_SCHEDULE: Record<string, { enabled: boolean; slots: string[] }> = {
  "1": { enabled: true, slots: ["09:00", "10:30", "14:00", "15:30", "17:00"] },
  "2": { enabled: true, slots: ["09:00", "10:30", "14:00", "15:30", "17:00"] },
  "3": { enabled: true, slots: ["09:00", "10:30", "14:00", "15:30", "17:00"] },
  "4": { enabled: true, slots: ["09:00", "10:30", "14:00", "15:30", "17:00"] },
  "5": { enabled: true, slots: ["09:00", "10:30", "14:00", "15:30", "17:00"] },
  "6": { enabled: true, slots: ["09:00", "10:30", "12:00"] },
  "0": { enabled: false, slots: ["09:00", "10:30", "14:00"] },
};

const DAYS_ORDER = [
  { key: "1", fr: "Lundi", ar: "الإثنين" },
  { key: "2", fr: "Mardi", ar: "الثلاثاء" },
  { key: "3", fr: "Mercredi", ar: "الأربعاء" },
  { key: "4", fr: "Jeudi", ar: "الخميس" },
  { key: "5", fr: "Vendredi", ar: "الجمعة" },
  { key: "6", fr: "Samedi", ar: "السبت" },
  { key: "0", fr: "Dimanche", ar: "الأحد" },
];

const PRESET_SLOTS = [
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
];

export function PractitionerDashboardClient({
  locale,
  profile,
  initialBookings,
}: PractitionerDashboardClientProps) {
  const ar = locale === "ar";
  const [activeTab, setActiveTab] = useState<"bookings" | "availability" | "profile">("bookings");
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

  // Availability & Weekly Schedule State
  const [availabilityStatusLabel, setAvailabilityStatusLabel] = useState<string>(
    profile.availabilityStatusLabel || "IMMEDIATE_FULL_TIME"
  );
  const [acceptedModalities, setAcceptedModalities] = useState<string>(
    profile.acceptedModalities || "BOTH"
  );
  const [availableLocationsText, setAvailableLocationsText] = useState<string>(
    profile.availableLocationsText || ""
  );
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, { enabled: boolean; slots: string[] }>>(
    profile.weeklySchedule && Object.keys(profile.weeklySchedule).length > 0
      ? profile.weeklySchedule
      : DEFAULT_WEEKLY_SCHEDULE
  );

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityMsg, setAvailabilityMsg] = useState("");
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

  const pendingBookings = bookings.filter(
    (b) => b.status === "AWAITING_PRACTITIONER_CONFIRMATION" || b.status === "PENDING"
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

  async function handleAvailabilitySave(e: React.FormEvent) {
    e.preventDefault();
    setSavingAvailability(true);
    setAvailabilityMsg("");

    try {
      const res = await fetch("/api/practitioner/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availabilityStatusLabel,
          acceptedModalities,
          availableLocationsText,
          weeklySchedule,
          contactPhone: contactPhone.trim() !== "+216" ? contactPhone : null,
          whatsappPhone: whatsappPhone.trim() !== "+216" ? whatsappPhone : null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        setAvailabilityMsg(
          ar ? "تم حفظ وتحديث جدول المواعيد والمناطق بنجاح." : "Disponibilités et zones d'intervention enregistrées avec succès."
        );
      } else {
        setAvailabilityMsg(json.message || json.error || "Erreur de sauvegarde");
      }
    } catch {
      setAvailabilityMsg("Erreur réseau");
    } finally {
      setSavingAvailability(false);
    }
  }

  function toggleDay(dayKey: string) {
    setWeeklySchedule((prev) => {
      const current = prev[dayKey] || { enabled: false, slots: [] };
      return {
        ...prev,
        [dayKey]: {
          ...current,
          enabled: !current.enabled,
        },
      };
    });
  }

  function removeSlot(dayKey: string, slotToRemove: string) {
    setWeeklySchedule((prev) => {
      const current = prev[dayKey] || { enabled: true, slots: [] };
      return {
        ...prev,
        [dayKey]: {
          ...current,
          slots: current.slots.filter((s) => s !== slotToRemove),
        },
      };
    });
  }

  function addSlot(dayKey: string, slotToAdd: string) {
    if (!slotToAdd) return;
    setWeeklySchedule((prev) => {
      const current = prev[dayKey] || { enabled: true, slots: [] };
      if (current.slots.includes(slotToAdd)) return prev;
      const newSlots = [...current.slots, slotToAdd].sort();
      return {
        ...prev,
        [dayKey]: {
          ...current,
          enabled: true,
          slots: newSlots,
        },
      };
    });
  }

  return (
    <div className="space-y-8" dir={ar ? "rtl" : "ltr"}>
      {/* Zero-Trust Accreditation Banner */}
      {profile.verificationStatus === "CERTIFIED_ACTIVE" || profile.certified ? (
        <div className="bg-gradient-to-r from-emerald-950 via-[#0D3B2E] to-[#124233] text-white rounded-3xl p-6 sm:p-7 shadow-md border border-emerald-800/60 relative overflow-hidden">
          <div className="absolute top-0 end-0 -mt-8 -me-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative">
            <div className="flex items-start gap-4">
              <span className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center flex-none">
                <Icon name="award" size={24} />
              </span>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {ar ? "اعتماد رسمي نشط" : "Habilitation Active — Zéro-Trust"}
                  </span>
                  {profile.uniqueIdentifier && (
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/20" dir="ltr">
                      ID : {profile.uniqueIdentifier}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold font-editorial-serif text-white">
                  {ar ? "ملف مهني معتمد رسمياً لدى الأكاديمية الوطنية" : "Profil Professionnel Agréé & Validé par l'Académie"}
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
                  {ar
                    ? "لقد اجتزت بنجاح التقييمات المعيارية للأكاديمية (علامة 80% فما فوق). ملفك يظهر مع شارة التحقق الرسمية في الدليل العام ويضمن كفاءتك أمام الأولياء والمدارس."
                    : "Votre accréditation Zero-Trust est active suite à votre réussite aux évaluations certifiantes (score ≥ 80%). Vos compétences sont garanties auprès des familles et établissements scolaires."}
                </p>
                {profile.certifications && profile.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-emerald-200">
                    <span className="font-semibold text-white/90">
                      {ar ? "المسارات المعتمدة :" : "Certifications :"}
                    </span>
                    {profile.certifications.map((c) => (
                      <span key={c.id} className="px-2 py-0.5 rounded-md bg-emerald-900/60 border border-emerald-700/50">
                        {ar ? c.courseTitleAr : c.courseTitleFr} ({c.scorePercent}%)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 flex-none">
              <Link
                href={`/${locale}/certificats/${profile.uniqueIdentifier || profile.id}`}
                className="py-2.5 px-4 rounded-xl bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2"
              >
                <Icon name="check" size={14} className="text-emerald-700" />
                <span>{ar ? "معاينة وتحميل الشهادة الرسمية" : "Voir mon certificat officiel"}</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 rounded-3xl p-6 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-none font-bold text-lg">
              !
            </span>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-amber-950">
                {ar ? "الاعتماد المهني في انتظار استكمال التقييم" : "Habilitation en attente de formation certifiante"}
              </h3>
              <p className="text-xs text-amber-900/80 max-w-2xl leading-relaxed">
                {ar
                  ? "للحصول على معرّفك الفريد (ID) وشارة الاعتماد الرسمي في الدليل، أكمل تكويناً معتمداً (طيف التوحد، صعوبات التعلم أو المرجعية البيداغوجية) مع نتيجة 80% على الأقل في الاختبار النهائي."
                  : "Pour obtenir votre Identifiant Unique infalsifiable et arborer le badge 'Certifié ANEI' dans l'annuaire national, complétez une formation qualifiante (TSA, TDAH, Troubles DYS ou Référentiel AVS) avec au moins 80% au QCM final."}
              </p>
            </div>
          </div>
          <Link
            href={`/${locale}/formations`}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 flex-none"
          >
            <span>{ar ? "استكشاف التكوينات المؤهلة" : "Accéder aux formations qualifiantes"}</span>
            <Icon name="arrow" size={13} className="directional-icon" />
          </Link>
        </div>
      )}

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

      {/* Pending Requests Alert Banner */}
      {pendingBookings.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              ⏳
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-amber-950">
                {ar
                  ? `لديك ${pendingBookings.length} طلب موعد جديد بانتظار تأكيدكم!`
                  : `Vous avez ${pendingBookings.length} nouvelle(s) demande(s) de rendez-vous en attente !`}
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                {ar
                  ? "يرجى تأكيد أو رفض المواعيد حتى يتم إشعار العائلة وتجهيز رابط الاستشارة أو استقبالهم بالعيادة."
                  : "Veuillez valider ou refuser les demandes afin de notifier immédiatement les familles."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab("bookings")}
            className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto"
          >
            {ar ? "معاينة الطلبات الآن ←" : "Traiter les demandes →"}
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("bookings")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "bookings"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>{ar ? "المواعيد والحجوزات" : "Rendez-vous & Consultations"}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            pendingBookings.length > 0 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"
          }`}>
            {bookings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("availability")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === "availability"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {ar ? "المواعيد والمناطق" : "Mes Disponibilités & Lieux"}
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
                const isPending =
                  booking.status === "AWAITING_PRACTITIONER_CONFIRMATION" || booking.status === "PENDING";
                const isLoading = actionLoadingId === booking.id;

                return (
                  <div
                    key={booking.id}
                    className={`bg-white rounded-2xl border shadow-xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all ${
                      isPending ? "border-amber-300 ring-1 ring-amber-200/60" : "border-slate-200/90"
                    }`}
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

                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>{ar ? "في انتظار تأكيدكم" : "En attente de confirmation"}</span>
                          </span>
                        ) : isConfirmed ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                            {ar ? "موعد مؤكد" : "Confirmé"}
                          </span>
                        ) : isCompleted ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                            {ar ? "منتهية ومصروفة" : "Séance effectuée"}
                          </span>
                        ) : isDeclined ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            {ar ? "ملغاة" : "Annulée"}
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-slate-900">
                          {booking.childName} {booking.childAge ? `(${booking.childAge} ans)` : ""}
                        </h4>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 mt-1.5">
                          <span>
                            <strong>{ar ? "الولي : " : "Parent : "}</strong>
                            {booking.parentName}
                          </span>
                          <span>
                            <strong>{ar ? "الهاتف : " : "Tél : "}</strong>
                            <a href={`tel:${booking.parentPhone}`} className="text-emerald-700 hover:underline font-mono font-bold">
                              {booking.parentPhone}
                            </a>
                          </span>
                          <span>
                            <strong>{ar ? "البريد : " : "Email : "}</strong>
                            <a href={`mailto:${booking.parentEmail}`} className="text-blue-700 hover:underline">
                              {booking.parentEmail}
                            </a>
                          </span>
                          {booking.parentLocation && (
                            <span>
                              <strong>{ar ? "الموقع : " : "Lieu : "}</strong>
                              <span className="text-slate-800">{booking.parentLocation}</span>
                            </span>
                          )}
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
                        {/* Actions for PENDING requests */}
                        {isPending && (
                          <>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleBookingAction(booking.id, "CONFIRM")}
                              className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                            >
                              <Icon name="check" size={13} />
                              <span>{ar ? "تأكيد الموعد" : "Confirmer ce rendez-vous"}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleBookingAction(booking.id, "DECLINE")}
                              className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                            >
                              <Icon name="close" size={13} />
                              <span>{ar ? "رفض" : "Refuser"}</span>
                            </button>
                          </>
                        )}

                        {/* Actions for CONFIRMED requests */}
                        {isConfirmed && (
                          <>
                            {isOnline && (
                              <a
                                href={`https://meet.jit.si/anei-visio-${booking.id.slice(0, 8)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-2 px-3.5 bg-[#082D55] hover:bg-[#0E3B6C] text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all"
                              >
                                <Icon name="video" size={13} />
                                <span>{ar ? "دخول قاعة الفيديو" : "Rejoindre la visio"}</span>
                              </a>
                            )}
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleBookingAction(booking.id, "COMPLETE")}
                              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                            >
                              <Icon name="check" size={13} />
                              <span>{ar ? "تأكيد إتمام الحصة" : "Séance effectuée"}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleBookingAction(booking.id, "DECLINE")}
                              className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                            >
                              <span>{ar ? "إلغاء" : "Annuler"}</span>
                            </button>
                          </>
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

      {/* Tab 2: Availability & Schedule Management */}
      {activeTab === "availability" && (
        <form onSubmit={handleAvailabilitySave} className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-900">
              {ar ? "إدارة التوفر وجدول المواعيد الأسبوعي والمناطق" : "Gestion des Disponibilités & Planning Hebdomadaire"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ar
                ? "حدد أوقات استقبال المرضى والتلاميذ، وصيغ التدخل (حضوري أو عن بعد)، ومناطق الخدمة."
                : "Configurez votre statut, vos modalités d'intervention, vos créneaux réguliers et zones couvertes."}
            </p>
          </div>

          {availabilityMsg && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-[#082D55] text-xs font-bold">
              {availabilityMsg}
            </div>
          )}

          {/* Availability Status & Modalities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                {ar ? "حالة التوفر الحالية" : "Statut de disponibilité"}
              </label>
              <select
                value={availabilityStatusLabel}
                onChange={(e) => setAvailabilityStatusLabel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              >
                <option value="IMMEDIATE_FULL_TIME">
                  {ar ? "متاح فوراً (وقت كامل)" : "Disponible immédiatement (Temps plein)"}
                </option>
                <option value="WEEKDAYS">
                  {ar ? "خلال أيام الأسبوع فقط (الإثنين إلى الجمعة)" : "En semaine uniquement (Lundi au Vendredi)"}
                </option>
                <option value="WEEKENDS_AND_EVENINGS">
                  {ar ? "عطلات نهاية الأسبوع والأمسيات" : "Soirs & Week-ends uniquement"}
                </option>
                <option value="UNAVAILABLE">
                  {ar ? "غير متاح حالياً (مغلق مؤقتاً أمام الحجوزات)" : "Non disponible actuellement (Fermé aux nouveaux RDV)"}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                {ar ? "صيغ الاستشارة المقبولة" : "Modalités d'intervention acceptées"}
              </label>
              <select
                value={acceptedModalities}
                onChange={(e) => setAcceptedModalities(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              >
                <option value="BOTH">
                  {ar ? "حضوري بالعيادة وعن بعد (كلاهما)" : "Présentiel en cabinet & Téléconsultation Visio (Les deux)"}
                </option>
                <option value="IN_PERSON_ONLY">
                  {ar ? "حضوري بالعيادة فقط" : "Présentiel en cabinet uniquement"}
                </option>
                <option value="ONLINE_ONLY">
                  {ar ? "استشارة عن بعد فقط" : "Téléconsultation Visio uniquement"}
                </option>
              </select>
            </div>
          </div>

          {/* Intervention Locations */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {ar ? "المناطق والمدن والمدارس المغطاة للتدخل" : "Villes, délégations et écoles couvertes pour les interventions"}
            </label>
            <input
              type="text"
              value={availableLocationsText}
              onChange={(e) => setAvailableLocationsText(e.target.value)}
              placeholder={ar ? "تونس الكبرى، أريانة، المرسى، المدارس الشريكة..." : "Ex: Grand Tunis, Ariana, La Marsa, Écoles partenaires de la région..."}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
            />
          </div>

          {/* Weekly Schedule Planner */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                {ar ? "الجدول الأسبوعي للفتحات الزمنية" : "Créneaux horaires par jour de la semaine"}
              </h4>
              <span className="text-xs text-slate-500">
                {ar ? "الفتحات تظهر مباشرة في صفحة ملفكم" : "Ces créneaux alimentent le widget de prise de rendez-vous"}
              </span>
            </div>

            <div className="space-y-3">
              {DAYS_ORDER.map((d) => {
                const dayConfig = weeklySchedule[d.key] || { enabled: false, slots: [] };
                return (
                  <div
                    key={d.key}
                    className={`p-4 rounded-2xl border transition-all ${
                      dayConfig.enabled ? "bg-slate-50/70 border-slate-200" : "bg-white border-slate-100 opacity-60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`day-${d.key}`}
                          checked={dayConfig.enabled}
                          onChange={() => toggleDay(d.key)}
                          className="w-4 h-4 rounded text-[#082D55] focus:ring-[#082D55]"
                        />
                        <label htmlFor={`day-${d.key}`} className="text-xs font-bold text-slate-900 cursor-pointer">
                          {ar ? d.ar : d.fr}
                        </label>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          dayConfig.enabled ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-500"
                        }`}>
                          {dayConfig.enabled ? (ar ? "نشط ومتاح" : "Actif") : (ar ? "مغلق / راحة" : "Inactif")}
                        </span>
                      </div>

                      {dayConfig.enabled && (
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] text-slate-500">
                            {ar ? "إضافة توقيت سريع :" : "Ajout rapide :"}
                          </label>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addSlot(d.key, e.target.value);
                                e.target.value = "";
                              }
                            }}
                            className="text-[11px] py-1 px-2 rounded-lg bg-white border border-slate-200 text-slate-700"
                          >
                            <option value="">{ar ? "+ اختر ساعة" : "+ Créneau"}</option>
                            {PRESET_SLOTS.filter((s) => !dayConfig.slots.includes(s)).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {dayConfig.enabled && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {dayConfig.slots.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">
                            {ar ? "لا توجد فتحات محددة لهذا اليوم. أضف créneau من القائمة أعلاه." : "Aucun créneau configuré pour ce jour."}
                          </span>
                        ) : (
                          dayConfig.slots.map((slot) => (
                            <span
                              key={slot}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-[#082D55] shadow-2xs"
                            >
                              <span>{slot}</span>
                              <button
                                type="button"
                                onClick={() => removeSlot(d.key, slot)}
                                className="text-slate-400 hover:text-rose-600 transition-colors"
                                title={ar ? "حذف" : "Supprimer"}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={savingAvailability}
              className="py-2.5 px-6 bg-[#082D55] hover:bg-[#0E3B6C] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55] disabled:opacity-50"
            >
              <Icon name="check" size={14} />
              <span>
                {savingAvailability
                  ? ar ? "جاري الحفظ..." : "Enregistrement en cours..."
                  : ar ? "حفظ جدول المواعيد والمناطق" : "Enregistrer mes disponibilités"}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Profile & Tariffs Self-Service */}
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
