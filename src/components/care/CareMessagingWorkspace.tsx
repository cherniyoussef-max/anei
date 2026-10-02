"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  MessageSquare,
  Send,
  Lock,
  ArrowLeft,
  ArrowRight,
  Search,
  RotateCw,
  Check,
  CheckCheck,
} from "lucide-react";
import type { Locale } from "@/types";
import type {
  CareConversationListItem,
  CareMessageItem,
} from "@/server/queries/care-messaging";

export function CareMessagingWorkspace({
  locale,
  initialConversations,
  initialSelectedId,
  role,
}: {
  locale: Locale;
  initialConversations: CareConversationListItem[];
  initialSelectedId?: string;
  role: "SPECIALIST" | "PARENT";
}) {
  const ar = locale === "ar";

  const [conversations, setConversations] =
    useState<CareConversationListItem[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId || (conversations.length > 0 ? conversations[0]!.id : null),
  );
  const [messages, setMessages] = useState<CareMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(
    Boolean(initialSelectedId || (conversations.length > 0 ? conversations[0]!.id : null)),
  );
  const [sending, setSending] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;

  function handleSelectConversation(convId: string) {
    if (convId === selectedId) return;
    setSelectedId(convId);
    setLoadingMessages(true);
    setMessages([]);
  }

  function handleBackToList() {
    setSelectedId(null);
    setMessages([]);
  }

  // Filter conversations in left pane
  const filteredConversations = conversations.filter((c) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const matchName = c.counterparty.name.toLowerCase().includes(q);
    const matchChild = c.child.firstName.toLowerCase().includes(q);
    const matchSpecialty = c.counterparty.specialty
      ? c.counterparty.specialty.toLowerCase().includes(q)
      : false;
    return matchName || matchChild || matchSpecialty;
  });

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  // When selection changes, fetch messages asynchronously
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    fetch(`/api/care/conversations/${selectedId}/messages`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setMessages(data.messages || []);
        // Clear unread count for this conversation in list
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Scroll to bottom when messages load or change
  useEffect(() => {
    scrollToBottom(false);
  }, [messages, scrollToBottom]);

  // Periodic polling for incoming messages (every 7 seconds)
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => {
      fetch(`/api/care/conversations/${selectedId}/messages`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.messages) {
            setMessages(data.messages);
          }
        })
        .catch(() => undefined);
    }, 7000);
    return () => clearInterval(interval);
  }, [selectedId]);

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedId || !inputText.trim() || sending) return;
    if (selectedConversation?.status === "READ_ONLY") return;

    const contentToSend = inputText.trim();
    if (contentToSend.length > 4000) return;

    setSending(true);
    setInputText("");

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: CareMessageItem = {
      id: tempId,
      senderUserId: "me",
      senderName: role === "SPECIALIST" ? "Moi" : "Moi",
      content: contentToSend,
      status: "SENT",
      createdAt: new Date(),
      isMine: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom(true);

    try {
      const res = await fetch(`/api/care/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentToSend }),
      });

      if (res.ok) {
        const data = await res.json();
        // Replace tempId with server ID
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, id: data.messageId } : m)),
        );
        // Update last message preview in conversations list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId
              ? {
                  ...c,
                  lastMessagePreview: contentToSend,
                  lastMessageAt: new Date(),
                }
              : c,
          ),
        );
      } else {
        // Rollback on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInputText(contentToSend);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(contentToSend);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleManualRefresh() {
    if (!selectedId || refreshing) return;
    setRefreshing(true);
    try {
      const [messagesRes, convsRes] = await Promise.all([
        fetch(`/api/care/conversations/${selectedId}/messages`),
        fetch(`/api/care/conversations`),
      ]);
      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setMessages(data.messages || []);
      }
      if (convsRes.ok) {
        const convData = await convsRes.json();
        setConversations(convData.conversations || []);
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] rounded-2xl border border-[#E7E0D3] bg-white shadow-sm overflow-hidden"
      dir={ar ? "rtl" : "ltr"}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 h-full">
        {/* Left Pane: Conversations List */}
        <aside
          className={`md:col-span-4 lg:col-span-4 border-e border-[#E7E0D3] flex flex-col h-full bg-[#FCFBF8] ${
            selectedId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* List Header */}
          <div className="p-4 border-b border-[#E7E0D3] bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#082D55]">
                {ar ? "المحادثات" : "Discussions"}
              </h2>
              <span className="text-xs font-semibold text-[#a9752f] bg-[#F6F1E7] px-2.5 py-0.5 rounded-full">
                {conversations.length}
              </span>
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[#7a7261]">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder={
                  ar ? "البحث بالاسم أو الطفل..." : "Rechercher par nom, enfant..."
                }
                className="w-full rounded-xl border border-[#E7E0D3] bg-[#FCFBF8] py-1.5 ps-8 pe-3 text-xs text-[#082D55] placeholder:text-[#a39c8a] focus:border-[#082D55] focus:outline-none"
              />
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E7E0D3]">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-[#a39c8a] space-y-2">
                <MessageSquare size={28} className="mx-auto text-[#a39c8a]" />
                <p className="text-xs">
                  {conversations.length === 0
                    ? ar
                      ? "لا توجد محادثات نشطة بعد."
                      : "Aucune conversation pour le moment."
                    : ar
                    ? "لا توجد نتائج مطابقة."
                    : "Aucune discussion trouvée."}
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectConversation(c.id)}
                    className={`w-full text-start p-4 transition flex items-start gap-3 hover:bg-[#F6F1E7]/50 ${
                      isSelected ? "bg-white border-s-4 border-s-[#082D55]" : ""
                    }`}
                  >
                    {c.counterparty.avatarUrl ? (
                      <Image
                        src={c.counterparty.avatarUrl}
                        alt={c.counterparty.name}
                        width={42}
                        height={42}
                        className="h-10 w-10 rounded-full object-cover border border-[#E7E0D3] flex-none"
                      />
                    ) : (
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#082D55]/10 text-xs font-bold text-[#082D55]">
                        {c.counterparty.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <strong className="truncate text-xs font-semibold text-[#082D55]">
                          {c.counterparty.name}
                        </strong>
                        {c.lastMessageAt && (
                          <span className="text-[10px] text-[#a39c8a] flex-none">
                            {new Date(c.lastMessageAt).toLocaleDateString(
                              ar ? "ar-TN" : "fr-TN",
                              { month: "short", day: "numeric" },
                            )}
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="rounded-md bg-[#F6F1E7] px-1.5 py-0.5 text-[10px] font-medium text-[#7a7261]">
                          {c.child.firstName}
                          {c.child.age !== null ? ` (${c.child.age}a)` : ""}
                        </span>
                        {c.counterparty.specialty && (
                          <span className="truncate text-[10px] text-[#a9752f]">
                            {c.counterparty.specialty}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-[#7a7261]">
                          {c.lastMessagePreview ||
                            (ar ? "بدء المحادثة..." : "Nouvel échange...")}
                        </p>

                        {c.unreadCount > 0 && (
                          <span className="flex-none grid h-4 w-4 place-items-center rounded-full bg-[#a9752f] text-[10px] font-bold text-white">
                            {c.unreadCount}
                          </span>
                        )}

                        {c.status === "READ_ONLY" && (
                          <span
                            title={ar ? "المتابعة منتهية" : "Suivi clôturé"}
                            className="flex-none text-[#a39c8a]"
                          >
                            <Lock size={12} />
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Pane: Active Thread */}
        <main
          className={`md:col-span-8 lg:col-span-8 flex flex-col h-full bg-white ${
            selectedId ? "flex" : "hidden md:flex"
          }`}
        >
          {selectedConversation ? (
            <>
              {/* Thread Header */}
              <div className="p-3.5 border-b border-[#E7E0D3] bg-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="md:hidden p-1.5 rounded-lg text-[#7a7261] hover:bg-[#F6F1E7]"
                    aria-label={ar ? "رجوع" : "Retour"}
                  >
                    {ar ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
                  </button>

                  {selectedConversation.counterparty.avatarUrl ? (
                    <Image
                      src={selectedConversation.counterparty.avatarUrl}
                      alt={selectedConversation.counterparty.name}
                      width={38}
                      height={38}
                      className="h-9 w-9 rounded-full object-cover border border-[#E7E0D3] flex-none"
                    />
                  ) : (
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#082D55]/10 text-xs font-bold text-[#082D55]">
                      {selectedConversation.counterparty.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="truncate text-sm font-semibold text-[#082D55]">
                        {selectedConversation.counterparty.name}
                      </strong>
                      {selectedConversation.counterparty.specialty && (
                        <span className="hidden sm:inline-block text-xs text-[#a9752f]">
                          ({selectedConversation.counterparty.specialty})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#7a7261]">
                      <span>{ar ? "متابعة:" : "Suivi :"}</span>
                      <strong className="text-[#082D55]">
                        {selectedConversation.child.firstName}
                      </strong>
                      {selectedConversation.child.age !== null && (
                        <span>
                          ({selectedConversation.child.age} {ar ? "سنوات" : "ans"})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedConversation.status === "READ_ONLY" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
                      <Lock size={11} />
                      {ar ? "للقراءة فقط" : "Lecture seule"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {ar ? "نشط" : "Actif"}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className="p-1.5 rounded-lg text-[#7a7261] hover:bg-[#F6F1E7] transition"
                    title={ar ? "تحديث" : "Actualiser"}
                  >
                    <RotateCw
                      size={15}
                      className={refreshing ? "animate-spin text-[#082D55]" : ""}
                    />
                  </button>
                </div>
              </div>

              {/* Read-Only Banner */}
              {selectedConversation.status === "READ_ONLY" && (
                <div className="bg-zinc-50 border-b border-zinc-200 p-2.5 text-center text-xs text-zinc-700 flex items-center justify-center gap-1.5">
                  <Lock size={13} className="flex-none text-zinc-500" />
                  <span>
                    {ar
                      ? "تم إنهاء علاقة المتابعة هذه. المحادثة محفوظة في الأرشيف للقراءة فقط لضمان التوثيق."
                      : "Cette relation de suivi est clôturée. La messagerie est archivée en lecture seule pour la traçabilité."}
                  </span>
                </div>
              )}

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FCFBF8]">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full text-xs text-[#7a7261]">
                    {ar ? "جارٍ تحميل الرسائل..." : "Chargement des messages..."}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
                    <div className="h-12 w-12 rounded-full bg-[#082D55]/5 grid place-items-center text-[#082D55]">
                      <MessageSquare size={22} />
                    </div>
                    <h4 className="font-semibold text-xs text-[#082D55]">
                      {ar ? "بداية المحادثة الآمنة" : "Espace d'échange confidentiel"}
                    </h4>
                    <p className="text-[11px] text-[#7a7261] max-w-xs">
                      {ar
                        ? "يمكنكم هنا تبادل الملاحظات والتقدم التربوي لطفلكم بكل أمان."
                        : "Échangez vos observations et le suivi pédagogique de l'enfant en toute sécurité."}
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const timeStr = new Date(m.createdAt).toLocaleTimeString(
                      ar ? "ar-TN" : "fr-TN",
                      { hour: "2-digit", minute: "2-digit" },
                    );

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          m.isMine ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                            m.isMine
                              ? "bg-[#082D55] text-white rounded-br-none"
                              : "bg-white border border-[#E7E0D3] text-[#082D55] rounded-bl-none"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>

                          <div
                            className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${
                              m.isMine ? "text-white/60" : "text-[#a39c8a]"
                            }`}
                          >
                            <span>{timeStr}</span>
                            {m.isMine && (
                              <span>
                                {m.status === "READ" ? (
                                  <CheckCheck size={13} className="text-[#a9752f]" />
                                ) : (
                                  <Check size={13} />
                                )}
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

              {/* Composer */}
              <div className="p-3 border-t border-[#E7E0D3] bg-white">
                {selectedConversation.status === "READ_ONLY" ? (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                    <Lock size={14} />
                    <span>
                      {ar
                        ? "المحادثة مغلقة ولا يمكن إرسال رسائل جديدة."
                        : "Cette discussion est archivée. Les nouveaux messages sont désactivés."}
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleSend} className="space-y-1.5">
                    <div className="relative rounded-xl border border-[#E7E0D3] bg-[#FCFBF8] focus-within:border-[#082D55] focus-within:ring-1 focus-within:ring-[#082D55]">
                      <textarea
                        ref={textareaRef}
                        rows={2}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        maxLength={4000}
                        placeholder={
                          ar
                            ? "اكتب رسالتك هنا... (اضغط Enter للإرسال، Shift+Enter لسطر جديد)"
                            : "Écrivez votre message... (Entrée pour envoyer, Maj+Entrée pour saut de ligne)"
                        }
                        className="w-full resize-none border-0 bg-transparent p-3 text-xs text-[#082D55] placeholder:text-[#a39c8a] focus:outline-none"
                      />

                      <div className="flex items-center justify-between border-t border-[#E7E0D3]/50 px-3 py-1.5">
                        <span className="text-[10px] text-[#a39c8a]">
                          {inputText.length}/4000
                        </span>

                        <button
                          type="submit"
                          disabled={!inputText.trim() || sending}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#082D55] px-3.5 py-1 text-xs font-semibold text-white hover:bg-[#061F3D] disabled:opacity-40 transition"
                        >
                          <Send size={12} />
                          <span>{ar ? "إرسال" : "Envoyer"}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </>
          ) : (
            /* Empty State when no conversation selected */
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-3">
              <div className="h-16 w-16 rounded-full bg-[#082D55]/5 grid place-items-center text-[#082D55]">
                <MessageSquare size={32} />
              </div>
              <h3 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#082D55]">
                {ar ? "مساحة الرسائل الآمنة" : "Messagerie sécurisée"}
              </h3>
              <p className="text-xs text-[#7a7261] max-w-sm leading-relaxed">
                {ar
                  ? "اختر محادثة من القائمة للتواصل المباشر والآمن مع أولياء الأمور أو المختصين."
                  : "Sélectionnez une discussion dans la liste pour démarrer vos échanges professionnels et bienveillants."}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
