"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  MessageSquare,
  CalendarDays,
  FileText,
  Download,
  Clock,
  UserX,
  ShieldCheck,
  AlertCircle,
  PlusCircle,
  Video,
  MapPin,
} from "lucide-react";
import type { Locale } from "@/types";
import type { ChildCareSummary } from "@/server/queries/care-notes-documents";

export function ParentChildCareTeam({
  locale,
  childrenSummaries,
}: {
  locale: Locale;
  childrenSummaries: ChildCareSummary[];
}) {
  const ar = locale === "ar";
  const router = useRouter();

  const [activeChildIndex, setActiveChildIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"team" | "notes" | "documents">("team");

  // End relationship modal
  const [endTargetId, setEndTargetId] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string>("");
  const [ending, setEnding] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Downloading document state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (childrenSummaries.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E7E0D3] bg-white p-12 text-center shadow-sm">
        <Users size={40} className="mx-auto text-[#a39c8a]" />
        <h3 className="mt-4 font-[family-name:var(--font-fraunces)] text-xl font-semibold text-[#082D55]">
          {ar ? "لا يوجد أطفال مرتبطون بحسابك حالياً" : "Aucun enfant associé à votre compte"}
        </h3>
        <p className="mt-2 text-sm text-[#7a7261] max-w-md mx-auto">
          {ar
            ? "تواصل مع إدارة منصة أني لربط ملفات أبنائك والاستفادة من المتابعة مع الأخصائيين المعتمدين."
            : "L'association de votre enfant s'effectue avec l'Académie ANEI pour garantir la stricte confidentialité de ses données."}
        </p>
      </div>
    );
  }

  const currentChild = childrenSummaries[activeChildIndex] || childrenSummaries[0]!;

  async function handleEndRelationship(e: React.FormEvent) {
    e.preventDefault();
    if (!endTargetId || ending) return;

    setEnding(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/care/relationships/${endTargetId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endReason: endReason.trim() || null }),
      });

      if (!res.ok) {
        setFeedbackMessage({
          type: "error",
          text: ar ? "تعذر إنهاء المتابعة. يرجى المحاولة لاحقاً." : "Impossible de clôturer le suivi.",
        });
        return;
      }

      setFeedbackMessage({
        type: "success",
        text: ar
          ? "تم إنهاء المتابعة بنجاح وتجميد المحادثة."
          : "Le suivi a été clôturé. La messagerie est désormais archivée.",
      });
      setEndTargetId(null);
      setEndReason("");
      router.refresh();
    } catch {
      setFeedbackMessage({
        type: "error",
        text: ar ? "خطأ في الاتصال بالخادم." : "Erreur de connexion.",
      });
    } finally {
      setEnding(false);
    }
  }

  async function handleDownloadDocument(docId: string, _fileName: string) {
    if (downloadingId) return;
    setDownloadingId(docId);

    try {
      const res = await fetch(`/api/care/documents/${docId}/download`);
      if (res.ok) {
        const data = await res.json();
        if (data.downloadUrl) {
          window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        alert(ar ? "تعذر تنزيل الملف." : "Impossible de télécharger le document.");
      }
    } catch {
      alert(ar ? "خطأ في الشبكة." : "Erreur réseau.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Feedback banner */}
      {feedbackMessage && (
        <div
          className={`flex items-center gap-2 rounded-xl p-4 text-xs font-medium ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <AlertCircle size={16} />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Child selector (if more than 1 child) */}
      {childrenSummaries.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-[#E7E0D3] pb-3">
          {childrenSummaries.map((s, idx) => (
            <button
              key={s.child.id}
              type="button"
              onClick={() => setActiveChildIndex(idx)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                idx === activeChildIndex
                  ? "bg-[#082D55] text-white shadow-xs"
                  : "bg-white text-[#7a7261] border border-[#E7E0D3] hover:bg-[#F6F1E7]"
              }`}
            >
              {s.child.firstName}
              {s.child.age !== null ? ` (${s.child.age} ${ar ? "سنوات" : "ans"})` : ""}
            </button>
          ))}
        </div>
      )}

      {/* Active Child Dossier Header */}
      <div className="rounded-2xl border border-[#E7E0D3] bg-[#FCFBF8] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#082D55]">
              {currentChild.child.name}
            </h2>
            {currentChild.child.age !== null && (
              <span className="rounded-md bg-[#F6F1E7] px-2 py-0.5 text-xs font-semibold text-[#7a7261]">
                {currentChild.child.age} {ar ? "سنوات" : "ans"}
              </span>
            )}
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              {currentChild.relationshipType}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#7a7261]">
            {ar
              ? "متابعة الفريق المختص، الملاحظات الإكلينيكية المشتركة، والتقارير المعتمدة."
              : "Équipe d'accompagnement, observations partagées et comptes-rendus de suivi."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/parent/specialistes`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E0D3] bg-white px-3.5 py-2 text-xs font-semibold text-[#082D55] hover:bg-[#F6F1E7] transition shadow-2xs"
          >
            <PlusCircle size={14} className="text-[#a9752f]" />
            <span>{ar ? "البحث عن مختص" : "Trouver un spécialiste"}</span>
          </Link>

          <Link
            href={`/${locale}/parent/messages`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#082D55] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#061F3D] transition shadow-xs"
          >
            <MessageSquare size={14} />
            <span>{ar ? "الرسائل" : "Messagerie"}</span>
          </Link>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-[#E7E0D3]">
        <button
          type="button"
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "team"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-[#7a7261] hover:text-[#082D55]"
          }`}
        >
          <Users size={16} />
          <span>{ar ? "فريق المتابعة" : "Équipe de suivi"}</span>
          <span className="rounded-full bg-[#F6F1E7] px-2 py-0.5 text-xs font-bold text-[#a9752f]">
            {currentChild.careTeam.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "notes"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-[#7a7261] hover:text-[#082D55]"
          }`}
        >
          <FileText size={16} />
          <span>{ar ? "ملاحظات المتابعة المشتركة" : "Notes de suivi partagées"}</span>
          <span className="rounded-full bg-[#F6F1E7] px-2 py-0.5 text-xs font-bold text-[#a9752f]">
            {currentChild.sharedNotes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "documents"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-[#7a7261] hover:text-[#082D55]"
          }`}
        >
          <Download size={16} />
          <span>{ar ? "الملفات والتقارير" : "Documents & Bilans"}</span>
          <span className="rounded-full bg-[#F6F1E7] px-2 py-0.5 text-xs font-bold text-[#a9752f]">
            {currentChild.sharedDocuments.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Care Team */}
      {activeTab === "team" && (
        <div className="space-y-4">
          {currentChild.careTeam.length === 0 ? (
            <div className="rounded-2xl border border-[#E7E0D3] bg-white p-12 text-center shadow-sm">
              <Users size={36} className="mx-auto text-[#a39c8a]" />
              <h3 className="mt-3 font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#082D55]">
                {ar ? "لا يوجد أخصائي متابع حالياً" : "Aucun spécialiste accompagnant actuellement"}
              </h3>
              <p className="mt-1 text-xs text-[#7a7261] max-w-sm mx-auto">
                {ar
                  ? "يمكنك استكشاف دليل الأخصائيين المعتمدين واختيار المختص الأنسب لاحتياجات طفلك."
                  : "Consultez l'annuaire pour trouver des orthophonistes, psychomotriciens ou éducateurs spécialisés."}
              </p>
              <Link
                href={`/${locale}/parent/specialistes`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#082D55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#061F3D] transition shadow-xs"
              >
                <PlusCircle size={14} />
                <span>{ar ? "دليل الأخصائيين" : "Consulter l'annuaire"}</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {currentChild.careTeam.map((member) => (
                <div
                  key={member.assignmentId}
                  className="rounded-2xl border border-[#E7E0D3] bg-white p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {member.specialist.avatarUrl ? (
                        <Image
                          src={member.specialist.avatarUrl}
                          alt={member.specialist.name}
                          width={48}
                          height={48}
                          className="h-12 w-12 rounded-full object-cover border border-[#E7E0D3]"
                        />
                      ) : (
                        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#082D55]/10 text-base font-bold text-[#082D55]">
                          {member.specialist.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-sm font-semibold text-[#082D55]">
                            {member.specialist.name}
                          </strong>
                          <ShieldCheck size={14} className="text-[#a9752f]" />
                        </div>
                        {member.specialist.specialty && (
                          <span className="inline-block mt-0.5 text-xs text-[#a9752f] font-medium">
                            {member.specialist.specialty}
                          </span>
                        )}
                        {(member.specialist.city || member.specialist.governorate) && (
                          <p className="flex items-center gap-1 text-[11px] text-[#7a7261]">
                            <MapPin size={11} />
                            <span>
                              {member.specialist.city ? `${member.specialist.city}, ` : ""}
                              {member.specialist.governorate}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      {ar ? "متابعة نشطة" : "Suivi actif"}
                    </span>
                  </div>

                  {/* Next session preview */}
                  <div className="rounded-xl border border-[#E7E0D3] bg-[#FCFBF8] p-3 text-xs space-y-1">
                    <span className="font-semibold text-[#082D55] flex items-center gap-1.5">
                      <CalendarDays size={13} className="text-[#a9752f]" />
                      {ar ? "الجلسة القادمة :" : "Prochaine séance :"}
                    </span>
                    {member.nextAppointment ? (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[#7a7261]">
                          {new Date(member.nextAppointment.startAt).toLocaleString(
                            ar ? "ar-TN" : "fr-TN",
                            { dateStyle: "medium", timeStyle: "short" },
                          )}
                        </span>
                        {member.nextAppointment.meetingUrl && (
                          <a
                            href={member.nextAppointment.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#082D55] hover:underline"
                          >
                            <Video size={12} />
                            <span>{ar ? "رابط الجلسة" : "Rejoindre"}</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#a39c8a]">
                        {ar ? "لا يوجد موعد محدد حالياً" : "Aucun rendez-vous planifié pour le moment"}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E7E0D3] pt-3">
                    <div className="flex items-center gap-2">
                      {member.conversationId ? (
                        <Link
                          href={`/${locale}/parent/messages/${member.conversationId}`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#082D55] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#061F3D] transition shadow-2xs"
                        >
                          <MessageSquare size={13} />
                          <span>{ar ? "الرسائل" : "Messagerie"}</span>
                        </Link>
                      ) : (
                        <Link
                          href={`/${locale}/parent/messages`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#082D55] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#061F3D] transition shadow-2xs"
                        >
                          <MessageSquare size={13} />
                          <span>{ar ? "الرسائل" : "Messagerie"}</span>
                        </Link>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setEndTargetId(member.assignmentId)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                    >
                      <UserX size={12} />
                      <span>{ar ? "إنهاء المتابعة" : "Clôturer le suivi"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Shared Notes */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          {currentChild.sharedNotes.length === 0 ? (
            <div className="rounded-2xl border border-[#E7E0D3] bg-white p-12 text-center shadow-sm">
              <FileText size={36} className="mx-auto text-[#a39c8a]" />
              <h3 className="mt-3 font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#082D55]">
                {ar ? "لا توجد ملاحظات مشاركة بعد" : "Aucune note partagée pour le moment"}
              </h3>
              <p className="mt-1 text-xs text-[#7a7261] max-w-sm mx-auto">
                {ar
                  ? "الملاحظات الإكلينيكية والتوصيات التي يشاركها الأخصائي بعد كل جلسة ستظهر هنا بانتظام."
                  : "Les observations, points d'étape et recommandations rédigés par l'équipe soignante apparaîtront ici."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E7E0D3] rounded-2xl border border-[#E7E0D3] bg-white shadow-sm overflow-hidden">
              {currentChild.sharedNotes.map((note) => (
                <div key={note.id} className="p-5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-[#082D55]">
                        {note.title}
                      </strong>
                      {note.isAddendum && (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          {ar ? "ملحق / تصحيح" : "Addendum"}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#a39c8a] flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(note.sessionDate).toLocaleDateString(ar ? "ar-TN" : "fr-TN", {
                        dateStyle: "medium",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-[#7a7261]">
                    {ar ? "بواسطة :" : "Par :"}{" "}
                    <strong className="text-[#082D55]">{note.specialist.name}</strong>
                    {note.specialist.specialty ? ` (${note.specialist.specialty})` : ""}
                  </p>

                  <div className="rounded-xl border border-[#E7E0D3] bg-[#FCFBF8] p-4 text-xs leading-relaxed text-[#082D55] whitespace-pre-line">
                    {note.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Shared Documents */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          {currentChild.sharedDocuments.length === 0 ? (
            <div className="rounded-2xl border border-[#E7E0D3] bg-white p-12 text-center shadow-sm">
              <Download size={36} className="mx-auto text-[#a39c8a]" />
              <h3 className="mt-3 font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#082D55]">
                {ar ? "لا توجد ملفات أو تقارير مشتركة" : "Aucun document partagé"}
              </h3>
              <p className="mt-1 text-xs text-[#7a7261] max-w-sm mx-auto">
                {ar
                  ? "التقارير الطبية، الخطط التربوية، والملفات المرفقة تظهر هنا بصيغة آمنة قابلة للتنزيل."
                  : "Les bilans psychomoteurs, bilans orthophoniques et comptes-rendus d'évaluation apparaîtront ici."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentChild.sharedDocuments.map((doc) => {
                const isDownloading = downloadingId === doc.id;
                const sizeKb = Math.round(doc.sizeBytes / 1024);
                return (
                  <div
                    key={doc.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#E7E0D3] bg-white p-4 shadow-2xs hover:shadow-xs transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-[#F6F1E7] px-2 py-0.5 text-[10px] font-semibold text-[#a9752f]">
                          {doc.documentType}
                        </span>
                        <span className="text-[10px] text-[#a39c8a]">
                          {new Date(doc.createdAt).toLocaleDateString(ar ? "ar-TN" : "fr-TN")}
                        </span>
                      </div>

                      <h4 className="mt-2 text-xs font-semibold text-[#082D55] line-clamp-1">
                        {doc.title || doc.fileName}
                      </h4>
                      <p className="text-[11px] text-[#7a7261]">
                        {ar ? "الملف :" : "Fichier :"} {doc.fileName} ({sizeKb} Ko)
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[#E7E0D3] pt-2">
                      <span className="text-[10px] text-[#a39c8a]">
                        {ar ? "المختص :" : "Par :"} {doc.specialist.name}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(doc.id, doc.fileName)}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#082D55] hover:text-[#a9752f] disabled:opacity-40"
                      >
                        <Download size={13} className={isDownloading ? "animate-pulse" : ""} />
                        <span>{isDownloading ? (ar ? "جاري التحميل..." : "Chargement...") : (ar ? "تنزيل" : "Télécharger")}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* End Relationship Modal */}
      {endTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E7E0D3] bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#082D55]">
              {ar ? "تأكيد إنهاء علاقة المتابعة" : "Clôturer le suivi d'accompagnement"}
            </h3>
            <p className="text-xs text-[#7a7261] leading-relaxed">
              {ar
                ? "عند إنهاء المتابعة، ستتحول المحادثة مع الأخصائي إلى وضع القراءة فقط. ستبقى الملاحظات والوثائق السابقة محفوظة في ملف طفلك بأمان."
                : "La clôture archivera la messagerie en lecture seule. Les notes et bilans antérieurs resteront accessibles pour la traçabilité."}
            </p>

            <form onSubmit={handleEndRelationship} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#082D55] mb-1">
                  {ar ? "سبب إنهاء المتابعة (اختياري) :" : "Motif de fin de suivi (optionnel) :"}
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  placeholder={
                    ar
                      ? "مثال: انتهاء فترة التأهيل، انتقال إلى مرحلة جديدة..."
                      : "Ex: Fin de la prise en charge, déménagement..."
                  }
                  className="w-full rounded-xl border border-[#E7E0D3] p-3 text-xs text-[#082D55] focus:border-[#082D55] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E7E0D3] pt-3">
                <button
                  type="button"
                  onClick={() => setEndTargetId(null)}
                  disabled={ending}
                  className="rounded-xl border border-[#E7E0D3] px-3.5 py-1.5 text-xs font-semibold text-[#7a7261] hover:bg-[#F6F1E7]"
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={ending}
                  className="rounded-xl bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50 shadow-xs"
                >
                  {ending
                    ? ar
                      ? "جاري الإنهاء..."
                      : "Clôture en cours..."
                    : ar
                    ? "تأكيد الإنهاء"
                    : "Confirmer la fin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
