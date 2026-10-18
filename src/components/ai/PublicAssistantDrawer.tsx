"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  X,
  Send,
  BookOpen,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";

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
    { label: "🎓 Réviser les points clés de ma formation", query: "Je prépare mon évaluation certifiante. Peux-tu me faire une synthèse des points clés indispensables de ma formation ?" },
    { label: "🎯 Comment réussir mon test certifiant (QCM 80%) ?", query: "Quels sont les concepts et questions clés à maîtriser absolument pour réussir l'examen certifiant ?" },
    { label: "🧩 M'entraîner avec des questions types", query: "Pose-moi une question d'entraînement pour tester ma compréhension de mes leçons et évalue ma réponse." },
    { label: "💡 Aménagements concrets en classe (TEACCH & ABC)", query: "Quels sont les aménagements scolaires et pratiques fondées sur les preuves essentiels de mon cours ?" },
  ],
  ar: [
    { label: "🎓 مراجعة النقاط الأساسية لدورتي التكوينية", query: "أستعد للتقييم النهائي، هل يمكنك تلخيص المفاهيم الأساسية لدورتي التكوينية ومساعدتي على المراجعة؟" },
    { label: "🎯 كيف أجتاز التقييم النهائي للشهادة بنجاح؟", query: "ما هي المفاهيم الجوهرية والأسئلة الأساسية لاجتياز اختبار الشهادة بنسبة تفوق 80%؟" },
    { label: "🧩 تدريبي بأسئلة تفاعلية لاختبار فهمي", query: "اطرح عليّ سؤالاً تدريبياً لاختبار فهمي للمنهاج، وقيّم إجابتي بيداغوجياً." },
    { label: "💡 الترتيبات الصفية والممارسات المبنية على البراهين", query: "ما هي أهم التدابير الصفية (TEACCH، شبكة ABC، والتواصل المعزز) الواجب استيعابها في دراستي؟" },
  ],
};

const SUGGESTIONS = {
  fr: [
    { label: "👤 Comment créer un compte et m'inscrire ?", query: "Comment créer un compte et s'inscrire sur la plateforme ?" },
    { label: "🎓 Quelle formation choisir pour ma situation ?", query: "Quelle formation recommandez-vous selon ma situation ?" },
    { label: "🧩 Mon enfant a un TSA (autisme), que faire ?", query: "Mon enfant a un trouble du spectre de l'autisme (TSA), que recommandez-vous ?" },
    { label: "💼 Comment devenir accompagnant scolaire (AVS) ?", query: "Comment devenir accompagnant scolaire AVS certifié ?" },
    { label: "💳 Quels sont les tarifs et moyens de paiement ?", query: "Quels sont les tarifs des formations et les moyens de paiement ?" },
  ],
  ar: [
    { label: "👤 كيف أنشئ حساباً وأسجل في المنصة؟", query: "كيف أنشئ حساباً جديداً وأسجل في المنصة؟" },
    { label: "🎓 ما هي الدورة المناسبة لوضعيتي؟", query: "ما هي الدورة التكوينية الأنسب لوضعيتي الحالية؟" },
    { label: "🧩 طفلي يعاني من طيف التوحد (TSA)، بماذا تنصحني؟", query: "طفلي يعاني من طيف التوحد (TSA)، كيف أساعده وما هي الدورة المقترحة؟" },
    { label: "💼 كيف أصبح مرافقاً مدرسياً (AVS) معتمداً؟", query: "كيف أصبح مرافقاً مدرسياً AVS معتمداً عبر المنصة؟" },
    { label: "💳 ما هي أسعار الدورات وطرق الدفع؟", query: "ما هي أسعار التكوينات وطرق الدفع المتاحة؟" },
  ],
};

/**
 * Formats message text into interactive HTML with styled links and bold markdown
 */
