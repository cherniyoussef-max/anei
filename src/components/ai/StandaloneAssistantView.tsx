"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Send,
  Sparkles,
  BookOpen,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  RotateCcw,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import type { Locale } from "@/types";

interface Citation {
  id: string;
  title: string;
  source: string;
  score: number;
  snippet: string;
  category?: string;
  fileName?: string;
  sectionTitle?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

interface StandaloneAssistantViewProps {
  locale?: Locale;
}

const SUGGESTIONS = {
  fr: [
    {
      title: "Adapter un exercice TDAH / DYS",
      desc: "Consignes claires, réduction de surcharge cognitive et repères visuels.",
      prompt: "Comment adapter un exercice de français ou de mathématiques pour un élève présentant un TDAH ou une dyslexie ?",
    },
    {
      title: "Gérer une crise ou surcharge sensorielle",
      desc: "Protocole d'apaisement immédiat pour le Trouble du Spectre de l'Autisme.",
      prompt: "Que faire immédiatement face à une crise, une agitation motrice sévère ou une surcharge sensorielle d'un élève avec TSA ?",
    },
    {
      title: "Élaborer une grille d'observation (PEI)",
      desc: "Identifier les déclencheurs et formuler des objectifs mesurables.",
      prompt: "Aidez-moi à concevoir une grille d'observation des comportements et des objectifs concrets pour un projet éducatif individualisé (PEI).",
    },
    {
      title: "Expliquer simplement la Dyslexie ou le TDAH",
      desc: "Vocabulaire positif et déculpabilisant pour l'enfant et sa classe.",
      prompt: "Comment expliquer simplement et de façon positive le TDAH ou la dyslexie à l'enfant et à ses camarades de classe ?",
    },
    {
      title: "Stratégies pour l'accompagnant AVS",
      desc: "Posture professionnelle, guidance estompée et autonomie.",
      prompt: "Quelles sont les meilleures pratiques pour un AVS afin d'encourager l'autonomie de l'élève sans créer de dépendance ?",
    },
  ],
  ar: [
    {
      title: "تكييف تمرين لتلميذ TDAH أو عسر تعلّم",
      desc: "تبسيط التعليمات، تقسيم المهام وتوفير المعينات البصرية.",
      prompt: "كيف يمكن تكييف تمرين في مادة اللغة أو الرياضيات وتبسيط التعليمات لتلميذ من ذوي فرط الحركة أو عسر القراءة والكتابة؟",
    },
    {
      title: "التعامل مع نوبة غضب أو تفريغ حسي (طيف التوحد)",
      desc: "خطوات التهدئة الفورية، توفير ركن هادئ واستخدام بطاقات التواصل.",
      prompt: "ما هي الخطوات الإجرائية الفورية للتعامل مع نوبة غضب، تفريغ حسي، أو رفض أداء المهمة لتلميذ من ذوي طيف التوحد داخل الفصل؟",
    },
    {
      title: "إعداد شبكة ملاحظة وخطة مرافقة (PEI)",
      desc: "رصد السلوكيات المحفزة وصياغة أهداف إجرائية قابلة للقياس.",
      prompt: "ساعدني في إعداد شبكة ملاحظة دقيقة للسلوكيات وتحديد أهداف بيداغوجية لمشروع الدمج الفردي للتلميذ.",
    },
    {
      title: "شرح مبسط للاضطراب للطفل وزملائه",
      desc: "أسلوب علمي إيجابي يعزز تقبل الفروق الفردية في القسم.",
      prompt: "كيف أشرح بطريقة علمية مبسطة وإيجابية اضطراب فرط الحركة، عسر التعلّم أو طيف التوحد للتلميذ وزملائه في القسم؟",
    },
    {
      title: "استراتيجيات المرافقة المدرسية AVS",
      desc: "المساندة الذكية، التلاشي التدريجي للمساعدة وبناء الاستقلالية.",
      prompt: "ما هي أفضل الممارسات لمرافق التلميذ (AVS) لتعزيز استقلالية الطفل في القسم دون خلق التبعية الدائمة؟",
    },
  ],
};

function renderFormattedMessage(content: string) {
  // Simple markdown renderer for paragraphs, headers, bold, and bullet points
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`${keyPrefix}-list`} className="my-2.5 space-y-1.5 list-disc ps-5 text-slate-800">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {formatInline(item)}
            </li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  const formatInline = (text: string): React.ReactNode => {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("### ")) {
      flushList(`flush-${lineIdx}`);
      elements.push(
        <h4 key={lineIdx} className="font-bold text-slate-950 text-base mt-4 mb-1.5 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#B58D3D] rounded-full inline-block" />
          {formatInline(trimmed.slice(4))}
        </h4>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushList(`flush-${lineIdx}`);
      elements.push(
        <h3 key={lineIdx} className="font-bold text-slate-950 text-lg mt-5 mb-2 border-b border-slate-100 pb-1">
          {formatInline(trimmed.slice(3))}
        </h3>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
    } else if (/^\d+\.\s/.test(trimmed)) {
      flushList(`flush-${lineIdx}`);
      const dotIndex = trimmed.indexOf(". ");
      const num = trimmed.slice(0, dotIndex);
      const text = trimmed.slice(dotIndex + 2);
      elements.push(
        <div key={lineIdx} className="flex items-start gap-2.5 my-2">
          <span className="flex-none w-5 h-5 rounded-full bg-[#0A192F]/10 text-[#0A192F] font-bold text-xs flex items-center justify-center mt-0.5">
            {num}
          </span>
          <p className="leading-relaxed text-slate-800 flex-1">{formatInline(text)}</p>
        </div>,
      );
    } else if (trimmed === "") {
      flushList(`flush-${lineIdx}`);
    } else {
      flushList(`flush-${lineIdx}`);
      elements.push(
        <p key={lineIdx} className="my-1.5 leading-relaxed text-slate-800">
          {formatInline(trimmed)}
        </p>,
      );
    }
  });

