"use client";

import React, { useState, useMemo } from "react";
import {
  Building2,
  FileText,
  PlusCircle,
  Clock,
  Handshake,
  CheckCircle2,
  Bell,
  Send,
  MessageSquare,
  Calendar,
  Award,
  ChevronRight,
  Check,
  RefreshCw,
} from "lucide-react";
import type { Locale } from "@/types";
import {
  DIFFICULTIES,
  SERVICE_TYPES,
  SELF_EVAL_QUESTIONS,
  DifficultyKey,
  ServiceRequestType,
  PARTNERSHIP_STAGES,
  SERVICE_REQUEST_STAGES,
  getDifficultyColor,
} from "@/lib/inclusive-taxonomy";

interface ServiceRequestItem {
  id: string;
  referenceCode: string;
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

interface EstablishmentData {
  id: string;
  name: string;
  level: string;
  region: string;
  studentCount: number;
  needsBreakdownJson: Record<string, number>;
  existingResourcesJson: string[];
  constraintsJson: string[];
  partnershipStage: number;
  conventionSignedAt?: string | Date | null;
  selfEvalAnswersJson?: Record<string, number> | null;
  selfEvalScorePercent?: number | null;
}

export interface EstablishmentNewsItem {
  id: string;
  type: string;
  title: string;
  date: string;
}

interface EstablishmentWorkspaceProps {
  locale: Locale;
  initialEstablishment: EstablishmentData;
  initialRequests: ServiceRequestItem[];
  initialRegisteredEventIds?: string[];
  initialNewsItems?: EstablishmentNewsItem[];
}

const RESOURCES_DEF = [
  { key: "aesh", label: "Accompagnants (AESH / AVS scolaires)" },
  { key: "salle", label: "Salle de ressources ou d'apaisement" },
  { key: "locaux", label: "Locaux entièrement accessibles (rampes, ascenseur)" },
];

const CONSTRAINTS_DEF = [
  { key: "mat", label: "Matériel adapté manquant ou obsolète" },
  { key: "rural", label: "Zone rurale ou éloignée des centres de soin" },
  { key: "forme", label: "Équipe pédagogique peu ou pas formée à l'inclusion" },
];

const NEWS_ITEMS = [
  {
    type: "Formation",
    title: "Accueillir un élève autiste en classe ordinaire",
    date: "20/10/2026 · En ligne",
  },
  {
    type: "Appel à projets",
    title: "Équipements pour salles de ressources et bibliothèques inclusives",
    date: "Date limite : 15/11/2026",
  },
  {
    type: "Événement",
    title: "Journée nationale de l'éducation inclusive",
    date: "03/12/2026 · Tunis",
  },
  {
    type: "Formation",
    title: "Aménager les évaluations et examens d'État",
    date: "05/11/2026 · Sur site établissement",
  },
];

export function EstablishmentWorkspace({
  locale,
  initialEstablishment,
  initialRequests,
  initialRegisteredEventIds,
  initialNewsItems,
}: EstablishmentWorkspaceProps) {
  const ar = locale === "ar";
  const [activeTab, setActiveTab] = useState<
    "home" | "prof" | "ask" | "track" | "part" | "eval" | "news"
  >("home");
  const [establishment, setEstablishment] = useState<EstablishmentData>(initialEstablishment);
  const [requests, setRequests] = useState<ServiceRequestItem[]>(initialRequests);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  // New Request Form state
  const [askServiceType, setAskServiceType] = useState<ServiceRequestType>("form");
  const [askUrgency, setAskUrgency] = useState<"Normale" | "Urgente" | "Très urgente">("Normale");
  const [askConcernedCount, setAskConcernedCount] = useState<number>(1);
  const [askDescription, setAskDescription] = useState<string>("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);

  // Self Eval state
  const [evalAnswers, setEvalAnswers] = useState<Record<string, number>>(
    establishment.selfEvalAnswersJson || {}
  );
  const [evalSubmitted, setEvalSubmitted] = useState<boolean>(
    establishment.selfEvalScorePercent !== undefined && establishment.selfEvalScorePercent !== null
  );

  const newsItems = useMemo(() => {
    if (initialNewsItems && initialNewsItems.length > 0) return initialNewsItems;
    return NEWS_ITEMS.map((n, idx) => ({ id: `default-event-${idx}`, ...n }));
  }, [initialNewsItems]);

  // News registrations toggle backed by PostgreSQL
  const [registeredNews, setRegisteredNews] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (initialRegisteredEventIds) {
      for (const id of initialRegisteredEventIds) {
        init[id] = true;
      }
    }
    return init;
  });

