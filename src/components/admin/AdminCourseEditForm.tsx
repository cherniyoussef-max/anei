"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { AdminObjectUpload } from "./AdminObjectUpload";

type CourseValues = {
  id: string; titleFr: string; titleAr: string; summaryFr: string; summaryAr: string; descriptionFr: string; descriptionAr: string;
  category: string; trainerName: string; durationMinutes: number; priceMillimes: number; level: string; mode: string; published: boolean;
  qualifiesForProfessionalPromotion?: boolean | null;
  qualifyingTargetType?: string | null;
  qualifyingTargetCategory?: string | null;
  coverImage?: string | null;
};

export function AdminCourseEditForm({ locale, course }: { locale: Locale; course: CourseValues }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [dirty, setDirty] = useState(false);
  const [isQualifying, setIsQualifying] = useState(Boolean(course.qualifiesForProfessionalPromotion));
  const [targetType, setTargetType] = useState<"AVS" | "SPECIALIST">((course.qualifyingTargetType as "AVS" | "SPECIALIST") || "AVS");
  const [targetCategory, setTargetCategory] = useState(course.qualifyingTargetCategory || "ORTHOPHONIE");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    const f = new FormData(e.currentTarget);
    const coverImageObjectKey = String(f.get("coverImageObjectKey") || "");
    const payload = {
      titleFr: String(f.get("titleFr")), titleAr: String(f.get("titleAr")),
      summaryFr: String(f.get("summaryFr")), summaryAr: String(f.get("summaryAr")),
      descriptionFr: String(f.get("descriptionFr")), descriptionAr: String(f.get("descriptionAr")),
      category: String(f.get("category")), trainerName: String(f.get("trainerName")),
      durationMinutes: Number(f.get("durationMinutes")), priceMillimes: Math.round(Number(f.get("priceTnd")) * 1000),
      level: String(f.get("level")), mode: String(f.get("mode")), published: f.get("published") === "on",
      qualifiesForProfessionalPromotion: isQualifying,
      qualifyingTargetType: isQualifying ? targetType : null,
      qualifyingTargetCategory: isQualifying ? targetCategory : null,
      // Omit entirely when no new file was uploaded. The API treats a
      // present-but-empty value as "clear the cover image", so only send
      // this key when the admin actually picked a new file.
      ...(coverImageObjectKey ? { coverImageObjectKey } : {}),
    };
    const res = await fetch(`/api/admin/courses/${course.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setState(res.ok ? "done" : "error");
    if (res.ok) { setDirty(false); router.refresh(); }
  }

  return <form id="admin-course-information-form" className="admin-course-form" onSubmit={submit} onChange={() => { setDirty(true); if (state === "done") setState("idle"); }}>
    <div className="admin-form-section-heading"><div><strong>{ar ? "الهوية والوعد" : "Identité et promesse"}</strong><small>{ar ? "تظهر هذه المعلومات في الكتالوج وصفحة الدورة." : "Ces informations structurent le catalogue et la page publique."}</small></div>{dirty ? <span className="admin-unsaved-indicator">{ar ? "تغييرات غير محفوظة" : "Modifications non enregistrées"}</span> : null}</div>
    <div className="field-row"><label><span>Titre FR</span><input name="titleFr" defaultValue={course.titleFr} required /></label><label><span>العنوان AR</span><input name="titleAr" dir="rtl" defaultValue={course.titleAr} required /></label></div>
    <div className="field-row"><label><span>Résumé FR</span><textarea name="summaryFr" defaultValue={course.summaryFr} maxLength={500} required /></label><label><span>الملخص AR</span><textarea name="summaryAr" dir="rtl" defaultValue={course.summaryAr} maxLength={500} required /></label></div>
    <div className="field-row"><label><span>Description FR</span><textarea name="descriptionFr" rows={5} defaultValue={course.descriptionFr} required /></label><label><span>الوصف AR</span><textarea name="descriptionAr" dir="rtl" rows={5} defaultValue={course.descriptionAr} required /></label></div>
    <div className="admin-form-section-heading"><div><strong>{ar ? "إعدادات العرض" : "Paramètres de l’offre"}</strong><small>{ar ? "حدّد التصنيف والصيغة والسعر والمكوّن." : "Définissez le classement, la modalité, le prix et le formateur."}</small></div></div>
    <div className="field-row"><label><span>{ar ? "الفئة" : "Catégorie"}</span><input name="category" defaultValue={course.category} required /></label><label><span>{ar ? "المدرب" : "Formateur"}</span><input name="trainerName" defaultValue={course.trainerName} required /></label></div>
    <div className="field-row"><label><span>{ar ? "الصيغة" : "Modalité"}</span><select name="mode" defaultValue={course.mode}><option value="online">En ligne</option><option value="hybrid">Hybride</option><option value="onsite">Présentiel</option></select></label><label><span>{ar ? "مستوى الصعوبة" : "Niveau"}</span><select name="level" defaultValue={course.level}><option value="beginner">{ar ? "مبتدئ" : "Débutant"}</option><option value="intermediate">{ar ? "متوسط" : "Intermédiaire"}</option><option value="advanced">{ar ? "متقدم" : "Avancé"}</option></select></label></div>
    <div className="field-row"><label><span>{ar ? "المدة بالدقائق" : "Durée (minutes)"}</span><input name="durationMinutes" type="number" min="30" defaultValue={course.durationMinutes} required /></label><label><span>{ar ? "السعر بالدينار" : "Prix (TND)"}</span><input name="priceTnd" type="number" min="0" step="0.001" defaultValue={(course.priceMillimes / 1000).toString()} required /></label></div>
    
    {/* Qualification section */}
    <div style={{ marginTop: 12, marginBottom: 16, padding: 14, background: isQualifying ? "#eff6ff" : "#f8fafc", borderRadius: 8, border: isQualifying ? "1px solid #bfdbfe" : "1px solid #e2e8f0" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#1e3a8a" }}>
        <input
          type="checkbox"
          checked={isQualifying}
          onChange={(e) => { setIsQualifying(e.target.checked); setDirty(true); }}
          style={{ width: 18, height: 18, accentColor: "#0284c7" }}
        />
        <span>🎖️ {ar ? "دورة مؤهلة للاعتماد المهني ANEI (ترقية مرافقي الحياة المدرسية والأخصائيين)" : "Formation qualifiante pour l'agrément professionnel ANEI"}</span>
      </label>
      {isQualifying && (
        <div style={{ marginTop: 12, paddingLeft: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
              {ar ? "نوع الاعتماد المستهدف" : "Corps de métier cible"}
            </label>
            <select
              className="form-select"
              value={targetType}
              onChange={(e) => { setTargetType(e.target.value as "AVS" | "SPECIALIST"); setDirty(true); }}
              style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
            >
              <option value="AVS">{ar ? "مرافق حياة مدرسية (AVS)" : "Accompagnant Scolaire (AVS)"}</option>
              <option value="SPECIALIST">{ar ? "أخصائي مرخص (Spécialiste)" : "Spécialiste Paramédical / Thérapeute"}</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
              {ar ? "التخصص الدقيق" : "Discipline / Spécialité requise"}
            </label>
            <select
              className="form-select"
              value={targetCategory}
              onChange={(e) => { setTargetCategory(e.target.value); setDirty(true); }}
              style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
            >
              {targetType === "AVS" ? (
                <>
                  <option value="ACCOMPAGNEMENT_AVS">{ar ? "مرافقة عامة في الوسط المدرسي" : "Accompagnement scolaire généraliste"}</option>
                  <option value="AVS_AUTISME">{ar ? "مرافقة متخصصة في التوحد TSA" : "Accompagnement TSA / Autisme"}</option>
                  <option value="AVS_DYS">{ar ? "مرافقة صعوبات التعلم DYS / TDAH" : "Accompagnement DYS & TDAH"}</option>
                </>
              ) : (
                <>
                  <option value="ORTHOPHONIE">{ar ? "تقويم النطق (Orthophonie)" : "Orthophonie"}</option>
                  <option value="PSYCHOLOGIE">{ar ? "علم النفس المدرسي (Psychologie)" : "Psychologie & Neuropsychologie"}</option>
                  <option value="ERGOTHERAPIE">{ar ? "العلاج الوظيفي (Ergothérapie)" : "Ergothérapie"}</option>
                  <option value="PSYCHOMOTRICITE">{ar ? "العلاج الحركي (Psychomotricité)" : "Psychomotricité"}</option>
                  <option value="PEDOPSYCHIATRIE">{ar ? "الطب النفسي للأطفال (Pédopsychiatrie)" : "Pédopsychiatrie"}</option>
                  <option value="ORTHOPEDAGOGIE">{ar ? "التربية المختصة (Orthopédagogie)" : "Orthopédagogie"}</option>
                </>
              )}
            </select>
          </div>
        </div>
      )}
    </div>

    {course.coverImage ? <p className="small-muted">{ar ? "الغلاف الحالي:" : "Couverture actuelle :"} <code className="object-key-preview">{course.coverImage}</code></p> : null}
    <AdminObjectUpload locale={locale} name="coverImageObjectKey" category="course" accept="image/jpeg,image/png,image/webp" labelFr="Remplacer l’image de couverture" labelAr="استبدال صورة الغلاف"/>
    <label className="checkbox-row"><input name="published" type="checkbox" defaultChecked={course.published} /><span>{ar ? "منشورة" : "Publiée"}</span></label>
    <div className="admin-form-submit-row"><button className="btn btn-primary" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : (ar ? "حفظ التعديلات" : "Enregistrer les modifications")}</button>
    <span aria-live="polite">{state === "done" ? <small className="success-inline">{ar ? "تم الحفظ." : "Modifications enregistrées."}</small> : state === "error" ? <small className="form-error">{ar ? "تعذر الحفظ." : "Échec de l’enregistrement."}</small> : null}</span></div>
  </form>;
}
