"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminEnrollForm({ organizationId, contactId, locale, courses, cohorts }: {
  organizationId: string;
  contactId: string;
  locale: string;
  courses: { id: string; titleFr: string; titleAr: string }[];
  cohorts: { id: string; name: string; courseId: string }[];
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [cohortId, setCohortId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const availableCohorts = cohorts.filter((c) => c.courseId === courseId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    const res = await fetch("/api/admission/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, contactId, courseId, cohortId: cohortId || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      if (payload?.error === "COHORT_FULL") setError(ar ? "المجموعة مكتملة." : "Cohorte complète.");
      else setError(ar ? "فشل التسجيل." : "Échec de l’inscription.");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  if (!courses.length) return null;

  return (
    <form onSubmit={submit} className="admin-filter-panel" style={{ marginTop: 16 }}>
      <label><span>{ar ? "الدورة" : "Formation"}</span>
        <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setCohortId(""); }}>
          {courses.map((course) => <option key={course.id} value={course.id}>{ar ? course.titleAr : course.titleFr}</option>)}
        </select>
      </label>
      <label><span>{ar ? "المجموعة (اختياري)" : "Cohorte (optionnel)"}</span>
        <select value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">{ar ? "بدون مجموعة" : "Sans cohorte"}</option>
          {availableCohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
        </select>
      </label>
      <button className="admin-primary-button" disabled={saving}>{ar ? "تسجيل الطالب" : "Inscrire l’étudiant"}</button>
      {error ? <p className="admin-error">{error}</p> : null}
      {success ? <p className="small-muted">{ar ? "تم التسجيل." : "Inscription effectuée."}</p> : null}
    </form>
  );
}