  const handleToggleRegistration = async (eventId: string) => {
    const isCurrentlyRegistered = Boolean(registeredNews[eventId]);
    setRegisteredNews((prev) => ({ ...prev, [eventId]: !isCurrentlyRegistered }));
    setFeedback(
      !isCurrentlyRegistered
        ? ar
          ? "تم تسجيل المؤسسة في الدورة بنجاح!"
          : "Inscription confirmée pour cette session."
        : ar
        ? "تم إلغاء التسجيل."
        : "Inscription annulée."
    );
    setTimeout(() => setFeedback(""), 3000);

    try {
      await fetch("/api/establishment/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
    } catch (err) {
      console.error("Failed to persist event registration:", err);
    }
  };

  // Active requests count (stage < 4)
  const pendingRequestsCount = useMemo(() => {
    return requests.filter((r) => r.stage < 4).length;
  }, [requests]);

  // Total student needs
  const totalNeeds = useMemo(() => {
    return Object.values(establishment.needsBreakdownJson || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  }, [establishment.needsBreakdownJson]);

  // Next scheduled meeting
  const nextRdv = useMemo(() => {
    return requests.find((r) => r.stage === 3 && r.scheduledRdvJson);
  }, [requests]);

  // Max need count for proportional bar chart
  const maxNeedCount = useMemo(() => {
    const vals = Object.values(establishment.needsBreakdownJson || {}).map(Number);
    return Math.max(...vals, 1);
  }, [establishment.needsBreakdownJson]);

  // Smart Recommendations
  const smartRecommendations = useMemo(() => {
    const recs: Array<{ message: string; service: ServiceRequestType; desc: string }> = [];
    const breakdown = establishment.needsBreakdownJson || {};
    const sorted = Object.entries(breakdown).sort((a, b) => Number(b[1]) - Number(a[1]));
    const topNeed = sorted[0];

    if (topNeed && topNeed[1] > 0) {
      const diffLabel = DIFFICULTIES[topNeed[0] as DifficultyKey]?.labelFr || topNeed[0];
      recs.push({
        message: `Besoin le plus fréquent : ${diffLabel} (${topNeed[1]} élèves identifiés). Une formation ciblée de l'équipe est vivement conseillée.`,
        service: "form",
        desc: `Formation sur l'accueil et la pédagogie adaptée pour les élèves avec ${diffLabel}.`,
      });
    }

    if (establishment.constraintsJson?.includes("mat")) {
      recs.push({
        message: "Manque de matériel adapté signalé : le pôle d'aide peut mettre à disposition des équipements en prêt gratuit.",
        service: "mat",
        desc: "Prêt de matériel adapté (claviers à grands caractères, logiciels de dictée, loupes électroniques).",
      });
    }

    if (!establishment.existingResourcesJson?.includes("locaux")) {
      recs.push({
        message: "Vos locaux ne sont pas indiqués comme totalement accessibles : un diagnostic d'accessibilité bâti peut être planifié.",
        service: "acc",
        desc: "Diagnostic d'accessibilité des locaux et des voies d'accès scolaires.",
      });
    }

    if (!establishment.existingResourcesJson?.includes("aesh")) {
      recs.push({
        message: "Absence d'accompagnants (AESH/AVS) dans l'établissement : une consultation clinique peut vous aider à structurer l'aide mutuelle.",
        service: "cons",
        desc: "Consultation spécialisée pour organiser l'accompagnement pédagogique sans AVS affecté.",
      });
    }

    return recs;
  }, [establishment]);

  // Handle Create Request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askDescription.trim()) return;

    setIsSubmittingRequest(true);
    try {
      const res = await fetch("/api/establishment/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: askServiceType,
          urgency: askUrgency,
          concernedCount: Number(askConcernedCount) || 1,
          situationDescription: askDescription.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok && data.request) {
        setRequests([
          {
            ...data.request,
            messages: [
              {
                id: "initial-msg",
                senderRole: "Académie",
                senderName: "Portail Académique ANEI",
                body: "Votre demande a été transmise aux spécialistes et conseillers de l'Académie.",
                createdAt: new Date(),
              },
            ],
          },
          ...requests,
        ]);
        setAskDescription("");
        setActiveTab("track");
        setFeedback(ar ? "تم إرسال طلبكم بنجاح إلى الأكاديمية!" : "Demande transmise avec succès à l'Académie.");
        setTimeout(() => setFeedback(""), 3500);
      }
    } catch (err) {
      console.error("Create request failed:", err);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Handle Send Reply Message
  const handleSendMessage = async (requestId: string) => {
    const text = replyMessage.trim();
    if (!text) return;

    try {
      const res = await fetch("/api/establishment/requests/message", {
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
      console.error("Failed to send message:", err);
    }
  };

  // Handle Save Profile
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/establishment/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: establishment.name,
          level: establishment.level,
          region: establishment.region,
          studentCount: establishment.studentCount,
          needsBreakdownJson: establishment.needsBreakdownJson,
          existingResourcesJson: establishment.existingResourcesJson,
          constraintsJson: establishment.constraintsJson,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback(ar ? "تم تحديث بيانات المؤسسة بنجاح!" : "Profil de l'établissement mis à jour.");
        setTimeout(() => setFeedback(""), 3000);
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Sign Convention
  const handleSignConvention = async () => {
    try {
      const res = await fetch("/api/establishment/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnershipStage: 3, // Active
          conventionSignedAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEstablishment({
          ...establishment,
          partnershipStage: 3,
          conventionSignedAt: new Date(),
        });
        setFeedback(ar ? "تم توقيع اتفاقية الشراكة بنجاح! الشراكة نشطة الآن." : "Convention validée ! Partenariat actif.");
        setTimeout(() => setFeedback(""), 3500);
      }
    } catch (err) {
      console.error("Sign convention failed:", err);
    }
  };

  // Handle Self Eval Submission
  const handleCalculateEvalScore = async () => {
    const answeredKeys = Object.keys(evalAnswers);
    if (answeredKeys.length < SELF_EVAL_QUESTIONS.length) {
      alert(
        ar
          ? "الرجاء الإجابة على جميع الأسئلة الثمانية لعرض النتيجة."
          : "Veuillez répondre aux 8 questions pour calculer votre score d'inclusion."
      );
      return;
    }

    const totalPts = answeredKeys.reduce((acc, k) => acc + (evalAnswers[k] || 0), 0);
    const maxPts = SELF_EVAL_QUESTIONS.length * 2;
    const scorePct = Math.round((totalPts / maxPts) * 100);

    try {
      await fetch("/api/establishment/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfEvalAnswersJson: evalAnswers,
          selfEvalScorePercent: scorePct,
        }),
      });
      setEstablishment({
        ...establishment,
        selfEvalAnswersJson: evalAnswers,
        selfEvalScorePercent: scorePct,
      });
      setEvalSubmitted(true);
    } catch (err) {
      console.error("Failed to save eval score:", err);
    }
  };

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0056D2]/10 text-[#0056D2]">
              <Building2 className="w-4 h-4 stroke-[1.8]" />
            </span>
            <h1 className="text-xl font-bold text-[#0A192F]">
              {establishment.name || (ar ? "المؤسسة الشريكة" : "Établissement partenaire")}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {ar
              ? `${establishment.level} · جهة ${establishment.region} · اتفاقية الشراكة : ${
                  establishment.partnershipStage >= 3 ? "سارية المفعول" : "قيد الإمضاء"
                }`
              : `${establishment.level} · Région ${establishment.region} · Convention de partenariat : ${
                  establishment.partnershipStage >= 3 ? "Active" : "En cours"
                }`}
          </p>
        </div>

        {/* Quick CTA to Ask a Service */}
        <button
          type="button"
          onClick={() => setActiveTab("ask")}
          className="bg-[#0056D2] hover:bg-[#00419e] text-white text-xs font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-xs transition-colors self-start md:self-auto"
        >
          <PlusCircle className="w-4 h-4 stroke-[2]" />
          <span>{ar ? "طلب خدمة أو تدخل" : "Demander un service"}</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
        {[
          { key: "home", icon: Building2, fr: "Accueil", ar: "الرئيسية" },
          { key: "prof", icon: FileText, fr: "Profil de l'établissement", ar: "ملف المؤسسة" },
          { key: "ask", icon: PlusCircle, fr: "Demander un service", ar: "طلب خدمة" },
          {
            key: "track",
            icon: Clock,
            fr: "Mes demandes",
            ar: "متابعة الطلبات",
            badge: pendingRequestsCount > 0 ? String(pendingRequestsCount) : undefined,
          },
          { key: "part", icon: Handshake, fr: "Partenariat & Convention", ar: "اتفاقية الشراكة" },
          { key: "eval", icon: CheckCircle2, fr: "Auto-évaluation", ar: "التقييم الذاتي" },
          { key: "news", icon: Bell, fr: "Annonces & Formations", ar: "الإعلانات والتكوين" },
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
                <span className="text-[10px] bg-[#0056D2] text-white px-1.5 py-0.2 rounded-full font-mono">
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
          TAB 1: ACCUEIL (KPIS, DISTRIBUTION, RECOMMANDATIONS, CATALOGUE)
      ========================================================================= */}
      {activeTab === "home" && (
        <div className="space-y-6">
          {/* 5 KPIs Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-xl sm:text-2xl font-bold text-[#0A192F]">{establishment.studentCount}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{ar ? "تلميذ بالمؤسسة" : "Élèves inscrits"}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-xl sm:text-2xl font-bold text-[#0056D2]">{totalNeeds}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{ar ? "حالة مشخصة" : "Besoins repérés"}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-xl sm:text-2xl font-bold text-amber-600">{pendingRequestsCount}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{ar ? "طلبات قيد المتابعة" : "Demandes en cours"}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                {nextRdv?.scheduledRdvJson ? `${nextRdv.scheduledRdvJson.d}` : "—"}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{ar ? "الموعد القادم" : "Prochain RDV"}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs col-span-2 sm:col-span-1">
              <div className="text-xs sm:text-sm font-bold text-emerald-600">
                {establishment.partnershipStage >= 3
                  ? ar
                    ? "سارية المفعول"
                    : "Active"
                  : ar
                  ? "قيد الإمضاء"
                  : "À signer"}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{ar ? "اتفاقية الشراكة" : "Convention"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Needs Breakdown Bar Chart */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-[#0A192F]">
                  {ar ? "توزيع الصعوبات والاحتياجات" : "Répartition des besoins identifiés"}
                </h3>
                <span className="text-xs text-slate-400 font-mono">{totalNeeds} élèves</span>
              </div>

              <div className="space-y-3">
                {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((dk) => {
                  const val = establishment.needsBreakdownJson?.[dk] || 0;
                  const pct = Math.max((val / maxNeedCount) * 100, 3);
                  const color = getDifficultyColor(dk, "Classique");
                  return (
                    <div key={dk} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-slate-800">{DIFFICULTIES[dk].labelFr}</span>
                        </span>
                        <span className="font-mono text-slate-700">{val}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Smart Recommendations */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-[#0A192F] flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#0056D2]" />
                  <span>{ar ? "توصيات ومسارات الدعم المقترحة" : "Recommandations d'accompagnement"}</span>
                </h3>
              </div>

              <div className="space-y-3">
                {smartRecommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <p className="text-xs text-slate-700 flex-1">{rec.message}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setAskServiceType(rec.service);
                        setAskDescription(rec.desc);
                        setActiveTab("ask");
                      }}
                      className="bg-white hover:bg-slate-100 text-[#0056D2] border border-[#0056D2]/30 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
                    >
                      {ar ? "طلب الخدمة" : "Demander"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Service Catalog Row */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#0A192F]">
              {ar ? "خدمات المرافقة والتدخل المتاحة للمؤسسات" : "Catalogue des services proposés par l'Académie"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(SERVICE_TYPES) as ServiceRequestType[]).map((sk) => {
                const sDef = SERVICE_TYPES[sk];
                return (
                  <div
                    key={sk}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#0A192F]">{sDef.labelFr}</div>
                      <p className="text-[11.5px] text-slate-500 mt-1">{sDef.descFr}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAskServiceType(sk);
                        setActiveTab("ask");
                      }}
                      className="text-xs text-[#0056D2] font-semibold hover:underline inline-flex items-center gap-1 self-start"
                    >
                      <span>{ar ? "اختيار هذا التدخل" : "Choisir ce service"}</span>
                      <ChevronRight className={`w-3.5 h-3.5 ${ar ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PROFIL DE L'ÉTABLISSEMENT
      ========================================================================= */}
      {activeTab === "prof" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-[#0A192F]">
                {ar ? "ملف وتعريف المؤسسة الشريكة" : "Profil de l'établissement"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {ar
                  ? "تحديث البيانات الإدارية وعدد التلاميذ المشخصين والموارد المادية والبشرية المتوفرة."
                  : "Renseignez les données pour permettre une affectation adaptée des formateurs et conseillers."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="bg-[#0056D2] hover:bg-[#00419e] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-2 transition-colors"
            >
              {savingProfile && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{ar ? "حفظ التعديلات" : "Enregistrer le profil"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                {ar ? "اسم المؤسسة" : "Nom de l'établissement"}
              </label>
              <input
                type="text"
                value={establishment.name}
                onChange={(e) => setEstablishment({ ...establishment, name: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                {ar ? "المرحلة التعليمية" : "Niveau"}
              </label>
              <select
                value={establishment.level}
                onChange={(e) => setEstablishment({ ...establishment, level: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
              >
                <option value="Primaire">Primaire (الابتدائي)</option>
                <option value="Collège">Collège (الإعدادي)</option>
                <option value="Lycée">Lycée (الثانوي)</option>
                <option value="Supérieur">Supérieur (الجامعي)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                {ar ? "الولاية / المنطقة" : "Région / Gouvernorat"}
              </label>
              <input
                type="text"
                value={establishment.region}
                onChange={(e) => setEstablishment({ ...establishment, region: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                {ar ? "العدد الجملي للتلاميذ" : "Nombre total d'élèves"}
              </label>
              <input
                type="number"
                min="0"
                value={establishment.studentCount}
                onChange={(e) =>
                  setEstablishment({ ...establishment, studentCount: Number(e.target.value) || 0 })
                }
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
              />
            </div>
          </div>

          {/* Breakdown numbers */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              {ar ? "عدد التلاميذ المشخصين حسب كل صعوبة" : "Nombre d'élèves repérés par difficulté"}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((dk) => (
                <div key={dk} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                  <span className="text-[11px] font-bold text-slate-700 block truncate">
                    {DIFFICULTIES[dk].labelFr}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={establishment.needsBreakdownJson?.[dk] || 0}
                    onChange={(e) => {
                      const next = {
                        ...(establishment.needsBreakdownJson || {}),
                        [dk]: Number(e.target.value) || 0,
                      };
                      setEstablishment({ ...establishment, needsBreakdownJson: next });
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg p-1.5 mt-1 font-mono font-bold text-[#0A192F]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Resources & Constraints */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 border-t border-slate-100">
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {ar ? "الموارد المتوفرة بالمؤسسة" : "Ressources existantes"}
              </div>
              <div className="space-y-1.5">
                {RESOURCES_DEF.map((r) => {
                  const checked = establishment.existingResourcesJson?.includes(r.key);
                  return (
                    <label key={r.key} className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const current = establishment.existingResourcesJson || [];
                          const updated = e.target.checked
                            ? [...current, r.key]
                            : current.filter((k) => k !== r.key);
                          setEstablishment({ ...establishment, existingResourcesJson: updated });
                        }}
                        className="rounded border-slate-300 text-[#0056D2] focus:ring-[#0056D2]"
                      />
                      <span>{r.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {ar ? "العوائق والصعوبات الملاحظة" : "Contraintes identifiées"}
              </div>
              <div className="space-y-1.5">
                {CONSTRAINTS_DEF.map((c) => {
                  const checked = establishment.constraintsJson?.includes(c.key);
                  return (
                    <label key={c.key} className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const current = establishment.constraintsJson || [];
                          const updated = e.target.checked
                            ? [...current, c.key]
                            : current.filter((k) => k !== c.key);
                          setEstablishment({ ...establishment, constraintsJson: updated });
                        }}
                        className="rounded border-slate-300 text-[#0056D2] focus:ring-[#0056D2]"
                      />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: DEMANDER UN SERVICE
      ========================================================================= */}
      {activeTab === "ask" && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-[#0A192F]">
              {ar ? "إرسال طلب مرافقة أو تدخل بيداغوجي" : "Formulaire de demande de service"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ar
                ? "حدد نوع التدخل المطلوب وحالة الاستعجال ووصف الموقف الصفي أو الإداري بدقة."
                : "Votre demande sera transmise directement au pôle d'experts et aux conseillers régionaux."}
            </p>
          </div>

          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                {ar ? "نوع الخدمة المطلوبة" : "Type de prestation"}
              </label>
              <select
                value={askServiceType}
                onChange={(e) => setAskServiceType(e.target.value as ServiceRequestType)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
              >
                {(Object.keys(SERVICE_TYPES) as ServiceRequestType[]).map((sk) => (
                  <option key={sk} value={sk}>
                    {SERVICE_TYPES[sk].labelFr} — {SERVICE_TYPES[sk].descFr}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  {ar ? "درجة الاستعجال" : "Degré d'urgence"}
                </label>
                <select
                  value={askUrgency}
                  onChange={(e) => setAskUrgency(e.target.value as typeof askUrgency)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
                >
                  <option value="Normale">Normale (عادية)</option>
                  <option value="Urgente">Urgente (عاجلة)</option>
                  <option value="Très urgente">Très urgente (عاجلة جداً)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  {ar ? "عدد المستفيدين المعنيين" : "Personnes / Élèves concernés"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={askConcernedCount}
                  onChange={(e) => setAskConcernedCount(Number(e.target.value) || 1)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                {ar ? "وصف الوضعية والاحتياج بدقة" : "Description détaillée du besoin"}
              </label>
              <textarea
                rows={5}
                required
                value={askDescription}
                onChange={(e) => setAskDescription(e.target.value)}
                placeholder={
                  ar
                    ? "صف الموقف التعليمي أو الصعوبات التي يواجهها الإطار التربوي أو التلاميذ..."
                    : "Ex. : Besoin d'une session de sensibilisation pour les enseignants de 4e suite à l'intégration d'un élève autiste..."
                }
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingRequest || !askDescription.trim()}
              className="w-full bg-[#0056D2] hover:bg-[#00419e] disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              {isSubmittingRequest ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 stroke-[2]" />
              )}
              <span>{ar ? "تأكيد وإرسال الطلب للأكاديمية" : "Transmettre la demande"}</span>
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 4: MES DEMANDES (PIPELINE & MESSAGING)
      ========================================================================= */}
      {activeTab === "track" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0A192F]">
              {ar ? "متابعة الطلبات الجارية والسابقة" : "Suivi des demandes d'intervention"} ({requests.length})
            </h3>
          </div>

          <div className="space-y-4">
            {requests.map((req) => {
              const isOpen = openRequestId === req.id;
              const sDef = SERVICE_TYPES[req.serviceType as ServiceRequestType];
              return (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-[#0A192F] flex items-center gap-2">
                        <span>{sDef?.labelFr || req.serviceType}</span>
                        <span className="text-xs font-mono font-normal text-slate-400">· {req.referenceCode}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{req.situationDescription}</div>
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

                  {/* Scheduled RDV Banner */}
                  {req.scheduledRdvJson && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>
                        {ar
                          ? `موعد مؤكد : ${req.scheduledRdvJson.d} الساعة ${req.scheduledRdvJson.h} (${req.scheduledRdvJson.mo})`
                          : `Rendez-vous fixé le ${req.scheduledRdvJson.d} à ${req.scheduledRdvJson.h} (${req.scheduledRdvJson.mo})`}
                      </span>
                    </div>
                  )}

                  {/* Message Thread Trigger & Content */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setOpenRequestId(isOpen ? null : req.id)}
                      className="text-xs font-semibold text-[#0056D2] hover:underline flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>
                        {ar
                          ? `الرسائل والمتابعة (${req.messages.length})`
                          : `Échanges et messages (${req.messages.length})`}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200/90 space-y-3">
                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                          {req.messages.length > 0 ? (
                            req.messages.map((m) => (
                              <div
                                key={m.id}
                                className={`text-xs p-2.5 rounded-xl max-w-[85%] ${
                                  m.senderRole === "Établissement"
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
                              {ar ? "لا توجد رسائل بعد" : "Aucun message pour cette demande."}
                            </span>
                          )}
                        </div>

                        {/* Reply box */}
                        <div className="flex gap-2 pt-2 border-t border-slate-200/80">
                          <input
                            type="text"
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder={ar ? "اكتب رسالة للمستشار أو الأخصائي..." : "Votre message..."}
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: PARTENARIAT & CONVENTION
      ========================================================================= */}
      {activeTab === "part" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#0A192F]">
              {ar ? "مسار اتفاقية الشراكة المؤسساتية" : "Convention et statut de partenariat"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ar
                ? "اتفاقية رسمية تتيح الاستفادة من برامج التكوين المستمر والزيارات الميدانية والتجهيزات."
                : "La convention donne accès prioritaire aux diagnostics sur site et aux prêts de matériel."}
            </p>
          </div>

          {/* 4 Stages Stepper */}
          <div className="grid grid-cols-4 gap-2 py-2">
            {PARTNERSHIP_STAGES.map((s, idx) => (
              <div key={idx} className="space-y-1.5 text-center">
                <div
                  className={`h-2 rounded-full transition-all ${
                    idx <= establishment.partnershipStage ? "bg-[#0056D2]" : "bg-slate-100"
                  }`}
                />
                <span className="text-[10px] text-slate-600 font-semibold block">{s}</span>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#0A192F]">
                {ar ? "وثيقة اتفاقية الشراكة الرسمية (PDF)" : "Convention cadre de partenariat (PDF)"}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {establishment.partnershipStage >= 3
                  ? ar
                    ? "تم توقيع الاتفاقية والمصادقة عليها."
                    : "Convention signée et enregistrée auprès de l'Académie."
                  : ar
                  ? "الاتفاقية جاهزة للإمضاء الإلكتروني."
                  : "Prête pour validation par le chef d'établissement."}
              </div>
            </div>

            {establishment.partnershipStage < 3 ? (
              <button
                type="button"
                onClick={handleSignConvention}
                className="bg-[#0056D2] hover:bg-[#00419e] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
              >
                {ar ? "توقيع ومصادقة" : "Marquer comme signée"}
              </button>
            ) : (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{ar ? "نشطة وموقعة" : "Convention active"}</span>
              </span>
            )}
          </div>

          {/* Upcoming Agenda Meetings */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              {ar ? "اللقاءات والمتابعات القادمة" : "Prochaines rencontres et comités de suivi"}
            </h4>
            <div className="space-y-2">
              <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center gap-3">
                <Calendar className="w-4 h-4 text-[#0056D2]" />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">14/10/2026 à 10h</span> · Consultation en ligne (Dr. Amel Bouazizi)
                </div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center gap-3">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">05/11/2026</span> · Réunion d’évaluation avec le conseiller académique
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: AUTO-ÉVALUATION (8 QUESTIONS & REMEDIATION CTAS)
      ========================================================================= */}
      {activeTab === "eval" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-[#0A192F]">
                {ar ? "أداة التقييم الذاتي للشمول المدرسي" : "Diagnostic d'auto-évaluation inclusive"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {ar
                  ? "أجب على الأسئلة الثمانية لقياس جاهزية المؤسسة واكتشاف خطط العمل العلاجية الفورية."
                  : "Évaluez votre niveau d'inclusion sur 8 critères clés et obtenez un plan d'action personnalisé."}
              </p>
            </div>

            {establishment.selfEvalScorePercent !== undefined && establishment.selfEvalScorePercent !== null && (
              <div className="bg-[#0056D2]/10 border border-[#0056D2]/30 px-4 py-2 rounded-xl text-center self-start sm:self-auto">
                <div className="text-xl font-black text-[#0056D2] font-mono">
                  {establishment.selfEvalScorePercent} %
                </div>
                <div className="text-[10px] text-slate-600 font-semibold">
                  {ar ? "مؤشر الشمول" : "Indice d'inclusion"}
                </div>
              </div>
            )}
          </div>

          {/* 8 Questions List */}
          <div className="space-y-3">
            {SELF_EVAL_QUESTIONS.map((q, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="text-xs font-semibold text-slate-800">
                  <span className="font-mono text-slate-400 me-2">{idx + 1}.</span>
                  <span>{ar ? q.questionAr : q.questionFr}</span>
                </div>

                <select
                  value={evalAnswers[idx] !== undefined ? String(evalAnswers[idx]) : ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? undefined : Number(e.target.value);
                    const next = { ...evalAnswers };
                    if (val === undefined) delete next[idx];
                    else next[idx] = val;
                    setEvalAnswers(next);
                  }}
                  aria-label={ar ? q.questionAr : q.questionFr}
                  className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0056D2] self-end sm:self-auto"
                >
                  <option value="">{ar ? "اختر..." : "Sélectionner"}</option>
                  <option value="2">{ar ? "نعم (2 نقاط)" : "Oui (2 pts)"}</option>
                  <option value="1">{ar ? "جزئياً (نقطة واحدة)" : "Partiellement (1 pt)"}</option>
                  <option value="0">{ar ? "لا (0 نقطة)" : "Non (0 pt)"}</option>
                </select>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleCalculateEvalScore}
              className="bg-[#0056D2] hover:bg-[#00419e] text-white text-xs font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2 transition-colors shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{ar ? "حساب نتيجة التقييم الذاتي" : "Calculer le score et afficher les recommandations"}</span>
            </button>
          </div>

          {/* Weak Points Remediation Direct CTAs */}
          {evalSubmitted && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {ar ? "نقاط التحسين ذات الأولوية وخطط العمل" : "Axes d'amélioration prioritaires"}
              </h4>
              <div className="space-y-2">
                {SELF_EVAL_QUESTIONS.filter((_, idx) => (evalAnswers[idx] || 0) < 2).map((weakQ, i) => {
                  const sDef = SERVICE_TYPES[weakQ.associatedService];
                  return (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="text-xs text-amber-950 font-medium">
                        {ar ? weakQ.questionAr : weakQ.questionFr}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAskServiceType(weakQ.associatedService);
                          setAskDescription(`Remédiation auto-évaluation : ${weakQ.questionFr}`);
                          setActiveTab("ask");
                        }}
                        className="bg-white hover:bg-amber-100 text-[#0056D2] border border-[#0056D2]/30 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
                      >
                        {ar ? `طلب ${sDef?.labelFr}` : `Demander ${sDef?.labelFr.toLowerCase()}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 7: ANNONCES & FORMATIONS
      ========================================================================= */}
      {activeTab === "news" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-[#0A192F]">
              {ar ? "الإعلانات الرسمية والدورات التكوينية" : "Annonces officielles & Sessions de formation"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ar
                ? "تسجيل مباشر لأعضاء الفريق التربوي في الدورات الحضورية وعبر الخط."
                : "Inscrivez vos équipes aux prochaines sessions proposées par le réseau ANEI."}
            </p>
          </div>

          <div className="space-y-3">
            {newsItems.map((n) => {
              const isRegistered = Boolean(registeredNews[n.id]);
              return (
                <div
                  key={n.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold bg-[#0056D2]/10 text-[#0056D2] px-2 py-0.5 rounded-md">
                      {n.type}
                    </span>
                    <div className="text-xs font-bold text-slate-900">{n.title}</div>
                    <div className="text-[11px] text-slate-500">{n.date}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleRegistration(n.id)}
                    className={`text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${
                      isRegistered
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-[#0056D2] hover:bg-[#00419e] text-white shadow-xs"
                    }`}
                  >
                    {isRegistered ? (ar ? "✓ مسجل" : "✓ Inscrit") : ar ? "التسجيل" : "S'inscrire"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
