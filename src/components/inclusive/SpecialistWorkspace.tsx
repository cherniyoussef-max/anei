"use client";

import React, { useState, useMemo } from "react";
import {
  Stethoscope,
  Inbox,
  Calendar,
  Building2,
  Lightbulb,
  User,
  Send,
  AlertTriangle,
  ChevronRight,
  Check,
  Plus,
  RefreshCw,
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

interface SpecialistRequestItem {
  id: string;
  referenceCode: string;
  establishmentId: string;
  establishmentName?: string | null;
  establishmentLevel?: string | null;
  establishmentRegion?: string | null;
  serviceType: string;
  urgency: string;
  concernedCount: number;
  situationDescription: string;
  stage: number;
  scheduledRdvJson?: { d: string; h: string; mo: string } | null;
  createdAt: string | Date;
  messages: Array<{
    id: string;
    senderRole: string;
    senderName: string;
    body: string;
    createdAt: string | Date;
  }>;
}

interface PartnerSchoolItem {
  id: string;
  name: string;
  level: string;
  region: string;
  partnershipStage: number;
  needsBreakdownJson: Record<string, number>;
}

interface SpecialistTipItem {
  id: string;
  authorName: string;
  difficultyKey: string;
  situationTitle: string;
  whatToDo: string;
  whatToAvoid: string;
  createdAt: string | Date;
}

interface SpecialistWorkspaceProps {
  locale: Locale;
  initialRequests: SpecialistRequestItem[];
  initialEstablishments: PartnerSchoolItem[];
  initialTips: SpecialistTipItem[];
  specialistName: string;
}

const URGENCY_ORDER: Record<string, number> = {
  "Très urgente": 0,
  Urgente: 1,
  Normale: 2,
};

export function SpecialistWorkspace({
  locale,
  initialRequests,
  initialEstablishments,
  initialTips,
  specialistName,
}: SpecialistWorkspaceProps) {
  const ar = locale === "ar";
  const [activeTab, setActiveTab] = useState<"home" | "req" | "ag" | "et" | "tip" | "pro">("home");
  const [requests, setRequests] = useState<SpecialistRequestItem[]>(initialRequests);
  const [establishments] = useState<PartnerSchoolItem[]>(initialEstablishments);
  const [tips, setTips] = useState<SpecialistTipItem[]>(initialTips);

  // Filters
  const [stageFilter, setStageFilter] = useState<"all" | "new" | "prog" | "rdv" | "done">("all");
  const [establishmentFilter, setEstablishmentFilter] = useState<string | null>(null);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState<string>("");
  const [availability, setAvailability] = useState<string>("Disponible");
  const [feedback, setFeedback] = useState<string>("");

  // Propose RDV Form state
  const [rdvDate, setRdvDate] = useState<string>("2026-10-20");
  const [rdvHour, setRdvHour] = useState<string>("10h");
  const [rdvModality, setRdvModality] = useState<string>("En ligne");

  // New Tip Form state
  const [tipDiff, setTipDiff] = useState<DifficultyKey>("tsa");
  const [tipTitle, setTipTitle] = useState<string>("");
  const [tipWhatToDo, setTipWhatToDo] = useState<string>("");
  const [tipWhatToAvoid, setTipWhatToAvoid] = useState<string>("");
  const [isPublishingTip, setIsPublishingTip] = useState<boolean>(false);

  // Counters
  const countNew = useMemo(() => requests.filter((r) => r.stage === 0).length, [requests]);
  const countInProgress = useMemo(() => requests.filter((r) => r.stage === 1 || r.stage === 2).length, [requests]);
  const countRdv = useMemo(() => requests.filter((r) => r.stage === 3).length, [requests]);
  const countDone = useMemo(() => requests.filter((r) => r.stage === 4).length, [requests]);

  // Priority sorted requests (unhandled new requests first, by urgency)
  const priorityRequests = useMemo(() => {
    return requests
      .filter((r) => r.stage === 0)
      .sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 2) - (URGENCY_ORDER[b.urgency] ?? 2));
  }, [requests]);

  // Scheduled RDVs
  const scheduledAgenda = useMemo(() => {
    return requests
      .filter((r) => r.scheduledRdvJson && r.stage === 3)
      .sort((a, b) => (a.scheduledRdvJson?.d || "").localeCompare(b.scheduledRdvJson?.d || ""));
  }, [requests]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests
      .filter((r) => {
        if (stageFilter === "new" && r.stage !== 0) return false;
        if (stageFilter === "prog" && r.stage !== 1 && r.stage !== 2) return false;
        if (stageFilter === "rdv" && r.stage !== 3) return false;
        if (stageFilter === "done" && r.stage !== 4) return false;
        if (establishmentFilter && r.establishmentName !== establishmentFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.stage === 0 && b.stage === 0) {
          return (URGENCY_ORDER[a.urgency] ?? 2) - (URGENCY_ORDER[b.urgency] ?? 2);
        }
        return a.stage === 0 ? -1 : b.stage === 0 ? 1 : 0;
      });
  }, [requests, stageFilter, establishmentFilter]);

  // Breakdown by service type for bar chart
  const serviceStats = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(SERVICE_TYPES).forEach((k) => {
      counts[k] = requests.filter((r) => r.serviceType === k).length;
    });
    return counts;
  }, [requests]);

  const maxServiceCount = useMemo(() => {
    const vals = Object.values(serviceStats);
    return Math.max(...vals, 1);
  }, [serviceStats]);

  // Handle Action: Accept request, Propose RDV, or Mark as Done
  const handleRequestAction = async (
    requestId: string,
    action: "acc" | "rdv" | "done",
    rdvData?: { d: string; h: string; mo: string }
  ) => {
    try {
      const res = await fetch("/api/specialist/requests/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action,
          rdv: rdvData,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setRequests(
          requests.map((r) => {
            if (r.id !== requestId) return r;
            if (action === "acc") {
              return {
                ...r,
                stage: 2,
                messages: [
                  ...r.messages,
                  {
                    id: "spec-acc",
                    senderRole: "Spécialiste",
                    senderName: specialistName,
                    body: "Demande prise en charge. Je prépare l'intervention et reviens vers vous rapidement.",
                    createdAt: new Date(),
                  },
                ],
              };
            }
            if (action === "rdv" && rdvData) {
              return {
                ...r,
                stage: 3,
                scheduledRdvJson: rdvData,
                messages: [
                  ...r.messages,
                  {
                    id: "spec-rdv",
                    senderRole: "Spécialiste",
                    senderName: specialistName,
                    body: `Rendez-vous proposé le ${rdvData.d} à ${rdvData.h} (${rdvData.mo.toLowerCase()}).`,
                    createdAt: new Date(),
                  },
                ],
              };
            }
            if (action === "done") {
              return {
                ...r,
                stage: 4,
                messages: [
                  ...r.messages,
                  {
                    id: "spec-done",
                    senderRole: "Spécialiste",
                    senderName: specialistName,
                    body: "Demande clôturée et traitée. Compte-rendu disponible au dossier.",
                    createdAt: new Date(),
                  },
                ],
              };
            }
            return r;
          })
        );

        setFeedback(
          action === "acc"
            ? ar
              ? "تم قبول الطلب وتعيينه لمتابعتك."
              : "Demande acceptée et prise en charge."
            : action === "rdv"
            ? ar
              ? "تم اقتراح الموعد وإرسال إشعار للمؤسسة."
              : "Rendez-vous planifié avec succès."
            : ar
            ? "تمت معالجة الطلب وإغلاقه."
            : "Demande clôturée."
        );
        setTimeout(() => setFeedback(""), 3000);
      }
    } catch (err) {
      console.error("Action error:", err);
    }
  };

  // Handle Send Specialist Message
  const handleSendMessage = async (requestId: string) => {
    const text = replyMessage.trim();
    if (!text) return;

    try {
      const res = await fetch("/api/specialist/requests/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          body: text,
        }),
      });

      const data = await res.json();
      if (data.ok && data.message) {
        setRequests(
          requests.map((r) =>
            r.id === requestId ? { ...r, messages: [...r.messages, data.message] } : r
          )
        );
        setReplyMessage("");
      }
    } catch (err) {
      console.error("Message send error:", err);
    }
  };

  // Handle Publish Tip
  const handlePublishTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipTitle.trim() || !tipWhatToDo.trim()) return;

    setIsPublishingTip(true);
    try {
      const res = await fetch("/api/specialist/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          difficultyKey: tipDiff,
          situationTitle: tipTitle.trim(),
          whatToDo: tipWhatToDo.trim(),
          whatToAvoid: tipWhatToAvoid.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok && data.tip) {
        setTips([data.tip, ...tips]);
        setTipTitle("");
        setTipWhatToDo("");
        setTipWhatToAvoid("");
        setFeedback(
          ar
            ? "تم نشر النصيحة بنجاح! ستظهر فورياً في فضاء الأساتذة (ماذا أفعل في القسم)."
            : "Conseil publié avec succès : immédiatement visible par les enseignants dans « Que faire en classe »."
        );
        setTimeout(() => setFeedback(""), 4000);
      }
    } catch (err) {
      console.error("Publish tip error:", err);
    } finally {
      setIsPublishingTip(false);
    }
  };

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0056D2]/10 text-[#0056D2]">
              <Stethoscope className="w-4 h-4 stroke-[1.8]" />
            </span>
            <h1 className="text-xl font-bold text-[#0A192F]">
              {ar ? "فضاء الأخصائي والمستشار التربوي" : "Espace Spécialiste & Conseil Pédagogique"}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {ar
              ? `الممارس : ${specialistName} · الحالة : ${availability} · شبكة المؤسسات الشريكة ANEI`
              : `${specialistName} · Statut : ${availability} · Réseau institutionnel et interventions scolaires.`}
          </p>
        </div>

        {/* Quick Availability Selector */}
        <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          {(["Disponible", "Peu disponible", "En congé"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setAvailability(st)}
              className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                availability === st
                  ? "bg-[#0A192F] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
        {[
          { key: "home", icon: Stethoscope, fr: "Accueil", ar: "الرئيسية" },
          {
            key: "req",
            icon: Inbox,
            fr: "Demandes reçues",
            ar: "الطلبات الواردة",
            badge: countNew > 0 ? String(countNew) : undefined,
          },
          {
            key: "ag",
            icon: Calendar,
            fr: "Agenda & RDV",
            ar: "المواعيد والجدول",
            badge: countRdv > 0 ? String(countRdv) : undefined,
          },
          { key: "et", icon: Building2, fr: "Établissements suivis", ar: "المؤسسات المتابعة" },
          { key: "tip", icon: Lightbulb, fr: "Conseils à publier", ar: "نشر التوصيات والنصائح" },
          { key: "pro", icon: User, fr: "Mon profil", ar: "ملفي المهني" },
        ].map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                active
                  ? "bg-[#0A192F] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5 stroke-[1.8]" />
              <span>{ar ? tab.ar : tab.fr}</span>
              {tab.badge && (
                <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.2 rounded-full font-mono">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600 stroke-[2]" />
          <span>{feedback}</span>
        </div>
      )}

      {/* =========================================================================
          TAB 1: ACCUEIL (KPIS, DEMANDES PRIORITAIRES, PROCHAINS RDV, ACTIVITÉ)
      ========================================================================= */}
      {activeTab === "home" && (
        <div className="space-y-6">
          {/* 4 KPIs Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-2xl font-bold text-red-600">{countNew}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{ar ? "طلبات جديدة واردة" : "Nouvelles demandes"}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-2xl font-bold text-[#0056D2]">{countInProgress}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{ar ? "طلبات قيد المتابعة" : "Dossiers en cours"}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-2xl font-bold text-amber-600">{countRdv}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{ar ? "مواعيد مبرمجة" : "Rendez-vous fixés"}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-2xl font-bold text-emerald-600">{countDone}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{ar ? "تدخلات منجزة" : "Traitées ce mois"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Priority New Requests */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-[#0A192F] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span>{ar ? "طلبات ذات أولوية بحاجة للرد" : "Demandes prioritaires à traiter"}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">{priorityRequests.length}</span>
              </div>

              <div className="space-y-3">
                {priorityRequests.length > 0 ? (
                  priorityRequests.slice(0, 4).map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>{SERVICE_TYPES[req.serviceType as ServiceRequestType]?.labelFr || req.serviceType}</span>
                          <span className="text-slate-400 font-normal">· {req.establishmentName}</span>
                          {req.urgency !== "Normale" && (
                            <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded">
                              {req.urgency}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 truncate max-w-md">
                          {req.situationDescription}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setStageFilter("all");
                          setOpenRequestId(req.id);
                          setActiveTab("req");
                        }}
                        className="bg-white hover:bg-slate-100 text-[#0056D2] border border-[#0056D2]/30 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap self-start sm:self-auto transition-colors"
                      >
                        {ar ? "فتح الطلب" : "Ouvrir"}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400 italic">
                    {ar ? "لا توجد طلبات جديدة عاجلة حالياً." : "Aucune nouvelle demande en attente."}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Agenda / Prochains RDV */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-[#0A192F] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#0056D2]" />
                  <span>{ar ? "المواعيد القادمة" : "Prochains rendez-vous"}</span>
                </h3>
              </div>

              <div className="space-y-3">
                {scheduledAgenda.length > 0 ? (
                  scheduledAgenda.slice(0, 3).map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1"
                    >
                      <div className="text-xs font-bold text-[#0A192F] flex items-center justify-between">
                        <span>{req.scheduledRdvJson?.d} à {req.scheduledRdvJson?.h}</span>
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full">
                          {req.scheduledRdvJson?.mo}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700">
                        {SERVICE_TYPES[req.serviceType as ServiceRequestType]?.labelFr} · {req.establishmentName}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400 italic">
                    {ar ? "لا توجد مواعيد مبرمجة حالياً." : "Aucun rendez-vous planifié."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Breakdown by Service Type */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#0A192F]">
              {ar ? "توزيع الطلبات والتدخلات حسب نوع الخدمة" : "Volume d'activité par type de prestation"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(SERVICE_TYPES) as ServiceRequestType[]).map((sk) => {
                const count = serviceStats[sk] || 0;
                const pct = Math.max((count / maxServiceCount) * 100, 4);
                return (
                  <div key={sk} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800">{SERVICE_TYPES[sk].labelFr}</span>
                      <span className="font-mono text-slate-700">{count}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0056D2] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DEMANDES REÇUES (FULL LIFECYCLE MANAGEMENT)
      ========================================================================= */}
      {activeTab === "req" && (
        <div className="space-y-4">
          {/* Filter Chips Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: "all", labelFr: "Toutes", count: requests.length },
                { key: "new", labelFr: "Nouvelles", count: countNew },
                { key: "prog", labelFr: "En cours", count: countInProgress },
                { key: "rdv", labelFr: "Rendez-vous fixé", count: countRdv },
                { key: "done", labelFr: "Traitées", count: countDone },
              ].map((f) => {
                const active = stageFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setStageFilter(f.key as typeof stageFilter)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all ${
                      active
                        ? "bg-[#0A192F] text-white shadow-xs"
                        : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>{f.labelFr}</span>
                    <span className="text-[10px] opacity-75 font-mono ms-1.5">({f.count})</span>
                  </button>
                );
              })}
            </div>

            {establishmentFilter && (
              <button
                type="button"
                onClick={() => setEstablishmentFilter(null)}
                className="text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1"
              >
                <span>✕ {establishmentFilter}</span>
              </button>
            )}
          </div>

          {/* Requests List */}
          <div className="space-y-4">
            {filteredRequests.map((req) => {
              const isOpen = openRequestId === req.id;
              const isNew = req.stage === 0;
              return (
                <div
                  key={req.id}
                  className={`bg-white border rounded-2xl p-5 shadow-xs space-y-3 transition-all ${
                    isNew ? "border-amber-300 ring-1 ring-amber-100" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-[#0A192F] flex items-center gap-2">
                        <span>{SERVICE_TYPES[req.serviceType as ServiceRequestType]?.labelFr || req.serviceType}</span>
                        <span className="text-xs font-mono font-normal text-slate-400">· {req.referenceCode}</span>
                      </div>
                      <div className="text-xs text-slate-600 font-semibold mt-0.5">
                        {req.establishmentName} · {req.establishmentLevel} ({req.establishmentRegion})
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          req.urgency === "Très urgente"
                            ? "bg-red-100 text-red-700"
                            : req.urgency === "Urgente"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {req.urgency}
                      </span>
                      <span className="text-[11px] font-semibold bg-[#0056D2]/10 text-[#0056D2] px-2.5 py-0.5 rounded-full">
                        {SERVICE_REQUEST_STAGES[req.stage] || "En cours"}
                      </span>
                    </div>
                  </div>

                  {/* 5-Stage Stepper Progress */}
                  <div className="grid grid-cols-5 gap-1.5 py-1">
                    {SERVICE_REQUEST_STAGES.map((label, idx) => (
                      <div key={idx} className="space-y-1 text-center">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            idx <= req.stage ? "bg-[#0056D2]" : "bg-slate-100"
                          }`}
                        />
                        <span className="text-[9.5px] text-slate-400 hidden sm:block truncate">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-slate-700">{req.situationDescription}</p>

                  {/* Scheduled RDV Banner */}
                  {req.scheduledRdvJson && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>
                        {ar
                          ? `موعد مؤكد : ${req.scheduledRdvJson.d} الساعة ${req.scheduledRdvJson.h} (${req.scheduledRdvJson.mo})`
                          : `Rendez-vous planifié le ${req.scheduledRdvJson.d} à ${req.scheduledRdvJson.h} (${req.scheduledRdvJson.mo})`}
                      </span>
                    </div>
                  )}

                  {/* Actions & Thread Toggle */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setOpenRequestId(isOpen ? null : req.id)}
                      className="text-xs font-semibold text-[#0056D2] hover:underline flex items-center gap-1"
                    >
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      <span>{isOpen ? (ar ? "إغلاق التفاصيل" : "Réduire") : ar ? "فتح التفاصيل والمراسلة" : "Ouvrir le dossier"}</span>
                    </button>

                    {/* Stage 0 Action: Accept Request */}
                    {req.stage === 0 && (
                      <button
                        type="button"
                        onClick={() => handleRequestAction(req.id, "acc")}
                        className="bg-[#0056D2] hover:bg-[#00419e] text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-colors shadow-xs"
                      >
                        {ar ? "قبول ومتابعة الطلب" : "Accepter la demande"}
                      </button>
                    )}

                    {/* Stage 3 Action: Mark as Treated */}
                    {req.stage === 3 && (
                      <button
                        type="button"
                        onClick={() => handleRequestAction(req.id, "done")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-colors shadow-xs"
                      >
                        {ar ? "تعليم كمنجز ومعالج" : "Marquer comme traitée"}
                      </button>
                    )}
                  </div>

                  {/* Expanded Drawer: Propose RDV & Messaging */}
                  {isOpen && (
                    <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200/90 space-y-4 animate-fadeIn">
                      {/* Propose RDV Form if in progress (stage 1 or 2) */}
                      {(req.stage === 1 || req.stage === 2) && (
                        <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                          <h4 className="text-xs font-bold text-[#0A192F]">
                            {ar ? "برمجة واقتراح موعد مع المؤسسة" : "Proposer un rendez-vous d'intervention"}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-500 font-bold block mb-1">Date</label>
                              <input
                                type="date"
                                value={rdvDate}
                                onChange={(e) => setRdvDate(e.target.value)}
                                className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 font-bold block mb-1">Heure</label>
                              <select
                                value={rdvHour}
                                onChange={(e) => setRdvHour(e.target.value)}
                                className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50"
                              >
                                <option value="9h">9h00</option>
                                <option value="10h">10h00</option>
                                <option value="11h">11h00</option>
                                <option value="14h">14h00</option>
                                <option value="15h">15h00</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 font-bold block mb-1">Modalité</label>
                              <select
                                value={rdvModality}
                                onChange={(e) => setRdvModality(e.target.value)}
                                className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50"
                              >
                                <option value="En ligne">En ligne (Visio)</option>
                                <option value="Sur place">Sur place (Établissement)</option>
                              </select>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleRequestAction(req.id, "rdv", {
                                d: rdvDate,
                                h: rdvHour,
                                mo: rdvModality,
                              })
                            }
                            className="bg-[#0056D2] hover:bg-[#00419e] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                          >
                            {ar ? "تأكيد اقتراح الموعد" : "Proposer ce créneau"}
                          </button>
                        </div>
                      )}

                      {/* Message Thread */}
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {ar ? "سجل التبادلات والرسائل" : "Historique des échanges"}
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {req.messages.length > 0 ? (
                            req.messages.map((m) => (
                              <div
                                key={m.id}
                                className={`text-xs p-2.5 rounded-xl max-w-[85%] ${
                                  m.senderRole === "Spécialiste"
                                    ? "bg-[#0056D2] text-white ms-auto"
                                    : "bg-white text-slate-800 border border-slate-200 me-auto"
                                }`}
                              >
                                <div className="text-[10px] font-bold opacity-75 mb-0.5">
                                  {m.senderName} ({m.senderRole})
                                </div>
                                <div>{m.body}</div>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              {ar ? "لا توجد رسائل مسجلة" : "Aucun message pour ce dossier."}
                            </span>
                          )}
                        </div>

                        {/* Reply box */}
                        <div className="flex gap-2 pt-2 border-t border-slate-200/80">
                          <input
                            type="text"
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder={ar ? "اكتب رداً لإدارة المؤسسة..." : "Répondre à l'établissement..."}
                            className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendMessage(req.id)}
                            disabled={!replyMessage.trim()}
                            className="bg-[#0056D2] hover:bg-[#00419e] disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: AGENDA & RDV
      ========================================================================= */}
      {activeTab === "ag" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-[#0A192F]">
              {ar ? "جدول المواعيد وجلسات التدخل المؤكدة" : "Agenda des interventions confirmées"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ar
                ? "مواعيد الاستشارات عن بعد والزيارات الميدانية المبرمجة مع المؤسسات الشريكة."
                : "Calendrier des séances de conseil, diagnostics et visites sur site."}
            </p>
          </div>

          <div className="space-y-3">
            {scheduledAgenda.length > 0 ? (
              scheduledAgenda.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center p-2 bg-[#0056D2]/10 rounded-xl min-w-[70px]">
                      <div className="text-xs font-bold text-[#0056D2]">{req.scheduledRdvJson?.d}</div>
                      <div className="text-[11px] font-mono text-slate-600">{req.scheduledRdvJson?.h}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0A192F]">
                        {SERVICE_TYPES[req.serviceType as ServiceRequestType]?.labelFr}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {req.establishmentName} · {req.scheduledRdvJson?.mo} · Dossier {req.referenceCode}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full self-start sm:self-auto">
                    {ar ? "مؤكد" : "Confirmé"}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                {ar ? "لا توجد مواعيد مبرمجة حالياً." : "Aucun rendez-vous planifié."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: ÉTABLISSEMENTS SUIVIS
      ========================================================================= */}
      {activeTab === "et" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0A192F]">
              {ar ? "المؤسسات التربوية الشريكة في الدائرة" : "Établissements partenaires suivis"} ({establishments.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {establishments.map((est) => {
              const reqCount = requests.filter((r) => r.establishmentName === est.name).length;
              return (
                <div
                  key={est.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[#0A192F]">{est.name}</h4>
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                        {est.level}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Région {est.region} · Convention {est.partnershipStage >= 3 ? "Active" : "En cours"}
                    </div>

                    {/* Needs badges */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((dk) => {
                        const count = est.needsBreakdownJson?.[dk] || 0;
                        if (!count) return null;
                        const color = getDifficultyColor(dk, "Classique");
                        return (
                          <span
                            key={dk}
                            style={{ backgroundColor: `${color}15`, color }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                          >
                            {DIFFICULTIES[dk].labelFr} : {count}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">{reqCount} demande(s)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEstablishmentFilter(est.name);
                        setStageFilter("all");
                        setActiveTab("req");
                      }}
                      className="text-xs text-[#0056D2] font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <span>{ar ? "عرض الطلبات" : "Voir ses demandes"}</span>
                      <ChevronRight className={`w-3.5 h-3.5 ${ar ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: CONSEILS À PUBLIER (DIRECT SYNC TO TEACHER WORKSPACE)
      ========================================================================= */}
      {activeTab === "tip" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Publication Form */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-[#0A192F] flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[#0056D2]" />
                <span>{ar ? "نشر توجيه صفّي للأساتذة" : "Publier un conseil pour la classe"}</span>
              </h3>
              <p className="text-[11.5px] text-slate-500 mt-0.5">
                {ar
                  ? "تظهر هذه النصائح والتوجيهات مباشرة في فضاء الأساتذة (ماذا أفعل في القسم) بحسب نوع الصعوبة."
                  : "Ces fiches réflexes enrichissent la base de connaissances partagée de l'Académie."}
              </p>
            </div>

            <form onSubmit={handlePublishTip} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  {ar ? "الصعوبة المستهدفة" : "Difficulté ciblée"}
                </label>
                <select
                  value={tipDiff}
                  onChange={(e) => setTipDiff(e.target.value as DifficultyKey)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
                >
                  {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((dk) => (
                    <option key={dk} value={dk}>
                      {DIFFICULTIES[dk].labelFr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  {ar ? "عنوان الموقف الملاحظ في القسم" : "Situation observée en classe"}
                </label>
                <input
                  type="text"
                  required
                  value={tipTitle}
                  onChange={(e) => setTipTitle(e.target.value)}
                  placeholder={ar ? "مثال : التلميذ يرفض الكتابة عند بداية الحصة..." : "Ex. : L'élève refuse d'écrire en début d'exercice..."}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  {ar ? "ما يجب فعله (تدخل عملي ومباشر)" : "Que faire (action concrète recommandée)"}
                </label>
                <textarea
                  rows={3}
                  required
                  value={tipWhatToDo}
                  onChange={(e) => setTipWhatToDo(e.target.value)}
                  placeholder={ar ? "الإجراءات الموصى بها للأستاذ..." : "Alléger la quantité, proposer la dictée vocale..."}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  {ar ? "ما يجب تجنبه (أخطاء شائعة)" : "À éviter (pièges fréquents)"}
                </label>
                <textarea
                  rows={2}
                  value={tipWhatToAvoid}
                  onChange={(e) => setTipWhatToAvoid(e.target.value)}
                  placeholder={ar ? "سلوكيات ينصح بالابتعاد عنها..." : "Forcer la copie ou punir le manque de travail..."}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
                />
              </div>

              <button
                type="submit"
                disabled={isPublishingTip || !tipTitle.trim() || !tipWhatToDo.trim()}
                className="w-full bg-[#0056D2] hover:bg-[#00419e] disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                {isPublishingTip ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{ar ? "نشر التوجيه رسمياً" : "Publier le conseil"}</span>
              </button>
            </form>
          </div>

          {/* Right: Published Tips Feed */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#0A192F]">
              {ar ? "التوجيهات المنشورة والمتاحة للأساتذة" : "Conseils actuellement publiés"} ({tips.length})
            </h3>

            <div className="space-y-3">
              {tips.map((t) => {
                const color = getDifficultyColor(t.difficultyKey as DifficultyKey, "Classique");
                return (
                  <div
                    key={t.id}
                    style={{ borderInlineStartColor: color }}
                    className="p-4 rounded-xl border border-slate-200 border-s-4 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        style={{ backgroundColor: `${color}15`, color }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      >
                        {DIFFICULTIES[t.difficultyKey as DifficultyKey]?.labelFr || t.difficultyKey}
                      </span>
                      <span className="text-[10px] text-slate-400 italic">{t.authorName}</span>
                    </div>

                    <div className="text-xs font-bold text-slate-900">{t.situationTitle}</div>
                    <div className="text-xs text-slate-700">
                      <span className="font-semibold text-emerald-700 me-1">Que faire :</span>
                      {t.whatToDo}
                    </div>
                    {t.whatToAvoid && (
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold text-red-600 me-1">À éviter :</span>
                        {t.whatToAvoid}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: MON PROFIL SPÉCIALISTE
      ========================================================================= */}
      {activeTab === "pro" && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-[#0A192F]">
              {ar ? "الملف المهني للأخصائي المستشار" : "Profil professionnel du spécialiste"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ar
                ? "بيانات الاعتماد والرتبة المهنية ومجالات التدخل المعتمدة."
                : "Informations d'agrément auprès de l'Académie nationale de l'éducation inclusive."}
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-bold text-slate-500">{ar ? "الاسم واللقب :" : "Nom complet :"}</span>
              <span className="font-bold text-slate-900">{specialistName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-bold text-slate-500">{ar ? "الصفة المهنية :" : "Spécialité :"}</span>
              <span className="font-bold text-[#0056D2]">Psychologue scolaire & Conseiller d’inclusion</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-bold text-slate-500">{ar ? "حالة التوفر الحالية :" : "Disponibilité :"}</span>
              <span className="font-bold text-emerald-700">{availability}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-bold text-slate-500">{ar ? "نطاق التدخل :" : "Modalités :"}</span>
              <span className="text-slate-800">Téléconsultation en ligne & Visites sur site</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-bold text-slate-500">{ar ? "المؤسسات التابعة للمتابعة :" : "Établissements suivis :"}</span>
              <span className="font-mono font-bold text-slate-800">{establishments.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
