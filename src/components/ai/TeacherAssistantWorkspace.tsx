"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  Send,
  RotateCcw,
  Copy,
  Check,
  ShieldCheck,
  Bot,
  User,
  SlidersHorizontal,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

interface Citation {
  id: string;
  title: string;
  source: string;
  visibility: string;
  score: number;
  snippet: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

interface TeacherAssistantWorkspaceProps {
  locale?: "fr" | "ar";
  userName?: string;
}

const TEMPLATES = {
  fr: [
    {
      title: "Adapter un exercice (TDAH / DYS)",
      prompt: "Comment adapter un exercice de français ou de mathématiques et ses consignes pour un élève présentant un TDAH ou une dyslexie ?",
    },
    {
      title: "Gérer une crise ou un refus de tâche",
      prompt: "Que faire immédiatement face à une crise, une agitation motrice sévère ou un refus de tâche en classe ?",
    },
    {
      title: "Grille d'observation & PEI",
      prompt: "Aidez-moi à concevoir une grille d'observation des comportements et des objectifs concrets pour un plan d'accompagnement (PEI).",
    },
    {
      title: "Expliquer simplement un trouble",
      prompt: "Comment expliquer de manière simple, déculpabilisante et positive le TDAH, la Dyslexie ou le TSA à l'élève et à ses camarades ?",
    },
  ],
  ar: [
    {
      title: "تكييف تمرين أو اختبار (TDAH / DYS)",
      prompt: "كيف يمكن تكييف تمرين في مادة اللغة أو الرياضيات وتبسيط التعليمات لتلميذ من ذوي فرط الحركة أو عسر القراءة والكتابة؟",
    },
    {
      title: "التعامل مع نوبة غضب أو رفض المهمة",
      prompt: "ما هي الخطوات الإجرائية الفورية للتعامل مع نوبة غضب، تفريغ حسي، أو رفض أداء المهمة داخل الفصل المدرسي؟",
    },
    {
      title: "إعداد شبكة ملاحظة وخطة مرافقة (PEI)",
      prompt: "ساعدني في إعداد شبكة ملاحظة دقيقة للسلوكيات وتحديد أهداف بيداغوجية لمشروع الدمج الفردي للتلميذ.",
    },
    {
      title: "شرح مبسط للاضطراب",
      prompt: "كيف أشرح بطريقة علمية مبسطة وإيجابية اضطراب فرط الحركة، عسر التعلّم أو طيف التوحد للتلميذ وزملائه في القسم؟",
    },
  ],
};

export function TeacherAssistantWorkspace({
  locale = "fr",
  userName,
}: TeacherAssistantWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isRtl = locale === "ar";
  const templates = isRtl ? TEMPLATES.ar : TEMPLATES.fr;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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

  const handleReset = () => {
    if (isLoading) return;
    setMessages([]);
    setInput("");
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
    setIsLoading(true);

    try {
      const res = await fetch("/api/assistant/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, locale }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur serveur (${res.status})`);
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
            // Buffer boundary
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

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="w-full max-w-5xl mx-auto flex flex-col gap-6 py-4">
      {/* Workspace Banner */}
      <div className="bg-[#002B49] rounded-2xl p-6 text-white border border-[#DDA74A]/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#DDA74A]/20 border border-[#DDA74A]/40 flex items-center justify-center text-[#DDA74A] shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-white">
                {isRtl ? "المستشار البيداغوجي للتربية الدامجة" : "Conseiller Pédagogique Spécialisé IA"}
              </h1>
              <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-[#DDA74A]/20 text-[#DDA74A] border border-[#DDA74A]/40">
                {isRtl ? "خاص بالمعلمين" : "Espace Enseignants"}
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {isRtl
                ? `مرحباً بك ${userName ? `أستاذ(ة) ${userName}` : ""}. فضاء مخصص لتطوير استراتيجيات التمايز البيداغوجي، تكييف الاختبارات والأنشطة الصفية.`
                : `Bienvenue ${userName ? `${userName}` : ""}. Votre copilote pour concevoir des adaptations pédagogiques, fiches de différenciation et projets personnalisés.`}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="self-start md:self-center flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 transition-colors focus:outline-none focus:ring-1 focus:ring-[#DDA74A]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRtl ? "محادثة جديدة" : "Nouvelle session"}</span>
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[580px] overflow-hidden">
        {/* Messages or Templates */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center py-6">
              <div className="text-center max-w-md mx-auto mb-8">
                <div className="w-12 h-12 rounded-2xl bg-[#002B49]/5 text-[#002B49] flex items-center justify-center mx-auto mb-3">
                  <SlidersHorizontal className="w-6 h-6 text-[#002B49]" />
                </div>
                <h2 className="text-base font-semibold text-slate-900">
                  {isRtl ? "نماذج تكييف سريعة" : "Modèles d'intervention rapide"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {isRtl
                    ? "اختر نموذجاً للبدء فوراً، أو اكتب استشارتك البيداغوجية في الحقل أدناه."
                    : "Sélectionnez un modèle ci-dessous ou décrivez votre besoin pédagogique dans le champ."}
                </p>
              </div>

              {/* Template Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto w-full">
                {templates.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(tpl.prompt)}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#DDA74A] hover:shadow-md transition-all text-left rtl:text-right group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#002B49] group-hover:text-[#DDA74A] transition-colors">
                        {tpl.title}
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#DDA74A] transition-colors" />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {tpl.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                } items-start`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    msg.role === "user"
                      ? "bg-[#002B49] text-white"
                      : "bg-[#DDA74A]/20 text-[#002B49] border border-[#DDA74A]/40"
                  }`}
                >
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className="flex-1 max-w-3xl space-y-2">
                  <div
                    className={`p-5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-[#002B49] text-white ml-auto"
                        : "bg-slate-50 border border-slate-200/90 text-slate-800 shadow-sm"
                    }`}
                  >
                    {msg.content || (msg.isStreaming ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-400 py-1">
                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                      </span>
                    ) : null)}
                  </div>

                  {/* Actions & Citations for Assistant */}
                  {msg.role === "assistant" && !msg.isStreaming && msg.content && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                      <div className="flex items-center gap-2">
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#002B49] bg-amber-50 border border-amber-200/70 px-2.5 py-1 rounded-lg">
                            <BookOpen className="w-3.5 h-3.5 text-[#DDA74A]" />
                            <span>
                              {isRtl
                                ? `${msg.citations.length} مراجع بيداغوجية معتمدة`
                                : `${msg.citations.length} référentiel(s) pédagogique(s)`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 py-1 px-2 rounded hover:bg-slate-100 transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600">{isRtl ? "تم النسخ" : "Copié"}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{isRtl ? "نسخ الملاحظات" : "Copier la fiche"}</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-1 border-s border-slate-200 ps-1.5 ms-1">
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "HELPFUL", msg.content, msg.citations)}
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                              feedbackGiven[msg.id] === "HELPFUL"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
                                : "text-slate-500 hover:text-emerald-600 hover:bg-slate-100"
                            }`}
                            title={isRtl ? "مفيد" : "Utile"}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>{isRtl ? "مفيد" : "Utile"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "UNHELPFUL", msg.content, msg.citations)}
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                              feedbackGiven[msg.id] === "UNHELPFUL"
                                ? "bg-rose-50 text-rose-700 border border-rose-200 font-semibold"
                                : "text-slate-500 hover:text-rose-600 hover:bg-slate-100"
                            }`}
                            title={isRtl ? "بحاجة لتحسين" : "À améliorer"}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            <span>{isRtl ? "بحاجة لتحسين" : "À améliorer"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Citations Preview Box */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2 mt-2">
                      <span className="font-semibold text-slate-700 block text-[11px]">
                        {isRtl ? "المستندات المستند إليها:" : "Sources pédagogiques ANEI vérifiées :"}
                      </span>
                      {msg.citations.map((c, idx) => (
                        <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="flex items-center justify-between font-medium text-[#002B49]">
                            <span>{c.title}</span>
                            <span className="text-[10px] text-slate-400">
                              {Math.round(c.score * 100)}% pertinence
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 italic mt-0.5">&ldquo;{c.snippet}&rdquo;</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex flex-col sm:flex-row gap-3 items-end"
          >
            <div className="flex-1 w-full relative">
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isLoading}
                placeholder={
                  isRtl
                    ? "اطرح سؤالك البيداغوجي، صف حالة تلميذك أو اطلب تكييف تقييم... (Enter للإرسال)"
                    : "Décrivez la difficulté observée, la matière, ou la consigne à adapter... (Entrée pour envoyer)"
                }
                className="w-full px-4 py-3 text-xs sm:text-sm bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#002B49] resize-none disabled:opacity-60 transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#002B49] text-white hover:bg-[#001f35] font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#DDA74A]"
            >
              <span>{isRtl ? "إرسال الاستشارة" : "Générer l'adaptation"}</span>
              <Send className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>

          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {isRtl
                ? "مستشار رقمي مساعد للمعلمين — التكييفات خاضعة دائماً للتقييم البيداغوجي للأستاذ."
                : "Assistance pédagogique conforme aux référentiels ANEI — Validation finale sous la responsabilité de l'enseignant."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
