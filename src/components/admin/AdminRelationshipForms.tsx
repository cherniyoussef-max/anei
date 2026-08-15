"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const relationshipTypes = ["MOTHER", "FATHER", "GUARDIAN", "OTHER"];

function useSubmit(url: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { setError("error"); return false; }
    router.refresh();
    return true;
  }
  return { submit, saving, error };
}

export function AdminParentLinkForm({ locale }: { locale: string }) {
  const ar = locale === "ar";
  const { submit, saving, error } = useSubmit("/api/admin/relationships/parent-links");
  const [parentUserId, setParentUserId] = useState("");
  const [studentUserId, setStudentUserId] = useState("");
  const [relationshipType, setRelationshipType] = useState("GUARDIAN");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (await submit({ parentUserId, studentUserId, relationshipType })) { setParentUserId(""); setStudentUserId(""); }
  }

  return <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
    <label>{ar ? "معرف الوالد" : "ID parent"}<input required value={parentUserId} onChange={(e) => setParentUserId(e.target.value)} /></label>
    <label>{ar ? "معرف الطالب" : "ID élève"}<input required value={studentUserId} onChange={(e) => setStudentUserId(e.target.value)} /></label>
    <label>{ar ? "نوع العلاقة" : "Type de relation"}<select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)}>
      {relationshipTypes.map((t) => <option key={t} value={t}>{t}</option>)}
    </select></label>
    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{ar ? "ربط" : "Lier"}</button>
    {error ? <span className="admin-error">{ar ? "فشلت العملية." : "Échec de l’opération."}</span> : null}
  </form>;
}

export function AdminAvsAssignmentForm({ locale }: { locale: string }) {
  const ar = locale === "ar";
  const { submit, saving, error } = useSubmit("/api/admin/relationships/avs-assignments");
  const [avsUserId, setAvsUserId] = useState("");
  const [studentUserId, setStudentUserId] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (await submit({ avsUserId, studentUserId })) { setAvsUserId(""); setStudentUserId(""); }
  }

  return <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
    <label>{ar ? "معرف مرافق الحياة المدرسية" : "ID AVS"}<input required value={avsUserId} onChange={(e) => setAvsUserId(e.target.value)} /></label>
    <label>{ar ? "معرف الطالب" : "ID élève"}<input required value={studentUserId} onChange={(e) => setStudentUserId(e.target.value)} /></label>
    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{ar ? "تعيين" : "Assigner"}</button>
    {error ? <span className="admin-error">{ar ? "فشلت العملية." : "Échec de l’opération."}</span> : null}
  </form>;
}

export function AdminSpecialistAssignmentForm({ locale }: { locale: string }) {
  const ar = locale === "ar";
  const { submit, saving, error } = useSubmit("/api/admin/relationships/specialist-assignments");
  const [specialistUserId, setSpecialistUserId] = useState("");
  const [studentUserId, setStudentUserId] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (await submit({ specialistUserId, studentUserId })) { setSpecialistUserId(""); setStudentUserId(""); }
  }

  return <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
    <label>{ar ? "معرف الأخصائي" : "ID spécialiste"}<input required value={specialistUserId} onChange={(e) => setSpecialistUserId(e.target.value)} /></label>
    <label>{ar ? "معرف الطالب" : "ID élève"}<input required value={studentUserId} onChange={(e) => setStudentUserId(e.target.value)} /></label>
    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{ar ? "تعيين" : "Assigner"}</button>
    {error ? <span className="admin-error">{ar ? "فشلت العملية." : "Échec de l’opération."}</span> : null}
  </form>;
}
