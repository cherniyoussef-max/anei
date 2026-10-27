"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Target, MessageSquare, Inbox, X, Check, CheckCheck } from "lucide-react";
import type { Locale } from "@/types";
import type {
  OmnichannelChannel,
  OmnichannelPipelineStage,
} from "@/server/services/omnichannel-crm";

type ThreadItem = {
  id: string;
  channel: OmnichannelChannel;
  externalContactId: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  avatarUrl: string | null;
  linkedUserId: string | null;
  sourceType: string;
  adId: string | null;
  campaignId: string | null;
  adHeadline: string | null;
  adBody?: string | null;
  ctwaClid: string | null;
  pipelineStage: OmnichannelPipelineStage;
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageDirection: string | null;
  assignedAdminId: string | null;
  createdAt: string;
};

type MessageItem = {
  id: string;
  threadId: string;
  direction: "INBOUND" | "OUTBOUND";
  messageType: string;
  content: string;
  metaMessageId: string | null;
  deliveryStatus: string;
  sentByAdminId: string | null;
  createdAt: string;
};

type ThreadDetail = {
  thread: ThreadItem & { internalNotes?: string; adBody?: string | null };
  messages: MessageItem[];
  linkedUserDetail?: {
    user: { id: string; name: string; email: string; role: string; profileType: string };
    enrollments: Array<{ courseId: string; courseTitle: string; progressPercent: number }>;
    bookings: Array<{ id: string; status: string; meetingType?: string; requestedDate?: string | null }>;
  } | null;
};

const QUICK_REPLIES = [
  {
    titleFr: "Catalogue Formations",
    titleAr: "كتالوج الدورات",
    textFr: "Bonjour ! Voici le catalogue officiel de nos formations certifiantes : https://anei.education/fr/formations. Souhaitez-vous un accompagnement personnalisé ?",
    textAr: "مرحباً بكم! يمكنكم الاطلاع على دليل دوراتنا التكوينية المعتمدة عبر الرابط: https://anei.education/ar/formations. هل تحتاجون إلى مساعدة مخصصة؟",
  },
  {
    titleFr: "Prise de RDV AVS / Spécialiste",
    titleAr: "حجز موعد مرافق / أخصائي",
    textFr: "Bonjour ! Vous pouvez consulter notre annuaire agréé et réserver une consultation (en ligne ou en cabinet) sur : https://anei.education/fr/specialistes",
    textAr: "مرحباً بكم! يمكنكم استكشاف دليل الأخصائيين المعتمدين وحجز استشارة حضورية أو عن بعد عبر: https://anei.education/ar/specialistes",
  },
  {
    titleFr: "Programme Métier AVS",
    titleAr: "برنامج تأهيل مرافق الحياة المدرسية",
    textFr: "Notre programme certifiant d'Accompagnant de Vie Scolaire (AVS) comprend un parcours complet, des ateliers pratiques et un examen final sécurisé.",
    textAr: "يتضمن برنامجنا التدريبي لتأهيل مرافقي الحياة المدرسية مساراً شاملاً وورشات تطبيقية مع اختبار نهائي للحصول على الشهادة الرسمية.",
  },
];

