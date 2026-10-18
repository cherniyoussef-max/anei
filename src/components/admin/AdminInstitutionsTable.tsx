"use client";

import React, { useState } from "react";
import {
  Building2,
  Inbox,
  Lightbulb,
} from "lucide-react";
import type { Locale } from "@/types";
import {
  DIFFICULTIES,
  SERVICE_TYPES,
  DifficultyKey,
  ServiceRequestType,
  SERVICE_REQUEST_STAGES,
  getDifficultyColor,
} from "@/lib/inclusive-taxonomy";

interface AdminEstablishmentRow {
  id: string;
  name: string;
  level: string;
  region: string;
  studentCount: number;
  needsBreakdownJson: Record<string, number>;
  partnershipStage: number;
  conventionSignedAt: string | Date | null;
  createdAt: string | Date;
}

interface AdminRequestRow {
  id: string;
  referenceCode: string;
  establishmentName: string;
  serviceType: string;
  urgency: string;
  concernedCount: number;
  situationDescription: string;
  stage: number;
  scheduledRdvJson?: { d: string; h: string; mo: string } | null;
  createdAt: string | Date;
}

interface AdminTipRow {
  id: string;
  authorName: string;
  difficultyKey: string;
  situationTitle: string;
  whatToDo: string;
  whatToAvoid: string;
  createdAt: string | Date;
}

interface AdminInstitutionsTableProps {
  locale: Locale;
  establishments: AdminEstablishmentRow[];
  requests: AdminRequestRow[];
  tips: AdminTipRow[];
}

export function AdminInstitutionsTable({
  locale,
  establishments,
  requests,
  tips,
}: AdminInstitutionsTableProps) {
  const ar = locale === "ar";
  const [activeTab, setActiveTab] = useState<"est" | "req" | "tips">("est");

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* 4 KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center">
          <div className="text-2xl font-bold text-[#0A192F]">{establishments.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {ar ? "المؤسسات الشريكة" : "Établissements partenaires"}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center">
          <div className="text-2xl font-bold text-[#0056D2]">{requests.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {ar ? "طلبات التدخل والدعم" : "Demandes de service"}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center">
          <div className="text-2xl font-bold text-amber-600">
            {requests.filter((r) => r.stage === 3).length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {ar ? "مواعيد مبرمجة" : "Rendez-vous planifiés"}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center">
          <div className="text-2xl font-bold text-emerald-600">{tips.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {ar ? "توجيهات صفية منشورة" : "Conseils spécialistes"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("est")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "est"
              ? "bg-[#0A192F] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Building2 className="w-4 h-4 stroke-[1.8]" />
          <span>{ar ? "المؤسسات الشريكة" : "Établissements"} ({establishments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("req")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "req"
              ? "bg-[#0A192F] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Inbox className="w-4 h-4 stroke-[1.8]" />
          <span>{ar ? "طلبات التدخل" : "Demandes d'intervention"} ({requests.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tips")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "tips"
              ? "bg-[#0A192F] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Lightbulb className="w-4 h-4 stroke-[1.8]" />
          <span>{ar ? "التوجيهات المنشورة" : "Conseils de classe"} ({tips.length})</span>
        </button>
      </div>

      {/* Tab 1: Établissements */}
      {activeTab === "est" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 text-start">{ar ? "المؤسسة" : "Établissement"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "المستوى" : "Niveau"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "المنطقة" : "Région"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "التلاميذ" : "Élèves"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "توزيع الاحتياجات" : "Besoins repérés"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "الاتفاقية" : "Convention"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {establishments.map((est) => (
                  <tr key={est.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{est.name}</td>
                    <td className="py-3 px-4 text-slate-600">{est.level}</td>
                    <td className="py-3 px-4 text-slate-600">{est.region}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">{est.studentCount}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((dk) => {
                          const count = est.needsBreakdownJson?.[dk] || 0;
                          if (!count) return null;
                          const color = getDifficultyColor(dk, "Classique");
                          return (
                            <span
                              key={dk}
                              style={{ backgroundColor: `${color}15`, color }}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            >
                              {DIFFICULTIES[dk].labelFr} : {count}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                          est.partnershipStage >= 3
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {est.partnershipStage >= 3 ? "Active" : "À signer"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Requests */}
      {activeTab === "req" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 text-start">{ar ? "الرمز المرجعي" : "Réf"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "المؤسسة" : "Établissement"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "نوع الخدمة" : "Prestation"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "الاستعجال" : "Urgence"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "المرحلة" : "Statut"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "الموعد" : "RDV"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{r.referenceCode}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{r.establishmentName}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {SERVICE_TYPES[r.serviceType as ServiceRequestType]?.labelFr || r.serviceType}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          r.urgency === "Très urgente"
                            ? "bg-red-100 text-red-700"
                            : r.urgency === "Urgente"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.urgency}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10.5px] font-semibold bg-[#0056D2]/10 text-[#0056D2] px-2 py-0.5 rounded-full">
                        {SERVICE_REQUEST_STAGES[r.stage] || "En cours"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.scheduledRdvJson ? `${r.scheduledRdvJson.d} (${r.scheduledRdvJson.h})` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Tips */}
      {activeTab === "tips" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 text-start">{ar ? "الصعوبة" : "Difficulté"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "الموقف الملاحظ" : "Situation observée"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "التدخل المقترح" : "Que faire"}</th>
                  <th className="py-3 px-4 text-start">{ar ? "الأخصائي المؤلف" : "Auteur"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tips.map((t) => {
                  const color = getDifficultyColor(t.difficultyKey as DifficultyKey, "Classique");
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <span
                          style={{ backgroundColor: `${color}15`, color }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded"
                        >
                          {DIFFICULTIES[t.difficultyKey as DifficultyKey]?.labelFr || t.difficultyKey}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{t.situationTitle}</td>
                      <td className="py-3 px-4 text-slate-700 max-w-md">{t.whatToDo}</td>
                      <td className="py-3 px-4 text-slate-500 italic">{t.authorName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
