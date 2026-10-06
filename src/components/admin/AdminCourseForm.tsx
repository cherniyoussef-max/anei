"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { slugify } from "@/lib/slug";
import { AdminObjectUpload } from "./AdminObjectUpload";

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

const CATEGORY_PRESETS = [
  { fr: "Éducation inclusive", ar: "التربية الدامجة", key: "education-inclusive" },
  { fr: "Autisme & TSA", ar: "طيف التوحد", key: "autisme-tsa" },
  { fr: "Troubles DYS & TDAH", ar: "صعوبات التعلم وتشتت الانتباه", key: "dys-tdah" },
  { fr: "Accompagnement AVS", ar: "المرافقة المدرسية", key: "accompagnement-avs" },
  { fr: "Pédagogie adaptée", ar: "البيداغوجيا المكيفة", key: "pedagogie-adaptee" },
];

export function AdminCourseForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();

  // Controlled states for high-efficiency editing & autofill
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [trainerName, setTrainerName] = useState("");
  const [category, setCategory] = useState("education-inclusive");

  const [titleFr, setTitleFr] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [summaryFr, setSummaryFr] = useState("");
  const [summaryAr, setSummaryAr] = useState("");
  const [descriptionFr, setDescriptionFr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [objectivesFr, setObjectivesFr] = useState("");
  const [objectivesAr, setObjectivesAr] = useState("");

  const [mode, setMode] = useState("online");
  const [durationMinutes, setDurationMinutes] = useState(600);
  const [priceTnd, setPriceTnd] = useState("0");
  const [level, setLevel] = useState("beginner");
  const [published, setPublished] = useState(true);

  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Auto-slug sync on Title FR change
  const handleTitleFrChange = (val: string) => {
    setTitleFr(val);
    if (!slugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  const handleForceGenerateSlug = () => {
    if (titleFr.trim()) {
      setSlug(slugify(titleFr));
      setSlugManuallyEdited(false);
    }
  };

  // Helper: Copy FR fields into empty AR fields
  const handleCopyFrToAr = () => {
    if (!titleAr) setTitleAr(titleFr);
    if (!summaryAr) setSummaryAr(summaryFr);
    if (!descriptionAr) setDescriptionAr(descriptionFr);
    if (!objectivesAr) setObjectivesAr(objectivesFr);
    setFeedbackMsg(ar ? "تم نسخ المحتوى إلى الحقول العربية للترجمة السريعة." : "Champs FR dupliqués vers AR pour traduction.");
    setTimeout(() => setFeedbackMsg(""), 3500);
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    setFeedbackMsg("");

    const form = e.currentTarget;
    const f = new FormData(form);
    const coverImageKey = String(f.get("coverImageObjectKey") || "") || null;

    const payload = {
      slug: slug.trim(),
      titleFr: titleFr.trim(),
      titleAr: titleAr.trim(),
      summaryFr: summaryFr.trim(),
      summaryAr: summaryAr.trim(),
      descriptionFr: descriptionFr.trim(),
      descriptionAr: descriptionAr.trim(),
      category: category.trim(),
      trainerName: trainerName.trim(),
      durationMinutes: Number(durationMinutes),
      priceMillimes: Math.round(Number(priceTnd) * 1000),
      mode,
      level,
      published,
      objectives: {
        fr: lines(objectivesFr),
        ar: lines(objectivesAr),
      },
      coverImageObjectKey: coverImageKey,
    };

    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setState("done");
        setFeedbackMsg(ar ? "تم إنشاء ونشر الدورة بنجاح!" : "Formation créée avec succès !");
        // Reset form
        setTitleFr("");
        setTitleAr("");
        setSlug("");
        setSlugManuallyEdited(false);
        setSummaryFr("");
        setSummaryAr("");
        setDescriptionFr("");
        setDescriptionAr("");
        setObjectivesFr("");
        setObjectivesAr("");
        router.refresh();
      } else {
        const errData = await res.json().catch(() => null);
        setState("error");
        setFeedbackMsg(
          errData?.error === "SLUG_EXISTS"
            ? ar
              ? "معرف الدورة (Slug) مستخدم بالفعل، اختر معرفاً آخر."
              : "Le slug est déjà utilisé par une autre formation."
            : ar
            ? "تعذر إنشاء الدورة. يرجى التحقق من الحقول المطلوبة."
            : "Création impossible. Vérifiez les champs obligatoires ou le slug.",
        );
      }
    } catch {
      setState("error");
      setFeedbackMsg(ar ? "حدث خطأ في الاتصال بالخادم." : "Erreur de connexion serveur.");
    }
  }

  return (
    <form className="admin-course-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* SECTION 1: IDENTIFICATION & METADATA */}
      <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, background: "#f8fafc" }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
          {ar ? "١. التعريف والمدرب والفئة" : "1. Identification, Formateur & Catégorie"}
        </legend>

        <div className="field-row">
          <label style={{ flex: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Slug (Identifiant URL unique)</span>
              <button
                type="button"
                onClick={handleForceGenerateSlug}
                style={{
                  background: "none",
                  border: "none",
                  color: "#0284c7",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {ar ? "توليد من العنوان" : "Auto-générer"}
              </button>
            </div>
            <input
              name="slug"
              required
              pattern="[a-z0-9-]+"
              placeholder="introduction-autisme-tsa"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugManuallyEdited(true);
              }}
            />
          </label>

          <label style={{ flex: 1.5 }}>
            <span>{ar ? "اسم المدرب / المؤطر" : "Formateur(rice) référent(e)"}</span>
            <input
              name="trainerName"
              required
              placeholder="Dr. Salma Karray"
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
            />
          </label>
        </div>

        {/* Category presets pills */}
        <div style={{ marginTop: 12 }}>
          <label style={{ marginBottom: 6, display: "block" }}>
            <span>{ar ? "الفئة التصنيفية" : "Catégorie pédagogique"}</span>
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {CATEGORY_PRESETS.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: category === cat.key ? 700 : 500,
                  background: category === cat.key ? "#0284c7" : "#fff",
                  color: category === cat.key ? "#fff" : "#334155",
                  border: category === cat.key ? "1px solid #0284c7" : "1px solid #cbd5e1",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {ar ? cat.ar : cat.fr}
              </button>
            ))}
          </div>
          <input
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: "100%", maxWidth: 360 }}
          />
        </div>
      </fieldset>

      {/* SECTION 2: BILINGUAL CONTENT & OBJECTIVES */}
      <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b", margin: 0 }}>
            {ar ? "٢. المحتوى البيداغوجي المزدوج (فرنسي / عربي)" : "2. Contenu bilingue & Objectifs d'apprentissage"}
          </legend>
          <button
            type="button"
            onClick={handleCopyFrToAr}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: "#f1f5f9",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              cursor: "pointer",
            }}
          >
            {ar ? "⎘ نسخ FR نحو AR" : "⎘ Dupliquer FR vers AR"}
          </button>
        </div>

        <div className="field-row">
          <label>
            <span>Titre (FR)</span>
            <input
              name="titleFr"
              required
              placeholder="ex: Les fondamentaux de l'inclusion scolaire"
              value={titleFr}
              onChange={(e) => handleTitleFrChange(e.target.value)}
            />
          </label>
          <label>
            <span>العنوان (AR)</span>
            <input
              name="titleAr"
              dir="rtl"
              required
              placeholder="مثال: أسس ومبادئ التربية الدامجة"
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
            />
          </label>
        </div>

        <div className="field-row">
          <label>
            <span>Résumé court (FR) — max 500 car.</span>
            <textarea
              name="summaryFr"
              required
              maxLength={500}
              rows={2}
              value={summaryFr}
              onChange={(e) => setSummaryFr(e.target.value)}
            />
          </label>
          <label>
            <span>الملخص المختصر (AR) — أقصى حد 500 حرف</span>
            <textarea
              name="summaryAr"
              dir="rtl"
              required
              maxLength={500}
              rows={2}
              value={summaryAr}
              onChange={(e) => setSummaryAr(e.target.value)}
            />
          </label>
        </div>

        <div className="field-row">
          <label>
            <span>Description complète du programme (FR)</span>
            <textarea
              name="descriptionFr"
              rows={4}
              required
              value={descriptionFr}
              onChange={(e) => setDescriptionFr(e.target.value)}
            />
          </label>
          <label>
            <span>الوصف المفصل للبرنامج (AR)</span>
            <textarea
              name="descriptionAr"
              dir="rtl"
              rows={4}
              required
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
            />
          </label>
        </div>

        <div className="field-row">
          <label>
            <span>Objectifs pédagogiques (FR) — un par ligne</span>
            <textarea
              name="objectivesFr"
              rows={3}
              required
              placeholder="Identifier les besoins spécifiques&#10;Adapter les supports d'évaluation"
              value={objectivesFr}
              onChange={(e) => setObjectivesFr(e.target.value)}
            />
          </label>
          <label>
            <span>الأهداف البيداغوجية (AR) — هدف في كل سطر</span>
            <textarea
              name="objectivesAr"
              dir="rtl"
              rows={3}
              required
              placeholder="تشخيص الاحتياجات الخاصة بالمتعلم&#10;تكييف الوسائل التقييمية في الفصل"
              value={objectivesAr}
              onChange={(e) => setObjectivesAr(e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      {/* SECTION 3: MODALITIES, PRICING & VISUAL */}
      <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, background: "#f8fafc" }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
          {ar ? "٣. الصيغة والمدة والسعر وصورة الغلاف" : "3. Modalités, Durée, Tarification & Visuel"}
        </legend>

        <div className="field-row">
          <label>
            <span>{ar ? "صيغة التدريب" : "Modalité d'apprentissage"}</span>
            <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="online">100% En ligne (Asynchrone / Vidéo)</option>
              <option value="hybrid">Hybride (En ligne + Ateliers)</option>
              <option value="onsite">Présentiel</option>
            </select>
          </label>

          <label>
            <span>{ar ? "مستوى الدورة" : "Niveau de difficulté"}</span>
            <select name="level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="beginner">{ar ? "مبتدئ (Débutant)" : "Débutant"}</option>
              <option value="intermediate">{ar ? "متوسط (Intermédiaire)" : "Intermédiaire"}</option>
              <option value="advanced">{ar ? "متقدم (Avancé)" : "Avancé"}</option>
            </select>
          </label>
        </div>

        <div className="field-row">
          <label>
            <span>{ar ? "المدة الإجمالية التقديرية (بالدقائق)" : "Durée estimée (minutes)"}</span>
            <input
              name="durationMinutes"
              type="number"
              min="15"
              step="15"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              required
            />
          </label>

          <label>
            <span>{ar ? "السعر بالدينار التونسي (0 للدورات المجانية)" : "Tarif en Dinars Tunisiens (0 = Gratuit)"}</span>
            <input
              name="priceTnd"
              type="number"
              min="0"
              step="0.001"
              value={priceTnd}
              onChange={(e) => setPriceTnd(e.target.value)}
              required
            />
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          <AdminObjectUpload
            locale={locale}
            name="coverImageObjectKey"
            category="course"
            accept="image/jpeg,image/png,image/webp"
            labelFr="Image de couverture de la formation"
            labelAr="صورة الغلاف الرسمية للدورة"
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              name="published"
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#0284c7" }}
            />
            <span style={{ fontWeight: 600 }}>
              {ar ? "نشر الدورة مباشرة في المنصة العامة للجمهور" : "Publier la formation immédiatement dans le catalogue"}
            </span>
          </label>
        </div>
      </fieldset>

      {/* ACTIONS & FEEDBACK */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
        <button
          className="admin-primary-button"
          disabled={state === "loading"}
          style={{ padding: "12px 28px", fontSize: 14, fontWeight: 700 }}
        >
          {state === "loading"
            ? ar
              ? "جارٍ الإنشاء..."
              : "Création en cours..."
            : ar
            ? "إنشاء الدورة التكوينية"
            : "Créer la formation"}
        </button>

        {feedbackMsg && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: state === "done" ? "#16a34a" : "#dc2626",
            }}
          >
            {feedbackMsg}
          </div>
        )}
      </div>
    </form>
  );
}