  flushList("final");
  return elements;
}

export function StandaloneAssistantView({ locale = "fr" }: StandaloneAssistantViewProps) {
  const isAr = locale === "ar";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "HELPFUL" | "UNHELPFUL">>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const counterRef = useRef(0);

  const suggestions = isAr ? SUGGESTIONS.ar : SUGGESTIONS.fr;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handleFeedback = async (
    msgId: string,
    rating: "HELPFUL" | "UNHELPFUL",
    content: string,
    citations?: Citation[],
  ) => {
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
      // Non-blocking
    }
  };

  const handleReset = () => {
    if (isLoading) return;
    setMessages([]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt ?? input).trim();
    if (!textToSend || isLoading) return;

    const count = ++counterRef.current;
    const userMessageId = `user-${count}`;
    const assistantMessageId = `asst-${count}`;

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: textToSend },
      { id: assistantMessageId, role: "assistant", content: "", isStreaming: true, citations: [] },
    ]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);

    try {
      const res = await fetch("/api/assistant/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, locale: isAr ? "ar" : "fr" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur serveur (${res.status})`);
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
            // Ignore parse errors on partial frames
          }
        }
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : isAr
          ? "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى."
          : "Une erreur est survenue. Veuillez réessayer.";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `${isAr ? "عذرًا، تعذر إكمال الإجابة: " : "Désolé, une erreur est survenue : "}${errorMessage}`,
                isStreaming: false,
              }
            : msg,
        ),
      );
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg)),
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  return (
    <div className="w-full bg-slate-50/50 min-h-[calc(100vh-80px)] py-6 sm:py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#0A192F] flex items-center justify-center flex-none shadow-xs">
                <Sparkles className="w-6 h-6 text-[#B58D3D]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {isAr ? "المساعد البيداغوجي الذكي ANEI" : "Assistant Pédagogique ANEI"}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {isAr ? "متصل ومتاح للجميع" : "En direct · Accès libre"}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  {isAr
                    ? "إرشاد بيداغوجي فوري للمربين، مرافقي AVS، والأولياء استنادًا إلى مراجع ANEI المعتمدة."
                    : "Accompagnement pédagogique immédiat pour enseignants, AVS et familles fondé sur les référentiels ANEI."}
                </p>
              </div>
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isAr ? "محادثة جديدة" : "Nouvelle discussion"}
              </button>
            )}
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#B58D3D] flex-none" />
              <span>{isAr ? "مراجع معتمدة (TSA, TDAH, DYS)" : "Référentiels validés (TSA, TDAH, DYS)"}</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0A192F] flex-none" />
              <span>{isAr ? "استشهاد بالمصادر والصفحات" : "Citations transparentes des sources"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 flex-none" />
              <span>{isAr ? "ذكاء اصطناعي سيادي وآمن" : "RAG hybride haute vitesse"}</span>
            </div>
          </div>
        </div>

        {/* Chat Stream Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col min-h-[480px]">
          {/* Conversation Area */}
          <div className="p-4 sm:p-6 flex-1 space-y-6">
            {messages.length === 0 ? (
              <div className="py-6">
                <div className="text-center max-w-lg mx-auto mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center mx-auto mb-3 text-[#B58D3D]">
                    <Bot className="w-7 h-7" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {isAr ? "كيف يمكنني مساعدتك اليوم؟" : "Comment puis-je vous aider aujourd'hui ?"}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    {isAr
                      ? "اطرح سؤالك حول صعوبات التعلّم، استراتيجيات التهدئة، أو تكييف الامتحانات والمناهج."
                      : "Posez vos questions sur les aménagements scolaires, la gestion des comportements ou la mise en place d'un PEI."}
                  </p>
                </div>

                {/* Suggestions Grid */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center sm:text-start">
                    {isAr ? "أمثلة لأسئلة شائعة جاهزة للاستخدام :" : "Suggestions de questions fréquentes :"}
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(item.prompt)}
                        className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-[#B58D3D]/60 hover:bg-[#B58D3D]/5 transition-all text-start"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-[#0A192F]">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                        </div>
                        <span className="flex-none inline-flex items-center gap-1 text-xs font-medium text-[#B58D3D] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform">
                          {isAr ? "طرح السؤال" : "Poser la question"}
                          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  } space-y-2`}
                >
                  <div
                    className={`flex items-start gap-3 max-w-[92%] sm:max-w-[85%] ${
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs shadow-2xs ${
                        msg.role === "user"
                          ? "bg-[#0A192F] text-white"
                          : "bg-[#B58D3D]/15 text-[#0A192F] border border-[#B58D3D]/30"
                      }`}
                    >
                      {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Bubble */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`p-4 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#0A192F] text-white rounded-tr-none rtl:rounded-tl-none rtl:rounded-tr-2xl"
                            : "bg-white text-slate-800 border border-slate-200/90 shadow-2xs rounded-tl-none rtl:rounded-tr-none rtl:rounded-tl-2xl"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : msg.content ? (
                          <div>{renderFormattedMessage(msg.content)}</div>
                        ) : msg.isStreaming ? (
                          <div className="flex items-center gap-1.5 py-1 text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-[#B58D3D] animate-bounce" />
                            <span className="w-2 h-2 rounded-full bg-[#B58D3D] animate-bounce [animation-delay:0.2s]" />
                            <span className="w-2 h-2 rounded-full bg-[#B58D3D] animate-bounce [animation-delay:0.4s]" />
                            <span className="text-xs text-slate-500 ms-2 font-medium">
                              {isAr ? "جاري التفكير وصياغة الإجابة..." : "Génération de la réponse en cours..."}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Citations Card */}
                      {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCitations((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            className="w-full flex items-center justify-between text-slate-700 font-semibold hover:text-slate-950"
                          >
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-[#B58D3D]" />
                              {isAr
                                ? `المراجع المعتمدة (${msg.citations.length})`
                                : `Sources pédagogiques citées (${msg.citations.length})`}
                            </span>
                            {expandedCitations[msg.id] ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {expandedCitations[msg.id] && (
                            <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-200/60">
                              {msg.citations.map((cite) => (
                                <div
                                  key={cite.id}
                                  className="p-2.5 rounded-lg bg-white border border-slate-200/70"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="font-semibold text-slate-900 text-[11px] truncate">
                                      {cite.title || cite.fileName || cite.source}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                                      {Math.round(cite.score * 100)}% pertinence
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed">
                                    &ldquo;{cite.snippet}&rdquo;
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Actions */}
                      {msg.role === "assistant" && msg.content && !msg.isStreaming && (
                        <div className="flex items-center gap-2 mt-2 px-1 text-xs text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                            aria-label={isAr ? "نسخ الإجابة" : "Copier la réponse"}
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-600 font-medium">{isAr ? "تم النسخ!" : "Copié !"}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>{isAr ? "نسخ" : "Copier"}</span>
                              </>
                            )}
                          </button>

                          <span className="text-slate-200">|</span>

                          {/* Feedback Thumbs */}
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleFeedback(msg.id, "HELPFUL", msg.content, msg.citations)}
                              className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                                feedbackGiven[msg.id] === "HELPFUL" ? "text-emerald-600 bg-emerald-50" : "hover:text-slate-700"
                              }`}
                              title={isAr ? "إجابة مفيدة" : "Réponse utile"}
                              aria-label={isAr ? "إجابة مفيدة" : "Réponse utile"}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(msg.id, "UNHELPFUL", msg.content, msg.citations)}
                              className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                                feedbackGiven[msg.id] === "UNHELPFUL" ? "text-rose-600 bg-rose-50" : "hover:text-slate-700"
                              }`}
                              title={isAr ? "إجابة غير مفيدة" : "Réponse pas utile"}
                              aria-label={isAr ? "إجابة غير مفيدة" : "Réponse pas utile"}
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative flex items-end gap-2"
            >
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputResize}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isAr
                      ? "اطرح سؤالك هنا حول تكييف الامتحانات، التعامل مع السلوكيات، أو أدوات AVS... (Enter للإرسال)"
                      : "Posez votre question ici sur les aménagements, la gestion de classe, le PEI... (Entrée pour envoyer)"
                  }
                  rows={1}
                  disabled={isLoading}
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0A192F] focus:outline-hidden focus:ring-2 focus:ring-[#0A192F]/10 disabled:opacity-50 transition-all max-h-[180px]"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex-none h-11 px-4 rounded-xl bg-[#0A192F] text-white hover:bg-[#112D55] disabled:opacity-40 disabled:hover:bg-[#0A192F] transition-all font-medium text-sm flex items-center justify-center gap-1.5 shadow-xs"
                aria-label={isAr ? "إرسال السؤال" : "Envoyer le message"}
              >
                <Send className="w-4 h-4 rtl:rotate-180" />
                <span className="hidden sm:inline">{isAr ? "إرسال" : "Envoyer"}</span>
              </button>
            </form>

            <div className="mt-2.5 flex flex-wrap items-center justify-between text-[11px] text-slate-400 px-1 gap-2">
              <span>
                {isAr
                  ? "مساعد ذكاء اصطناعي بيداغوجي. تحقق دائمًا من الملاحظات الميدانية وخطة الفريق التربوي."
                  : "Assistant d'aide pédagogique. Validez toujours vos décisions avec l'équipe éducative et médicale."}
              </span>
              <div className="flex items-center gap-3">
                <Link
                  href={`/${locale}/formations`}
                  className="hover:text-slate-600 transition-colors inline-flex items-center gap-1"
                >
                  <BookOpen className="w-3 h-3" />
                  {isAr ? "تصفح الدورات" : "Formations"}
                </Link>
                <span>·</span>
                <Link
                  href={`/${locale}/bibliotheque`}
                  className="hover:text-slate-600 transition-colors inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {isAr ? "المكتبة" : "Bibliothèque"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
