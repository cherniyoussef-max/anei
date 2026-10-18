"use client";

import React, { useState, useRef, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  X,
  BookOpen,
  ChevronDown,
  ChevronUp,
  User,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { AneiLogo } from "@/components/brand/AneiLogo";

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

const LEARNER_SUGGESTIONS = {
  fr: [
    {
      label: "Synthétiser les points clés de ma formation",
      query: "Je prépare mon évaluation certifiante. Peux-tu me faire une synthèse des points clés indispensables de ma formation ?",
    },
    {
      label: "Comment réussir mon test certifiant (QCM 80%) ?",
      query: "Quels sont les concepts et questions clés à maîtriser absolument pour réussir l'examen certifiant ?",
    },
    {
      label: "S'entraîner avec des questions types",
      query: "Pose-moi une question d'entraînement pour tester ma compréhension de mes leçons et évalue ma réponse.",
    },
    {
      label: "Aménagements concrets en classe (TEACCH & ABC)",
      query: "Quels sont les aménagements scolaires et pratiques fondées sur les preuves essentiels de mon cours ?",
    },
  ],
  ar: [
    {
      label: "مراجعة النقاط الأساسية لدورتي التكوينية",
      query: "أستعد للتقييم النهائي، هل يمكنك تلخيص المفاهيم الأساسية لدورتي التكوينية ومساعدتي على المراجعة؟",
    },
    {
      label: "كيف أجتاز التقييم النهائي للشهادة بنجاح؟",
      query: "ما هي المفاهيم الجوهرية والأسئلة الأساسية لاجتياز اختبار الشهادة بنسبة تفوق 80%؟",
    },
    {
      label: "تدريب بأسئلة تفاعلية لاختبار فهمي",
      query: "اطرح عليّ سؤالاً تدريبياً لاختبار فهمي للمنهاج، وقيّم إجابتي بيداغوجياً.",
    },
    {
      label: "الترتيبات الصفية والممارسات المبنية على البراهين",
      query: "ما هي أهم التدابير الصفية (TEACCH، شبكة ABC، والتواصل المعزز) الواجب استيعابها في دراستي؟",
    },
  ],
};

const SUGGESTIONS = {
  fr: [
    {
      label: "Comment créer un compte et m'inscrire ?",
      query: "Comment créer un compte et s'inscrire sur la plateforme ?",
    },
    {
      label: "Quelle formation choisir pour ma situation ?",
      query: "Quelle formation recommandez-vous selon ma situation ?",
    },
    {
      label: "Mon enfant a un TSA (autisme), que faire ?",
      query: "Mon enfant a un trouble du spectre de l'autisme (TSA), que recommandez-vous ?",
    },
    {
      label: "Comment devenir accompagnant scolaire (AVS) ?",
      query: "Comment devenir accompagnant scolaire AVS certifié ?",
    },
  ],
  ar: [
    {
      label: "كيف أنشئ حساباً وأسجل في المنصة؟",
      query: "كيف أنشئ حساباً جديداً وأسجل في المنصة؟",
    },
    {
      label: "ما هي الدورة المناسبة لوضعيتي؟",
      query: "ما هي الدورة التكوينية الأنسب لوضعيتي الحالية؟",
    },
    {
      label: "طفلي يعاني من طيف التوحد (TSA)، بماذا تنصحني؟",
      query: "طفلي يعاني من طيف التوحد (TSA)، كيف أساعده وما هي الدورة المقترحة؟",
    },
    {
      label: "كيف أصبح مرافقاً مدرسياً (AVS) معتمداً؟",
      query: "كيف أصبح مرافقاً مدرسياً AVS معتمداً عبر المنصة؟",
    },
  ],
};

/**
 * Formats message text into interactive HTML with styled links and bold markdown
 */
function FormattedMessage({ text, locale }: { text: string; locale: "fr" | "ar" }) {
  const isRtl = locale === "ar";
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 leading-relaxed text-xs sm:text-sm">
      {lines.map((line, idx) => {
        if (!line.trim()) {
          return <div key={idx} className="h-1" />;
        }

        const isBullet = /^[-*•]\s+/.test(line);
        const isNumbered = /^\d+[\.\)]\s+/.test(line);
        const cleanLine = isBullet
          ? line.replace(/^[-*•]\s+/, "")
          : isNumbered
          ? line.replace(/^\d+[\.\)]\s+/, "")
          : line;

        const parts = cleanLine.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|(?:\/)?(?:fr|ar)\/[a-zA-Z0-9\-_/]+)/g);

        const content = parts.map((part, pIdx) => {
          if (!part) return null;

          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={pIdx} className="font-semibold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }

          if (part.startsWith("`") && part.endsWith("`")) {
            const rawContent = part.slice(1, -1).trim();
            const normalizedLink = rawContent.startsWith("/")
              ? rawContent
              : rawContent.startsWith("fr/") || rawContent.startsWith("ar/")
              ? `/${rawContent}`
              : null;

            if (normalizedLink) {
              return (
                <Link
                  key={pIdx}
                  href={normalizedLink}
                  className="inline-flex items-center gap-1 font-semibold text-[#002B49] bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors mx-0.5"
                >
                  <span dir="ltr">{normalizedLink}</span>
                  {isRtl ? <ArrowLeft className="w-3 h-3 text-[#B58D3D]" /> : <ArrowRight className="w-3 h-3 text-[#B58D3D]" />}
                </Link>
              );
            }

            return (
              <code key={pIdx} className="bg-slate-100 text-slate-800 text-[11px] font-mono px-1.5 py-0.5 rounded">
                {rawContent}
              </code>
            );
          }

          const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (linkMatch) {
            const [, title, url] = linkMatch;
            return (
              <Link
                key={pIdx}
                href={url}
                className="inline-flex items-center gap-1 font-semibold text-[#002B49] bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors mx-0.5"
              >
                <span>{title}</span>
                {isRtl ? <ArrowLeft className="w-3 h-3 text-[#B58D3D]" /> : <ArrowRight className="w-3 h-3 text-[#B58D3D]" />}
              </Link>
            );
          }

          const trimmedPart = part.trim();
          if (
            trimmedPart.startsWith(`/${locale}/`) ||
            trimmedPart.startsWith("/fr/") ||
            trimmedPart.startsWith("/ar/") ||
            trimmedPart.startsWith("fr/") ||
            trimmedPart.startsWith("ar/")
          ) {
            const normalized = trimmedPart.startsWith("/") ? trimmedPart : `/${trimmedPart}`;
            return (
              <Link
                key={pIdx}
                href={normalized}
                className="inline-flex items-center gap-1 font-semibold text-[#002B49] underline decoration-amber-500/60 hover:text-[#B58D3D] transition-colors mx-0.5"
              >
                <span dir="ltr">{normalized}</span>
              </Link>
            );
          }

          return <span key={pIdx}>{part}</span>;
        });

        if (isBullet || isNumbered) {
          return (
            <div key={idx} className="flex items-start gap-2 ps-1">
              <span className="text-[#0A192F] font-bold select-none shrink-0 mt-0.5">
                {isNumbered ? line.match(/^\d+[\.\)]/)?.[0] : "•"}
              </span>
              <span className="flex-1">{content}</span>
            </div>
          );
        }

        return <p key={idx}>{content}</p>;
      })}
    </div>
  );
}

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const counterRef = useRef(0);

  const isRtl = locale === "ar";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLearnerPath = pathname ? pathname.includes("/dashboard") || pathname.includes("/apprendre") : false;

  useEffect(() => {
    if (searchParams?.get("assistant") === "open") {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const suggestions = isLearnerPath
    ? (isRtl ? LEARNER_SUGGESTIONS.ar : LEARNER_SUGGESTIONS.fr)
    : (isRtl ? SUGGESTIONS.ar : SUGGESTIONS.fr);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const toggleCitation = (msgId: string) => {
    setExpandedCitations((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
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
            if (eventType === "citations" && parsed.citations && parsed.citations.length > 0) {
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
                  ? `عذراً، حدث خطأ أثناء المعالجة: ${errMsg}`
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

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  const isMac = useSyncExternalStore(
    () => () => {},
    () => (typeof navigator !== "undefined" ? /Mac|iPod|iPhone|iPad/.test(navigator.userAgent || "") : false),
    () => false,
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const target = e.target as HTMLElement | null;
        const isEditing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
        if (!isEditing || target === textareaRef.current) {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const handleOpenEvent = (e: Event) => {
      setIsOpen(true);
      const customEvent = e as CustomEvent<{ prompt?: string }>;
      if (customEvent?.detail?.prompt) {
        handleSendRef.current(customEvent.detail.prompt);
      }
    };

    window.addEventListener("anei:open-assistant", handleOpenEvent);
    return () => {
      window.removeEventListener("anei:open-assistant", handleOpenEvent);
    };
  }, []);

  return (
    <>
      {/* Sober & Institutional Floating Trigger Button (Zero AI clichés) */}
      {!isOpen && !isLearnerPath && (
        <button
          data-testid="public-assistant-trigger"
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-5 sm:bottom-6 ${
            isRtl ? "left-5 sm:left-6" : "right-5 sm:right-6"
          } z-40 group inline-flex items-center gap-2.5 h-11 px-4 rounded-full bg-[#0A192F] hover:bg-[#142B47] text-white shadow-md border border-white/10 text-[13px] font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] cursor-pointer select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0056D2]`}
          aria-label={isRtl ? "فتح مساعدة ANEI" : "Ouvrir l'assistance ANEI"}
        >
          <MessageSquare className="w-4 h-4 text-white/90 shrink-0" />
          <span className="font-medium tracking-tight">
            {isRtl ? "مساعدة ANEI" : "Assistance ANEI"}
          </span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/10 group-hover:bg-white/15 border border-white/10 text-[10.5px] font-mono font-medium text-slate-300 transition-colors select-none ms-0.5">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>
      )}

      {/* Drawer Overlay / Support Chat Modal */}
      {isOpen && (
        <aside
          data-testid="public-assistant-drawer"
          aria-label={isRtl ? "مساعد ANEI" : "Assistant ANEI"}
          dir={isRtl ? "rtl" : "ltr"}
          className={`fixed bottom-5 sm:bottom-6 ${
            isRtl ? "left-5 sm:left-6" : "right-5 sm:right-6"
          } z-50 w-[380px] sm:w-[400px] h-[535px] max-h-[calc(100vh-5rem)] rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_40px_-8px_rgba(10,25,47,0.16)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200`}
        >
          {/* 1. Minimalist & Institutional Header (Light Surface, No Sparkles, No Online Pill) */}
          <div className="bg-white border-b border-slate-200/80 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="shrink-0 flex items-center justify-center">
                <AneiLogo locale={locale} variant="mark" withText={false} height={22} className="shrink-0" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-[#0A192F] truncate">
                    {isLearnerPath
                      ? (isRtl ? "المرشد البيداغوجي ANEI" : "Tuteur Pédagogique ANEI")
                      : (isRtl ? "مساعد ANEI" : "Assistant ANEI")}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                </div>
                <p className="text-[11.5px] text-slate-500 truncate mt-0.5">
                  {isLearnerPath
                    ? (isRtl ? "مرافقة ومراجعة للدروس" : "Accompagnement & révision des cours")
                    : (isRtl ? "توجيه، تكوينات ومرافقة" : "Orientation, formations & accompagnement")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={resetChat}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title={isRtl ? "محادثة جديدة" : "Nouvelle conversation"}
                  aria-label={isRtl ? "محادثة جديدة" : "Nouvelle conversation"}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label={isRtl ? "إغلاق" : "Fermer"}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 2. Body: Clean Welcome Bubble & Untruncated Suggestions (Zero Scrollbar on Open) */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-[#F8FAFC]/50 [scrollbar-width:thin]">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-2.5">
                {/* Natural Welcome Bubble */}
                <div className="rounded-xl border border-slate-200/70 bg-[#F8FAFC] p-3 text-[12.5px] text-slate-700 leading-relaxed shadow-2xs">
                  {isLearnerPath
                    ? (isRtl
                        ? "مرحباً بك. كيف يمكنني مرافقتك اليوم في متابعة دروسك، المراجعة أو الاستعداد لاختبار الشهادة؟"
                        : "Bonjour. Comment puis-je vous accompagner aujourd'hui dans vos cours, révisions ou la préparation de votre test certifiant ?")
                    : (isRtl
                        ? "مرحباً بك. كيف يمكنني توجيهك اليوم بخصوص التكوينات، مرافقة الحياة المدرسية أو الأخصائيين؟"
                        : "Bonjour. Comment puis-je vous orienter aujourd'hui concernant nos formations, l'accompagnement AVS ou nos spécialistes ?")}
                </div>

                {/* 4 Clean Action Prompts (No left circle icons, no truncation with "...") */}
                <div className="flex flex-col gap-1.5">
                  {suggestions.slice(0, 4).map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(item.query)}
                      className="w-full text-start px-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-[#F8FAFC] hover:border-slate-300 text-[12px] font-medium text-[#0A192F] leading-snug transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs group"
                    >
                      <span className="flex-1 text-slate-800 font-medium">{item.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 shrink-0 rtl:rotate-180 transition-colors" />
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
                    className={`flex items-start gap-2 max-w-[90%] ${
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs ${
                        msg.role === "user"
                          ? "bg-[#0A192F] text-white"
                          : "bg-white border border-slate-200 shadow-2xs p-0.5"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="w-3.5 h-3.5" />
                      ) : (
                        <AneiLogo locale={locale} variant="mark" withText={false} height={14} />
                      )}
                    </div>

                    <div
                      className={`px-3.5 py-2.5 rounded-2xl shadow-2xs ${
                        msg.role === "user"
                          ? "bg-[#0A192F] text-white rounded-br-xs rtl:rounded-bl-xs rtl:rounded-br-2xl"
                          : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs rtl:rounded-br-xs rtl:rounded-bl-2xl"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      ) : msg.content ? (
                        <FormattedMessage text={msg.content} locale={locale} />
                      ) : msg.isStreaming ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-400 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0A192F] animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0056D2] animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Citations Accordion */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="w-[88%] ms-8 rtl:ms-0 rtl:me-8 text-xs">
                      <button
                        type="button"
                        onClick={() => toggleCitation(msg.id)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-[#0A192F] transition-colors py-0.5 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-[#0056D2]" />
                        <span>
                          {isRtl
                            ? `${msg.citations.length} مراجع رسمية من المنصة`
                            : `${msg.citations.length} source(s) officielle(s) ANEI`}
                        </span>
                        {expandedCitations[msg.id] ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {expandedCitations[msg.id] && (
                        <div className="mt-1 space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                          {msg.citations.map((c) => (
                            <div key={c.id} className="text-[11px] text-slate-600 border-s-2 border-[#0056D2] ps-2 py-0.5">
                              <span className="font-semibold text-slate-800 block">{c.title}</span>
                              <span className="text-[10px] text-slate-400">{c.source}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Feedback buttons */}
                      {!msg.isStreaming && msg.content && (
                        <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "HELPFUL", msg.content, msg.citations)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
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
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
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

          {/* 3. Compact Input Bar (Single Line, No "IA & RAG" badge, No shortcut clutter) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200/80 shrink-0"
          >
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] focus-within:bg-white focus-within:border-[#0A192F] px-3 py-1.5 transition-all">
              <textarea
                data-testid="public-assistant-input"
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  isLearnerPath
                    ? (isRtl ? "اطرح سؤالك على المرشد البيداغوجي..." : "Posez une question sur vos cours...")
                    : (isRtl ? "اطرح سؤالك..." : "Posez votre question...")
                }
                disabled={isLoading}
                className="public-chat-input flex-1 bg-transparent text-[13px] text-[#0A192F] placeholder:text-slate-400 outline-none resize-none h-7 py-0.5 leading-6 overflow-hidden"
              />
              <button
                data-testid="public-assistant-send"
                type="submit"
                disabled={isLoading || !input.trim()}
                className="h-7 w-7 rounded-lg bg-[#0A192F] hover:bg-[#0056D2] disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed"
                aria-label={isRtl ? "إرسال" : "Envoyer"}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10.5px] text-slate-400 text-center mt-1.5">
              {isRtl
                ? "معلومات توجيهية — لا تعوض الاستشارة الطبية."
                : "Information d'orientation — Ne remplace pas un avis médical."}
            </p>
          </form>
        </aside>
      )}
    </>
  );
}
