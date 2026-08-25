"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";

type DiscussionItem = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  authorFirstName: string;
  own: boolean;
};

const copy = {
  en: {
    title: "Questions and answers",
    intro: "Ask a practical question or share a useful response with other enrolled learners.",
    label: "Your question",
    replyLabel: "Your response",
    questionPlaceholder: "Describe the point you would like clarified.",
    replyPlaceholder: "Write a clear, respectful response.",
    ask: "Publish question",
    reply: "Reply",
    publishReply: "Publish response",
    cancel: "Cancel",
    empty: "No questions yet. Start the course conversation when you need clarification.",
    success: "Your contribution is now visible to enrolled learners.",
    error: "Your contribution could not be published. Check the text and try again.",
    limit: "Maximum 2,000 characters",
    you: "You",
  },
  fr: {
    title: "Questions et réponses",
    intro: "Posez une question pratique ou partagez une réponse utile avec les autres participants inscrits.",
    label: "Votre question",
    replyLabel: "Votre réponse",
    questionPlaceholder: "Décrivez le point que vous souhaitez clarifier.",
    replyPlaceholder: "Rédigez une réponse claire et respectueuse.",
    ask: "Publier la question",
    reply: "Répondre",
    publishReply: "Publier la réponse",
    cancel: "Annuler",
    empty: "Aucune question pour le moment. Lancez la discussion lorsque vous avez besoin d’une clarification.",
    success: "Votre contribution est maintenant visible par les participants inscrits.",
    error: "Votre contribution n’a pas pu être publiée. Vérifiez le texte puis réessayez.",
    limit: "2 000 caractères maximum",
    you: "Vous",
  },
  ar: {
    title: "الأسئلة والإجابات",
    intro: "اطرح سؤالاً عملياً أو شارك إجابة مفيدة مع بقية المشاركين المسجلين.",
    label: "سؤالك",
    replyLabel: "إجابتك",
    questionPlaceholder: "اشرح النقطة التي تحتاج إلى توضيح.",
    replyPlaceholder: "اكتب إجابة واضحة ومحترمة.",
    ask: "نشر السؤال",
    reply: "إجابة",
    publishReply: "نشر الإجابة",
    cancel: "إلغاء",
    empty: "لا توجد أسئلة بعد. ابدأ النقاش عندما تحتاج إلى توضيح.",
    success: "أصبحت مساهمتك ظاهرة للمشاركين المسجلين.",
    error: "تعذر نشر مساهمتك. تحقق من النص ثم أعد المحاولة.",
    limit: "الحد الأقصى 2000 حرف",
    you: "أنت",
  },
} as const;

export function CourseDiscussion({ courseId, locale, items }: { courseId: string; locale: Locale; items: DiscussionItem[] }) {
  const c = copy[locale];
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const roots = items.filter((item) => !item.parentId);
  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium" });

  async function submit(body: string, parentId: string | null) {
    if (pending || body.trim().length < 2) return;
    setPending(true);
    setStatus("idle");
    const response = await fetch(`/api/learning/courses/${courseId}/discussion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, parentId }),
    });
    setPending(false);
    if (!response.ok) {
      setStatus("error");
      return;
    }
    setQuestion("");
    setReply("");
    setReplyTo(null);
    setStatus("success");
    router.refresh();
  }

  return (
    <section className="course-discussion" id="questions" aria-labelledby="course-discussion-title">
      <header className="course-room-section-heading">
        <div>
          <h2 id="course-discussion-title">{c.title}</h2>
          <p>{c.intro}</p>
        </div>
        <span>{roots.length}</span>
      </header>

      <form className="course-question-form" onSubmit={(event) => { event.preventDefault(); void submit(question, null); }}>
        <label htmlFor="course-question">{c.label}</label>
        <textarea id="course-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={c.questionPlaceholder} minLength={2} maxLength={2000} required />
        <div className="course-form-footer"><small>{c.limit}</small><button className="course-room-primary" type="submit" disabled={pending || question.trim().length < 2}><Icon name="mail" size={17} />{c.ask}</button></div>
      </form>

      <p className="course-discussion-status" aria-live="polite">{status === "success" ? c.success : status === "error" ? c.error : ""}</p>

      {roots.length ? <div className="course-question-list">{roots.map((item) => {
        const replies = items.filter((candidate) => candidate.parentId === item.id);
        return <article className="course-question" key={item.id}>
          <header><span aria-hidden="true">{item.authorFirstName.charAt(0).toLocaleUpperCase(locale)}</span><div><strong>{item.own ? c.you : item.authorFirstName}</strong><time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time></div></header>
          <p>{item.body}</p>
          <button className="course-reply-trigger" type="button" aria-expanded={replyTo === item.id} aria-controls={`reply-${item.id}`} onClick={() => { setReplyTo(replyTo === item.id ? null : item.id); setReply(""); setStatus("idle"); }}><Icon name="mail" size={16} />{c.reply}</button>

          {replies.length ? <div className="course-replies">{replies.map((response) => <article key={response.id}><header><span aria-hidden="true">{response.authorFirstName.charAt(0).toLocaleUpperCase(locale)}</span><div><strong>{response.own ? c.you : response.authorFirstName}</strong><time dateTime={response.createdAt}>{dateFormatter.format(new Date(response.createdAt))}</time></div></header><p>{response.body}</p></article>)}</div> : null}

          {replyTo === item.id ? <form className="course-reply-form" id={`reply-${item.id}`} onSubmit={(event) => { event.preventDefault(); void submit(reply, item.id); }}><label htmlFor={`reply-body-${item.id}`}>{c.replyLabel}</label><textarea id={`reply-body-${item.id}`} value={reply} onChange={(event) => setReply(event.target.value)} placeholder={c.replyPlaceholder} minLength={2} maxLength={2000} required autoFocus/><div className="course-form-footer"><button type="button" className="course-room-secondary" onClick={() => setReplyTo(null)}>{c.cancel}</button><button type="submit" className="course-room-primary" disabled={pending || reply.trim().length < 2}>{c.publishReply}</button></div></form> : null}
        </article>;
      })}</div> : <div className="course-discussion-empty"><Icon name="mail" size={23}/><p>{c.empty}</p></div>}
    </section>
  );
}
