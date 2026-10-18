"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  X,
  BookOpen,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  User,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ArrowUp,
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
    { label: "Synthétiser les points clés de ma formation", query: "Je prépare mon évaluation certifiante. Peux-tu me faire une synthèse des points clés indispensables de ma formation ?" },
    { label: "Comment réussir mon test certifiant (QCM 80%) ?", query: "Quels sont les concepts et questions clés à maîtriser absolument pour réussir l'examen certifiant ?" },
    { label: "S'entraîner avec des questions types", query: "Pose-moi une question d'entraînement pour tester ma compréhension de mes leçons et évalue ma réponse." },
    { label: "Aménagements concrets en classe (TEACCH & ABC)", query: "Quels sont les aménagements scolaires et pratiques fondées sur les preuves essentiels de mon cours ?" },
  ],
  ar: [
    { label: "مراجعة النقاط الأساسية لدورتي التكوينية", query: "أستعد للتقييم النهائي، هل يمكنك تلخيص المفاهيم الأساسية لدورتي التكوينية ومساعدتي على المراجعة؟" },
    { label: "كيف أجتاز التقييم النهائي للشهادة بنجاح؟", query: "ما هي المفاهيم الجوهرية والأسئلة الأساسية لاجتياز اختبار الشهادة بنسبة تفوق 80%؟" },
    { label: "تدريب بأسئلة تفاعلية لاختبار فهمي", query: "اطرح عليّ سؤالاً تدريبياً لاختبار فهمي للمنهاج، وقيّم إجابتي بيداغوجياً." },
    { label: "الترتيبات الصفية والممارسات المبنية على البراهين", query: "ما هي أهم التدابير الصفية (TEACCH، شبكة ABC، والتواصل المعزز) الواجب استيعابها في دراستي؟" },
  ],
};

