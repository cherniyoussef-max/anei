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
      <div className="rounded-2xl border border-[#e2d7c3] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#e2d7c3]/60 pb-3">
          <Bell className="h-5 w-5 text-[#a9752f]" />
          <h3 className="font-semibold text-base text-[#082D55]">
            {ar ? "قنوات التواصل" : "Canaux de réception"}
          </h3>
        </div>
        <p className="mt-2 text-xs text-[#7a7261]">
          {ar
            ? "اختر القنوات التي ترغب في تلقي التنبيهات من خلالها."
            : "Choisissez les canaux par lesquels vous souhaitez être averti."}
        </p>

        <div className="mt-4 space-y-3">
          {/* Email toggle */}
          <label className="flex items-center justify-between rounded-xl border border-[#e2d7c3]/60 p-4 hover:bg-[#FAF7F2]/40 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#082D55]/10 text-[#082D55]">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#082D55]">
                  {ar ? "تنبيهات البريد الإلكتروني" : "Alertes par e-mail"}
                </strong>
                <span className="text-xs text-[#7a7261]">
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
              className="h-5 w-5 rounded border-[#e2d7c3] text-[#082D55] focus:ring-[#C9913F]"
            />
          </label>

          {/* In-app toggle */}
          <label className="flex items-center justify-between rounded-xl border border-[#e2d7c3]/60 p-4 hover:bg-[#FAF7F2]/40 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#a9752f]/10 text-[#a9752f]">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#082D55]">
                  {ar ? "الإشعارات داخل المنصة" : "Notifications dans la plateforme"}
                </strong>
                <span className="text-xs text-[#7a7261]">
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
              className="h-5 w-5 rounded border-[#e2d7c3] text-[#082D55] focus:ring-[#C9913F]"
            />
          </label>
        </div>
      </div>

      {/* Triggers section */}
      <div className="rounded-2xl border border-[#e2d7c3] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#e2d7c3]/60 pb-3">
          <ShieldCheck className="h-5 w-5 text-[#a9752f]" />
          <h3 className="font-semibold text-base text-[#082D55]">
            {ar ? "نوعية التنبيهات" : "Types d'événements"}
          </h3>
        </div>
        <p className="mt-2 text-xs text-[#7a7261]">
          {ar
            ? "حدد الأنشطة التي تهمك في مساحة المتابعة."
            : "Sélectionnez les activités pour lesquelles vous souhaitez recevoir une notification."}
        </p>

        <div className="mt-4 space-y-3">
          {/* Messages */}
          <label className="flex items-center justify-between rounded-xl border border-[#e2d7c3]/60 p-4 hover:bg-[#FAF7F2]/40 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#082D55]/10 text-[#082D55]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#082D55]">
                  {ar ? "الرسائل الخاصة الآمنة" : "Nouveaux messages sécurisés"}
                </strong>
                <span className="text-xs text-[#7a7261]">
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
              className="h-5 w-5 rounded border-[#e2d7c3] text-[#082D55] focus:ring-[#C9913F]"
            />
          </label>

          {/* Session notes */}
          <label className="flex items-center justify-between rounded-xl border border-[#e2d7c3]/60 p-4 hover:bg-[#FAF7F2]/40 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#a9752f]/10 text-[#a9752f]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#082D55]">
                  {ar ? "ملاحظات الجلسات والملاحق" : "Observations de séances & addenda"}
                </strong>
                <span className="text-xs text-[#7a7261]">
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
              className="h-5 w-5 rounded border-[#e2d7c3] text-[#082D55] focus:ring-[#C9913F]"
            />
          </label>

          {/* Documents */}
          <label className="flex items-center justify-between rounded-xl border border-[#e2d7c3]/60 p-4 hover:bg-[#FAF7F2]/40 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#166534]/10 text-[#166534]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#082D55]">
                  {ar ? "التقارير والوثائق السريرية" : "Bilans & documents cliniques"}
                </strong>
                <span className="text-xs text-[#7a7261]">
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
              className="h-5 w-5 rounded border-[#e2d7c3] text-[#082D55] focus:ring-[#C9913F]"
            />
          </label>

          {/* Requests */}
          <label className="flex items-center justify-between rounded-xl border border-[#e2d7c3]/60 p-4 hover:bg-[#FAF7F2]/40 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#7c3aed]/10 text-[#7c3aed]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-sm font-semibold text-[#082D55]">
                  {ar ? "طلبات المتابعة وتحديثات الحالة" : "Demandes de prise en charge & statuts"}
                </strong>
                <span className="text-xs text-[#7a7261]">
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
              className="h-5 w-5 rounded border-[#e2d7c3] text-[#082D55] focus:ring-[#C9913F]"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-[#082D55] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#061F3D] focus:outline-none focus:ring-2 focus:ring-[#C9913F] disabled:opacity-50 transition"
        >
          {isPending
            ? (ar ? "جارٍ الحفظ..." : "Enregistrement...")
            : (ar ? "حفظ التفضيلات" : "Enregistrer les préférences")}
        </button>
      </div>
    </form>
  );
}
