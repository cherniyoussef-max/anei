"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles, BookOpen, ShieldCheck, ChevronDown, ChevronUp, Bot, User, ThumbsUp, ThumbsDown } from "lucide-react";

interface Citation {
  id: string;
  title: string;
  source: string;
  score: number;
  snippet: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

interface PublicAssistantDrawerProps {
  locale?: "fr" | "ar";
}

const SUGGESTIONS = {
  fr: [
    "🎯 Adapter un exercice pour élève TDAH / DYS",
    "🧩 Que faire face à une crise ou refus de tâche ?",
    "📋 Créer une grille d'observation / PEI",
    "💡 Expliquer simplement le TDAH, la Dyslexie ou le TSA",
  ],
  ar: [
    "🎯 تكييف تمرين لتلميذ TDAH أو عسر التعلّم",
    "🧩 التعامل مع نوبة غضب أو تفريغ حسي",
    "📋 إعداد شبكة ملاحظة وخطة مرافقة (PEI)",
    "💡 شرح مبسط لاضطراب فرط الحركة أو التوحد",
  ],
};

export function PublicAssistantDrawer({ locale = "fr" }: PublicAssistantDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "HELPFUL" | "UNHELPFUL">>({});

  const handleFeedback = async (msgId: string, rating: "HELPFUL" | "UNHELPFUL", content: string, citations?: Citation[]) => {
    setFeedbackGiven((prev) => ({ ...prev, [msgId]: rating }));
    try {
      await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          responseText: content,
          sourcesUsed: citations,
          locale,
          messageId: msgId,
        }),
      });
    } catch {
      // Ignore network errors
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const counterRef = useRef(0);

  const isRtl = locale === "ar";
  const suggestions = isRtl ? SUGGESTIONS.ar : SUGGESTIONS.fr;

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const toggleCitation = (msgId: string) => {
    setExpandedCitations((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSend = async (textToSend?: string) => {
    const promptText = (textToSend ?? input).trim();
    if (!promptText || isLoading) return;

    const count = ++counterRef.current;
    const userMessageId = `user-${count}`;
    const assistantMessageId = `asst-${count}`;

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: promptText },
      { id: assistantMessageId, role: "assistant", content: "", isStreaming: true, citations: [] },
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/assistant/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: promptText, locale }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur (${res.status})`);
      }

      if (!res.body) throw new Error("Flux non disponible");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;
          const lines = rawEvent.split("\n");
          let eventType = "message";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }

          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (eventType === "citations" && parsed.citations) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, citations: parsed.citations }
                    : msg,
                ),
              );
            } else if (eventType === "token" && parsed.text) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + parsed.text }
                    : msg,
                ),
              );
            } else if (eventType === "done") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg,
                ),
              );
            }
          } catch {
            // Non-JSON line or chunk boundary
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Erreur de connexion";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: isRtl
                  ? `عذراً، حدث خطأ: ${errMsg}`
                  : `Désolé, une erreur est survenue : ${errMsg}`,
                isStreaming: false,
              }
            : msg,
        ),
      );
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg,
        ),
      );
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 ${
            isRtl ? "left-6" : "right-6"
          } z-40 flex items-center gap-2.5 px-4 py-3 bg-[#002B49] text-white rounded-full shadow-lg hover:bg-[#001f35] border border-[#DDA74A]/40 transition-all duration-300 hover:scale-105 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-[#DDA74A]`}
          aria-label={isRtl ? "فتح المساعد الذكي للأكاديمية" : "Ouvrir l'assistant IA ANEI"}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 text-[#DDA74A]" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#DDA74A] rounded-full animate-pulse" />
          </div>
          <span className="text-sm font-medium tracking-wide">
            {isRtl ? "مساعد الأكاديمية" : "Assistant ANEI"}
          </span>
        </button>
      )}

      {/* Drawer Overlay / Modal */}
      {isOpen && (
        <aside
          aria-label={isRtl ? "مساعد الأكاديمية" : "Assistant IA ANEI"}
          dir={isRtl ? "rtl" : "ltr"}
          className={`fixed bottom-6 ${
            isRtl ? "left-6" : "right-6"
          } z-50 w-[92vw] sm:w-[440px] h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300`}
        >
          {/* Header */}
          <div className="bg-[#002B49] text-white px-5 py-4 flex items-center justify-between border-b border-[#DDA74A]/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#DDA74A]/20 flex items-center justify-center border border-[#DDA74A]/40">
                <Sparkles className="w-4 h-4 text-[#DDA74A]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-white flex items-center gap-1.5">
                  {isRtl ? "المساعد التربوي الدامج" : "Assistant Éducation Inclusive"}
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#DDA74A]/20 text-[#DDA74A] border border-[#DDA74A]/30">
                    Officiel
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  {isRtl ? "إرشاد الأولياء والعائلات" : "Orientation & ressources ANEI"}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-[#DDA74A]"
              aria-label={isRtl ? "إغلاق" : "Fermer"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#002B49]/5 flex items-center justify-center text-[#002B49]">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    {isRtl ? "مرحباً بكم في الأكاديمية" : "Bienvenue à l'Académie"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
                    {isRtl
                      ? "اطرحوا أسئلتكم حول برامجنا، مرافقة AVS، أو التربية الدامجة."
                      : "Posez vos questions sur nos formations, l'accompagnement AVS ou nos ressources."}
                  </p>
                </div>

                {/* Suggestions */}
                <div className="w-full space-y-2 pt-2">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider text-left rtl:text-right">
                    {isRtl ? "أسئلة شائعة:" : "Questions fréquentes :"}
                  </p>
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(suggestion)}
                      className="w-full text-left rtl:text-right text-xs px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#DDA74A] hover:bg-[#DDA74A]/5 text-slate-700 transition-all text-ellipsis overflow-hidden"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  } space-y-1.5`}
                >
                  <div
                    className={`flex items-start gap-2 max-w-[88%] ${
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                        msg.role === "user"
                          ? "bg-[#002B49] text-white"
                          : "bg-[#DDA74A]/20 text-[#002B49] border border-[#DDA74A]/30"
                      }`}
                    >
                      {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    <div
                      className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-[#002B49] text-white rounded-br-none rtl:rounded-bl-none rtl:rounded-br-2xl"
                          : "bg-white text-slate-800 border border-slate-200/80 shadow-sm rounded-bl-none rtl:rounded-br-none rtl:rounded-bl-2xl"
                      }`}
                    >
                      {msg.content || (msg.isStreaming ? (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                        </span>
                      ) : null)}
                    </div>
                  </div>

                  {/* Citations Accordion */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="w-[88%] mr-9 rtl:mr-0 rtl:ml-9 text-xs">
                      <button
                        onClick={() => toggleCitation(msg.id)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-[#002B49] transition-colors py-1"
                      >
                        <BookOpen className="w-3 h-3 text-[#DDA74A]" />
                        <span>
                          {isRtl
                            ? `${msg.citations.length} مراجع رسمية من الأكاديمية`
                            : `${msg.citations.length} source(s) officielle(s) ANEI`}
                        </span>
                        {expandedCitations[msg.id] ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {/* Feedback buttons */}
                      {!msg.isStreaming && msg.content && (
                        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "HELPFUL", msg.content, msg.citations)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              feedbackGiven[msg.id] === "HELPFUL"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "text-slate-500 hover:text-emerald-600 hover:bg-slate-100"
                            }`}
                            title={isRtl ? "مفيد" : "Utile"}
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>{isRtl ? "مفيد" : "Utile"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "UNHELPFUL", msg.content, msg.citations)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              feedbackGiven[msg.id] === "UNHELPFUL"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "text-slate-500 hover:text-rose-600 hover:bg-slate-100"
                            }`}
                            title={isRtl ? "بحاجة لتحسين" : "À améliorer"}
                          >
                            <ThumbsDown className="w-3 h-3" />
                            <span>{isRtl ? "بحاجة لتحسين" : "À améliorer"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Ethical Disclaimer */}
          <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>
              {isRtl
                ? "مساعد استرشادي رسمي — لا يغني عن الاستشارة الطبية أو النفسية المتخصصة."
                : "Information indicative officielle — Ne remplace pas un avis médical ou spécialisé."}
            </span>
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isRtl
                  ? "اكتب استفسارك هنا..."
                  : "Posez votre question à l'assistant..."
              }
              disabled={isLoading}
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#002B49] focus:bg-white transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2.5 rounded-xl bg-[#002B49] text-white hover:bg-[#001f35] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#DDA74A]"
              aria-label={isRtl ? "إرسال" : "Envoyer"}
            >
              <Send className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
