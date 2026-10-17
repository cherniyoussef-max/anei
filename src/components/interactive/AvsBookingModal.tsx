"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import { useSession } from "@/lib/auth-client";

export type AvsBookingModalProps = {
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
  };
  initialDate?: string;
  initialTimeSlot?: string;
  initialMeetingType?: "IN_PERSON" | "ONLINE" | "HOME";
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const COMMON_SLOTS = [
  "08:30 - 09:30",
  "09:30 - 10:30",
  "10:30 - 11:30",
  "11:30 - 12:30",
  "14:00 - 15:00",
  "15:00 - 16:00",
  "16:00 - 17:00",
  "17:00 - 18:00",
];

export function AvsBookingModal({
  locale,
  avs,
  initialDate,
  initialTimeSlot,
  initialMeetingType,
  isOpen,
  onClose,
  onSuccess,
}: AvsBookingModalProps) {
  const ar = locale === "ar";
  const { data: sessionData, isPending: isSessionPending } = useSession();
  const user = sessionData?.user;

  // Calculate upcoming 7 days
  const today = new Date();
  const nextDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() + i + 1);
    const iso = d.toISOString().split("T")[0];
    const dayLabel = d.toLocaleDateString(ar ? "ar-TN" : "fr-TN", { weekday: "short" });
    const dateLabel = d.toLocaleDateString(ar ? "ar-TN" : "fr-TN", { day: "numeric", month: "short" });
    return { iso, dayLabel, dateLabel };
  });

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || nextDays[0].iso);
  const [selectedSlot, setSelectedSlot] = useState<string>(initialTimeSlot || COMMON_SLOTS[1]);
  const [meetingType, setMeetingType] = useState<"IN_PERSON" | "ONLINE" | "HOME">(initialMeetingType || "IN_PERSON");

  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("7");
  const [schoolName, setSchoolName] = useState("");
  const [interventionDomain, setInterventionDomain] = useState(avs.domains?.[0] || "");
  const [needDescription, setNeedDescription] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("+216 ");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CARD_ESCROW" | "FLOUCI" | "ESCROW_SIMULATION">("CARD_ESCROW");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmedBookingId, setConfirmedBookingId] = useState("");
  const [escrowRef, setEscrowRef] = useState("");

  const resolvedParentName = parentName || user?.name || "";
  const resolvedParentEmail = parentEmail || user?.email || "";

  if (!isOpen) return null;

  // Pricing calculations
  const sessionRateTnd = avs.hourlyRateTnd && avs.hourlyRateTnd > 0 ? avs.hourlyRateTnd : 35;
  const platformFeeTnd = Math.round(sessionRateTnd * 0.1);
  const totalEscrowTnd = sessionRateTnd + platformFeeTnd;

  async function handlePaymentAndSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!childName || !needDescription || !parentPhone) {
      setErrorMessage(
        ar ? "يرجى ملء جميع الحقول المطلوبة." : "Veuillez renseigner tous les champs obligatoires."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/avs/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avsProfileId: avs.id,
          parentName: resolvedParentName || "Parent",
          parentEmail: resolvedParentEmail || "",
          parentPhone,
          childName,
          childAge: Number(childAge) || 7,
          schoolName,
          needDescription,
          interventionDomain,
          requestedDate: selectedDate,
          requestedTimeSlot: selectedSlot,
          meetingType,
          notes,
          paymentMethod,
          locale,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === "AUTH_REQUIRED") {
          throw new Error(
            ar
              ? "يجب تسجيل الدخول لحجز موعد مرافقة وتأمين الضمان."
              : "Connexion requise pour réserver et sécuriser les fonds sous séquestre."
          );
        }
        throw new Error(data.error || "Erreur lors de la réservation");
      }

      setConfirmedBookingId(data.booking.id);
      setEscrowRef(data.booking.escrow?.reference || `ESC-2026-${Date.now().toString(36).toUpperCase()}`);
      setStep(4);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : ar
          ? "حدث خطأ أثناء إتمام العملية. يرجى المحاولة ثانية."
          : "Une erreur est survenue lors de l'enregistrement de votre demande."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Auth gate if user is not logged in
  const isUnauthenticated = !isSessionPending && !user;

  return (
    <div
      className="avs-booking-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#1B3A5C] text-white px-6 py-5 flex items-center justify-between border-b border-white/10 flex-none">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center font-bold text-white border border-white/20">
              {avs.initials}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-blue-100 font-semibold flex items-center gap-1.5">
                <span>🛡️</span>
                <span>{ar ? "حجز موعد مع ضمان طرف ثالث ANEI" : "Rendez-vous AVS & Tiers de Confiance ANEI"}</span>
              </div>
              <h2 id="booking-modal-title" className="text-lg font-bold text-white">
                {avs.name}
              </h2>
              <div className="text-xs text-blue-100 flex items-center gap-2">
                <span>{avs.specialty}</span>
                <span>•</span>
                <span>{avs.city}</span>
                <span>•</span>
                <span className="text-white font-semibold">{sessionRateTnd} TND / séance</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={ar ? "إغلاق" : "Fermer"}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Auth Gate Screen */}
        {isUnauthenticated ? (
          <div className="p-8 text-center space-y-6 overflow-y-auto">
            <div className="w-16 h-16 bg-[#F0F6FF] text-[#1B3A5C] rounded-full mx-auto flex items-center justify-center">
              <Icon name="shield" size={32} />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#1B3A5C] bg-[#F0F6FF] border border-[#BFDBFE] px-3 py-1 rounded-full">
                {ar ? "حساب مطلوب لسلامة المعاملة" : "Authentification requise · Sécurité ANEI"}
              </span>
              <h3 className="text-xl font-bold text-[#0F172A]">
                {ar ? "يرجى تسجيل الدخول أو إنشاء حساب" : "Connexion obligatoire pour réserver"}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {ar
                  ? "لضمان سرية المعطيات البيداغوجية، ومتابعة الطفل بدقة، وحفظ أموالكم في حساب الضمان (Séquestre) لدى الأكاديمية كطرف ثالث، يجب أن يتوفر لديكم حساب ولي أمر مسجل."
                  : "La réservation d'un accompagnant scolaire certifié et la protection des fonds sous séquestre nécessitent un compte Famille ou Parent identifié. Veuillez vous connecter ou créer votre compte en quelques secondes."}
              </p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-xs text-slate-700 max-w-md mx-auto text-start space-y-2">
              <div className="flex items-center gap-2 text-[#1B3A5C] font-bold">
                <span>🛡️</span>
                <span>{ar ? "لماذا يشترط إنشاء الحساب؟" : "Pourquoi un compte est-il requis ?"}</span>
              </div>
              <p>• {ar ? "حماية بيانات الطفل وحالته البيداغوجية في سرية تامة." : "Protection des données de santé et d'inclusion de votre enfant."}</p>
              <p>• {ar ? "ضمان مالي رسمي: الأموال تبقى محجوزة لدى ANEI حتى تمام الحصة." : "Garantie financière tiers de confiance : fonds sous séquestre ANEI."}</p>
              <p>• {ar ? "متابعة المواعيد وسجل الجلسات عبر لوحة تحكم الولي." : "Suivi direct de vos rendez-vous et reçus dans votre espace Parent."}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href={`/${locale}/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : `/${locale}/avs`)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1B3A5C] hover:bg-[#24476E] text-white px-6 py-3 rounded-xl text-sm font-bold shadow-xs transition-all"
              >
                <Icon name="user" size={16} />
                <span>{ar ? "تسجيل الدخول" : "Se connecter"}</span>
              </Link>
              <Link
                href={`/${locale}/register?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : `/${locale}/avs`)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-[#1B3A5C] bg-white hover:bg-[#F0F6FF] text-[#1B3A5C] px-6 py-3 rounded-xl text-sm font-bold shadow-xs transition-all"
              >
                <span>{ar ? "إنشاء حساب جديد" : "Créer un compte"}</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Stepper Progress */}
            {step < 4 && (
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-medium text-slate-600 flex-none">
                <div className={`flex items-center gap-2 ${step >= 1 ? "text-[#1B3A5C] font-bold" : ""}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? "bg-[#1B3A5C] text-white" : "bg-slate-200"}`}>1</span>
                  <span>{ar ? "الموعد" : "Créneau"}</span>
                </div>
                <div className="h-0.5 w-6 bg-slate-200" />
                <div className={`flex items-center gap-2 ${step >= 2 ? "text-[#1B3A5C] font-bold" : ""}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? "bg-[#1B3A5C] text-white" : "bg-slate-200"}`}>2</span>
                  <span>{ar ? "الطفل" : "L'Élève"}</span>
                </div>
                <div className="h-0.5 w-6 bg-slate-200" />
                <div className={`flex items-center gap-2 ${step >= 3 ? "text-[#1B3A5C] font-bold" : ""}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? "bg-[#1B3A5C] text-white" : "bg-slate-200"}`}>3</span>
                  <span>{ar ? "الدفع والضمان" : "Paiement Séquestre"}</span>
                </div>
              </div>
            )}

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {errorMessage && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <Icon name="shield" size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* STEP 1: Date, slot & format */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      {ar ? "1. اختر اليوم المناسب" : "1. Choisissez le jour"}
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                      {nextDays.map((d) => {
                        const isSel = d.iso === selectedDate;
                        return (
                          <button
                            key={d.iso}
                            type="button"
                            onClick={() => setSelectedDate(d.iso)}
                            className={`p-2.5 rounded-xl border text-center transition-all ${
                              isSel
                                ? "bg-[#1B3A5C] border-[#1B3A5C] text-white shadow-xs font-bold"
                                : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                            }`}
                          >
                            <div className="text-[11px] uppercase opacity-80">{d.dayLabel}</div>
                            <div className="text-sm font-bold mt-0.5">{d.dateLabel.split(" ")[0]}</div>
                            <div className="text-[10px] opacity-75">{d.dateLabel.split(" ")[1]}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      {ar ? "2. التوقيت المتاح" : "2. Créneau horaire"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {COMMON_SLOTS.map((slot) => {
                        const isSel = slot === selectedSlot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-all ${
                              isSel
                                ? "bg-[#1B3A5C] border-[#1B3A5C] text-white shadow-xs"
                                : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      {ar ? "3. صيغة اللقاء" : "3. Format de la rencontre"}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: "IN_PERSON", label: ar ? "حضوري بالمكتب" : "En cabinet", icon: "map" as const },
                          { id: "HOME", label: ar ? "في المنزل" : "À domicile", icon: "map" as const },
                          { id: "ONLINE", label: ar ? "عن بعد (فيديو)" : "En ligne", icon: "video" as const },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setMeetingType(t.id)}
                          className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                            meetingType === t.id
                              ? "bg-[#F0F6FF] border-[#1B3A5C] text-[#1B3A5C] font-bold shadow-xs"
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                          }`}
                        >
                          <Icon name={t.icon} size={18} />
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Child info */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {ar ? "اسم ولقب التلميذ(ة) *" : "Nom et prénom de l'élève *"}
                      </label>
                      <input
                        type="text"
                        required
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                        placeholder={ar ? "محمد علي" : "Ex: Rayan Ben Salem"}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#1B3A5C]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {ar ? "عمر التلميذ *" : "Âge de l'élève *"}
                      </label>
                      <input
                        type="number"
                        min={3}
                        max={25}
                        required
                        value={childAge}
                        onChange={(e) => setChildAge(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#1B3A5C]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {ar ? "المؤسسة التربوية / المدرسة" : "Établissement scolaire"}
                    </label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder={ar ? "المدرسة الابتدائية بالمنزه..." : "Ex: École primaire Hannibal, Tunis"}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#1B3A5C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {ar ? "طبيعة الحاجة والاضطراب *" : "Description du besoin / Spécificité *"}
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={needDescription}
                      onChange={(e) => setNeedDescription(e.target.value)}
                      placeholder={
                        ar
                          ? "مثال: طيف التوحد، صعوبات التعلم (عسر القراءة)، تشتت الانتباه وفرط الحركة..."
                          : "Ex: Trouble du spectre autistique, TDAH, troubles des apprentissages (dyslexie), besoin d'autonomie en classe..."
                      }
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#1B3A5C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {ar ? "مجال التدخل الرئيسي" : "Domaine d'intervention"}
                    </label>
                    <select
                      value={interventionDomain}
                      onChange={(e) => setInterventionDomain(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#1B3A5C] bg-white text-slate-800"
                    >
                      <option value="">{ar ? "اختر مجال التدخل (اختياري)" : "Sélectionner un domaine (optionnel)"}</option>
                      <option value="TSA">{ar ? "طيف التوحد (TSA)" : "Troubles du spectre de l'autisme (TSA)"}</option>
                      <option value="TDAH">{ar ? "فرط الحركة ونقص الانتباه (TDAH)" : "TDAH & Troubles de l'attention"}</option>
                      <option value="DYS">{ar ? "صعوبات التعلم (DYS)" : "Troubles d'apprentissage (DYS)"}</option>
                      <option value="MOTEUR">{ar ? "إعاقة حركية أو حسية" : "Accompagnement moteur ou sensoriel"}</option>
                      <option value="AUTRE">{ar ? "مرافقة عامة / أخرى" : "Autre accompagnement scolaire"}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 3: Third-Party Escrow Payment */}
              {step === 3 && (
                <form onSubmit={handlePaymentAndSubmit} className="space-y-5">
                  {/* Escrow Guarantee Pill */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-xs text-emerald-900">
                    <span className="text-xl flex-none mt-0.5">🛡️</span>
                    <div>
                      <strong className="block font-bold text-emerald-950 mb-0.5">
                        {ar ? "ضمان الطرف الثالث الموثوق (ANEI Séquestre)" : "Garantie Tiers de Confiance ANEI"}
                      </strong>
                      <p className="text-emerald-800 leading-relaxed">
                        {ar
                          ? "الأكاديمية الوطنية تضمن سلامة أموالكم: يبقى المبلغ محجوزاً في حساب الضمان الآمن ولا يُصرف للمرافق إلا بعد انعقاد الحصة وتأكيدها. في حال التعذر، يُسترجع كامل المبلغ فوراً."
                          : "L'ANEI agit comme tiers de confiance neutre et sécurisé. Vos fonds sont bloqués sur un compte séquestre et ne sont reversés à l'AVS qu'une fois la séance effectuée. Remboursement intégral garanti en cas d'annulation."}
                      </p>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-slate-700">
                      <span>{ar ? "أتعاب جلسة المرافقة (AVS) :" : "Honoraires de la séance AVS :"}</span>
                      <strong className="font-mono text-slate-900">{sessionRateTnd}.000 TND</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{ar ? "رسوم الضمان والتأمين والمتابعة (ANEI 10%) :" : "Frais de séquestre & supervision (ANEI 10%) :"}</span>
                      <span className="font-mono text-[#1B3A5C]">+{platformFeeTnd}.000 TND</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-[#0F172A]">
                      <span>{ar ? "المجموع المودع تحت الضمان :" : "Total à régler sous séquestre :"}</span>
                      <span className="font-mono text-base text-[#1B3A5C]">{totalEscrowTnd}.000 TND</span>
                    </div>
                  </div>

                  {/* Parent Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {ar ? "ولي الأمر المسجل *" : "Parent titulaire *"}
                      </label>
                      <input
                        type="text"
                        required
                        value={resolvedParentName}
                        onChange={(e) => setParentName(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#1B3A5C] font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {ar ? "البريد الإلكتروني *" : "Email de confirmation *"}
                      </label>
                      <input
                        type="email"
                        required
                        value={resolvedParentEmail}
                        onChange={(e) => setParentEmail(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#1B3A5C] font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {ar ? "رقم الهاتف للاتصال *" : "Téléphone de contact *"}
                      </label>
                      <input
                        type="tel"
                        required
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#1B3A5C]"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      {ar ? "طريقة الدفع تحت الضمان" : "Mode de règlement sous séquestre"}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: "CARD_ESCROW", label: ar ? "بطاقة بنكية" : "Carte Bancaire", icon: "wallet" as const },
                          { id: "FLOUCI", label: "Flouci", icon: "wallet" as const },
                          { id: "ESCROW_SIMULATION", label: ar ? "محاكاة فورية" : "Test Séquestre", icon: "check" as const },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                            paymentMethod === m.id
                              ? "bg-[#1B3A5C] border-[#1B3A5C] text-white shadow-xs"
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                          }`}
                        >
                          <Icon name={m.icon} size={15} />
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {ar ? "ملاحظات وتوجيهات خاصة (اختياري)" : "Remarques ou précisions pour l'AVS (optionnel)"}
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={ar ? "أي توجيهات لوجستية أو مواصفات خاصة..." : "Ex: Première prise de contact, documents bilans..."}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#1B3A5C]"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[#1B3A5C] hover:bg-[#24476E] disabled:opacity-50 text-white py-3.5 px-4 rounded-xl text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <span>{ar ? "جارٍ تسجيل الدفع والضمان..." : "Sécurisation des fonds sous séquestre..."}</span>
                      ) : (
                        <>
                          <span>🛡️</span>
                          <span>
                            {ar
                              ? `تأكيد الدفع وحجز الموعد (${totalEscrowTnd}.000 TND)`
                              : `Régler et Sécuriser le RDV sous Séquestre (${totalEscrowTnd}.000 TND)`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 4: Confirmation & Receipt */}
              {step === 4 && (
                <div className="text-center py-4 space-y-5">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full mx-auto flex items-center justify-center font-bold">
                    <Icon name="check" size={32} />
                  </div>
                  <div>
                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mb-2">
                      {ar ? "🛡️ مدفوع — الأموال تحت الضمان الآمن" : "🛡️ Payé — Fonds protégés sous séquestre ANEI"}
                    </span>
                    <h3 className="text-xl font-bold text-[#0F172A]">
                      {ar ? "تم تأكيد موعدكم بنجاح" : "Votre rendez-vous est confirmé"}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {ar
                        ? "تم إرسال إشعار وسند الضمان إلى بريدكم الإلكتروني. الموعد متاح الآن في لوحة تحكمكم."
                        : "Un accusé de réception et le certificat de séquestre ont été transmis à votre adresse email."}
                    </p>
                  </div>

                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-xs text-slate-700 max-w-md mx-auto text-start space-y-2">
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500">{ar ? "المرجع الآمن للضمان :" : "Réf. Séquestre :"}</span>
                      <strong className="font-mono text-[#1B3A5C]">{escrowRef}</strong>
                    </div>
                    {confirmedBookingId && (
                      <div className="flex justify-between border-b border-slate-200 pb-2 text-[11px] text-slate-500">
                        <span>{ar ? "معرّف الموعد :" : "N° de dossier :"}</span>
                        <span className="font-mono text-slate-600">{confirmedBookingId.slice(0, 12)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500">{ar ? "المرافق المدرسي :" : "Accompagnant(e) :"}</span>
                      <strong>{avs.name}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500">{ar ? "التاريخ والتوقيت :" : "Date & Créneau :"}</span>
                      <span>{selectedDate} ({selectedSlot})</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">{ar ? "المبلغ المحفوظ تحت الضمان :" : "Montant sous séquestre :"}</span>
                      <strong className="text-emerald-700 font-mono text-sm">{totalEscrowTnd}.000 TND</strong>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                    <Link
                      href={`/${locale}/dashboard`}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1B3A5C] hover:bg-[#24476E] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all"
                    >
                      <Icon name="calendar" size={15} />
                      <span>{ar ? "عرض في مساحتي (لوحة التحكم)" : "Gérer dans mon espace Parent"}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
                    >
                      <span>{ar ? "إغلاق" : "Fermer"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper Footer Controls */}
            {step < 3 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-none">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : 1))}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-white transition-colors"
                  >
                    {ar ? "← السابق" : "← Précédent"}
                  </button>
                ) : <div />}

                <button
                  type="button"
                  onClick={() => {
                    if (step === 2 && (!childName || !needDescription)) {
                      setErrorMessage(ar ? "يرجى كتابة اسم التلميذ ووصف الحاجة." : "Veuillez renseigner le nom de l'élève et son besoin.");
                      return;
                    }
                    setErrorMessage("");
                    setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : 4));
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-xs font-bold hover:bg-[#24476E] transition-colors shadow-xs"
                >
                  {step === 2
                    ? ar
                      ? "المتابعة إلى الدفع والضمان →"
                      : "Passer au paiement sous séquestre →"
                    : ar
                    ? "التالي →"
                    : "Suivant →"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