const SUGGESTIONS = {
  fr: [
    { label: "Comment créer un compte et m'inscrire ?", query: "Comment créer un compte et s'inscrire sur la plateforme ?" },
    { label: "Quelle formation choisir pour ma situation ?", query: "Quelle formation recommandez-vous selon ma situation ?" },
    { label: "Mon enfant a un TSA (autisme), que faire ?", query: "Mon enfant a un trouble du spectre de l'autisme (TSA), que recommandez-vous ?" },
    { label: "Comment devenir accompagnant scolaire (AVS) ?", query: "Comment devenir accompagnant scolaire AVS certifié ?" },
    { label: "Quels sont les tarifs et moyens de paiement ?", query: "Quels sont les tarifs des formations et les moyens de paiement ?" },
  ],
  ar: [
    { label: "كيف أنشئ حساباً وأسجل في المنصة؟", query: "كيف أنشئ حساباً جديداً وأسجل في المنصة؟" },
    { label: "ما هي الدورة المناسبة لوضعيتي؟", query: "ما هي الدورة التكوينية الأنسب لوضعيتي الحالية؟" },
    { label: "طفلي يعاني من طيف التوحد (TSA)، بماذا تنصحني؟", query: "طفلي يعاني من طيف التوحد (TSA)، كيف أساعده وما هي الدورة المقترحة؟" },
    { label: "كيف أصبح مرافقاً مدرسياً (AVS) معتمداً؟", query: "كيف أصبح مرافقاً مدرسياً AVS معتمداً عبر المنصة؟" },
    { label: "ما هي أسعار الدورات وطرق الدفع؟", query: "ما هي أسعار التكوينات وطرق الدفع المتاحة؟" },
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
      {/* Floating Trigger Button - Hidden on learner routes to avoid duplication */}
      {!isOpen && !isLearnerPath && (
        <button
          data-testid="public-assistant-trigger"
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 ${
            isRtl ? "left-6" : "right-6"
          } z-40 inline-flex items-center gap-2 px-3.5 py-2.5 bg-[#0A192F] hover:bg-[#0056D2] text-white text-[13px] font-medium rounded-full shadow-lg border border-slate-700/60 transition-all duration-200 hover:shadow-xl group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0056D2]`}
          aria-label={isRtl ? "فتح مساعد ANEI" : "Ouvrir l'assistant ANEI"}
        >
          <Sparkles className="w-4 h-4 text-[#B58D3D] group-hover:text-white transition-colors shrink-0" />
          <span>{isRtl ? "مساعد ANEI" : "Assistant ANEI"}</span>
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
          } z-50 w-[92vw] sm:w-[460px] h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300`}
        >
          {/* Header with Institutional Branding & Professional Micro-details */}
          <div className="bg-[#0A192F] text-white px-4 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10 text-[#B58D3D] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-white tracking-tight">
                    {isLearnerPath
                      ? (isRtl ? "المرشد البيداغوجي ANEI" : "Tuteur Pédagogique ANEI")
                      : (isRtl ? "مساعد ANEI" : "Assistant ANEI")}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                    {isLearnerPath
                      ? (isRtl ? "تكوين وشهادة" : "Certifiant")
                      : (isRtl ? "دليل معتمد" : "Officiel")}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-300 font-normal mt-0.5">
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
                  className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
                  title={isRtl ? "محادثة جديدة" : "Nouvelle conversation"}
                  aria-label={isRtl ? "محادثة جديدة" : "Nouvelle conversation"}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
                aria-label={isRtl ? "إغلاق" : "Fermer"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#F8FAFC]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[#0A192F] border border-slate-200">
                  <Sparkles className="w-5 h-5 text-[#0056D2]" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-slate-900">
                    {isLearnerPath
                      ? (isRtl ? "فضاء المتعلّم ANEI · المرشد الذكي" : "Tuteur Pédagogique ANEI")
                      : (isRtl ? "مرحباً بكم في الأكاديمية الوطنية" : "Bienvenue à l'Académie ANEI")}
                  </h4>
                  <p className="text-[12px] text-slate-500 mt-1 max-w-[320px] leading-relaxed">
                    {isLearnerPath
                      ? (isRtl
                          ? "أنا مرشدك البيداغوجي: أتابع دوراتك، دروسك، وأساعدك على مراجعة النقاط الأساسية واجتياز التقييم النهائي بنجاح."
                          : "Je connais vos formations et leçons. Posez vos questions, révisez les concepts clés et préparez votre test final certifiant.")
                      : (isRtl
                          ? "أنا هنا لمساعدتكم في اختيار التكوين الأنسب، معرفة الإجراءات والتسجيل في المنصة."
                          : "Je vous accompagne pour découvrir le catalogue, choisir la formation adaptée et vous inscrire sur la plateforme.")}
                  </p>
                </div>

                {/* Suggestions List */}
                <div className="w-full space-y-1.5 pt-1">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider text-left rtl:text-right">
                    {isRtl ? "اقتراحات سريعة :" : "Suggestions rapides :"}
                  </p>
                  {suggestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(item.query)}
                      className="w-full text-left rtl:text-right text-[12px] px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-[#0056D2] hover:bg-blue-50/40 text-slate-700 font-medium transition-colors shadow-2xs flex items-center justify-between group cursor-pointer"
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="text-slate-400 group-hover:text-[#0056D2] transition-colors shrink-0 ms-2">
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
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs ${
                        msg.role === "user"
                          ? "bg-[#0056D2] text-white"
                          : "bg-white text-[#0A192F] border border-slate-200 shadow-2xs"
                      }`}
                    >
                      {msg.role === "user" ? <User className="w-3 h-3" /> : <Sparkles className="w-3.5 h-3.5 text-[#0056D2]" />}
                    </div>

                    <div
                      className={`px-3.5 py-2.5 rounded-2xl shadow-2xs ${
                        msg.role === "user"
                          ? "bg-[#0056D2] text-white rounded-br-none rtl:rounded-bl-none rtl:rounded-br-2xl"
                          : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-none rtl:rounded-br-none rtl:rounded-bl-2xl"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      ) : msg.content ? (
                        <FormattedMessage text={msg.content} locale={locale} />
                      ) : msg.isStreaming ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-400 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0056D2] animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0A192F] animate-bounce [animation-delay:0.2s]" />
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
            className="p-3 bg-white border-t border-slate-200 shrink-0"
          >
            <div className="relative rounded-xl border border-slate-200 bg-[#F8FAFC] focus-within:border-[#0056D2] focus-within:bg-white transition-all shadow-2xs p-2">
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
                    ? (isRtl ? "اطرح سؤالك على المرشد البيداغوجي..." : "Posez une question sur vos cours ou l'évaluation...")
                    : (isRtl ? "اكتب سؤالك هنا..." : "Posez votre question...")
                }
                disabled={isLoading}
                className="public-chat-input w-full text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed pe-9"
              />
              <button
                data-testid="public-assistant-send"
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute bottom-2 end-2 w-7 h-7 rounded-lg bg-[#0056D2] hover:bg-[#00419e] text-white disabled:opacity-40 disabled:hover:bg-[#0056D2] transition-colors flex items-center justify-center shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                aria-label={isRtl ? "إرسال" : "Envoyer"}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{isRtl ? "استرشادي رسمي ANEI" : "Conseil indicatif officiel ANEI"}</span>
              </span>
              <span>{isRtl ? "Enter للإرسال" : "Entrée pour envoyer"}</span>
            </div>
          </form>
        </aside>
      )}
    </>
  );
}
