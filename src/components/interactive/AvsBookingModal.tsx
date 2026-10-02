"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";

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
  isOpen,
  onClose,
  onSuccess,
}: AvsBookingModalProps) {
  const ar = locale === "ar";

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
  const [meetingType, setMeetingType] = useState<"IN_PERSON" | "ONLINE" | "HOME">("IN_PERSON");

  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("7");
  const [schoolName, setSchoolName] = useState("");
  const [interventionDomain, setInterventionDomain] = useState(avs.domains?.[0] || "");
  const [needDescription, setNeedDescription] = useState("");

  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("+216 ");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmedBookingId, setConfirmedBookingId] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parentName || !parentEmail || !parentPhone || !childName || !needDescription) {
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
          parentName,
          parentEmail,
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
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Erreur lors de la réservation");
      }

      setConfirmedBookingId(data.booking.id);
      setStep(4);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : ar
          ? "حدث خطأ أثناء إرسال الموعد. يرجى المحاولة ثانية."
          : "Une erreur est survenue lors de l'enregistrement de votre demande."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="avs-booking-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#082D55] text-white px-6 py-5 flex items-center justify-between border-b border-white/10 flex-none">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center font-bold text-amber-300 border border-white/20">
              {avs.initials}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-300 font-semibold">
                {ar ? "حجز موعد مقابلة مرافقة" : "Prendre rendez-vous avec un AVS"}
              </div>
              <h2 id="booking-modal-title" className="text-lg font-bold text-white">
                {avs.name}
              </h2>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span>{avs.specialty}</span>
                <span>•</span>
                <span>{avs.city}</span>
                {avs.hourlyRateTnd ? (
                  <>
                    <span>•</span>
                    <span className="text-amber-200 font-semibold">{avs.hourlyRateTnd} TND / h</span>
                  </>
                ) : null}
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

        {/* Stepper Progress */}
        {step < 4 && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-medium text-slate-600 flex-none">
            <div className={`flex items-center gap-2 ${step >= 1 ? "text-[#082D55] font-bold" : ""}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? "bg-[#082D55] text-white" : "bg-slate-200"}`}>1</span>
              <span>{ar ? "الموعد والتوقيت" : "Créneau & Format"}</span>
            </div>
            <div className="h-0.5 w-8 bg-slate-200" />
            <div className={`flex items-center gap-2 ${step >= 2 ? "text-[#082D55] font-bold" : ""}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? "bg-[#082D55] text-white" : "bg-slate-200"}`}>2</span>
              <span>{ar ? "معلومات التلميذ" : "L'Élève"}</span>
            </div>
            <div className="h-0.5 w-8 bg-slate-200" />
            <div className={`flex items-center gap-2 ${step >= 3 ? "text-[#082D55] font-bold" : ""}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? "bg-[#082D55] text-white" : "bg-slate-200"}`}>3</span>
              <span>{ar ? "ولي الأمر والتأكيد" : "Coordonnées"}</span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <Icon name="shield" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Date, slot & format */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  {ar ? "1. اختر اليوم المناسب" : "1. Choisissez le jour du rendez-vous"}
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {nextDays.map((d) => {
                    const isSelected = selectedDate === d.iso;
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => setSelectedDate(d.iso)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? "border-[#082D55] bg-[#082D55] text-white shadow-sm"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="text-[11px] uppercase tracking-wider opacity-80">{d.dayLabel}</div>
                        <div className="font-bold text-sm mt-0.5">{d.dateLabel}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  {ar ? "2. اختر التوقيت المتاح" : "2. Choisissez l'heure souhaitée"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COMMON_SLOTS.map((slot) => {
                    const isSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
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

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  {ar ? "3. صيغة المقابلة" : "3. Modalité de la rencontre"}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "IN_PERSON", fr: "En établissement", ar: "بالمؤسسة التربوية" },
                    { key: "ONLINE", fr: "En visioconférence", ar: "عن بُعد (فيديو)" },
                    { key: "HOME", fr: "À domicile", ar: "بالمنزل" },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMeetingType(m.key as "IN_PERSON" | "ONLINE" | "HOME")}
                      className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                        meetingType === m.key
                          ? "border-[#082D55] bg-blue-50 text-[#082D55] ring-2 ring-[#082D55]/10"
                          : "border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {ar ? m.ar : m.fr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  id="avs-booking-next-step"
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-primary px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2"
                >
                  <span>{ar ? "التالي: بيانات التلميذ" : "Suivant : Informations de l'enfant"}</span>
                  <Icon name="arrow" size={16} className="directional-icon" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Child info */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {ar ? "اسم ولقب التلميذ *" : "Nom et prénom de l'élève *"}
                  </label>
                  <input
                    id="avs-child-name"
                    type="text"
                    required
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder={ar ? "مثال: يوسف بن سالم" : "Ex: Adam Trabelsi"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {ar ? "العمر أو المستوى الدراسي *" : "Âge / Classe actuelle *"}
                  </label>
                  <input
                    id="avs-child-age"
                    type="text"
                    required
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    placeholder={ar ? "7 سنوات - السنة الأولى" : "Ex: 7 ans (CP)"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {ar ? "المؤسسة التعليمية الحالية (إن وجدت)" : "Établissement scolaire actuel"}
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder={ar ? "اسم المدرسة الابتدائية أو الإعدادية" : "Ex: École Primaire Mutuelleville"}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {ar ? "مجال المرافقة المطلوب" : "Besoin ou diagnostic principal"}
                </label>
                <select
                  value={interventionDomain}
                  onChange={(e) => setInterventionDomain(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55]"
                >
                  <option value="">{ar ? "-- اختر المجال --" : "-- Sélectionner le domaine --"}</option>
                  <option value="Autisme (TSA)">{ar ? "طيف التوحد (TSA)" : "Autisme (TSA)"}</option>
                  <option value="Troubles DYS">{ar ? "صعوبات واضطرابات التعلم (DYS)" : "Troubles DYS (Dyslexie, Dyspraxie)"}</option>
                  <option value="TDAH">{ar ? "تشتت الانتباه وفرط الحركة (TDAH)" : "TDAH (Déficit de l'attention)"}</option>
                  <option value="Trisomie 21">{ar ? "متلازمة داون / إعاقة ذهنية" : "Déficience intellectuelle / Trisomie 21"}</option>
                  <option value="Handicap moteur">{ar ? "إعاقة حركية وتيسير بيئة القسم" : "Handicap moteur & Ergonomie"}</option>
                  <option value="Troubles sensoriels">{ar ? "اضطرابات بصرية أو سمعية" : "Troubles sensoriels"}</option>
                  <option value="Autonomie">{ar ? "استقلالية مدرسية وتكيف عام" : "Autonomie & Adaptation générale"}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {ar ? "وصف الحاجيات وسياق المرافقة *" : "Description du besoin d'accompagnement *"}
                </label>
                <textarea
                  id="avs-need-description"
                  required
                  rows={3}
                  value={needDescription}
                  onChange={(e) => setNeedDescription(e.target.value)}
                  placeholder={
                    ar
                      ? "وضح الصعوبات التي يواجهها التلميذ، أوقات المرافقة المرجوة، وأي ملاحظات تهم الفريق التربوي..."
                      : "Précisez les difficultés en classe, les adaptations souhaitées, le temps d'accompagnement envisagé (temps plein/partiel)..."
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55]"
                />
              </div>

              <div className="pt-3 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-ghost text-xs font-semibold px-4"
                >
                  {ar ? "رجوع" : "Retour"}
                </button>
                <button
                  id="avs-booking-next-step"
                  type="button"
                  onClick={() => {
                    if (!childName.trim() || !needDescription.trim()) {
                      setErrorMessage(ar ? "يرجى كتابة اسم التلميذ ووصف الحاجيات." : "Veuillez renseigner le nom de l'enfant et le besoin.");
                      return;
                    }
                    setErrorMessage("");
                    setStep(3);
                  }}
                  className="btn btn-primary px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2"
                >
                  <span>{ar ? "التالي: بيانات الاتصال" : "Suivant : Coordonnées du parent"}</span>
                  <Icon name="arrow" size={16} className="directional-icon" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Parent details & final confirm */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="calendar" size={16} className="text-[#a9752f]" />
                  <span>
                    <strong>{selectedDate}</strong> à <strong>{selectedSlot}</strong> ({meetingType})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-amber-800 underline font-semibold hover:text-amber-950"
                >
                  {ar ? "تعديل" : "Modifier"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {ar ? "اسم ولقب ولي الأمر *" : "Nom et prénom du parent / tuteur *"}
                  </label>
                  <input
                    id="avs-parent-name"
                    type="text"
                    required
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder={ar ? "مثال: منية بن سالم" : "Ex: Sonia Ben Salem"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {ar ? "رقم الهاتف التونسي *" : "Numéro de téléphone *" }
                  </label>
                  <input
                    id="avs-parent-phone"
                    type="tel"
                    required
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="+216 98 123 456"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {ar ? "البريد الإلكتروني لتأكيد الموعد *" : "Adresse email (pour la confirmation) *"}
                </label>
                <input
                  id="avs-parent-email"
                  type="email"
                  required
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {ar ? "ملاحظة أو سؤال للمرافق (اختياري)" : "Message ou question pour l'AVS (facultatif)"}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={ar ? "أي معلومة إضافية تود إبلاغها..." : "Précisions sur la disponibilité, lieu exact..."}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#082D55]/30 focus:border-[#082D55]"
                />
              </div>

              <div className="pt-3 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-ghost text-xs font-semibold px-4"
                >
                  {ar ? "رجوع" : "Retour"}
                </button>
                <button
                  id="avs-booking-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary px-7 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span>{ar ? "جاري الإرسال..." : "Enregistrement en cours..."}</span>
                  ) : (
                    <>
                      <Icon name="check" size={16} />
                      <span>{ar ? "تأكيد طلب الموعد" : "Confirmer la demande de rendez-vous"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Success confirmation */}
          {step === 4 && (
            <div className="avs-booking-success py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <Icon name="check" size={32} />
              </div>
              <h3 className="text-xl font-bold text-[#082D55]">
                {ar ? "تم إرسال طلب الموعد بنجاح !" : "Demande de rendez-vous enregistrée !"}
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                {ar
                  ? `تم إشعار المرافق(ة) ${avs.name} بطلب الموعد ليوم ${selectedDate} على الساعة ${selectedSlot}. سيتم التواصل معك هاتفيًا أو عبر البريد لتأكيد التفاصيل.`
                  : `L'accompagnant(e) ${avs.name} a bien reçu votre demande pour le ${selectedDate} à ${selectedSlot}. Vous recevrez une confirmation et un contact direct rapidement.`}
              </p>
              <div className="avs-booking-ref inline-block px-4 py-2 bg-slate-100 rounded-lg text-xs font-mono text-slate-600">
                {ar ? `رمز المرجع: ${confirmedBookingId.slice(0, 8)}` : `Réf : ${confirmedBookingId.slice(0, 8)}`}
              </div>
              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary px-8 py-2.5 rounded-xl font-semibold text-sm"
                >
                  {ar ? "تم، إغلاق" : "Terminer et fermer"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