function FormattedMessage({ text, locale }: { text: string; locale: "fr" | "ar" }) {
  const isRtl = locale === "ar";

  // Split lines
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 leading-relaxed text-xs sm:text-sm">
      {lines.map((line, idx) => {
        if (!line.trim()) {
          return <div key={idx} className="h-1" />;
        }

        // Render bullet lines
        const isBullet = /^[-*•]\s+/.test(line);
        const isNumbered = /^\d+[\.\)]\s+/.test(line);
        const cleanLine = isBullet
          ? line.replace(/^[-*•]\s+/, "")
          : isNumbered
          ? line.replace(/^\d+[\.\)]\s+/, "")
          : line;

        // Parse markdown bold **text**, `code/link`, [Title](Url) and internal paths
        const parts = cleanLine.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|(?:\/)?(?:fr|ar)\/[a-zA-Z0-9\-_/]+)/g);

        const content = parts.map((part, pIdx) => {
          if (!part) return null;

          // Bold markdown
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={pIdx} className="font-semibold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }

          // Backtick code / inline link
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

          // Markdown link [Title](Url)
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

          // Raw internal path like /fr/formations/... or ar/auth/register
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
              <span className="text-[#B58D3D] font-bold select-none shrink-0 mt-0.5">
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
  const inputRef = useRef<HTMLInputElement>(null);
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
      inputRef.current?.focus();
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
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          data-testid="public-assistant-trigger"
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 ${
            isRtl ? "left-6" : "right-6"
          } z-40 flex items-center gap-2.5 px-4 py-3 bg-[#002B49] text-white rounded-full shadow-xl hover:bg-[#001f35] border border-[#B58D3D]/50 transition-all duration-300 hover:scale-105 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-[#B58D3D]`}
          aria-label={
            isLearnerPath
              ? (isRtl ? "فتح المرشد البيداغوجي ANEI" : "Ouvrir le Tuteur Pédagogique ANEI")
              : (isRtl ? "فتح مساعد ANEI" : "Ouvrir l'assistant ANEI")
          }
        >
          <div className="relative flex items-center justify-center">
            {isLearnerPath ? (
              <GraduationCap className="w-5 h-5 text-[#DDA74A]" />
            ) : (
              <Bot className="w-5 h-5 text-[#DDA74A]" />
            )}
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#002B49] animate-pulse" />
          </div>
          <span className="text-sm font-semibold tracking-wide" style={{ color: "#ffffff" }}>
            {isLearnerPath
              ? (isRtl ? "المرشد البيداغوجي" : "Tuteur ANEI")
              : (isRtl ? "مساعد ANEI" : "Assistant ANEI")}
          </span>
        </button>
      )}

      {/* Drawer Overlay / Modal */}
      {isOpen && (
        <aside
          data-testid="public-assistant-drawer"
          aria-label={isRtl ? "مساعد ANEI" : "Assistant ANEI"}
          dir={isRtl ? "rtl" : "ltr"}
          className={`fixed bottom-6 ${
            isRtl ? "left-6" : "right-6"
          } z-50 w-[92vw] sm:w-[440px] h-[610px] max-h-[86vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300`}
        >
          {/* Header with High-Contrast Typography & Professional Icon */}
          <div className="bg-[#002B49] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#B58D3D]/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-[#B58D3D]/50 text-[#DDA74A]">
                {isLearnerPath ? (
                  <GraduationCap className="w-5 h-5 text-[#DDA74A]" />
                ) : (
                  <Bot className="w-5 h-5 text-[#DDA74A]" />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight text-white" style={{ color: "#ffffff" }}>
                    {isLearnerPath
                      ? (isRtl ? "المرشد البيداغوجي ANEI" : "Tuteur Pédagogique ANEI")
                      : (isRtl ? "مساعد ANEI الذكي" : "Assistant ANEI")}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#B58D3D] text-white shadow-xs">
                    {isLearnerPath
                      ? (isRtl ? "تكوين وشهادة" : "Tuteur Certifiant")
                      : (isRtl ? "دليل معتمد" : "Guide Officiel")}
                  </span>
                </div>
                <p className="text-xs text-slate-200 font-normal mt-0.5" style={{ color: "#e2e8f0" }}>
                  {isLearnerPath
                    ? (isRtl ? "مرافقة المتعلّم، مراجعة الدروس والاستعداد للاختبار" : "Accompagnement, révision & préparation au test certifiant")
                    : (isRtl ? "إنشاء حساب، استشارات وتوجيه للتكوين" : "Création de compte, conseil & formations")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={resetChat}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-[#B58D3D]"
                  title={isRtl ? "محادثة جديدة" : "Nouvelle conversation"}
                  aria-label={isRtl ? "محادثة جديدة" : "Nouvelle conversation"}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-[#B58D3D]"
                aria-label={isRtl ? "إغلاق" : "Fermer"}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#002B49]/10 flex items-center justify-center text-[#002B49] border border-[#002B49]/15">
                  {isLearnerPath ? (
                    <GraduationCap className="w-6 h-6 text-[#002B49]" />
                  ) : (
                    <Bot className="w-6 h-6 text-[#002B49]" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {isLearnerPath
                      ? (isRtl ? "مرحباً بك في فضاء المتعلّم ANEI" : "Votre Tuteur Pédagogique ANEI")
                      : (isRtl ? "مرحباً بكم في الأكاديمية الوطنية" : "Bienvenue à l'Académie")}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-[310px] leading-relaxed">
                    {isLearnerPath
                      ? (isRtl
                          ? "أنا مرشدك البيداغوجي المخصص: أعرف دوراتك المسجلة، دروسك، وأساعدك على المراجعة واجتياز التقييم النهائي بنجاح!"
                          : "Je connais vos formations achetées et vos leçons. Je suis là pour vous aider à comprendre chaque concept, réviser et réussir votre test final certifiant !")
                      : (isRtl
                          ? "أنا هنا لمساعدتكم في إنشاء حساب، الإجابة عن استفساراتكم، واقتراح الدورة الأنسب لوضعيتكم."
                          : "Créer un compte, répondre à vos questions ou vous recommander la formation certifiante adaptée à votre situation.")}
                  </p>
                </div>

                {/* Suggestions List */}
                <div className="w-full space-y-2 pt-1">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left rtl:text-right">
                    {isRtl ? "أسئلة شائعة واقتراحات :" : "Questions fréquentes & orientations :"}
                  </p>
                  {suggestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(item.query)}
                      className="w-full text-left rtl:text-right text-xs px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#B58D3D] hover:bg-[#B58D3D]/5 text-slate-700 font-medium transition-all shadow-xs flex items-center justify-between group"
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="text-slate-400 group-hover:text-[#B58D3D] transition-colors shrink-0 ms-2">
                        {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                      </span>
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
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                        msg.role === "user"
                          ? "bg-[#002B49] text-white"
                          : "bg-white text-[#002B49] border border-slate-200 shadow-xs"
                      }`}
                    >
                      {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4 text-[#B58D3D]" />}
                    </div>

                    <div
                      className={`px-4 py-3 rounded-2xl shadow-xs ${
                        msg.role === "user"
                          ? "bg-[#002B49] text-white rounded-br-none rtl:rounded-bl-none rtl:rounded-br-2xl"
                          : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-none rtl:rounded-br-none rtl:rounded-bl-2xl"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      ) : msg.content ? (
                        <FormattedMessage text={msg.content} locale={locale} />
                      ) : msg.isStreaming ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-400 py-1">
                          <span className="w-2 h-2 rounded-full bg-[#B58D3D] animate-bounce" />
                          <span className="w-2 h-2 rounded-full bg-[#002B49] animate-bounce [animation-delay:0.2s]" />
                          <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Citations Accordion (Only displayed when actual references exist) */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="w-[88%] ms-9 rtl:ms-0 rtl:me-9 text-xs">
                      <button
                        type="button"
                        onClick={() => toggleCitation(msg.id)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-[#002B49] transition-colors py-1"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-[#B58D3D]" />
                        <span>
                          {isRtl
                            ? `${msg.citations.length} مراجع رسمية من الأرشيف`
                            : `${msg.citations.length} source(s) officielle(s) ANEI`}
                        </span>
                        {expandedCitations[msg.id] ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {expandedCitations[msg.id] && (
                        <div className="mt-1 space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                          {msg.citations.map((c) => (
                            <div key={c.id} className="text-[11px] text-slate-600 border-s-2 border-[#B58D3D] ps-2 py-0.5">
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
          <div className="px-4 py-2 bg-slate-100/80 border-t border-slate-200 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              data-testid="public-assistant-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isRtl
                  ? "اكتب سؤالك هنا (إنشاء حساب، توجيه، تكوين)..."
                  : "Posez votre question (création de compte, formation)..."
              }
              disabled={isLoading}
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#002B49] focus:bg-white transition-all disabled:opacity-60 text-slate-900"
            />
            <button
              data-testid="public-assistant-send"
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2.5 rounded-xl bg-[#002B49] text-white hover:bg-[#001f35] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#B58D3D] shrink-0"
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
