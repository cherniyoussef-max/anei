"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  Phone,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  X,
} from "lucide-react";
import type { Locale } from "@/types";
import type { getLearnerAvsBookings } from "@/server/queries/account";

export type LearnerAvsBookingItem = Awaited<ReturnType<typeof getLearnerAvsBookings>>[number];

export function LearnerAvsBookingsSection({
  locale,
  bookings,
}: {
  locale: Locale;
  bookings: LearnerAvsBookingItem[];
}) {
  const ar = locale === "ar";
  const [selectedBookingForHelp, setSelectedBookingForHelp] = useState<LearnerAvsBookingItem | null>(null);

  if (bookings.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#E7E0D3] bg-[#FCFBF8] p-8 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#082D55] to-[#0A3D74] text-white shadow-md">
          <UserCheck size={26} strokeWidth={1.75} />
        </div>
        <h3 className="mt-4 font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#082D55] sm:text-xl">
          {ar ? "لا توجد مواعيد مرافقة مدرسية (AVS) حاليًا" : "Aucun rendez-vous AVS en cours"}
        </h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[#7a7261]">
          {ar
            ? "هل يحتاج طفلك إلى مرافقة مدرسية متخصصة (طيف توحد، فرط حركة، صعوبات تعلم)؟ تصفح دليل ANEI الوطني واحجز جلسة آمنة تحت ضمان المنصة."
            : "Votre enfant a besoin d'un accompagnant scolaire spécialisé (TSA, TDAH, DYS) ? Consultez notre annuaire national certifié et réservez une première séance sous protection séquestre ANEI."}
        </p>
        <div className="mt-5">
          <Link
            href={`/${locale}/avs`}
            className="inline-flex items-center gap-2 rounded-full bg-[#082D55] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0A3D74]"
          >
            <span>{ar ? "تصفح دليل المرافقين المعتمدين" : "Consulter l'annuaire AVS"}</span>
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECTION HEADER & ESCROW GUARANTEE CALLOUT */}
      <div className="overflow-hidden rounded-3xl border border-[#D5E2EE] bg-gradient-to-br from-white via-[#F7FAFC] to-[#EFF6FF] p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              <ShieldCheck size={15} className="text-emerald-600" />
              <span>{ar ? "ضمان الطرف الثالث المالي (Séquestre ANEI)" : "Séquestre Tiers de Confiance ANEI"}</span>
            </div>
            <h2 className="mt-2 font-[family-name:var(--font-fraunces)] text-xl font-bold tracking-tight text-[#082D55] sm:text-2xl">
              {ar ? "مواعيدكم مع المرافقين المدرسيين" : "Vos rendez-vous avec les AVS"}
            </h2>
            <p className="mt-1 text-xs text-[#526477] sm:text-sm">
              {ar
                ? "أموالكم محفوظة بأمان لدى منصة ANEI كطرف ثالث محايد، ولا يتم صرفها للمرافق إلا بعد إتمام الجلسة ورضاكم."
                : "Vos paiements sont consignés en séquestre sécurisé par ANEI. Les fonds ne sont débloqués à l'AVS qu'après confirmation de tenue de la séance."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/${locale}/avs`}
              className="inline-flex items-center gap-2 rounded-full border border-[#082D55] bg-white px-4 py-2 text-xs font-bold text-[#082D55] transition hover:bg-[#082D55] hover:text-white"
            >
              <span>{ar ? "حجز موعد جديد" : "Réserver un autre AVS"}</span>
              <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* BOOKINGS LIST */}
      <div className="space-y-4">
        {bookings.map((b) => {
          const payStatus = b.paymentStatus || "HELD_IN_ESCROW";
          const isHeld = payStatus === "HELD_IN_ESCROW";
          const isReleased = payStatus === "RELEASED_TO_AVS";
          const isRefunded = payStatus === "REFUNDED_TO_PARENT";

          const amountTnd = b.amountMillimes ? (b.amountMillimes / 1000).toFixed(3) : "38.500";
          const feeTnd = b.platformFeeMillimes ? (b.platformFeeMillimes / 1000).toFixed(3) : "3.500";
          const avsShareTnd = b.avsPayoutMillimes ? (b.avsPayoutMillimes / 1000).toFixed(3) : "35.000";

          return (
            <article
              key={b.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-[#082D55]/30 hover:shadow-md sm:p-6"
            >
              {/* TOP STATUS ROW */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                {/* ESCROW BADGE */}
                <div className="flex flex-wrap items-center gap-2">
                  {isHeld && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                      <ShieldCheck size={15} className="text-emerald-600" />
                      <span>{ar ? `أموال تحت الحراسة: ${amountTnd} د.ت` : `Fonds sous séquestre : ${amountTnd} TND`}</span>
                    </div>
                  )}
                  {isReleased && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
                      <CheckCircle2 size={15} className="text-blue-600" />
                      <span>{ar ? "تم تحويل المستحقات للمرافق" : "Séance réalisée — Fonds débloqués"}</span>
                    </div>
                  )}
                  {isRefunded && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800">
                      <AlertCircle size={15} className="text-rose-600" />
                      <span>{ar ? "تم استرجاع المبلغ لحسابكم" : "Montant remboursé au parent"}</span>
                    </div>
                  )}

                  <span className="font-mono text-xs font-semibold text-slate-500">
                    Réf: {b.paymentReference || `ESC-${b.id.slice(0, 8).toUpperCase()}`}
                  </span>
                </div>

                {/* RDV STATUS */}
                <div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                      b.status === "CONFIRMED"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : b.status === "DECLINED"
                        ? "bg-rose-100 text-rose-900 border border-rose-300"
                        : b.status === "COMPLETED"
                        ? "bg-blue-100 text-blue-900 border border-blue-300"
                        : "bg-amber-100 text-amber-900 border border-amber-300"
                    }`}
                  >
                    {b.status === "PENDING"
                      ? ar ? "قيد انتظار تأكيد المرافق" : "En attente de confirmation"
                      : b.status === "CONFIRMED"
                      ? ar ? "موعد مؤكد" : "Rendez-vous confirmé"
                      : b.status === "COMPLETED"
                      ? ar ? "جلسة مكتملة" : "Séance complétée"
                      : ar ? "موعد ملغى" : "Rendez-vous annulé"}
                  </span>
                </div>
              </div>

              {/* CARD MAIN CONTENT GRID */}
              <div className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-3">
                {/* COL 1: AVS PROFILE */}
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {b.avsAvatarUrl ? (
                      <Image
                        src={b.avsAvatarUrl}
                        alt={b.avsName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-[family-name:var(--font-fraunces)] text-lg font-bold text-[#082D55]">
                        {b.avsName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#082D55] text-base leading-snug">
                      {b.avsName}
                    </h4>
                    <p className="text-xs font-medium text-[#a9752f]">
                      {ar ? b.avsSpecialtyAr : b.avsSpecialtyFr}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={12} />
                      <span>{ar ? b.avsCityAr : b.avsCityFr}</span>
                    </p>
                    {b.avsSlug && (
                      <Link
                        href={`/${locale}/avs/${b.avsSlug}`}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#082D55] hover:underline"
                      >
                        <span>{ar ? "عرض الملف التعريفي" : "Voir profil complet"}</span>
                        <ExternalLink size={11} />
                      </Link>
                    )}
                  </div>
                </div>

                {/* COL 2: APPOINTMENT TIME & FORMAT */}
                <div className="space-y-2 rounded-2xl bg-slate-50/70 p-3.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2 font-semibold text-[#082D55]">
                    <Calendar size={15} className="text-[#a9752f]" />
                    <span>{b.requestedDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock size={15} className="text-[#a9752f]" />
                    <span>{b.requestedTimeSlot}</span>
                  </div>
                  <div className="pt-1">
                    <span className="inline-block rounded-md bg-white px-2 py-0.5 font-bold text-slate-800 shadow-2xs border border-slate-200">
                      {ar ? `نوع الحصة: ${b.meetingType}` : `Format : ${b.meetingType}`}
                    </span>
                  </div>
                </div>

                {/* COL 3: CHILD & EDUCATIONAL NEED */}
                <div className="space-y-1.5 text-xs">
                  <div className="font-bold text-[#082D55]">
                    {ar ? "بيانات التلميذ والمتابعة:" : "Élève & Besoins :"}
                  </div>
                  <div className="font-semibold text-slate-800">
                    {b.childName} {b.childAge ? `(${b.childAge} ans)` : ""}
                  </div>
                  {b.schoolName && (
                    <div className="text-slate-500">
                      {ar ? `المدرسة: ${b.schoolName}` : `Établissement : ${b.schoolName}`}
                    </div>
                  )}
                  {b.interventionDomain && (
                    <div className="inline-block rounded-md bg-[#082D55]/5 px-2 py-0.5 font-semibold text-[#082D55] text-[11px]">
                      {b.interventionDomain}
                    </div>
                  )}
                  {b.needDescription && (
                    <p className="text-[11px] text-slate-600 italic line-clamp-2" title={b.needDescription}>
                      &ldquo;{b.needDescription}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* CARD FOOTER WITH ACTION BUTTONS */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs">
                <div className="flex items-center gap-4 text-slate-600">
                  <span>
                    {ar ? "أتعاب المرافق:" : "Séance AVS :"}{" "}
                    <strong className="text-slate-900">{avsShareTnd} TND</strong>
                  </span>
                  <span>•</span>
                  <span>
                    {ar ? "ضمان وحراسة ANEI (10%):" : "Séquestre ANEI (10%) :"}{" "}
                    <strong className="text-slate-900">{feeTnd} TND</strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {b.avsPhone && (
                    <a
                      href={`tel:${b.avsPhone}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#082D55] hover:text-[#082D55] transition shadow-2xs"
                    >
                      <Phone size={13} />
                      <span>{ar ? "الاتصال بالمرافق" : "Contacter l'AVS"}</span>
                    </a>
                  )}

                  {/* HELP / SUPPORT BUTTON */}
                  <button
                    type="button"
                    onClick={() => setSelectedBookingForHelp(b)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#082D55] bg-[#082D55]/5 px-3.5 py-1.5 text-xs font-bold text-[#082D55] hover:bg-[#082D55] hover:text-white transition shadow-2xs"
                  >
                    <HelpCircle size={14} />
                    <span>{ar ? "مساعدة / دعم ANEI" : "Besoin d'aide / Support ANEI"}</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* SUPPORT ASSISTANCE MODAL */}
      {selectedBookingForHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#082D55]/10 text-[#082D55]">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#082D55]">
                    {ar ? "مركز المساعدة وحماية المواعيد" : "Assistance & Protection Réservation"}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Réf: {selectedBookingForHelp.paymentReference || selectedBookingForHelp.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingForHelp(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors flex items-center justify-center"
                aria-label={ar ? "إغلاق" : "Fermer"}
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-emerald-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <ShieldCheck size={16} className="text-emerald-700" />
                <span>{ar ? "ضمان الحراسة المالية ساري المفعول" : "Garantie Séquestre ANEI Active"}</span>
              </div>
              <p className="text-emerald-800/90 leading-relaxed">
                {ar
                  ? "مبلغ الحجز محفوظ كليًا في حساب الحراسة. إذا تعذر على المرافق الحضور أو لم تكن راضيًا عن الخدمة، يمكنك طلب استرجاع فوري للمبلغ أو استبدال الموعد."
                  : "Votre règlement est consigné sous séquestre. En cas d'indisponibilité de l'accompagnant ou de désaccord, vous pouvez demander le remboursement intégral ou la reprogrammation de la séance."}
              </p>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="rounded-2xl bg-slate-50 p-3.5 space-y-1">
                <div className="font-semibold text-slate-900">
                  {ar ? "تفاصيل الموعد:" : "Récapitulatif séance :"}
                </div>
                <div>{ar ? "المرافق:" : "Accompagnant :"} <strong>{selectedBookingForHelp.avsName}</strong></div>
                <div>{ar ? "التاريخ:" : "Date :"} <strong>{selectedBookingForHelp.requestedDate} ({selectedBookingForHelp.requestedTimeSlot})</strong></div>
                <div>{ar ? "التلميذ:" : "Élève :"} <strong>{selectedBookingForHelp.childName}</strong></div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-[#082D55] text-xs">
                  {ar ? "قنوات الدعم المباشر:" : "Assistance directe ANEI :"}
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href="tel:+21671888200"
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50 transition font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Phone size={14} className="text-[#082D55]" />
                      <span>{ar ? "خلية الطوارئ والمرافقة" : "Ligne prioritaire familles"}</span>
                    </span>
                    <strong className="text-[#082D55] font-mono">+216 71 888 200</strong>
                  </a>

                  <Link
                    href={`/${locale}/contact?motif=rdv_avs&ref=${selectedBookingForHelp.paymentReference || selectedBookingForHelp.id}&avs=${encodeURIComponent(selectedBookingForHelp.avsName)}`}
                    onClick={() => setSelectedBookingForHelp(null)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#082D55] text-white py-2.5 font-bold hover:bg-[#0A3D74] transition"
                  >
                    <span>{ar ? "فتح تذكرة دعم رسمي لهذا الموعد" : "Ouvrir une réclamation / demande formelle"}</span>
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedBookingForHelp(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                {ar ? "إغلاق" : "Fermer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
