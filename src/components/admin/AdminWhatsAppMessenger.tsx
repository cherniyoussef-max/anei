"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import { AdminWhatsAppAccountForm } from "./AdminWhatsAppAccountForm";

export type WhatsAppMessageItem = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  messageType: string;
  status: string;
  textPreview: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  providerMessageId: string | null;
  providerErrorMessage: string | null;
  toPhone: string | null;
  fromPhone: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  createdAt: string;
};

export type ConversationSummary = {
  peerPhone: string;
  displayPhone: string;
  contactName: string;
  contactEmail: string | null;
  persona: string | null;
  userRole: string | null;
  contactId: string | null;
  userId: string | null;
  lastMessage: {
    text: string;
    direction: "INBOUND" | "OUTBOUND";
    status: string;
    createdAt: string;
    messageType: string;
  } | null;
  unreadCount: number;
  totalMessages: number;
};

export type DirectoryContact = {
  phone: string;
  displayPhone: string;
  name: string;
  email: string | null;
  persona: string | null;
  role: string | null;
  contactId: string | null;
  userId: string | null;
  source: "user" | "crm";
};

export type TemplateItem = {
  id: string;
  name: string;
  language: string;
  status: string;
  parameterCount: number;
};

export function AdminWhatsAppMessenger({
  organizationId,
  locale,
  initialConversations,
  initialDirectory,
  templates,
  account,
  metaConfigured,
}: {
  organizationId: string;
  locale: Locale;
  initialConversations: ConversationSummary[];
  initialDirectory: DirectoryContact[];
  templates: TemplateItem[];
  account: {
    phoneNumberId: string;
    businessAccountId: string;
    displayPhoneNumber: string | null;
    status: string;
  } | null;
  metaConfigured: boolean;
}) {
  const ar = locale === "ar";
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [directory, setDirectory] = useState<DirectoryContact[]>(initialDirectory);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"conversations" | "directory">("conversations");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(
    initialConversations[0]?.peerPhone ?? initialDirectory[0]?.phone ?? null,
  );

  const [messages, setMessages] = useState<WhatsAppMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [outboundText, setOutboundText] = useState("");
  const [sending, setSending] = useState(false);
  const [showConfig, setShowConfig] = useState(!account || !metaConfigured);
  const [showSimulateBar, setShowSimulateBar] = useState(false);
  const [simulateText, setSimulateText] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);

  const [conversationFilter, setConversationFilter] = useState<"all" | "unread">("all");
  const [directoryFilter, setDirectoryFilter] = useState<string>("all");

  const unreadTotal = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount > 0 ? 1 : 0), 0),
    [conversations],
  );

  const quickReplies = useMemo(() => {
    return ar
      ? [
          { label: "👋 ترحيب", text: "مرحباً بك في أكاديمية ANEI! كيف يمكننا مساعدتك اليوم؟" },
          { label: "📅 موعد", text: "تم تأكيد موعدك بنجاح. نحن في انتظارك في الوقت المحدد." },
          { label: "💳 دفع", text: "تم تأكيد عملية الدفع بنجاح. دورتك التدريبية متاحة الآن." },
          { label: "⏳ متابعة", text: "طلبك قيد المعالجة وسنوافيك بالرد خلال لحظات." },
        ]
      : [
          { label: "👋 Bienvenue", text: "Bonjour et bienvenue sur l’Académie ANEI ! Comment pouvons-nous vous aider aujourd’hui ?" },
          { label: "📅 RDV confirmé", text: "Votre rendez-vous a bien été confirmé. Nous restons à votre entière disposition." },
          { label: "💳 Paiement validé", text: "Votre paiement a été validé avec succès. Votre formation est disponible dès maintenant." },
          { label: "⏳ En cours", text: "Votre demande est en cours de traitement par notre équipe. Merci de votre patience." },
        ];
  }, [ar]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active contact details
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.peerPhone === selectedPhone) ?? null;
  }, [conversations, selectedPhone]);

  const activeDirectoryContact = useMemo(() => {
    return directory.find((d) => d.phone === selectedPhone) ?? null;
  }, [directory, selectedPhone]);

  const activeName = activeConversation?.contactName || activeDirectoryContact?.name || selectedPhone || "";
  const activeDisplayPhone = activeConversation?.displayPhone || activeDirectoryContact?.displayPhone || (selectedPhone ? `+${selectedPhone}` : "");
  const activePersona = activeConversation?.persona || activeDirectoryContact?.persona;

  // Filtered lists
  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (conversationFilter === "unread") {
      list = list.filter((c) => c.unreadCount > 0);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (c) =>
        c.contactName.toLowerCase().includes(q) ||
        c.peerPhone.includes(q) ||
        (c.lastMessage?.text && c.lastMessage.text.toLowerCase().includes(q)),
    );
  }, [conversations, searchQuery, conversationFilter]);

  const filteredDirectory = useMemo(() => {
    let list = directory;
    if (directoryFilter !== "all") {
      if (directoryFilter === "crm") {
        list = list.filter((d) => d.source === "crm");
      } else {
        list = list.filter(
          (d) =>
            d.persona?.toUpperCase() === directoryFilter ||
            d.role?.toUpperCase() === directoryFilter,
        );
      }
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.phone.includes(q) ||
        (d.email && d.email.toLowerCase().includes(q)),
    );
  }, [directory, searchQuery, directoryFilter]);

  function handleSelectPhone(phone: string) {
    setSelectedPhone(phone);
    setMessages([]);
  }

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedPhone) return;
    let cancelled = false;
    async function fetchMessages() {
      setLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/admin/crm/whatsapp/conversations/${encodeURIComponent(selectedPhone!)}?organizationId=${organizationId}`,
        );
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { messages: WhatsAppMessageItem[] };
          setMessages(data.messages);
        }
      } catch {
        // Non-blocking
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }
    fetchMessages();
    return () => {
      cancelled = true;
    };
  }, [selectedPhone, organizationId]);

  // Live auto-polling every 4 seconds for real-time customer replies
  useEffect(() => {
    if (!selectedPhone) return;
    const interval = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(
          `/api/admin/crm/whatsapp/conversations/${encodeURIComponent(selectedPhone)}?organizationId=${organizationId}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { messages: WhatsAppMessageItem[] };
          setMessages((prev) => {
            if (
              prev.length !== data.messages.length ||
              (data.messages.length > 0 &&
                prev[prev.length - 1]?.id !== data.messages[data.messages.length - 1]?.id)
            ) {
              return data.messages;
            }
            return prev;
          });
        }
      } catch {
        // Non-blocking background sync
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedPhone, organizationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send direct text message
  async function handleSendText(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedPhone || !outboundText.trim() || sending) return;

    const textToSend = outboundText.trim();
    setSending(true);

    try {
      const res = await fetch("/api/admin/crm/whatsapp/send-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          toPhone: selectedPhone,
          text: textToSend,
          contactId: activeConversation?.contactId ?? activeDirectoryContact?.contactId ?? undefined,
        }),
      });

      if (res.ok) {
        setOutboundText("");
        // Optimistically append message
        const optimisticMsg: WhatsAppMessageItem = {
          id: `opt_${Date.now()}`,
          direction: "OUTBOUND",
          messageType: "TEXT",
          status: metaConfigured ? "SENT" : "DELIVERED",
          textPreview: textToSend,
          templateName: null,
          templateLanguage: null,
          providerMessageId: null,
          providerErrorMessage: null,
          toPhone: selectedPhone,
          fromPhone: null,
          sentAt: new Date().toISOString(),
          deliveredAt: metaConfigured ? null : new Date().toISOString(),
          readAt: null,
          failedAt: null,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        // Refresh conversation preview
        refreshConversations();
      }
    } catch {
      // Handled gracefully
    } finally {
      setSending(false);
    }
  }

  // Simulate customer inbound message
  async function handleSimulateInbound(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedPhone || !simulateText.trim() || simulating) return;

    setSimulating(true);
    try {
      const res = await fetch("/api/admin/crm/whatsapp/simulate-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          fromPhone: selectedPhone,
          text: simulateText.trim(),
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { message: WhatsAppMessageItem };
        setMessages((prev) => [...prev, data.message]);
        setSimulateText("");
        setShowSimulateBar(false);
        refreshConversations();
      }
    } catch {
      // Handled
    } finally {
      setSimulating(false);
    }
  }

  // Refresh conversation list from backend
  async function refreshConversations() {
    try {
      const res = await fetch(
        `/api/admin/crm/whatsapp/conversations?organizationId=${organizationId}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          conversations: ConversationSummary[];
          directory: DirectoryContact[];
        };
        setConversations(data.conversations);
        setDirectory(data.directory);
      }
    } catch {
      // Non-blocking
    }
  }

  // Send approved template message
  async function handleSendTemplate() {
    if (!selectedPhone || !selectedTemplateId) return;
    const approvedTpl = templates.find((t) => t.id === selectedTemplateId);
    if (!approvedTpl) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/crm/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          contactId: activeConversation?.contactId ?? activeDirectoryContact?.contactId,
          templateId: approvedTpl.name,
          language: approvedTpl.language,
          parameters: templateParams,
        }),
      });
      if (res.ok) {
        setShowTemplateModal(false);
        setTemplateParams([]);
        router.refresh();
        refreshConversations();
      }
    } catch {
      // Handled
    } finally {
      setSending(false);
    }
  }

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/whatsapp` : "/api/webhooks/whatsapp";
  const verifyToken = "anei_verify_token_default";

  function copyText(text: string, isToken = false) {
    navigator.clipboard.writeText(text);
    if (isToken) {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  }

  return (
    <div className="admin-whatsapp-workspace">
      {/* Top Banner: Status & Meta Cloud API Credentials Quick-Setup */}
      <div className="admin-whatsapp-top-banner">
        <div className="admin-whatsapp-status-left">
          <div className="admin-whatsapp-pill">
            <span className={`admin-status-dot ${metaConfigured ? "is-live" : "is-simulation"}`} />
            <strong>
              {metaConfigured
                ? (ar ? "Meta Cloud API متصلة ومباشرة" : "Meta Cloud API Connectée (Live)")
                : (ar ? "وضع المحاكاة جاهز (في انتظار مفاتيح Meta)" : "Mode Simulation Prêt (En attente des clés Meta)")}
            </strong>
          </div>
          <span className="admin-whatsapp-subinfo">
            {ar
              ? "يمكنك المحادثة وإرسال الرسائل فوراً. بمجرد إدخال مفاتيح Meta، تعمل فورياً مع واتساب الرسمي."
              : "Discutez et testez dès maintenant. Dès saisie de vos clés Meta dans .env, tout bascule en direct."}
          </span>
        </div>
        <div className="admin-whatsapp-actions-right">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Icon name="spark" size={15} />
            {showConfig ? (ar ? "إخفاء الإعدادات" : "Masquer configuration") : (ar ? "إعدادات Meta & Webhook" : "Paramètres Meta & Webhook")}
          </button>
        </div>
      </div>

      {/* Collapsible Meta & Webhook Panel */}
      {showConfig && (
        <section className="admin-surface admin-whatsapp-meta-panel">
          <div className="admin-whatsapp-meta-grid">
            <div className="admin-meta-info-card">
              <h4>{ar ? "رابط Webhook الرسمي لـ Meta" : "URL du Webhook Meta"}</h4>
              <p className="small-muted">
                {ar
                  ? "انسخ هذا الرابط والصقه في لوحة مطوري فيسبوك (Meta for Developers > WhatsApp > Configuration)."
                  : "Copiez cette URL dans le tableau de bord Meta for Developers (WhatsApp > Configuration du Webhook)."}
              </p>
              <div className="admin-copy-field">
                <code>{webhookUrl}</code>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => copyText(webhookUrl, false)}
                >
                  {copiedWebhook ? (ar ? "تم النسخ ✓" : "Copié ✓") : (ar ? "نسخ" : "Copier")}
                </button>
              </div>

              <h4 style={{ marginTop: 16 }}>{ar ? "رمز التحقق (Verify Token)" : "Jeton de vérification (Verify Token)"}</h4>
              <div className="admin-copy-field">
                <code>{verifyToken}</code>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => copyText(verifyToken, true)}
                >
                  {copiedToken ? (ar ? "تم النسخ ✓" : "Copié ✓") : (ar ? "نسخ" : "Copier")}
                </button>
              </div>
            </div>

            <div className="admin-meta-account-card">
              <h4>{ar ? "معرفات الحساب التجاري" : "Identifiants du compte Meta"}</h4>
              <AdminWhatsAppAccountForm
                organizationId={organizationId}
                locale={locale}
                account={account}
              />
            </div>
          </div>
        </section>
      )}

      {/* Main Two-Pane Messenger Layout */}
      <div className="admin-whatsapp-messenger-layout">
        {/* Left Pane: Conversations & Directory */}
        <aside className="admin-whatsapp-sidebar-pane">
          {/* Header & Search */}
          <div className="admin-whatsapp-sidebar-header">
            <div className="admin-whatsapp-search-box">
              <Icon name="search" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={ar ? "بحث بالاسم أو الرقم..." : "Rechercher par nom ou numéro..."}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear">
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>

            {/* Segmented Tab Switch */}
            <div className="admin-whatsapp-tabs-pill">
              <button
                type="button"
                className={activeTab === "conversations" ? "is-active" : ""}
                onClick={() => setActiveTab("conversations")}
              >
                {ar ? `المحادثات (${conversations.length})` : `Discussions (${conversations.length})`}
              </button>
              <button
                type="button"
                className={activeTab === "directory" ? "is-active" : ""}
                onClick={() => setActiveTab("directory")}
              >
                {ar ? `دليل الأرقام (${directory.length})` : `Annuaire (${directory.length})`}
              </button>
            </div>

            {/* Sub-filters */}
            <div className="admin-whatsapp-subfilter-bar">
              {activeTab === "conversations" ? (
                <>
                  <button
                    type="button"
                    className={`admin-subfilter-chip ${conversationFilter === "all" ? "is-active" : ""}`}
                    onClick={() => setConversationFilter("all")}
                  >
                    {ar ? "الكل" : "Toutes"}
                  </button>
                  <button
                    type="button"
                    className={`admin-subfilter-chip ${conversationFilter === "unread" ? "is-active" : ""}`}
                    onClick={() => setConversationFilter("unread")}
                  >
                    {ar ? "غير مقروءة" : "Non lues"}
                    {unreadTotal > 0 && <span className="chip-badge">{unreadTotal}</span>}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`admin-subfilter-chip ${directoryFilter === "all" ? "is-active" : ""}`}
                    onClick={() => setDirectoryFilter("all")}
                  >
                    {ar ? "الكل" : "Tous"}
                  </button>
                  <button
                    type="button"
                    className={`admin-subfilter-chip ${directoryFilter === "STUDENT" ? "is-active" : ""}`}
                    onClick={() => setDirectoryFilter("STUDENT")}
                  >
                    {ar ? "الطلاب" : "Apprenants"}
                  </button>
                  <button
                    type="button"
                    className={`admin-subfilter-chip ${directoryFilter === "TEACHER" ? "is-active" : ""}`}
                    onClick={() => setDirectoryFilter("TEACHER")}
                  >
                    {ar ? "المدرسون" : "Formateurs"}
                  </button>
                  <button
                    type="button"
                    className={`admin-subfilter-chip ${directoryFilter === "AVS" ? "is-active" : ""}`}
                    onClick={() => setDirectoryFilter("AVS")}
                  >
                    AVS
                  </button>
                  <button
                    type="button"
                    className={`admin-subfilter-chip ${directoryFilter === "crm" ? "is-active" : ""}`}
                    onClick={() => setDirectoryFilter("crm")}
                  >
                    CRM
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Conversation / Contact List */}
          <div className="admin-whatsapp-items-list">
            {activeTab === "conversations" ? (
              filteredConversations.length ? (
                filteredConversations.map((c) => {
                  const isSelected = selectedPhone === c.peerPhone;
                  return (
                    <button
                      type="button"
                      key={c.peerPhone}
                      className={`admin-whatsapp-item ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleSelectPhone(c.peerPhone)}
                    >
                      <div className="admin-whatsapp-avatar">
                        {c.contactName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="admin-whatsapp-item-body">
                        <div className="admin-whatsapp-item-top">
                          <strong className="admin-whatsapp-name">{c.contactName}</strong>
                          {c.lastMessage && (
                            <span className="admin-whatsapp-time">
                              {new Date(c.lastMessage.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                        <div className="admin-whatsapp-item-sub">
                          <span className="admin-whatsapp-preview">
                            {c.lastMessage?.direction === "OUTBOUND" ? (
                              <span className="admin-outbound-check">✓ </span>
                            ) : null}
                            {c.lastMessage?.text || c.displayPhone}
                          </span>
                          {c.unreadCount > 0 && (
                            <span className="admin-whatsapp-badge">{c.unreadCount}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="admin-empty-state">
                  <p>{ar ? "لا توجد محادثات." : "Aucune discussion trouvée."}</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab("directory")}
                  >
                    {ar ? "تصفح دليل الأرقام" : "Parcourir l’annuaire des utilisateurs"}
                  </button>
                </div>
              )
            ) : (
              filteredDirectory.length ? (
                filteredDirectory.map((d) => {
                  const isSelected = selectedPhone === d.phone;
                  return (
                    <button
                      type="button"
                      key={d.phone}
                      className={`admin-whatsapp-item ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleSelectPhone(d.phone)}
                    >
                      <div className="admin-whatsapp-avatar">
                        {d.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="admin-whatsapp-item-body">
                        <div className="admin-whatsapp-item-top">
                          <strong className="admin-whatsapp-name">{d.name}</strong>
                          {d.persona && (
                            <span className="admin-whatsapp-persona-tag">{d.persona}</span>
                          )}
                        </div>
                        <div className="admin-whatsapp-item-sub">
                          <span className="admin-whatsapp-preview">{d.displayPhone}</span>
                          <span className="admin-source-tag">{d.source === "user" ? "Utilisateur" : "Contact CRM"}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="admin-empty-state">
                  <p>{ar ? "لم يتم العثور على أرقام." : "Aucun numéro trouvé."}</p>
                </div>
              )
            )}
          </div>
        </aside>

        {/* Right Pane: Live Chat Conversation */}
        <main className="admin-whatsapp-chat-pane">
          {selectedPhone ? (
            <>
              {/* Active Conversation Header */}
              <div className="admin-whatsapp-chat-header">
                <div className="admin-whatsapp-chat-header-user">
                  <div className="admin-whatsapp-avatar is-large">
                    {activeName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="admin-chat-header-title">
                      <h3>{activeName}</h3>
                      {activePersona && (
                        <span className="admin-whatsapp-persona-tag">{activePersona}</span>
                      )}
                    </div>
                    <span className="admin-chat-header-phone">{activeDisplayPhone}</span>
                  </div>
                </div>

                <div className="admin-whatsapp-chat-header-actions">
                  {activeConversation?.contactId ? (
                    <Link
                      href={`/${locale}/admin/crm/${organizationId}/contacts/${activeConversation.contactId}`}
                      className="btn btn-ghost btn-sm"
                      target="_blank"
                    >
                      <Icon name="users" size={15} />
                      {ar ? "ملف CRM" : "Fiche CRM"}
                    </Link>
                  ) : null}

                  {activeConversation?.userId || activeDirectoryContact?.userId ? (
                    <Link
                      href={`/${locale}/admin/users/${activeConversation?.userId || activeDirectoryContact?.userId}`}
                      className="btn btn-ghost btn-sm"
                      target="_blank"
                    >
                      <Icon name="user" size={15} />
                      {ar ? "حساب المستخدم" : "Compte"}
                    </Link>
                  ) : null}

                  <a
                    href={`https://wa.me/${selectedPhone}`}
                    className="btn btn-ghost btn-sm"
                    target="_blank"
                    rel="noopener noreferrer"
                    title={ar ? "فتح المحادثة في تطبيق واتساب الرسمي" : "Ouvrir dans WhatsApp Web"}
                  >
                    <Icon name="phone" size={14} />
                    {ar ? "واتساب ويب ↗" : "WhatsApp Web ↗"}
                  </a>

                  <button
                    type="button"
                    className={`btn btn-sm ${showContactInfo ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setShowContactInfo(!showContactInfo)}
                    title={ar ? "معلومات جهة الاتصال" : "Détails du contact"}
                  >
                    <Icon name="user" size={14} />
                    {ar ? "معلومات" : "Infos"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowSimulateBar(!showSimulateBar)}
                    title={ar ? "محاكاة وصول رد من هذا العميل" : "Simuler la réception d'un message client"}
                  >
                    🧪 {ar ? "محاكاة رد" : "Simuler réponse"}
                  </button>
                </div>
              </div>

              {/* Inbound Message Simulation Bar */}
              {showSimulateBar && (
                <div className="admin-whatsapp-simulate-bar">
                  <span>📥 <strong>{ar ? "محاكاة رسالة واردة من الزبون" : "Simulateur message entrant (Client -> ANEI)"} :</strong></span>
                  <input
                    type="text"
                    value={simulateText}
                    onChange={(e) => setSimulateText(e.target.value)}
                    placeholder={ar ? "اكتب رداً لاختباره وكأنه وارد من الزبون..." : "Tapez le texte reçu du client pour tester le flux..."}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSimulateInbound();
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={simulating || !simulateText.trim()}
                    onClick={handleSimulateInbound}
                  >
                    {simulating ? "..." : (ar ? "محاكاة الاستلام" : "Simuler la réception")}
                  </button>
                </div>
              )}

              {/* Messages Stream & Optional Contact Inspector */}
              <div className="admin-whatsapp-chat-main-area">
                <div className="admin-whatsapp-messages-stream">
                  {loadingMessages ? (
                    <div className="admin-whatsapp-loading">
                      <span>{ar ? "جارٍ تحميل الرسائل..." : "Chargement des messages..."}</span>
                    </div>
                  ) : messages.length ? (
                    messages.map((m) => {
                      const isOutbound = m.direction === "OUTBOUND";
                      return (
                        <div
                          key={m.id}
                          className={`admin-whatsapp-bubble-row ${isOutbound ? "is-outbound" : "is-inbound"}`}
                        >
                          <div className={`admin-whatsapp-bubble ${isOutbound ? "is-outbound" : "is-inbound"}`}>
                            {m.templateName && (
                              <div className="admin-whatsapp-bubble-template-tag">
                                📋 {ar ? "قالب:" : "Modèle :"} <strong>{m.templateName}</strong>
                              </div>
                            )}
                            <div className="admin-whatsapp-bubble-text">
                              {m.messageType === "audio" || m.messageType === "voice" ? (
                                <div className="admin-bubble-media-item">
                                  <span className="media-type-icon">🎙️</span>
                                  <span className="media-type-label">{m.textPreview || (ar ? "رسالة صوتية" : "Message vocal WhatsApp")}</span>
                                </div>
                              ) : m.messageType === "image" ? (
                                <div className="admin-bubble-media-item">
                                  <span className="media-type-icon">📷</span>
                                  <span className="media-type-label">{m.textPreview || (ar ? "صورة" : "Photo WhatsApp")}</span>
                                </div>
                              ) : m.messageType === "document" ? (
                                <div className="admin-bubble-media-item">
                                  <span className="media-type-icon">📄</span>
                                  <span className="media-type-label">{m.textPreview || (ar ? "مستند / وثيقة" : "Document PDF / Fichier")}</span>
                                </div>
                              ) : m.messageType === "video" ? (
                                <div className="admin-bubble-media-item">
                                  <span className="media-type-icon">🎥</span>
                                  <span className="media-type-label">{m.textPreview || (ar ? "مقطع فيديو" : "Vidéo")}</span>
                                </div>
                              ) : (
                                m.textPreview || (m.templateName ? `Modèle ${m.templateName}` : "—")
                              )}
                            </div>
                            <div className="admin-whatsapp-bubble-meta">
                              <span>
                                {new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isOutbound && (
                                <span
                                  className={`admin-whatsapp-bubble-status is-${m.status.toLowerCase()}`}
                                  title={m.providerErrorMessage || m.status}
                                >
                                  {m.status === "DELIVERED" || m.status === "READ" ? "✓✓" : m.status === "SENT" ? "✓" : m.status === "FAILED" ? "⚠️" : "⏳"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="admin-whatsapp-empty-chat">
                      <p>{ar ? "لا توجد رسائل مع هذا الرقم بعد." : "Aucun message avec ce numéro pour le moment."}</p>
                      <p className="small-muted">{ar ? "ابدأ بإرسال رسالة نصية أو قالب ترحيبي." : "Commencez par envoyer un message texte ou un modèle WhatsApp."}</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Contact Inspector Sidebar */}
                {showContactInfo && (
                  <aside className="admin-whatsapp-contact-inspector">
                    <div className="admin-inspector-header">
                      <h4>{ar ? "معلومات جهة الاتصال" : "Fiche contact"}</h4>
                      <button type="button" onClick={() => setShowContactInfo(false)} aria-label="Fermer">
                        <Icon name="close" size={14} />
                      </button>
                    </div>

                    <div className="admin-inspector-body">
                      <div className="admin-whatsapp-avatar is-large" style={{ margin: "0 auto 8px" }}>
                        {activeName.slice(0, 2).toUpperCase()}
                      </div>
                      <strong className="admin-inspector-name">{activeName}</strong>
                      {activePersona && (
                        <span className="admin-whatsapp-persona-tag" style={{ margin: "4px auto 14px", display: "inline-block" }}>
                          {activePersona}
                        </span>
                      )}

                      <div className="admin-inspector-card">
                        <div className="admin-inspector-field">
                          <span className="small-muted">{ar ? "رقم الواتساب" : "Numéro WhatsApp"}</span>
                          <div className="admin-inspector-phone-row">
                            <strong>{activeDisplayPhone}</strong>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => copyText(activeDisplayPhone, false)}
                              title={ar ? "نسخ الرقم" : "Copier"}
                            >
                              📋
                            </button>
                          </div>
                        </div>

                        {(activeConversation?.contactEmail || activeDirectoryContact?.email) && (
                          <div className="admin-inspector-field">
                            <span className="small-muted">{ar ? "البريد الإلكتروني" : "E-mail"}</span>
                            <a href={`mailto:${activeConversation?.contactEmail || activeDirectoryContact?.email}`} className="admin-inspector-email">
                              {activeConversation?.contactEmail || activeDirectoryContact?.email}
                            </a>
                          </div>
                        )}

                        <div className="admin-inspector-field">
                          <span className="small-muted">{ar ? "الرسائل في المحادثة" : "Messages dans le fil"}</span>
                          <span className="admin-inspector-count">{messages.length}</span>
                        </div>
                      </div>

                      <div className="admin-inspector-shortcuts">
                        <a
                          href={`https://wa.me/${selectedPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          <Icon name="phone" size={14} />
                          {ar ? "واتساب ويب" : "WhatsApp Web"}
                        </a>

                        {activeConversation?.contactId && (
                          <Link
                            href={`/${locale}/admin/crm/${organizationId}/contacts/${activeConversation.contactId}`}
                            target="_blank"
                            className="btn btn-ghost btn-sm"
                          >
                            <Icon name="users" size={14} />
                            {ar ? "فتح بطاقة CRM" : "Voir fiche CRM"}
                          </Link>
                        )}

                        {(activeConversation?.userId || activeDirectoryContact?.userId) && (
                          <Link
                            href={`/${locale}/admin/users/${activeConversation?.userId || activeDirectoryContact?.userId}`}
                            target="_blank"
                            className="btn btn-ghost btn-sm"
                          >
                            <Icon name="user" size={14} />
                            {ar ? "حساب المنصة" : "Voir compte"}
                          </Link>
                        )}
                      </div>
                    </div>
                  </aside>
                )}
              </div>

              {/* Chat Composer with Quick Replies */}
              <footer className="admin-whatsapp-composer">
                <div className="admin-whatsapp-quick-chips">
                  <span className="admin-chips-label">{ar ? "ردود سريعة:" : "Réponses rapides :"}</span>
                  {quickReplies.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="admin-whatsapp-chip"
                      onClick={() => setOutboundText(q.text)}
                      title={q.text}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendText} className="admin-whatsapp-composer-form">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm admin-whatsapp-template-btn"
                    onClick={() => setShowTemplateModal(true)}
                    title={ar ? "إرسال قالب رسمي" : "Envoyer un modèle WhatsApp"}
                  >
                    📋 {ar ? "قالب" : "Modèle"}
                  </button>
                  <input
                    type="text"
                    value={outboundText}
                    onChange={(e) => setOutboundText(e.target.value)}
                    placeholder={ar ? "اكتب رسالة واتساب..." : "Écrire un message WhatsApp..."}
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm admin-whatsapp-send-btn"
                    disabled={sending || !outboundText.trim()}
                  >
                    <Icon name="play" size={14} />
                    {sending ? (ar ? "..." : "Envoi...") : (ar ? "إرسال" : "Envoyer")}
                  </button>
                </form>
              </footer>
            </>
          ) : (
            <div className="admin-whatsapp-no-selection">
              <Icon name="phone" size={48} />
              <h3>{ar ? "مرحباً بك في واتساب CRM" : "Bienvenue sur WhatsApp CRM"}</h3>
              <p>
                {ar
                  ? "اختر محادثة من القائمة الجانبية أو ابحث عن رقم لبدء التواصل الفوري."
                  : "Sélectionnez une discussion à gauche ou démarrez un échange avec n’importe quel utilisateur."}
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowTemplateModal(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{ar ? "إرسال قالب رسمي معتمد" : "Envoyer un modèle WhatsApp approuvé"}</h3>
              <button type="button" onClick={() => setShowTemplateModal(false)}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <label>
                <span>{ar ? "اختر القالب" : "Choisir un modèle"}</span>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    const t = templates.find((tpl) => tpl.id === e.target.value);
                    setTemplateParams(new Array(t?.parameterCount ?? 0).fill(""));
                  }}
                >
                  <option value="">{ar ? "اختر قالباً..." : "Sélectionner un modèle..."}</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language}) — {t.status}
                    </option>
                  ))}
                </select>
              </label>

              {templateParams.map((p, idx) => (
                <label key={idx}>
                  <span>{ar ? `المتغير {{${idx + 1}}}` : `Variable {{${idx + 1}}}`}</span>
                  <input
                    type="text"
                    value={p}
                    onChange={(e) => {
                      const next = [...templateParams];
                      next[idx] = e.target.value;
                      setTemplateParams(next);
                    }}
                    placeholder={`Valeur pour {{${idx + 1}}}`}
                  />
                </label>
              ))}
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                disabled={sending || !selectedTemplateId}
                onClick={handleSendTemplate}
              >
                {sending ? (ar ? "جارٍ الإرسال..." : "Envoi en cours...") : (ar ? "إرسال القالب" : "Envoyer le modèle")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowTemplateModal(false)}
              >
                {ar ? "إلغاء" : "Annuler"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
