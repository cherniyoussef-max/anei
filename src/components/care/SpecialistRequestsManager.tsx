"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, Clock, Users, AlertCircle, CheckCircle2, UserX, MessageSquare } from "lucide-react";
import type { Locale } from "@/types";

type RequestItem = {
  id: string;
  status: string;
  requestMessage: string | null;
  declineReason: string | null;
  endReason: string | null;
  consentAcceptedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  conversationId: string | null;
  conversationStatus: string | null;
  child: {
    id: string;
    firstName: string;
    age: number | null;
  };
  parent: {
    id: string | null;
    name: string;
    email: string;
  } | null;
};

export function SpecialistRequestsManager({
  locale,
  initialRequests,
}: {
  locale: Locale;
  initialRequests: RequestItem[];
}) {
  const ar = locale === "ar";
  const router = useRouter();

  const [tab, setTab] = useState<"pending" | "active" | "history">("pending");
  const [actingId, setActingId] = useState<string | null>(null);
  const [declineModalId, setDeclineModalId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState<string>("");
  const [endModalId, setEndModalId] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const pendingRequests = initialRequests.filter((r) => r.status === "PENDING");
  const activeCaseload = initialRequests.filter((r) => r.status === "ACTIVE");
  const historyRequests = initialRequests.filter(
    (r) => r.status === "DECLINED" || r.status === "ENDED",
  );

  async function handleAccept(id: string) {
    setActingId(id);
    setMessage(null);

    try {
      const res = await fetch(`/api/care/relationships/${id}/accept`, {
        method: "POST",
      });
      await res.json().catch(() => null);

      if (!res.ok) {
        setMessage({
          type: "error",
          text:
            ar
              ? "تعذر قبول الطلب. ربما تم تعديله مسبقاً."
              : "Impossible d'accepter la demande. Elle a peut-être déjà été traitée.",
        });
        return;
      }

      setMessage({
        type: "success",
        text:
          ar
            ? "تم قبول المتابعة بنجاح وفتح المحادثة الآمنة."
            : "Demande acceptée avec succès. L'espace d'échange sécurisé est ouvert.",
      });
      router.refresh();
    } catch {
      setMessage({
        type: "error",
        text: ar ? "خطأ في الاتصال." : "Erreur réseau. Veuillez réessayer.",
      });
    } finally {
      setActingId(null);
    }
  }

  async function handleDecline(e: React.FormEvent) {
    e.preventDefault();
    if (!declineModalId) return;

    setActingId(declineModalId);
    setMessage(null);

    try {
      const res = await fetch(`/api/care/relationships/${declineModalId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declineReason: declineReason.trim() || null }),
      });

      if (!res.ok) {
        setMessage({
          type: "error",
          text: ar ? "تعذر رفض الطلب." : "Impossible de refuser la demande.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: ar ? "تم تسجيل اعتذارك وإشعار الولي." : "Demande déclinée. Le parent a été notifié.",
      });
      setDeclineModalId(null);
      setDeclineReason("");
      router.refresh();
    } catch {
      setMessage({
        type: "error",
        text: ar ? "خطأ في الاتصال." : "Erreur réseau.",
      });
    } finally {
      setActingId(null);
    }
  }

  async function handleEnd(e: React.FormEvent) {
    e.preventDefault();
    if (!endModalId) return;

    setActingId(endModalId);
    setMessage(null);

    try {
      const res = await fetch(`/api/care/relationships/${endModalId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endReason: endReason.trim() || null }),
      });

      if (!res.ok) {
        setMessage({
          type: "error",
          text: ar ? "تعذر إنهاء المتابعة." : "Impossible de clôturer le suivi.",
        });
        return;
      }

      setMessage({
        type: "success",
        text:
          ar
            ? "تم إنهاء المتابعة وتجميد المحادثة."
            : "Suivi clôturé. La messagerie a été passée en lecture seule.",
      });
      setEndModalId(null);
      setEndReason("");
      router.refresh();
    } catch {
      setMessage({
        type: "error",
        text: ar ? "خطأ في الاتصال." : "Erreur réseau.",
      });
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Header and Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0056D2]">
            {ar ? "إدارة المتابعات" : "Prise en charge"}
          </span>
          <h1 className="mt-1 text-2xl font-bold text-[#0F172A] sm:text-3xl">
            {ar ? "طلبات المتابعة والملفات النشطة" : "Demandes de suivi & File active"}
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {ar
              ? "متابعة طلبات الأولياء وإدارة الأطفال المسندين إليك بكل سرية وأمان."
              : "Consultez les demandes des parents et gérez vos prises en charge en toute confidentialité."}
          </p>
        </div>

        <div className="flex rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setTab("pending")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              tab === "pending"
                ? "bg-[#0056D2] text-white"
                : "text-[#64748B] hover:text-[#0056D2]"
            }`}
          >
            {ar ? "الطلبات الجديدة" : "Nouvelles demandes"} ({pendingRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              tab === "active"
                ? "bg-[#0056D2] text-white"
                : "text-[#64748B] hover:text-[#0056D2]"
            }`}
          >
            {ar ? "الملفات النشطة" : "File active"} ({activeCaseload.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              tab === "history"
                ? "bg-[#0056D2] text-white"
                : "text-[#64748B] hover:text-[#0056D2]"
            }`}
          >
            {ar ? "الأرشيف" : "Historique"} ({historyRequests.length})
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3 text-xs ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={16} className="flex-none" />
          ) : (
            <AlertCircle size={16} className="flex-none" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Pending Requests Tab */}
      {tab === "pending" && (
        <div>
          {pendingRequests.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
              <Clock size={36} className="mx-auto text-[#94A3B8]" />
              <h3 className="mt-3 text-lg font-bold text-[#0F172A]">
                {ar ? "لا توجد طلبات متابعة معلقة" : "Aucune demande en attente"}
              </h3>
              <p className="mt-1 text-sm text-[#64748B]">
                {ar
                  ? "ستظهر هنا أي طلبات متابعة جديدة يقدمها الأولياء."
                  : "Les nouvelles demandes d'accompagnement apparaîtront ici."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0] rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-6 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base text-[#0F172A]">
                          {req.child.firstName}
                        </span>
                        {req.child.age !== null && (
                          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-xs font-medium text-[#64748B]">
                            {req.child.age} {ar ? "سنوات" : "ans"}
                          </span>
                        )}
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          {ar ? "طلب جديد" : "Nouvelle demande"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#64748B]">
                        {ar ? "مقدم من:" : "Demandé par :"} {req.parent?.name ?? "Parent"} •{" "}
                        {ar ? "تاريخ الطلب:" : "Reçu le :"}{" "}
                        {new Date(req.createdAt).toLocaleDateString(ar ? "ar-TN" : "fr-TN", {
                          dateStyle: "medium",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleAccept(req.id)}
                        disabled={actingId === req.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00419E] disabled:opacity-50 transition shadow-xs"
                      >
                        <Check size={14} />
                        {actingId === req.id
                          ? ar
                            ? "جارٍ القبول..."
                            : "Acceptation..."
                          : ar
                          ? "قبول المتابعة"
                          : "Accepter"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeclineModalId(req.id);
                          setDeclineReason("");
                        }}
                        disabled={actingId === req.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition"
                      >
                        <X size={14} />
                        {ar ? "اعتذار" : "Décliner"}
                      </button>
                    </div>
                  </div>

                  {req.requestMessage && (
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#0F172A] leading-relaxed">
                      <strong className="block text-[#64748B] mb-1">
                        {ar ? "رسالة الولي:" : "Message du parent :"}
                      </strong>
                      {req.requestMessage}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {ar
                        ? "تم التحقق من موافقة الولي على مشاركة المعلومات التربوية."
                        : "Consentement parental vérifié et horodaté."}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Caseload Tab */}
      {tab === "active" && (
        <div>
          {activeCaseload.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
              <Users size={36} className="mx-auto text-[#94A3B8]" />
              <h3 className="mt-3 text-lg font-bold text-[#0F172A]">
                {ar ? "لا توجد ملفات نشطة حالياً" : "Aucun apprenant suivi actuellement"}
              </h3>
              <p className="mt-1 text-sm text-[#64748B]">
                {ar
                  ? "عند قبول طلب متابعة، سيظهر هنا في ملفاتك النشطة."
                  : "Lorsque vous acceptez une demande, l'apprenant rejoint votre file active."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0] rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
              {activeCaseload.map((req) => (
                <div key={req.id} className="p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base text-[#0F172A]">
                        {req.child.firstName}
                      </span>
                      {req.child.age !== null && (
                        <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-xs font-medium text-[#64748B]">
                          {req.child.age} {ar ? "سنوات" : "ans"}
                        </span>
                      )}
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        {ar ? "متابعة نشطة" : "Suivi actif"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[#64748B]">
                      {ar ? "الولي المعني:" : "Parent référent :"} {req.parent?.name ?? "Parent"} •{" "}
                      {ar ? "بدأت المتابعة في:" : "Début de suivi :"}{" "}
                      {req.startDate
                        ? new Date(req.startDate).toLocaleDateString(ar ? "ar-TN" : "fr-TN", {
                            dateStyle: "medium",
                          })
                        : "—"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 sm:pt-0">
                    <Link
                      href={`/${locale}/specialist/messages${req.conversationId ? `/${req.conversationId}` : ""}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0056D2] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#00419E] transition shadow-xs"
                    >
                      <MessageSquare size={13} />
                      <span>{ar ? "الرسائل" : "Messagerie"}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEndModalId(req.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                    >
                      <UserX size={14} />
                      {ar ? "إنهاء المتابعة" : "Clôturer le suivi"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div>
          {historyRequests.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
              <Clock size={36} className="mx-auto text-[#94A3B8]" />
              <h3 className="mt-3 text-lg font-bold text-[#0F172A]">
                {ar ? "لا يوجد أرشيف" : "Aucun historique"}
              </h3>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0] rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
              {historyRequests.map((req) => (
                <div key={req.id} className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-semibold text-[#0F172A]">
                      {req.child.firstName}
                    </strong>
                    {req.status === "DECLINED" ? (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        {ar ? "اعتذار" : "Décliné"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {ar ? "منتهي" : "Terminé"}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#64748B]">
                    {ar ? "الولي:" : "Parent :"} {req.parent?.name ?? "Parent"} •{" "}
                    {ar ? "تاريخ الطلب:" : "Date :"} {new Date(req.createdAt).toLocaleDateString(ar ? "ar-TN" : "fr-TN")}
                  </p>

                  {req.declineReason && (
                    <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg">
                      <strong>{ar ? "السبب:" : "Motif :"}</strong> {req.declineReason}
                    </p>
                  )}
                  {req.endReason && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                      <strong>{ar ? "سبب الإنهاء:" : "Motif de fin :"}</strong> {req.endReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Decline Reason Modal */}
      {declineModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">
              {ar ? "الاعتذار عن قبول الطلب" : "Décliner la demande"}
            </h3>
            <p className="text-xs text-[#64748B]">
              {ar
                ? "يمكنك توضيح سبب الاعتذار للولي باختصار وبكل لباقة (اختياري)."
                : "Vous pouvez indiquer brièvement la raison au parent (optionnel)."}
            </p>

            <form onSubmit={handleDecline} className="space-y-4">
              <div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder={
                    ar
                      ? "مثلاً: اكتمال جدول المواعيد حالياً، خارج النطاق الجغرافي..."
                      : "Ex : Planning complet, hors secteur géographique..."
                  }
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#0F172A] focus:border-[#0056D2] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setDeclineModalId(null)}
                  disabled={actingId !== null}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={actingId !== null}
                  className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                >
                  {actingId ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : ar ? "تأكيد الرفض" : "Confirmer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Relationship Modal */}
      {endModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">
              {ar ? "إنهاء المتابعة" : "Clôturer le suivi"}
            </h3>
            <p className="text-xs text-[#64748B]">
              {ar
                ? "سيتم حفظ ملف المتابعة في الأرشيف ونقل المحادثة لوضع القراءة فقط."
                : "Le suivi sera archivé et l'espace de messagerie passera en lecture seule."}
            </p>

            <form onSubmit={handleEnd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  {ar ? "سبب إنهاء المتابعة (اختياري)" : "Motif de fin de suivi (optionnel)"}
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  placeholder={
                    ar ? "مثلاً: استكمال الأهداف المحددة..." : "Ex : Objectifs pédagogiques atteints..."
                  }
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#0F172A] focus:border-[#0056D2] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setEndModalId(null)}
                  disabled={actingId !== null}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={actingId !== null}
                  className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                >
                  {actingId ? (ar ? "جارٍ الحفظ..." : "Clôture...") : ar ? "تأكيد الإنهاء" : "Confirmer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
