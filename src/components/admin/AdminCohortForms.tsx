"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminCohortCreateForm({ organizationId, locale, courses }: {
  organizationId: string;
  locale: string;
  courses: { id: string; titleFr: string; titleAr: string }[];
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/cohorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        courseId,
        name,
        capacity: capacity ? Number(capacity) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(ar ? "فشل إنشاء المجموعة." : "Échec de la création de la cohorte.");
      return;
    }
    setName("");
    setCapacity("");
    router.refresh();
  }

  if (!courses.length) return null;

  return (
    <form onSubmit={submit} className="admin-filter-panel" style={{ marginBottom: 16 }}>
      <label><span>{ar ? "الدورة" : "Formation"}</span>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((course) => <option key={course.id} value={course.id}>{ar ? course.titleAr : course.titleFr}</option>)}
        </select>
      </label>
      <label><span>{ar ? "الاسم" : "Nom"}</span><input required value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label><span>{ar ? "السعة (اختياري)" : "Capacité (optionnel)"}</span>
        <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>
      <button className="admin-primary-button" disabled={saving}>{ar ? "إنشاء مجموعة" : "Créer la cohorte"}</button>
      {error ? <p className="admin-error">{error}</p> : null}
    </form>
  );
}

const cohortStatuses = ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"] as const;

export function AdminCohortStatusSelect({ organizationId, cohortId, status }: {
  organizationId: string;
  cohortId: string;
  status: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function changeStatus(next: string) {
    if (next === status) return;
    setSaving(true);
    await fetch(`/api/admin/cohorts/${cohortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, status: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select value={status} disabled={saving} onChange={(e) => changeStatus(e.target.value)}>
      {cohortStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