export function AdminOmnichannelCrm({
  initialChannel = "ALL",
  locale,
}: {
  initialChannel?: OmnichannelChannel | "ALL";
  locale: Locale;
}) {
  const ar = locale === "ar";

  const [channel, setChannel] = useState<OmnichannelChannel | "ALL">(initialChannel);
  const [filter, setFilter] = useState<"all" | "unread" | "meta_ads" | "registered_users">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [detail, setDetail] = useState<ThreadDetail | null>(null);

  const [draftReply, setDraftReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const [internalNotes, setInternalNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [linkUserId, setLinkUserId] = useState("");
  const [linkingUser, setLinkingUser] = useState(false);

  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simChannel, setSimChannel] = useState<OmnichannelChannel>("WHATSAPP");
  const [simContactId, setSimContactId] = useState("+216 20 123 456");
  const [simName, setSimName] = useState("Amira Trabelsi");
  const [simMessage, setSimMessage] = useState("Bonjour, j'ai vu votre publicité sur Facebook pour la formation AVS. Comment s'inscrire ?");
  const [simAdHeadline, setSimAdHeadline] = useState("Devenez AVS Certifié ANEI — Session 2026");
  const [simulating, setSimulating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch threads
  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const params = new URLSearchParams();
      if (channel !== "ALL") params.set("channel", channel);
      if (filter !== "all") params.set("filter", filter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const res = await fetch(`/api/admin/crm/omnichannel/threads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.items || []);
        if (data.items?.length > 0 && !selectedThreadId) {
          setSelectedThreadId(data.items[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load threads", err);
    } finally {
      setLoadingThreads(false);
    }
  }, [channel, filter, searchQuery, selectedThreadId]);

  useEffect(() => {
    let active = true;
    const fetchInitial = async () => {
      try {
        const params = new URLSearchParams();
        if (channel !== "ALL") params.set("channel", channel);
        if (filter !== "all") params.set("filter", filter);
        if (searchQuery.trim()) params.set("q", searchQuery.trim());

        const res = await fetch(`/api/admin/crm/omnichannel/threads?${params.toString()}`);
        if (res.ok && active) {
          const data = await res.json();
          setThreads(data.items || []);
          if (data.items?.length > 0 && !selectedThreadId) {
            setSelectedThreadId(data.items[0].id);
          }
        }
      } catch (err) {
        if (active) console.error("Failed to load threads", err);
      }
    };
    void fetchInitial();
    return () => {
      active = false;
    };
  }, [channel, filter, searchQuery, selectedThreadId]);

  // Fetch thread detail when selected
  useEffect(() => {
    if (!selectedThreadId) return;
    let active = true;
    fetch(`/api/admin/crm/omnichannel/threads/${selectedThreadId}`)
      .then((r) => r.json())
      .then((data) => {
        if (active) {
          setDetail(data);
          setInternalNotes(data.thread?.internalNotes || "");
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      })
      .catch((err) => {
        if (active) console.error("Failed to load detail", err);
      });
    return () => {
      active = false;
    };
  }, [selectedThreadId]);

  // Send reply
  const handleSendReply = async (contentToSend?: string) => {
    const text = (contentToSend ?? draftReply).trim();
    if (!text || !selectedThreadId) return;

    setSendingReply(true);
    try {
      const res = await fetch(`/api/admin/crm/omnichannel/threads/${selectedThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, messageType: "TEXT" }),
      });
      if (res.ok) {
        setDraftReply("");
        // Refresh detail
        const updated = await fetch(`/api/admin/crm/omnichannel/threads/${selectedThreadId}`).then((r) => r.json());
        setDetail(updated);
        // Also refresh list
        loadThreads();
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    } catch (err) {
      console.error("Failed to send reply", err);
    } finally {
      setSendingReply(false);
    }
  };

  // Change pipeline stage
  const handleStageChange = async (newStage: OmnichannelPipelineStage) => {
    if (!selectedThreadId) return;
    try {
      const res = await fetch(`/api/admin/crm/omnichannel/threads/${selectedThreadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage: newStage }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDetail(updated);
        loadThreads();
      }
    } catch (err) {
      console.error("Failed to change stage", err);
    }
  };

  // Save internal notes
  const handleSaveNotes = async () => {
    if (!selectedThreadId) return;
    setSavingNotes(true);
    try {
      await fetch(`/api/admin/crm/omnichannel/threads/${selectedThreadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes }),
      });
    } catch (err) {
      console.error("Failed to save notes", err);
    } finally {
      setSavingNotes(false);
    }
  };

  // Link to user
  const handleLinkUser = async () => {
    if (!selectedThreadId || !linkUserId.trim()) return;
    setLinkingUser(true);
    try {
      const res = await fetch(`/api/admin/crm/omnichannel/threads/${selectedThreadId}/link-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: linkUserId.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDetail(updated);
        setLinkUserId("");
        loadThreads();
      }
    } catch (err) {
      console.error("Failed to link user", err);
    } finally {
      setLinkingUser(false);
    }
  };

  // Simulate incoming Meta Lead
  const handleSimulateLead = async () => {
    setSimulating(true);
    try {
      const res = await fetch(`/api/admin/crm/omnichannel/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: simChannel,
          externalContactId: simContactId,
          contactName: simName,
          content: simMessage,
          referral: {
            source_type: "ad",
            source_id: "ad_fb_" + Math.floor(Math.random() * 900000 + 100000),
            headline: simAdHeadline,
            body: "Campagne Meta Ads ANEI Inclusion & AVS 2026",
            ctwa_clid: "ctwa_" + Math.random().toString(36).substring(2, 10),
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowSimulateModal(false);
        await loadThreads();
        setSelectedThreadId(data.threadId);
      }
    } catch (err) {
      console.error("Simulation failed", err);
    } finally {
      setSimulating(false);
    }
  };

  const stageBadgeStyle = (stage: string) => {
    switch (stage) {
      case "NEW_AD_LEAD":
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      case "QUALIFIED":
        return "bg-blue-50 text-blue-700 border-blue-200/80";
      case "INTERESTED_IN_COURSE":
      case "BOOKING_AVS_SPECIALIST":
        return "bg-purple-50 text-purple-700 border-purple-200/80";
      case "CONVERTED_PAID":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const channelIcon = (ch: OmnichannelChannel) => {
    if (ch === "WHATSAPP") return <span className="text-emerald-600 font-semibold text-xs">WhatsApp</span>;
    if (ch === "INSTAGRAM") return <span className="text-pink-600 font-semibold text-xs">Instagram</span>;
    return <span className="text-blue-600 font-semibold text-xs">Messenger</span>;
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-[820px]">
      {/* Top action bar */}
      <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
            Omnicanal CRM
          </span>
          <span className="text-xs text-slate-500">
            {ar
              ? "الربط المباشر مع Meta Ads (WhatsApp, Instagram, Messenger)"
              : "Synchronisation temps réel Meta Graph API & Meta Ads"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSimulateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Target className="w-3.5 h-3.5 text-amber-500" />
            {ar ? "محاكاة وصول عميل من إعلان Meta" : "Simuler Lead Meta Ads"}
          </button>
          <button
            type="button"
            onClick={loadThreads}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 transition-colors"
            title={ar ? "تحديث" : "Actualiser"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================= */}
        {/* COLONNE 1 : Liste des conversations & Filtres             */}
        {/* ========================================================= */}
        <div className="w-80 md:w-96 border-e border-slate-200/80 flex flex-col bg-slate-50/30">
          {/* Channel Selector Tabs */}
          <div className="p-3 border-b border-slate-200/60 bg-white flex gap-1">
            {(["ALL", "WHATSAPP", "INSTAGRAM", "MESSENGER"] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors text-center ${
                  channel === ch
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {ch === "ALL" ? (ar ? "الكل" : "Tous") : ch === "WHATSAPP" ? "WhatsApp" : ch === "INSTAGRAM" ? "Instagram" : "Messenger"}
              </button>
            ))}
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 border-b border-slate-200/60 flex items-center gap-1 overflow-x-auto text-xs bg-slate-50">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                filter === "all" ? "bg-white text-slate-900 border border-slate-300 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {ar ? "الكل" : "Tous"}
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                filter === "unread" ? "bg-white text-slate-900 border border-slate-300 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {ar ? "غير مقروءة" : "Non lus"}
            </button>
            <button
              type="button"
              onClick={() => setFilter("meta_ads")}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors flex items-center gap-1 ${
                filter === "meta_ads" ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-xs font-semibold" : "text-amber-800 hover:text-amber-900"
              }`}
            >
              <Target className="w-3 h-3 text-amber-600" />
              {ar ? "إعلانات Meta" : "Meta Ads"}
            </button>
            <button
              type="button"
              onClick={() => setFilter("registered_users")}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                filter === "registered_users" ? "bg-white text-slate-900 border border-slate-300 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {ar ? "المسجلون" : "Inscrits"}
            </button>
          </div>

          {/* Search bar */}
          <div className="p-3 border-b border-slate-200/60 bg-white">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={ar ? "بحث بالاسم، الهاتف، الإعلان…" : "Recherche contact, téléphone, pub…"}
                className="w-full text-xs bg-slate-100/70 border border-slate-200 rounded-lg ps-3 pe-8 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingThreads ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {ar ? "جار التحميل…" : "Chargement des discussions…"}
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                {ar ? "لا توجد محادثات مطابقة." : "Aucune conversation correspondante."}
              </div>
            ) : (
              threads.map((t) => {
                const isSelected = t.id === selectedThreadId;
                const isMetaLead = t.sourceType !== "ORGANIC";
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-teal-50/50 border-s-4 border-teal-600"
                        : "hover:bg-slate-100/60 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <strong className="text-xs font-bold text-slate-900 truncate">
                          {t.contactName || t.externalContactId}
                        </strong>
                        {t.unreadCount > 0 && (
                          <span className="w-2 h-2 rounded-full bg-teal-600 inline-block shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(t.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1.5">
                      {channelIcon(t.channel)}
                      {isMetaLead && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                          <Target className="w-2.5 h-2.5 inline me-1 text-amber-600" />
                          {t.adHeadline ? t.adHeadline.slice(0, 24) + "…" : "Meta Ad"}
                        </span>
                      )}
                      {t.linkedUserId && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-2.5 h-2.5 inline me-1" />
                          Compte ANEI
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-1">
                      {t.lastMessageDirection === "OUTBOUND" ? "Vous: " : ""}
                      {t.lastMessagePreview || "—"}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLONNE 2 : Fil de discussion Temps Réel                  */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col bg-white border-e border-slate-200/80">
          {!detail ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-xs">
              <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              {ar ? "اختر محادثة لعرض تفاصيلها والرد عليها" : "Sélectionnez une discussion pour afficher et répondre"}
            </div>
          ) : (
            <>
              {/* Top conversation header */}
              <div className="px-5 py-3 border-b border-slate-200/80 bg-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">
                      {detail.thread.contactName || detail.thread.externalContactId}
                    </h2>
                    {channelIcon(detail.thread.channel)}
                    <span className="text-xs text-slate-400 font-mono">
                      {detail.thread.externalContactId}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${stageBadgeStyle(detail.thread.pipelineStage)}`}>
                    {detail.thread.pipelineStage}
                  </span>
                </div>
              </div>

              {/* Meta Ads Referral Context Banner */}
              {detail.thread.sourceType !== "ORGANIC" && (
                <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2.5 flex items-start gap-3">
                  <Target className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-amber-950 font-bold">
                        {ar ? "وارد من إعلان Meta Ads :" : "Prospect acquis via Meta Ads :"}
                      </strong>
                      <span className="font-semibold text-amber-900">
                        {detail.thread.adHeadline || "Campagne ANEI"}
                      </span>
                      {detail.thread.adId && (
                        <span className="text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded font-mono">
                          Ad ID: {detail.thread.adId}
                        </span>
                      )}
                      {detail.thread.ctwaClid && (
                        <span className="text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded font-mono">
                          CTWA: {detail.thread.ctwaClid}
                        </span>
                      )}
                    </div>
                    {detail.thread.adBody && (
                      <p className="text-amber-800/90 mt-0.5 text-[11px] italic">
                        &quot;{detail.thread.adBody}&quot;
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Messages scroll area */}
              <div className="flex-1 p-5 overflow-y-auto space-y-3.5 bg-slate-50/40">
                {detail.messages.map((m) => {
                  const isOutbound = m.direction === "OUTBOUND";
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isOutbound
                            ? "bg-teal-700 text-white rounded-br-xs"
                            : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400">
                        <span>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isOutbound && (
                          <span
                            className={
                              m.deliveryStatus === "READ"
                                ? "text-blue-500 font-bold inline-flex items-center"
                                : "text-slate-400 inline-flex items-center"
                            }
                            title={m.deliveryStatus}
                          >
                            <CheckCheck className="w-3.5 h-3.5 inline" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reply Templates */}
              <div className="px-4 py-2 border-t border-slate-200/60 bg-white flex items-center gap-1.5 overflow-x-auto text-xs">
                <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                  {ar ? "ردود سريعة :" : "Réponses rapides :"}
                </span>
                {QUICK_REPLIES.map((qr, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendReply(ar ? qr.textAr : qr.textFr)}
                    className="shrink-0 px-2.5 py-1 rounded-md text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                  >
                    {ar ? qr.titleAr : qr.titleFr}
                  </button>
                ))}
              </div>

              {/* Direct Reply Composer */}
              <div className="p-3 border-t border-slate-200/80 bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendReply();
                  }}
                  className="flex gap-2"
                >
                  <textarea
                    rows={2}
                    value={draftReply}
                    onChange={(e) => setDraftReply(e.target.value)}
                    placeholder={
                      ar
                        ? "اكتب رداً مباشراً إلى هذا العميل…"
                        : "Rédigez une réponse directe à ce contact…"
                    }
                    className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl resize-none focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !draftReply.trim()}
                    className="self-end px-4 py-2.5 rounded-xl text-xs font-semibold bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 transition-colors shadow-xs"
                  >
                    {sendingReply ? (ar ? "إرسال…" : "Envoi…") : (ar ? "إرسال" : "Envoyer")}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* ========================================================= */}
        {/* COLONNE 3 : Fiche Prospect 360° & Actions Rapides         */}
        {/* ========================================================= */}
        <div className="w-80 md:w-88 flex flex-col bg-slate-50/50 overflow-y-auto p-4 space-y-4">
          {!detail ? (
            <div className="text-xs text-slate-400 text-center py-10">
              {ar ? "لا توجد معلومات محددة" : "Aucun contact sélectionné"}
            </div>
          ) : (
            <>
              {/* Pipeline Stage Controller */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 mb-2">
                  {ar ? "مرحلة مسار العميل (Pipeline)" : "Étape du Pipeline CRM"}
                </h3>
                <select
                  value={detail.thread.pipelineStage}
                  onChange={(e) => handleStageChange(e.target.value as OmnichannelPipelineStage)}
                  className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="NEW_AD_LEAD">1. Nouveau Lead Pub (NEW_AD_LEAD)</option>
                  <option value="QUALIFIED">2. Qualifié / Contact Établi (QUALIFIED)</option>
                  <option value="INTERESTED_IN_COURSE">3. Intéressé par une Formation</option>
                  <option value="BOOKING_AVS_SPECIALIST">4. RDV AVS / Spécialiste Demandé</option>
                  <option value="CONVERTED_PAID">5. Converti & Payé (CONVERTED_PAID)</option>
                  <option value="ARCHIVED">6. Archivé / Sans Suite</option>
                </select>
              </div>

              {/* Linked User Status */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 mb-2 flex items-center justify-between">
                  <span>{ar ? "حساب ANEI المرتبط" : "Compte ANEI Associé"}</span>
                  {detail.linkedUserDetail ? (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Lié
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Non lié</span>
                  )}
                </h3>

                {detail.linkedUserDetail ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <strong className="block text-slate-800">
                        {detail.linkedUserDetail.user.name}
                      </strong>
                      <span className="text-slate-500 text-[11px]">
                        {detail.linkedUserDetail.user.email}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Rôle:</span>
                      <strong className="text-slate-700">{detail.linkedUserDetail.user.role}</strong>
                    </div>

                    {/* Courses */}
                    {detail.linkedUserDetail.enrollments.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                          Formations en cours ({detail.linkedUserDetail.enrollments.length})
                        </span>
                        {detail.linkedUserDetail.enrollments.map((enr, i) => (
                          <div key={i} className="text-[11px] text-slate-700 truncate">
                            • {enr.courseTitle} ({enr.progressPercent}%)
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bookings */}
                    {detail.linkedUserDetail.bookings.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                          Rendez-vous ({detail.linkedUserDetail.bookings.length})
                        </span>
                        {detail.linkedUserDetail.bookings.map((b, i) => (
                          <div key={i} className="text-[11px] text-slate-700">
                            • {b.meetingType || "Séance"} — {b.status}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2">
                      <Link
                        href={`/${locale}/admin/users/${detail.linkedUserDetail.user.id}`}
                        className="text-teal-700 hover:underline text-[11px] font-semibold"
                      >
                        {ar ? "عرض ملف المستخدم الكامل ←" : "Consulter le profil complet →"}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">
                      {ar
                        ? "يمكنك ربط هذه المحادثة بمعرف مستخدم ANEI (UUID)."
                        : "Liez cette conversation à un compte utilisateur ANEI via son identifiant (UUID)."}
                    </p>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={linkUserId}
                        onChange={(e) => setLinkUserId(e.target.value)}
                        placeholder="UUID utilisateur..."
                        className="flex-1 text-xs p-1.5 border border-slate-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleLinkUser}
                        disabled={linkingUser || !linkUserId.trim()}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white disabled:opacity-50"
                      >
                        {linkingUser ? "…" : "Lier"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Internal Notes */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 mb-2">
                  {ar ? "ملاحظات الفريق الداخلية" : "Notes Internes d'Équipe"}
                </h3>
                <textarea
                  rows={4}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder={
                    ar
                      ? "أضف ملاحظة سرية للفريق حول هذا العميل…"
                      : "Note confidentielle pour l'équipe commerciale et académique…"
                  }
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg resize-none mb-2 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                >
                  {savingNotes ? (ar ? "حفظ…" : "Enregistrement…") : (ar ? "حفظ الملاحظة" : "Enregistrer la note")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal: Simuler Lead Meta Ads */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-500" />
              {ar ? "محاكاة وصول عميل من إعلان Meta Ads" : "Simuler un Lead Meta Ads"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {ar
                ? "اختبر خط أنابيب التحويل وتعيين الإعلانات تلقائياً."
                : "Injectez un événement webhook simulé pour tester l'attribution Meta Ads et le pipeline CRM."}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Canal Meta</label>
                <select
                  value={simChannel}
                  onChange={(e) => setSimChannel(e.target.value as OmnichannelChannel)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                >
                  <option value="WHATSAPP">WhatsApp Cloud API (Click-to-WhatsApp)</option>
                  <option value="INSTAGRAM">Instagram Direct Messaging</option>
                  <option value="MESSENGER">Facebook Messenger Ads</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom du contact</label>
                <input
                  type="text"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Identifiant contact (E.164 ou Scoped ID)
                </label>
                <input
                  type="text"
                  value={simContactId}
                  onChange={(e) => setSimContactId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Titre de la publicité Meta (Ad Headline)
                </label>
                <input
                  type="text"
                  value={simAdHeadline}
                  onChange={(e) => setSimAdHeadline(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message initial</label>
                <textarea
                  rows={2}
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg resize-none"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSimulateLead}
                disabled={simulating}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {simulating ? "Création en cours…" : "Créer le Lead Simulé"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
