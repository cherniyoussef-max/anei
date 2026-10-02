"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, ShieldCheck } from "lucide-react";
import type { Locale } from "@/types";
import type { CareAccessLogItem } from "@/server/queries/care-notes-documents";

type RelationshipRow = {
  id: string;
  status: string;
  requestMessage: string | null;
  declineReason: string | null;
  endReason: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  conversationId: string | null;
  conversationStatus: string | null;
  specialist: { id: string; name: string };
  student: { id: string; name: string };
  requestedBy: { id: string; name: string } | null;
};

export function AdminCareTable({
  locale,
  initialRelationships,
  totalCount,
  accessLogs = [],
}: {
  locale: Locale;
  initialRelationships: RelationshipRow[];
  totalCount: number;
  accessLogs?: CareAccessLogItem[];
}) {
  const ar = locale === "ar";
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"relationships" | "logs">("relationships");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [endTargetId, setEndTargetId] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string>("");
  const [ending, setEnding] = useState<boolean>(false);

  const filtered = initialRelationships.filter((r) => {
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
    return true;
  });

  async function handleAdminEnd(e: React.FormEvent) {
    e.preventDefault();
    if (!endTargetId) return;

    setEnding(true);
    try {
      const res = await fetch(`/api/care/relationships/${endTargetId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endReason: endReason.trim() || null }),
      });

      if (res.ok) {
        setEndTargetId(null);
        setEndReason("");
        router.refresh();
      }
    } finally {
      setEnding(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {ar ? "نشط" : "Actif"}
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {ar ? "معلق" : "En attente"}
          </span>
        );
      case "DECLINED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
            {ar ? "مرفوض" : "Décliné"}
          </span>
        );
      case "ENDED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800 border border-rose-200">
            {ar ? "منتهي" : "Terminé"}
          </span>
        );
      default:
        return <span className="text-xs text-[#7a7261]">{status}</span>;
    }
  }

  return (
    <div className="space-y-4" dir={ar ? "rtl" : "ltr"}>
      {/* Top tabs */}
      <div className="flex border-b border-[#E7E0D3] gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("relationships")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === "relationships"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-[#7a7261] hover:text-[#082D55]"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>{ar ? "متابعات المختصين والأولياء" : "Relations de suivi"}</span>
          <span className="rounded-full bg-[#082D55]/10 px-2 py-0.5 text-xs text-[#082D55]">
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === "logs"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-[#7a7261] hover:text-[#082D55]"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>{ar ? "سجل الوصول السريري (Audit Log)" : "Journal d'accès clinique"}</span>
          <span className="rounded-full bg-[#a9752f]/10 px-2 py-0.5 text-xs text-[#a9752f]">
            {accessLogs.length}
          </span>
        </button>
      </div>

      {activeTab === "relationships" && (
        <>
          {/* Filters bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#082D55]">
                {ar ? "الحالة:" : "Statut :"}
              </span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-[#E7E0D3] bg-white px-3 py-1.5 text-xs text-[#082D55] focus:outline-none"
              >
                <option value="ALL">{ar ? "الكل" : "Tous"} ({totalCount})</option>
                <option value="PENDING">{ar ? "معلق" : "En attente"}</option>
                <option value="ACTIVE">{ar ? "نشط" : "Actif"}</option>
                <option value="DECLINED">{ar ? "مرفوض" : "Décliné"}</option>
                <option value="ENDED">{ar ? "منتهي" : "Terminé"}</option>
              </select>
            </div>

            <p className="text-xs text-[#7a7261]">
              {ar
                ? `عرض ${filtered.length} من إجمالي ${totalCount} علاقة متابعة`
                : `Affichage de ${filtered.length} sur ${totalCount} suivis`}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-[#E7E0D3] bg-white shadow-sm">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-[#E7E0D3] bg-[#FCFBF8] text-[#7a7261]">
                <tr>
                  <th className="px-4 py-3 font-semibold text-start">{ar ? "الأخصائي" : "Spécialiste"}</th>
                  <th className="px-4 py-3 font-semibold text-start">{ar ? "الطفل" : "Enfant"}</th>
                  <th className="px-4 py-3 font-semibold text-start">{ar ? "الطلب بواسطة" : "Demandé par"}</th>
                  <th className="px-4 py-3 font-semibold text-start">{ar ? "الحالة" : "Statut"}</th>
                  <th className="px-4 py-3 font-semibold text-start">{ar ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-3 font-semibold text-start">{ar ? "محادثة المتابعة" : "Messagerie"}</th>
                  <th className="px-4 py-3 font-semibold text-end">{ar ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D3]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#7a7261]">
                      {ar ? "لا توجد نتائج مطابقة" : "Aucun résultat trouvé"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-[#FCFBF8]">
                      <td className="px-4 py-3 font-medium text-[#082D55]">{r.specialist.name}</td>
                      <td className="px-4 py-3 text-[#082D55]">{r.student.name}</td>
                      <td className="px-4 py-3 text-[#7a7261]">{r.requestedBy?.name ?? "—"}</td>
                      <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-[#7a7261]">
                        {new Date(r.createdAt).toLocaleDateString(ar ? "ar-TN" : "fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {r.conversationId ? (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            {r.conversationStatus === "READ_ONLY"
                              ? ar ? "للقراءة فقط" : "Lecture seule"
                              : ar ? "محادثة نشطة" : "Active"}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {r.status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() => setEndTargetId(r.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            {ar ? "إنهاء إداري" : "Clôturer"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "logs" && (
        <div className="overflow-x-auto rounded-xl border border-[#E7E0D3] bg-white shadow-sm">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-[#E7E0D3] bg-[#FCFBF8] text-[#7a7261]">
              <tr>
                <th className="px-4 py-3 font-semibold text-start">{ar ? "المستخدم (الفاعل)" : "Utilisateur (Acteur)"}</th>
                <th className="px-4 py-3 font-semibold text-start">{ar ? "العملية" : "Action"}</th>
                <th className="px-4 py-3 font-semibold text-start">{ar ? "نوع المورد السريري" : "Type de ressource"}</th>
                <th className="px-4 py-3 font-semibold text-start">{ar ? "معرّف المورد" : "ID Ressource"}</th>
                <th className="px-4 py-3 font-semibold text-start">{ar ? "التاريخ والوقت" : "Horodatage"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D3]">
              {accessLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#7a7261]">
                    {ar ? "لا توجد سجلات وصول بعد" : "Aucun journal d'accès enregistré pour l'instant"}
                  </td>
                </tr>
              ) : (
                accessLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FCFBF8]">
                    <td className="px-4 py-3 font-medium text-[#082D55]">{log.actorName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded bg-[#082D55]/10 px-2 py-0.5 text-[11px] font-semibold text-[#082D55]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#7a7261]">{log.resourceType}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 truncate max-w-[150px]">{log.resourceId}</td>
                    <td className="px-4 py-3 text-[#7a7261]">
                      {new Date(log.createdAt).toLocaleString(ar ? "ar-TN" : "fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin End Modal */}
      {endTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E7E0D3] bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#082D55]">
              {ar ? "إنهاء متابعة إدارياً" : "Clôture administrative du suivi"}
            </h3>
            <p className="text-xs text-[#7a7261]">
              {ar
                ? "بصفتك مسؤولاً، يمكنك إنهاء هذه العلاقة وتجميد المحادثة. سيتم إشعار الطرفين."
                : "En tant qu'administrateur, cette action met fin au suivi et bascule la conversation en lecture seule."}
            </p>

            <form onSubmit={handleAdminEnd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#082D55] mb-1">
                  {ar ? "سبب الإلغاء أو الإنهاء الإداري" : "Motif administratif"}
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  placeholder={ar ? "سبب الإنهاء الإداري..." : "Précisez le motif..."}
                  className="w-full rounded-xl border border-[#E7E0D3] bg-[#FCFBF8] p-3 text-sm text-[#082D55] focus:border-[#082D55] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E0D3]">
                <button
                  type="button"
                  onClick={() => setEndTargetId(null)}
                  disabled={ending}
                  className="rounded-xl border border-[#E7E0D3] px-4 py-2 text-xs font-semibold text-[#7a7261] hover:bg-[#FCFBF8]"
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={ending}
                  className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                >
                  {ending ? (ar ? "جارٍ الإنهاء..." : "Clôture...") : ar ? "تأكيد الإنهاء" : "Confirmer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
