"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import type { SocialChannel } from "@/server/social/normalize";

export type SocialMessageItem = {
  id: string;
  channel: SocialChannel;
  direction: "INBOUND" | "OUTBOUND";
  status: string;
  textPreview: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  senderId: string;
  recipientId: string;
  senderName: string | null;
  senderUsername: string | null;
  providerMessageId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  createdAt: string;
};

export type SocialConversationSummary = {
  peerId: string;
  channel: SocialChannel;
  contactName: string;
  username: string | null;
  avatarUrl: string | null;
  contactId: string | null;
  userId: string | null;
  lastMessage: {
    text: string;
    direction: "INBOUND" | "OUTBOUND";
    status: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  totalMessages: number;
};

export function AdminSocialMessenger({
  organizationId,
  locale,
  initialChannel = "ALL",
  initialConversations,
  metaConfigured,
}: {
  organizationId: string;
  locale: Locale;
  initialChannel?: "INSTAGRAM" | "MESSENGER" | "ALL";
  initialConversations: SocialConversationSummary[];
  metaConfigured: {
    instagram: boolean;
    messenger: boolean;
  };
}) {
  const ar = locale === "ar";

  const [channelFilter, setChannelFilter] = useState<"INSTAGRAM" | "MESSENGER" | "ALL">(initialChannel);
  const [conversations, setConversations] = useState<SocialConversationSummary[]>(initialConversations);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(initialConversations[0]?.peerId ?? null);
  const [selectedChannel, setSelectedChannel] = useState<SocialChannel>(initialConversations[0]?.channel ?? "INSTAGRAM");

  const [messages, setMessages] = useState<SocialMessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simName, setSimName] = useState("Sarah Amari");
  const [simUsername, setSimUsername] = useState("sarah.amari");
  const [simText, setSimText] = useState("Bonjour ! J’aimerais avoir des informations sur les formations ANEI.");
  const [simChannel, setSimChannel] = useState<SocialChannel>("INSTAGRAM");
  const [simulating, setSimulating] = useState(false);

  const [showDrawer, setShowDrawer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick canned replies
  const CANNED_REPLIES = [
    {
      label: ar ? "👋 ترحيب" : "👋 Bienvenue",
      text: ar
        ? "مرحبًا بك في أكاديمية ANEI! كيف يمكننا مساعدتك اليوم؟"
        : "Bonjour et bienvenue chez ANEI Académie ! Comment pouvons-nous vous accompagner aujourd’hui ?",
    },
    {
      label: ar ? "📅 توجيه" : "📅 Orientation",
      text: ar
        ? "يسعدنا تحديد موعد جلسة توجيه مجانية معك لمناقشة مسارك التعليمي."
        : "Nous serions ravis de planifier une session d’orientation avec vous pour échanger sur vos objectifs.",
    },
    {
      label: ar ? "💳 تسجيل" : "💳 Inscription",
      text: ar
        ? "تم تأكيد طلبك وملفك قيد المعالجة من قبل فريقنا التربوي."
        : "Votre demande a bien été reçue. Notre équipe pédagogique valide actuellement votre accès.",
    },
    {
      label: ar ? "⏳ قيد المتابعة" : "⏳ En cours",
      text: ar
        ? "شكرًا لرسالتك! يقوم أحد مستشارينا بالرد عليك خلال لحظات."
        : "Merci pour votre message ! Un conseiller prend en charge votre demande dans un instant.",
    },
  ];

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (channelFilter !== "ALL" && c.channel !== channelFilter) return false;
      if (unreadOnly && c.unreadCount === 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.contactName.toLowerCase().includes(q);
        const matchesUsername = c.username?.toLowerCase().includes(q);
        const matchesText = c.lastMessage?.text.toLowerCase().includes(q);
        if (!matchesName && !matchesUsername && !matchesText) return false;
      }
      return true;
    });
  }, [conversations, channelFilter, unreadOnly, searchQuery]);

  const activeConversation = useMemo(() => {
    return (
      conversations.find((c) => c.peerId === selectedPeerId && c.channel === selectedChannel) ??
      filteredConversations[0] ??
      null
    );
  }, [conversations, selectedPeerId, selectedChannel, filteredConversations]);

  const activePeerId = activeConversation?.peerId ?? null;
  const activeChannel = activeConversation?.channel ?? "INSTAGRAM";

  // Load messages when selected thread changes
  useEffect(() => {
    if (!activePeerId) return;
    let cancelled = false;
    async function fetchMessages() {
      setMessagesLoading(true);
      try {
        const res = await fetch(
          `/api/admin/crm/social/conversations/${activeChannel}/${encodeURIComponent(activePeerId!)}?organizationId=${organizationId}`,
        );
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { messages: SocialMessageItem[] };
          if (Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        }
      } catch {
        // Non-blocking
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    }
    fetchMessages();
    return () => {
      cancelled = true;
    };
  }, [activePeerId, activeChannel, organizationId]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Background polling every 4s
  useEffect(() => {
    const timer = setInterval(() => {
      fetch(`/api/admin/crm/social/conversations?organizationId=${organizationId}&channel=${channelFilter}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.conversations)) {
            setConversations(data.conversations);
          }
        })
        .catch(() => {});

      if (activeConversation) {
        fetch(
          `/api/admin/crm/social/conversations/${activeConversation.channel}/${encodeURIComponent(activeConversation.peerId)}?organizationId=${organizationId}`,
        )
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data.messages)) {
              setMessages(data.messages);
            }
          })
          .catch(() => {});
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [organizationId, channelFilter, activeConversation]);

  // Send message handler
  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!draftText.trim() || !activePeerId || sending) return;

    setSending(true);
    setSendError(null);

    try {
      const res = await fetch("/api/admin/crm/social/send-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          channel: activeChannel,
          recipientId: activePeerId,
          text: draftText.trim(),
          contactId: activeConversation?.contactId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Échec de l’envoi");
      }

      setDraftText("");
      const newMsg: SocialMessageItem = {
        id: data.message?.id || String(Date.now()),
        channel: activeChannel,
        direction: "OUTBOUND",
        status: "DELIVERED",
        textPreview: draftText.trim(),
        mediaUrl: null,
        mediaType: null,
        senderId: "page",
        recipientId: activePeerId,
        senderName: "ANEI Académie",
        senderUsername: null,
        providerMessageId: data.message?.providerMessageId || null,
        sentAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
        readAt: null,
        failedAt: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erreur d’envoi");
    } finally {
      setSending(false);
    }
  }

  // Simulate inbound message
  async function handleSimulateInbound(e: React.FormEvent) {
    e.preventDefault();
    if (!simText.trim() || simulating) return;

    setSimulating(true);
    try {
      const res = await fetch("/api/admin/crm/social/simulate-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          channel: simChannel,
          senderName: simName.trim(),
          senderUsername: simUsername.trim() || undefined,
          text: simText.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.message) {
        setShowSimulateModal(false);
        const refresh = await fetch(`/api/admin/crm/social/conversations?organizationId=${organizationId}`);
        const cData = await refresh.json();
        if (Array.isArray(cData.conversations)) {
          setConversations(cData.conversations);
        }
        setSelectedPeerId(data.message.senderId);
        setSelectedChannel(simChannel);
      }
    } catch {
      // ignore
    } finally {
      setSimulating(false);
    }
  }

  const isLiveConfigured =
    activeChannel === "INSTAGRAM" ? metaConfigured.instagram : metaConfigured.messenger;

  return (
    <div className="admin-whatsapp-workspace">
      {/* Top Banner with Meta Status & Simulation Shortcut */}
      <div className="admin-whatsapp-top-banner">
        <div className="admin-whatsapp-status-left">
          <span className="admin-whatsapp-pill is-active">
            <span className="admin-whatsapp-pulse-dot" />
            <span>{ar ? "مركز المحادثات الاجتماعية" : "Centre de Messagerie Sociale"}</span>
          </span>
          <span className="admin-whatsapp-subinfo">
            {activeChannel === "INSTAGRAM" ? "Instagram Direct (Meta)" : "Facebook Messenger (Meta)"}
            {" • "}
            {isLiveConfigured ? (
              <strong style={{ color: "#16a34a" }}>{ar ? "متصل مباشر" : "Connecté en direct"}</strong>
            ) : (
              <strong style={{ color: "#c9913f" }}>{ar ? "وضع المحاكاة نشط" : "Mode simulation actif"}</strong>
            )}
          </span>
        </div>

        <div className="admin-whatsapp-actions-right">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSimulateModal(true)}
          >
            <Icon name="spark" size={14} />
            <span>{ar ? "محاكاة رسالة واردة" : "Simuler un message client"}</span>
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="admin-whatsapp-messenger-layout">
        {/* LEFT PANE: CONVERSATIONS LIST */}
        <aside className="admin-whatsapp-sidebar-pane">
          <div className="admin-whatsapp-sidebar-header">
            {/* Channel Tabs */}
            <div className="admin-whatsapp-tabs-pill" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <button
                type="button"
                className={channelFilter === "ALL" ? "is-active" : ""}
                onClick={() => setChannelFilter("ALL")}
              >
                {ar ? "الكل" : "Tous"}
              </button>
              <button
                type="button"
                className={channelFilter === "INSTAGRAM" ? "is-active" : ""}
                onClick={() => setChannelFilter("INSTAGRAM")}
              >
                Instagram
              </button>
              <button
                type="button"
                className={channelFilter === "MESSENGER" ? "is-active" : ""}
                onClick={() => setChannelFilter("MESSENGER")}
              >
                Messenger
              </button>
            </div>

            {/* Search Box */}
            <div className="admin-whatsapp-search-box">
              <Icon name="search" size={15} />
              <input
                type="text"
                placeholder={ar ? "بحث بالاسم أو المعرف..." : "Rechercher un contact, @pseudo..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")}>
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>

            {/* Sub-filter chips */}
            <div className="admin-whatsapp-subfilter-bar">
              <button
                type="button"
                className={`admin-whatsapp-subfilter-chip ${!unreadOnly ? "is-active" : ""}`}
                onClick={() => setUnreadOnly(false)}
              >
                {ar ? "الكل" : "Toutes"} ({conversations.length})
              </button>
              <button
                type="button"
                className={`admin-whatsapp-subfilter-chip ${unreadOnly ? "is-active" : ""}`}
                onClick={() => setUnreadOnly(true)}
              >
                {ar ? "غير المقروءة" : "Non lues"} (
                {conversations.reduce((acc, c) => acc + (c.unreadCount > 0 ? 1 : 0), 0)})
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="admin-whatsapp-items-list">
            {filteredConversations.length === 0 ? (
              <div className="admin-whatsapp-no-selection" style={{ padding: "40px 16px" }}>
                <p>{ar ? "لا توجد محادثات مطابقة" : "Aucune discussion trouvée"}</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 10 }}
                  onClick={() => setShowSimulateModal(true)}
                >
                  {ar ? "+ محاكاة رسالة جديدة" : "+ Simuler un premier message"}
                </button>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.peerId === activePeerId && c.channel === activeChannel;
                const isIg = c.channel === "INSTAGRAM";
                return (
                  <button
                    type="button"
                    key={`${c.channel}-${c.peerId}`}
                    className={`admin-whatsapp-item ${isSelected ? "is-selected" : ""}`}
                    onClick={() => {
                      setSelectedPeerId(c.peerId);
                      setSelectedChannel(c.channel);
                    }}
                  >
                    <div
                      className="admin-whatsapp-avatar"
                      style={
                        isIg
                          ? { background: "linear-gradient(45deg, #f09433, #dc2743, #bc1888)" }
                          : { background: "linear-gradient(135deg, #0084ff, #00c6ff)" }
                      }
                    >
                      <Icon name={isIg ? "instagram" : "messenger"} size={20} />
                    </div>

                    <div className="admin-whatsapp-item-body">
                      <div className="admin-whatsapp-item-top">
                        <span className="admin-whatsapp-name">{c.contactName}</span>
                        {c.lastMessage && (
                          <span className="admin-whatsapp-time">
                            {new Date(c.lastMessage.createdAt).toLocaleTimeString(
                              locale === "ar" ? "ar-TN" : "fr-FR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </span>
                        )}
                      </div>

                      <div className="admin-whatsapp-item-sub">
                        <span className="admin-whatsapp-preview">
                          {c.lastMessage?.direction === "OUTBOUND" ? "✓ " : ""}
                          {c.lastMessage?.text || (isIg ? "Discussion Instagram" : "Discussion Messenger")}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="admin-whatsapp-badge">{c.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* CENTER PANE & RIGHT DRAWER */}
        <div className="admin-whatsapp-chat-main-area">
          <main className="admin-whatsapp-chat-pane">
            {activeConversation ? (
              <>
                {/* Header */}
                <div className="admin-whatsapp-chat-header">
                  <div
                    className="admin-whatsapp-chat-header-user"
                    onClick={() => setShowDrawer(!showDrawer)}
                    role="button"
                    tabIndex={0}
                  >
                    <div
                      className="admin-whatsapp-avatar is-large"
                      style={
                        activeChannel === "INSTAGRAM"
                          ? { background: "linear-gradient(45deg, #f09433, #dc2743, #bc1888)" }
                          : { background: "linear-gradient(135deg, #0084ff, #00c6ff)" }
                      }
                    >
                      <Icon name={activeChannel === "INSTAGRAM" ? "instagram" : "messenger"} size={22} />
                    </div>
                    <div>
                      <h3>{activeConversation.contactName}</h3>
                      <p>
                        {activeConversation.username
                          ? `@${activeConversation.username}`
                          : `ID: ${activeConversation.peerId}`}
                        {" • "}
                        {activeChannel === "INSTAGRAM" ? "Instagram Direct" : "Messenger"}
                        {" • "}
                        {isLiveConfigured ? "🟢 Live" : "⚪ Simulation"}
                      </p>
                    </div>
                  </div>

                  <div className="admin-whatsapp-chat-header-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowSimulateModal(true)}
                    >
                      <Icon name="spark" size={13} />
                      <span>{ar ? "محاكاة" : "Simuler"}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowDrawer(!showDrawer)}
                      title={ar ? "معلومات جهة الاتصال" : "Fiche contact"}
                    >
                      <Icon name="user" size={16} />
                    </button>
                  </div>
                </div>

                {/* Message Stream */}
                <div className="admin-whatsapp-messages-stream">
                  {messagesLoading ? (
                    <div className="admin-whatsapp-loading">
                      <span className="button-spinner" />
                      <p>{ar ? "جارٍ تحميل المحادثة..." : "Chargement des messages..."}</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="admin-whatsapp-empty-chat">
                      <p>{ar ? "لا توجد رسائل في هذه المحادثة بعد." : "Aucun message dans cette discussion."}</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isOutbound = m.direction === "OUTBOUND";
                      const isIg = m.channel === "INSTAGRAM";
                      return (
                        <div
                          key={m.id}
                          className={`admin-whatsapp-bubble-row ${isOutbound ? "is-outbound" : "is-inbound"}`}
                        >
                          <div
                            className={`admin-whatsapp-bubble ${isOutbound ? "is-outbound" : "is-inbound"}`}
                            style={
                              isOutbound
                                ? isIg
                                  ? { background: "#fdf2f8", color: "#831843", border: "1px solid #fbcfe8" }
                                  : { background: "#eff6ff", color: "#1e3a8a", border: "1px solid #bfdbfe" }
                                : {}
                            }
                          >
                            <div className="admin-whatsapp-bubble-text">{m.textPreview}</div>
                            <div className="admin-whatsapp-bubble-meta">
                              <span>
                                {new Date(m.createdAt).toLocaleTimeString(locale === "ar" ? "ar-TN" : "fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isOutbound && (
                                <span className="admin-whatsapp-bubble-status is-delivered">
                                  {m.status === "READ" ? "✓✓" : m.status === "DELIVERED" ? "✓✓" : "✓"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Canned Quick Replies */}
                <div className="admin-whatsapp-quick-chips">
                  {CANNED_REPLIES.map((rep, i) => (
                    <button
                      key={i}
                      type="button"
                      className="admin-whatsapp-chip"
                      onClick={() => setDraftText(rep.text)}
                    >
                      {rep.label}
                    </button>
                  ))}
                </div>

                {/* Composer */}
                <div className="admin-whatsapp-composer">
                  {sendError && (
                    <div className="form-error" style={{ margin: "0 0 8px" }}>
                      {sendError}
                    </div>
                  )}
                  <form className="admin-whatsapp-composer-form" onSubmit={handleSend}>
                    <input
                      type="text"
                      placeholder={
                        ar
                          ? "اكتب رسالة للرد..."
                          : `Répondre sur ${activeChannel === "INSTAGRAM" ? "Instagram" : "Messenger"}...`
                      }
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="admin-whatsapp-send-btn"
                      disabled={!draftText.trim() || sending}
                    >
                      {sending ? <span className="button-spinner" /> : <Icon name="arrow" size={16} />}
                      <span>{ar ? "إرسال" : "Envoyer"}</span>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="admin-whatsapp-no-selection">
                <Icon name="spark" size={42} />
                <h3>{ar ? "اختر محادثة للمتابعة" : "Sélectionnez une discussion"}</h3>
                <p>
                  {ar
                    ? "إدارة متكاملة لرسائل إنستغرام وفيسبوك ماسنجر مع ربط مباشر بملفات العملاء."
                    : "Centre de support multi-canal unifié pour Instagram Direct et Facebook Messenger."}
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() => setShowSimulateModal(true)}
                >
                  {ar ? "+ محاكاة رسالة واردة" : "+ Simuler un message client"}
                </button>
              </div>
            )}
          </main>

          {/* RIGHT DRAWER: CONTACT INSPECTOR */}
          {showDrawer && activeConversation && (
            <aside className="admin-whatsapp-contact-inspector">
              <div className="admin-inspector-header">
                <h4>{ar ? "تفاصيل الاتصال" : "Fiche Contact Social"}</h4>
                <button
                  type="button"
                  className="admin-inspector-close"
                  onClick={() => setShowDrawer(false)}
                >
                  <Icon name="close" size={15} />
                </button>
              </div>

              <div className="admin-inspector-body">
                <div className="admin-inspector-hero">
                  <div
                    className="admin-whatsapp-avatar is-large"
                    style={
                      activeChannel === "INSTAGRAM"
                        ? { background: "linear-gradient(45deg, #f09433, #dc2743, #bc1888)" }
                        : { background: "linear-gradient(135deg, #0084ff, #00c6ff)" }
                    }
                  >
                    <Icon name={activeChannel === "INSTAGRAM" ? "instagram" : "messenger"} size={26} />
                  </div>
                  <h3>{activeConversation.contactName}</h3>
                  <p className="admin-inspector-phone">
                    {activeConversation.username ? `@${activeConversation.username}` : `ID: ${activeConversation.peerId}`}
                  </p>
                </div>

                <div className="admin-inspector-section">
                  <span className="admin-inspector-label">{ar ? "القناة" : "Canal"}</span>
                  <div className="admin-inspector-val">
                    {activeChannel === "INSTAGRAM" ? "Instagram Direct (Meta)" : "Facebook Messenger (Meta)"}
                  </div>
                </div>

                <div className="admin-inspector-section">
                  <span className="admin-inspector-label">{ar ? "إجمالي الرسائل" : "Total messages"}</span>
                  <div className="admin-inspector-val">
                    <strong>{activeConversation.totalMessages}</strong> {ar ? "رسائل متبادلة" : "messages échangés"}
                  </div>
                </div>

                <div className="admin-inspector-actions">
                  {activeConversation.username && activeChannel === "INSTAGRAM" && (
                    <a
                      href={`https://instagram.com/${activeConversation.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-block btn-sm"
                    >
                      <Icon name="instagram" size={14} />
                      <span>{ar ? "فتح الملف الشخصي" : "Voir profil Instagram"}</span>
                    </a>
                  )}
                  {activeChannel === "MESSENGER" && (
                    <a
                      href={`https://m.me/${activeConversation.peerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-block btn-sm"
                    >
                      <Icon name="messenger" size={14} />
                      <span>{ar ? "فتح على Messenger" : "Ouvrir sur Messenger"}</span>
                    </a>
                  )}
                  {activeConversation.contactId && (
                    <Link
                      href={`/${locale}/admin/crm/${organizationId}/contacts/${activeConversation.contactId}`}
                      className="btn btn-primary btn-block btn-sm"
                    >
                      <Icon name="user" size={14} />
                      <span>{ar ? "فتح ملف العميل في CRM" : "Fiche contact CRM"}</span>
                    </Link>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* SIMULATE MODAL */}
      {showSimulateModal && (
        <div className="whatsapp-modal-backdrop" onClick={() => setShowSimulateModal(false)}>
          <div className="whatsapp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{ar ? "محاكاة رسالة عميل واردة" : "Simuler un message client entrant"}</h3>
              <button type="button" onClick={() => setShowSimulateModal(false)}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <form onSubmit={handleSimulateInbound} className="modal-form">
              <label>
                <span>{ar ? "القناة" : "Canal de communication"}</span>
                <select
                  value={simChannel}
                  onChange={(e) => setSimChannel(e.target.value as SocialChannel)}
                >
                  <option value="INSTAGRAM">Instagram Direct</option>
                  <option value="MESSENGER">Facebook Messenger</option>
                </select>
              </label>

              <label>
                <span>{ar ? "اسم العميل" : "Nom du contact"}</span>
                <input
                  type="text"
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                />
              </label>

              <label>
                <span>{ar ? "اسم المستخدم (Username / Pseudo)" : "Identifiant (@pseudo / ID)"}</span>
                <input
                  type="text"
                  value={simUsername}
                  onChange={(e) => setSimUsername(e.target.value)}
                  placeholder="ex: amari.sarah"
                />
              </label>

              <label>
                <span>{ar ? "نص الرسالة" : "Texte du message"}</span>
                <textarea
                  rows={3}
                  required
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowSimulateModal(false)}
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={simulating}
                >
                  {simulating ? <span className="button-spinner" /> : <Icon name="spark" size={16} />}
                  <span>{ar ? "تأكيد واستلام" : "Simuler la réception"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
