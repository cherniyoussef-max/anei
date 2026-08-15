"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminAssessmentActions({ organizationId, assessmentId, status, score, maxScore, summary, locale }: {
  organizationId: string;
  assessmentId: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  summary: string | null;
  locale: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [draft, setDraft] = useState({ score: score ?? "", maxScore: maxScore ?? "", summary: summary ?? "" });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string, body: Record<string, unknown>, key: string) {
    setSaving(key);
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      if (payload?.error === "INVALID_SCORE") setError(ar ? "درجة غير صالحة (تفوق الدرجة القصوى)." : "Score invalide (dépasse le score max).");
      else if (payload?.error === "INVALID_TRANSITION") setError(ar ? "التقييم مكتمل ولا يمكن تعديله." : "Évaluation terminée : modification impossible.");
      else setError(ar ? "فشلت العملية." : "Échec de l’opération.");
      return;
    }
    router.refresh();
  }

  const editable = status === "DRAFT";

  return (
    <div className="admin-list">
      <article>
        <div><strong>{ar ? "الحالة" : "Statut"}</strong><small>{status}</small></div>
      </article>
      {editable ? (
        <article>
          <div><strong>{ar ? "المحتوى" : "Contenu"}</strong></div>
          <form onSubmit={(e) => {
            e.preventDefault();
            call(`/api/admin/crm/assessments/${assessmentId}`, "PATCH", {
              organizationId,
              score: draft.score === "" ? null : Number(draft.score),
              maxScore: draft.maxScore === "" ? null : Number(draft.maxScore),
              summary: draft.summary || null,
            }, "save");
          }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label><span>{ar ? "الدرجة" : "Score"}</span><input type="number" min={0} value={draft.score} onChange={(e) => setDraft({ ...draft, score: e.target.value })} /></label>
              <label><span>{ar ? "الدرجة القصوى" : "Score max"}</span><input type="number" min={0} value={draft.maxScore} onChange={(e) => setDraft({ ...draft, maxScore: e.target.value })} /></label>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving === "save"}>{ar ? "حفظ" : "Enregistrer"}</button>
            </div>
            <textarea rows={3} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} style={{ width: "100%", marginTop: 8 }} />
          </form>
        </article>
      ) : null}
      {editable ? (
        <article>
          <button type="button" className="btn btn-primary btn-sm" disabled={saving === "complete"}
            onClick={() => call(`/api/admin/crm/assessments/${assessmentId}/complete`, "POST", { organizationId }, "complete")}>
            {ar ? "إنهاء التقييم" : "Terminer l’évaluation"}
          </button>
          <p className="admin-hint">{ar ? "بعد الإنهاء يصبح المحتوى غير قابل للتعديل." : "Après finalisation, le contenu devient immuable."}</p>
        </article>
      ) : null}
      {error ? <p className="admin-error">{error}</p> : null}
    </div>
  );
}