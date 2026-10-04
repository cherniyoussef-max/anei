"use client";

import { useState, useTransition } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  FileText,
  Users,
  Check,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import type { Locale } from "@/types";
import type { CareNotificationPreferences } from "@/server/services/care-notifications";

export function CareNotificationPreferencesForm({
  locale,
  initialPreferences,
}: {
  locale: Locale;
  initialPreferences: CareNotificationPreferences;
}) {
  const ar = locale === "ar";
  const [prefs, setPrefs] = useState<CareNotificationPreferences>(initialPreferences);
  const [isPending, startTransition] = useTransition();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggle(key: keyof CareNotificationPreferences) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setSavedSuccess(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSavedSuccess(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/care/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prefs),
        });

        if (!res.ok) {
          setErrorMessage(
            ar
              ? "تعذر حفظ التفضيلات. الرجاء المحاولة مرة أخرى."
              : "Impossible d'enregistrer les préférences. Veuillez réessayer.",
          );
          return;
        }

        const data = await res.json();
        setPrefs(data);
        setSavedSuccess(true);
      } catch {
        setErrorMessage(
          ar
            ? "حدث خطأ غير متوقع أثناء الحفظ."
            : "Une erreur inattendue s'est produite lors de l'enregistrement.",
        );
      }
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 flex-none" />
          <span>{errorMessage}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <Check className="h-5 w-5 flex-none" />
          <span>
            {ar
              ? "تم حفظ تفضيلات الإشعارات بنجاح."
              : "Vos préférences de notification ont été mises à jour avec succès."}
          </span>
        </div>
      )}

      {/* Channels section */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
          <Bell className="h-5 w-5 text-[#0056D2]" />
          <h3 className="font-bold text-base text-[#0F172A]">
            {ar ? "قنوات التواصل" : "Canaux de réception"}
          </h3>
        </div>
        <p className="mt-2 text-xs text-[#64748B]">
          {ar
            ? "اختر القنوات التي ترغب في تلقي التنبيهات من خلالها."
            : "Choisissez les canaux par lesquels vous souhaitez être averti."}
        </p>

        <div className="mt-4 space-y-3">
          {/* Email toggle */}
          <label className="flex items-center justify-between rounded-xl border border-[#E2E8F0] p-4 hover:bg-[#F8FAFC] transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F0F6FF] text-[#0056D2]">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#0F172A]">
                  {ar ? "تنبيهات البريد الإلكتروني" : "Alertes par e-mail"}
                </strong>
                <span className="text-xs text-[#64748B]">
                  {ar
                    ? "إرسال رسائل بريد إلكتروني فورية عند حدوث مستجدات في مسار الرعاية."
                    : "Recevoir un e-mail instantané pour chaque événement de suivi important."}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailEnabled}
              onChange={() => toggle("emailEnabled")}
              className="h-5 w-5 rounded border-[#E2E8F0] text-[#0056D2] focus:ring-[#0056D2]"
            />
          </label>

          {/* In-app toggle */}
          <label className="flex items-center justify-between rounded-xl border border-[#E2E8F0] p-4 hover:bg-[#F8FAFC] transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F0F6FF] text-[#0056D2]">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#0F172A]">
                  {ar ? "الإشعارات داخل المنصة" : "Notifications dans la plateforme"}
                </strong>
                <span className="text-xs text-[#64748B]">
                  {ar
                    ? "عرض شارة الإشعارات وقائمة التنبيهات في شريط التصفح."
                    : "Afficher le badge et le centre d'alertes dans votre barre de navigation."}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.inAppEnabled}
              onChange={() => toggle("inAppEnabled")}
              className="h-5 w-5 rounded border-[#E2E8F0] text-[#0056D2] focus:ring-[#0056D2]"
            />
          </label>
        </div>
      </div>

      {/* Triggers section */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
          <ShieldCheck className="h-5 w-5 text-[#0056D2]" />
          <h3 className="font-bold text-base text-[#0F172A]">
            {ar ? "نوعية التنبيهات" : "Types d'événements"}
          </h3>
        </div>
        <p className="mt-2 text-xs text-[#64748B]">
          {ar
            ? "حدد الأنشطة التي تهمك في مساحة المتابعة."
            : "Sélectionnez les activités pour lesquelles vous souhaitez recevoir une notification."}
        </p>

        <div className="mt-4 space-y-3">
          {/* Messages */}
          <label className="flex items-center justify-between rounded-xl border border-[#E2E8F0] p-4 hover:bg-[#F8FAFC] transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F0F6FF] text-[#0056D2]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#0F172A]">
                  {ar ? "الرسائل الخاصة الآمنة" : "Nouveaux messages sécurisés"}
                </strong>
                <span className="text-xs text-[#64748B]">
                  {ar
                    ? "تنبيه عند استلام رسالة جديدة في مساحة المحادثة السريرية."
                    : "Avertissement lors de la réception d'un nouveau message de suivi."}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.notifyOnMessages}
              onChange={() => toggle("notifyOnMessages")}
              className="h-5 w-5 rounded border-[#E2E8F0] text-[#0056D2] focus:ring-[#0056D2]"
            />
          </label>

          {/* Session notes */}
          <label className="flex items-center justify-between rounded-xl border border-[#E2E8F0] p-4 hover:bg-[#F8FAFC] transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F0F6FF] text-[#0056D2]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#0F172A]">
                  {ar ? "ملاحظات الجلسات والملاحق" : "Observations de séances & addenda"}
                </strong>
                <span className="text-xs text-[#64748B]">
                  {ar
                    ? "تنبيه عند نشر ملاحظات جلسة متابعة جديدة أو إضافة ملحق توضيحي."
                    : "Avertissement lorsqu'une observation clinique est partagée avec la famille."}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.notifyOnNotes}
              onChange={() => toggle("notifyOnNotes")}
              className="h-5 w-5 rounded border-[#E2E8F0] text-[#0056D2] focus:ring-[#0056D2]"
            />
          </label>

          {/* Documents */}
          <label className="flex items-center justify-between rounded-xl border border-[#E2E8F0] p-4 hover:bg-[#F8FAFC] transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#0F172A]">
                  {ar ? "التقارير والوثائق السريرية" : "Bilans & documents cliniques"}
                </strong>
                <span className="text-xs text-[#64748B]">
                  {ar
                    ? "تنبيه عند رفع تقرير تقييمي أو وثيقة متابعة جديدة."
                    : "Avertissement lors du dépôt d'un bilan ou document téléchargeable."}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.notifyOnDocuments}
              onChange={() => toggle("notifyOnDocuments")}
              className="h-5 w-5 rounded border-[#E2E8F0] text-[#0056D2] focus:ring-[#0056D2]"
            />
          </label>

          {/* Requests */}
          <label className="flex items-center justify-between rounded-xl border border-[#E2E8F0] p-4 hover:bg-[#F8FAFC] transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#0F172A]">
                  {ar ? "طلبات المتابعة وتحديثات الحالة" : "Demandes de prise en charge & statuts"}
                </strong>
                <span className="text-xs text-[#64748B]">
                  {ar
                    ? "تنبيه عند إرسال طلب مرافقة جديد، قبوله، أو إنهائه."
                    : "Avertissement lors de la réception, validation ou clôture d'une demande."}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.notifyOnRequests}
              onChange={() => toggle("notifyOnRequests")}
              className="h-5 w-5 rounded border-[#E2E8F0] text-[#0056D2] focus:ring-[#0056D2]"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-[#0056D2] px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#00419E] focus:outline-none focus:ring-2 focus:ring-[#0056D2] disabled:opacity-50 transition"
        >
          {isPending
            ? (ar ? "جارٍ الحفظ..." : "Enregistrement...")
            : (ar ? "حفظ التفضيلات" : "Enregistrer les préférences")}
        </button>
      </div>
    </form>
  );
}
