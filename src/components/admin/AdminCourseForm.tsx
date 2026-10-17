"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/types";
import { slugify } from "@/lib/slug";
import { AdminObjectUpload } from "./AdminObjectUpload";
import { Icon } from "@/components/ui/Icon";

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

const CATEGORY_PRESETS = [
  { fr: "Éducation inclusive", ar: "التربية الدامجة", key: "education-inclusive" },
  { fr: "Autisme & TSA", ar: "طيف التوحد", key: "autisme-tsa" },
  { fr: "Troubles DYS & TDAH", ar: "صعوبات التعلم وتشتت الانتباه", key: "dys-tdah" },
  { fr: "Accompagnement AVS", ar: "المرافقة المدرسية", key: "accompagnement-avs" },
  { fr: "Pédagogie adaptée", ar: "البيداغوجيا المكيفة", key: "pedagogie-adaptee" },
  { fr: "Communication PECS & Makaton", ar: "التواصل المعزز والبديل", key: "communication-alternative" },
];

const OBJECTIVE_SUGGESTIONS = [
  {
    fr: "Identifier les manifestations et besoins éducatifs spécifiques (TSA, DYS, TDAH)",
    ar: "تشخيص مظاهر واحتياجات التعلم الخاصة لدى المتعلم (التوحد، صعوبات التعلم، فرط الحركة)",
  },
  {
    fr: "Adapter les supports pédagogiques, consignes et rythmes d'apprentissage en classe",
    ar: "تكييف الوسائل البيداغوجية والتعليمات ونسق التعلم داخل الفصل الدراسي",
  },
  {
    fr: "Concevoir et évaluer un Projet Personnalisé de Scolarisation (PPS)",
    ar: "إعداد ومتابعة وتقييم مشروع الدمج المدرسي الفردي (PPS)",
  },
  {
    fr: "Gérer les situations de crise et désamorcer la surcharge sensorielle",
    ar: "إدارة حالات الأزمات السلوكية وخفض الإرهاق الحسي في البيئة المدرسية",
  },
  {
    fr: "Coordonner efficacement l'action entre l'école, la famille et les spécialistes",
    ar: "التنسيق الفعّال بين المؤسسة التربوية والأسرة والفريق الطبي المعالج",
  },
];

type CreatedCourseInfo = {
  id: string;
  slug: string;
  titleFr: string;
  titleAr: string;
  trainerName: string;
  category: string;
};

export function AdminCourseForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";

  // Tab navigation
  const [activeTab, setActiveTab] = useState<"general" | "content" | "settings" | "visual">("general");

  // Identification & Metadata
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [trainerName, setTrainerName] = useState("");
  const [category, setCategory] = useState("education-inclusive");

  // Bilingual Titles & Descriptions
  const [titleFr, setTitleFr] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [summaryFr, setSummaryFr] = useState("");
  const [summaryAr, setSummaryAr] = useState("");
  const [descriptionFr, setDescriptionFr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");

  // Objectives
  const [objectivesListFr, setObjectivesListFr] = useState<string[]>([
    "Identifier les manifestations et besoins éducatifs spécifiques (TSA, DYS, TDAH)",
    "Adapter les supports pédagogiques, consignes et rythmes d'apprentissage en classe",
  ]);
  const [objectivesListAr, setObjectivesListAr] = useState<string[]>([
    "تشخيص مظاهر واحتياجات التعلم الخاصة لدى المتعلم (التوحد، صعوبات التعلم، فرط الحركة)",
    "تكييف الوسائل البيداغوجية والتعليمات ونسق التعلم داخل الفصل الدراسي",
  ]);
  const [customObjInputFr, setCustomObjInputFr] = useState("");
  const [customObjInputAr, setCustomObjInputAr] = useState("");
  const [manualObjectivesMode, setManualObjectivesMode] = useState(false);
  const [objectivesRawFr, setObjectivesRawFr] = useState("");
  const [objectivesRawAr, setObjectivesRawAr] = useState("");

  // Modalities & Pricing
  const [mode, setMode] = useState("online");
  const [level, setLevel] = useState("beginner");
  const [durationHours, setDurationHours] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(600);
  const [isFree, setIsFree] = useState(true);
  const [priceTnd, setPriceTnd] = useState("0");
  const [published, setPublished] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);

  // Qualification for Professional Promotion
  const [qualifiesForProfessionalPromotion, setQualifiesForProfessionalPromotion] = useState(false);
  const [qualifyingTargetType, setQualifyingTargetType] = useState<"AVS" | "SPECIALIST">("AVS");
  const [qualifyingTargetCategory, setQualifyingTargetCategory] = useState<string>("ORTHOPHONIE");

  // Submission & Post-Creation States
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [createdCourse, setCreatedCourse] = useState<CreatedCourseInfo | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Sync Duration Hours <-> Minutes
  const handleHoursChange = (hrs: number) => {
    const validHrs = Math.max(0.5, hrs);
    setDurationHours(validHrs);
    setDurationMinutes(Math.round(validHrs * 60));
  };

  const handleAddQuickHours = (hrsToAdd: number) => {
    const next = durationHours + hrsToAdd;
    handleHoursChange(next);
  };

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
    if (objectivesListAr.length === 0 || objectivesListAr.length < objectivesListFr.length) {
      setObjectivesListAr([...objectivesListFr]);
    }
    setFeedbackMsg(ar ? "تم نسخ المحتوى الفرنسي للترجمة السريعة." : "Champs FR dupliqués vers AR pour traduction.");
    setTimeout(() => setFeedbackMsg(""), 3500);
  };

  // Interactive Objectives Management
  const handleAddCustomObjective = () => {
    if (customObjInputFr.trim()) {
      setObjectivesListFr([...objectivesListFr, customObjInputFr.trim()]);
      setObjectivesListAr([...objectivesListAr, customObjInputAr.trim() || customObjInputFr.trim()]);
      setCustomObjInputFr("");
      setCustomObjInputAr("");
    }
  };

  const handleRemoveObjective = (index: number) => {
    setObjectivesListFr(objectivesListFr.filter((_, i) => i !== index));
    setObjectivesListAr(objectivesListAr.filter((_, i) => i !== index));
  };

  const handleInsertObjectiveSuggestion = (item: { fr: string; ar: string }) => {
    if (!objectivesListFr.includes(item.fr)) {
      setObjectivesListFr([...objectivesListFr, item.fr]);
      setObjectivesListAr([...objectivesListAr, item.ar]);
    }
  };

  // Course Readiness & Quality Score calculation (0 to 100%)
  const qualityScore = useMemo(() => {
    let score = 0;
    if (slug.trim().length >= 3) score += 15;
    if (titleFr.trim() && titleAr.trim()) score += 15;
    if (summaryFr.trim() && summaryAr.trim()) score += 10;
    if (descriptionFr.trim().length >= 30) score += 15;
    const finalObjs = manualObjectivesMode ? lines(objectivesRawFr) : objectivesListFr;
    if (finalObjs.length >= 2) score += 20;
    else if (finalObjs.length >= 1) score += 10;
    if (trainerName.trim()) score += 10;
    if (durationMinutes > 0) score += 5;
    if (coverImageKey) score += 10;
    return Math.min(100, score);
  }, [slug, titleFr, titleAr, summaryFr, summaryAr, descriptionFr, manualObjectivesMode, objectivesRawFr, objectivesListFr, trainerName, durationMinutes, coverImageKey]);

  // Submission handler
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    setFeedbackMsg("");

    const form = e.currentTarget;
    const f = new FormData(form);
    const uploadedCoverKey = String(f.get("coverImageObjectKey") || "") || coverImageKey || null;

    // Resolve final objectives
    let frObjectives = manualObjectivesMode ? lines(objectivesRawFr) : objectivesListFr;
    let arObjectives = manualObjectivesMode ? lines(objectivesRawAr) : objectivesListAr;

    if (frObjectives.length === 0) {
      frObjectives = ["Acquérir les compétences clés du parcours"];
    }
    if (arObjectives.length === 0) {
      arObjectives = frObjectives;
    }

    // Auto-generate summary from description if left empty
    const resolvedSummaryFr = summaryFr.trim() || descriptionFr.trim().slice(0, 300) || titleFr.trim();
    const resolvedSummaryAr = summaryAr.trim() || descriptionAr.trim().slice(0, 300) || titleAr.trim() || resolvedSummaryFr;

    const payload = {
      slug: slug.trim(),
      titleFr: titleFr.trim(),
      titleAr: titleAr.trim() || titleFr.trim(),
      summaryFr: resolvedSummaryFr.slice(0, 500),
      summaryAr: resolvedSummaryAr.slice(0, 500),
      descriptionFr: descriptionFr.trim() || resolvedSummaryFr,
      descriptionAr: descriptionAr.trim() || descriptionFr.trim() || resolvedSummaryAr,
      category: category.trim(),
      trainerName: trainerName.trim() || "Équipe pédagogique ANEI",
      durationMinutes: Number(durationMinutes),
      priceMillimes: isFree ? 0 : Math.round(Number(priceTnd) * 1000),
      mode,
      level,
      published,
      featured,
      qualifiesForProfessionalPromotion,
      qualifyingTargetType: qualifiesForProfessionalPromotion ? qualifyingTargetType : null,
      qualifyingTargetCategory: qualifiesForProfessionalPromotion ? qualifyingTargetCategory : null,
      objectives: {
        fr: frObjectives,
        ar: arObjectives,
      },
      coverImageObjectKey: uploadedCoverKey,
    };

    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setState("done");
        setCreatedCourse({
          id: data.course.id,
          slug: data.course.slug,
          titleFr: data.course.titleFr,
          titleAr: data.course.titleAr,
          trainerName: data.course.trainerName,
          category: data.course.category,
        });
      } else {
        const errData = await res.json().catch(() => null);
        setState("error");
        setFeedbackMsg(
          errData?.error === "SLUG_EXISTS"
            ? ar
              ? "معرف الدورة (Slug) مستخدم بالفعل، اختر معرفاً آخر."
              : "Le slug URL est déjà utilisé par une autre formation."
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

  // Reset form to add another course
  const handleResetForNewCourse = () => {
    setCreatedCourse(null);
    setState("idle");
    setFeedbackMsg("");
    setTitleFr("");
    setTitleAr("");
    setSlug("");
    setSlugManuallyEdited(false);
    setSummaryFr("");
    setSummaryAr("");
    setDescriptionFr("");
    setDescriptionAr("");
    setPriceTnd("0");
    setIsFree(true);
    setCoverImageKey(null);
    setActiveTab("general");
  };

  // If course was successfully created, show Enterprise Handoff View
  if (state === "done" && createdCourse) {
    return (
      <div
        className="admin-surface"
        style={{
          border: "2px solid #10b981",
          borderRadius: 12,
          padding: 28,
          background: "#f0fdf4",
          textAlign: ar ? "right" : "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#10b981",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            ✓
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: "#065f46" }}>
              {ar ? "تم إنشاء الدورة بنجاح في كتالوج ANEI !" : "Formation créée avec succès dans le catalogue ANEI !"}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#047857" }}>
              {ar ? createdCourse.titleAr : createdCourse.titleFr} ({createdCourse.slug})
            </p>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d1fae5",
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            fontSize: 13,
          }}
        >
          <div>
            <span style={{ color: "#64748b", display: "block" }}>{ar ? "المدرب" : "Formateur référent"}</span>
            <strong>{createdCourse.trainerName}</strong>
          </div>
          <div>
            <span style={{ color: "#64748b", display: "block" }}>{ar ? "الفئة" : "Catégorie"}</span>
            <strong>{createdCourse.category}</strong>
          </div>
          <div>
            <span style={{ color: "#64748b", display: "block" }}>{ar ? "الحالة" : "Visibilité"}</span>
            <span style={{ color: "#059669", fontWeight: 700 }}>
              {published ? (ar ? "منشورة مباشرة" : "Publiée dans le catalogue") : (ar ? "مسودة غير معلنة" : "Brouillon privé")}
            </span>
          </div>
        </div>

        {/* Action Handoffs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Link
            href={`/${locale}/admin/courses/editor/${createdCourse.id}?section=programme`}
            className="admin-primary-button"
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon name="book" size={17} />
            {ar ? "فتح البرنامج وإضافة الوحدات والدروس الآن ←" : "Ouvrir le Programme (Ajouter Modules & Leçons) →"}
          </Link>

          <Link
            href={`/${locale}/formations/${createdCourse.slug}`}
            target="_blank"
            className="btn btn-secondary"
            style={{
              padding: "11px 18px",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="play" size={16} />
            {ar ? "معاينة الصفحة العامة للمتعلمين" : "Voir la page publique"}
          </Link>

          <button
            type="button"
            onClick={handleResetForNewCourse}
            className="btn btn-ghost"
            style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600 }}
          >
            {ar ? "+ إنشاء دورة أخرى" : "+ Créer une autre formation"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="admin-course-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER: READINESS SCORE & PROGRESS */}
      <div
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 10,
          padding: "14px 18px",
          background: qualityScore >= 80 ? "#f8fafc" : "#fff",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: 6,
                background: qualityScore >= 80 ? "#10b981" : qualityScore >= 50 ? "#f59e0b" : "#64748b",
                color: "#fff",
              }}
            >
              {qualityScore}%
            </span>
            <strong style={{ fontSize: 13, color: "#1e293b" }}>
              {ar ? "مؤشر جودة واكتمال الدورة (Course Readiness)" : "Indicateur d'exhaustivité pédagogique"}
            </strong>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setShowLivePreview(!showLivePreview)}
              style={{
                background: "none",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#0284c7",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Icon name="eye" size={14} />
              {showLivePreview
                ? (ar ? "إخفاء بطاقة الكتالوج" : "Masquer aperçu carte")
                : (ar ? "معاينة بطاقة الكتالوج الحية" : "Aperçu carte catalogue")}
            </button>
            <button
              type="button"
              onClick={handleCopyFrToAr}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              {ar ? "⎘ نسخ FR نحو AR" : "⎘ Dupliquer FR vers AR"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, width: "100%", background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${qualityScore}%`,
              background: qualityScore >= 80 ? "#10b981" : qualityScore >= 50 ? "#f59e0b" : "#0284c7",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* LIVE CATALOG CARD PREVIEW (OPTIONAL COLLAPSIBLE) */}
      {showLivePreview && (
        <div
          style={{
            border: "2px dashed #0284c7",
            borderRadius: 10,
            padding: 16,
            background: "#f0f9ff",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", marginBottom: 10 }}>
            {ar ? "معاينة حية: كيف ستظهر البطاقة في كتالوج المنصة" : "Aperçu en direct : Rendu de la carte dans le catalogue public"}
          </div>
          <div
            style={{
              maxWidth: 380,
              background: "#fff",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                height: 140,
                background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {coverImageKey ? "Image de couverture chargée ✓" : (titleFr || "Visuel de la formation")}
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                  {category}
                </span>
                <span style={{ color: "#64748b" }}>
                  {durationHours}h · {level}
                </span>
              </div>
              {qualifiesForProfessionalPromotion && (
                <div style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  🎖️ {ar ? "مسار تأهيلي للاعتماد ANEI" : `Qualifiant ANEI (${qualifyingTargetType})`}
                </div>
              )}
              <strong style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.3 }}>
                {titleFr || "Titre de la formation..."}
              </strong>
              {titleAr && (
                <div style={{ fontSize: 12, color: "#475569", direction: "rtl", textAlign: "right" }}>
                  {titleAr}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {trainerName || "Dr. Salma Karray"}
                </span>
                <strong style={{ fontSize: 14, color: isFree ? "#10b981" : "#0284c7" }}>
                  {isFree ? (ar ? "مجانية" : "Gratuit") : `${priceTnd} DT`}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDIO TAB NAVIGATOR */}
      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid #e2e8f0", paddingBottom: 6, flexWrap: "wrap" }}>
        {[
          { key: "general", labelFr: "1. Identification & Formateur", labelAr: "١. التعريف والمدرب" },
          { key: "content", labelFr: "2. Contenu & Objectifs", labelAr: "٢. المحتوى والأهداف" },
          { key: "settings", labelFr: "3. Modalités, Durée & Prix", labelAr: "٣. الصيغة والمدة والسعر" },
          { key: "visual", labelFr: "4. Visuel & Couverture", labelAr: "٤. الغلاف والوسائط" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 700 : 500,
              background: activeTab === tab.key ? "#0f172a" : "#f8fafc",
              color: activeTab === tab.key ? "#fff" : "#475569",
              border: "1px solid",
              borderColor: activeTab === tab.key ? "#0f172a" : "#cbd5e1",
              cursor: "pointer",
            }}
          >
            {ar ? tab.labelAr : tab.labelFr}
          </button>
        ))}
      </div>

      {/* TAB 1: IDENTIFICATION & INSTRUCTOR */}
      {activeTab === "general" && (
        <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, background: "#f8fafc" }}>
          <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
            {ar ? "١. التعريف والمدرب والفئة" : "1. Identification, Formateur & Catégorie"}
          </legend>

          <div className="field-row">
            <label style={{ flex: 1.5 }}>
              <span>Titre principal (FR)</span>
              <input
                name="titleFr"
                required
                placeholder="ex: Les fondamentaux de l'inclusion scolaire"
                value={titleFr}
                onChange={(e) => handleTitleFrChange(e.target.value)}
              />
            </label>

            <label style={{ flex: 1.5 }}>
              <span>العنوان بالعربية (AR)</span>
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

          <div className="field-row" style={{ marginTop: 10 }}>
            <label style={{ flex: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Slug URL (Identifiant unique du parcours)</span>
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
                placeholder="les-fondamentaux-de-linclusion-scolaire"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugManuallyEdited(true);
                }}
              />
              <small style={{ color: "#64748b", fontSize: 11, marginTop: 4, display: "block" }}>
                URL publique : <code style={{ color: "#0369a1" }}>/formations/{slug || "slug-formation"}</code>
              </small>
            </label>

            <label style={{ flex: 1.5 }}>
              <span>{ar ? "اسم المدرب / المؤطر" : "Formateur(rice) référent(e)"}</span>
              <input
                name="trainerName"
                required
                placeholder="Dr. Salma Karray (Pédopsychiatre)"
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
              />
            </label>
          </div>

          {/* Category presets pills */}
          <div style={{ marginTop: 14 }}>
            <label style={{ marginBottom: 6, display: "block" }}>
              <span>{ar ? "الفئة التصنيفية البيداغوجية" : "Catégorie pédagogique"}</span>
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

          {/* Professional Qualification Toggle */}
          <div style={{ marginTop: 16, padding: 14, background: qualifiesForProfessionalPromotion ? "#eff6ff" : "#f1f5f9", borderRadius: 8, border: qualifiesForProfessionalPromotion ? "1px solid #bfdbfe" : "1px solid #e2e8f0", transition: "all 0.2s" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#1e3a8a" }}>
              <input
                type="checkbox"
                checked={qualifiesForProfessionalPromotion}
                onChange={(e) => setQualifiesForProfessionalPromotion(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#0284c7" }}
              />
              <span>🎖️ {ar ? "دورة مؤهلة للاعتماد المهني ANEI (ترقية مرافقي الحياة المدرسية والأخصائيين)" : "Formation qualifiante pour l'agrément professionnel ANEI"}</span>
            </label>
            <p style={{ margin: "4px 0 0 28px", fontSize: 12, color: "#475569" }}>
              {ar
                ? "تتيح هذه الدورة للمتعلم الترشح للاعتماد الرسمي كـ AVS أو أخصائي مرخص في دليل المنصة بعد استكمالها واجتياز المقابلة."
                : "La complétion de ce parcours qualifie l'apprenant pour le statut certifié AVS ou Spécialiste dans les annuaires ANEI après entretien."}
            </p>

            {qualifiesForProfessionalPromotion && (
              <div style={{ marginTop: 12, paddingLeft: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                    {ar ? "نوع الاعتماد المستهدف" : "Corps de métier cible"}
                  </label>
                  <select
                    className="form-select"
                    value={qualifyingTargetType}
                    onChange={(e) => setQualifyingTargetType(e.target.value as "AVS" | "SPECIALIST")}
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
                    value={qualifyingTargetCategory}
                    onChange={(e) => setQualifyingTargetCategory(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                  >
                    {qualifyingTargetType === "AVS" ? (
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

          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className="btn btn-secondary btn-sm"
              style={{ padding: "8px 16px" }}
            >
              {ar ? "متابعة: المحتوى والأهداف ←" : "Continuer : Contenu & Objectifs →"}
            </button>
          </div>
        </fieldset>
      )}

      {/* TAB 2: CONTENT & PEDAGOGICAL OBJECTIVES */}
      {activeTab === "content" && (
        <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, background: "#fff" }}>
          <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
            {ar ? "٢. المحتوى البيداغوجي المزدوج والأهداف" : "2. Contenu bilingue & Objectifs pédagogiques"}
          </legend>

          <div className="field-row">
            <label>
              <span>Résumé court d&apos;accroche (FR) — max 500 car.</span>
              <textarea
                name="summaryFr"
                required
                maxLength={500}
                rows={2}
                placeholder="Une synthèse claire des enjeux et bénéfices concrets pour l'apprenant."
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
                placeholder="ملخص يبرز الفائدة المباشرة والمهارات المكتسبة للمشارك."
                value={summaryAr}
                onChange={(e) => setSummaryAr(e.target.value)}
              />
            </label>
          </div>

          <div className="field-row" style={{ marginTop: 10 }}>
            <label>
              <span>Description détaillée du programme (FR)</span>
              <textarea
                name="descriptionFr"
                rows={4}
                required
                placeholder="Présentation du contexte pédagogique, de la méthode et des compétences visées."
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
                placeholder="عرض سياق التدريب والمنهجية التربوية المعتمدة."
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
              />
            </label>
          </div>

          {/* PEDAGOGICAL OBJECTIVES STUDIO */}
          <div style={{ marginTop: 16, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <strong style={{ fontSize: 13, color: "#1e293b" }}>
                  {ar ? "الأهداف البيداغوجية المكتسبة" : "Objectifs pédagogiques opérationnels"}
                </strong>
                <small style={{ color: "#64748b", display: "block" }}>
                  {ar ? "ماذا سيتمكن المتعلم من إنجازه في نهاية الدورة؟" : "Compétences concrètes acquises par l'apprenant à l'issue du cursus."}
                </small>
              </div>
              <button
                type="button"
                onClick={() => setManualObjectivesMode(!manualObjectivesMode)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#0284c7",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {manualObjectivesMode
                  ? (ar ? "العودة للقائمة التفاعلية" : "Mode liste interactive")
                  : (ar ? "وضع النص الحر (سطر لكل هدف)" : "Mode texte libre")}
              </button>
            </div>

            {/* Quick Bloom taxonomy suggestion chips */}
            {!manualObjectivesMode && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 6 }}>
                  {ar ? "اقتراحات سريعة وفق معايير الإدماج المدرسي:" : "Suggestions pédagogiques prêtes à l'emploi (cliquer pour ajouter) :"}
                </span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {OBJECTIVE_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleInsertObjectiveSuggestion(sug)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 14,
                        fontSize: 11,
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      + {ar ? sug.ar : sug.fr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!manualObjectivesMode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {objectivesListFr.map((objFr, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      background: "#f8fafc",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <span style={{ color: "#0284c7", fontWeight: 700, fontSize: 12 }}>{idx + 1}.</span>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <div>{objFr}</div>
                      {objectivesListAr[idx] && (
                        <div style={{ color: "#64748b", fontSize: 12, direction: "rtl", textAlign: "right" }}>
                          {objectivesListAr[idx]}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveObjective(idx)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontWeight: 700,
                        padding: "2px 6px",
                      }}
                      title={ar ? "حذف" : "Supprimer"}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Add new custom objective row */}
                <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  <input
                    placeholder="Objectif FR (ex: Maîtriser les grilles d'observation)"
                    value={customObjInputFr}
                    onChange={(e) => setCustomObjInputFr(e.target.value)}
                    style={{ flex: 1, minWidth: 220 }}
                  />
                  <input
                    dir="rtl"
                    placeholder="الهدف بالعربية (اختياري)"
                    value={customObjInputAr}
                    onChange={(e) => setCustomObjInputAr(e.target.value)}
                    style={{ flex: 1, minWidth: 220 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomObjective}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "6px 14px", alignSelf: "center" }}
                  >
                    {ar ? "+ إضافة" : "+ Ajouter"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="field-row">
                <label>
                  <span>Objectifs FR (un par ligne)</span>
                  <textarea
                    rows={4}
                    value={objectivesRawFr}
                    onChange={(e) => setObjectivesRawFr(e.target.value)}
                    placeholder="Identifier les besoins spécifiques&#10;Adapter les supports d'évaluation"
                  />
                </label>
                <label>
                  <span>الأهداف AR (هدف في كل سطر)</span>
                  <textarea
                    dir="rtl"
                    rows={4}
                    value={objectivesRawAr}
                    onChange={(e) => setObjectivesRawAr(e.target.value)}
                    placeholder="تشخيص الاحتياجات الخاصة بالمتعلم&#10;تكييف الوسائل التقييمية في الفصل"
                  />
                </label>
              </div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className="btn btn-secondary btn-sm"
              style={{ padding: "8px 16px" }}
            >
              {ar ? "متابعة: الصيغة والمدة والسعر ←" : "Continuer : Modalités & Tarification →"}
            </button>
          </div>
        </fieldset>
      )}

      {/* TAB 3: SETTINGS, DURATION & PRICING */}
      {activeTab === "settings" && (
        <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, background: "#f8fafc" }}>
          <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
            {ar ? "٣. الصيغة والمدة والسعر والاعتماد" : "3. Modalités, Durée & Modèle Économique"}
          </legend>

          <div className="field-row">
            <label>
              <span>{ar ? "صيغة التدريب" : "Modalité d'apprentissage"}</span>
              <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="online">100% En ligne (Asynchrone / Vidéo & Quiz)</option>
                <option value="hybrid">Hybride (En ligne + Ateliers pratiques en direct)</option>
                <option value="onsite">Présentiel (En établissement / Centre ANEI)</option>
              </select>
            </label>

            <label>
              <span>{ar ? "مستوى الصعوبة" : "Niveau de difficulté"}</span>
              <select name="level" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="beginner">{ar ? "مبتدئ (Débutant / Sensibilisation)" : "Débutant (Sensibilisation)"}</option>
                <option value="intermediate">{ar ? "متوسط (Intermédiaire / Pratique de terrain)" : "Intermédiaire (Pratique de terrain)"}</option>
                <option value="advanced">{ar ? "متقدم (Avancé / Spécialisation clinique)" : "Avancé (Spécialisation)"}</option>
              </select>
            </label>
          </div>

          {/* DURATION ENGINE (HOURS & MINUTES) */}
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              <span>{ar ? "المدة الإجمالية التقديرية للتدريب" : "Durée estimée de la formation"}</span>
            </label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={durationHours}
                  onChange={(e) => handleHoursChange(Number(e.target.value))}
                  style={{ width: 80, fontWeight: 700 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{ar ? "ساعات" : "heures"}</span>
              </div>
              <span style={{ color: "#94a3b8" }}>=</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  name="durationMinutes"
                  type="number"
                  min="15"
                  step="15"
                  value={durationMinutes}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setDurationMinutes(m);
                    setDurationHours(Math.round((m / 60) * 10) / 10);
                  }}
                  style={{ width: 90 }}
                />
                <span style={{ fontSize: 13, color: "#64748b" }}>{ar ? "دقيقة" : "minutes"}</span>
              </div>

              {/* Fast duration increment pills */}
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 5, 10, 20].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => handleAddQuickHours(hrs)}
                    style={{
                      background: "#fff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 14,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    +{hrs}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PRICING ENGINE */}
          <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
            <label style={{ display: "block", marginBottom: 8 }}>
              <span>{ar ? "نموذج التسعير" : "Modèle tarifaire"}</span>
            </label>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="pricingChoice"
                  checked={isFree}
                  onChange={() => {
                    setIsFree(true);
                    setPriceTnd("0");
                  }}
                  style={{ width: 16, height: 16 }}
                />
                <strong style={{ fontSize: 13, color: isFree ? "#10b981" : "#334155" }}>
                  {ar ? "دورة مجانية للجميع (0 DT)" : "Formation gratuite (Accès libre)"}
                </strong>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="pricingChoice"
                  checked={!isFree}
                  onChange={() => {
                    setIsFree(false);
                    if (priceTnd === "0") setPriceTnd("75");
                  }}
                  style={{ width: 16, height: 16 }}
                />
                <strong style={{ fontSize: 13, color: !isFree ? "#0284c7" : "#334155" }}>
                  {ar ? "دورة مدفوعة" : "Formation payante"}
                </strong>
              </label>
            </div>

            {!isFree && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ maxWidth: 220 }}>
                  <span>{ar ? "السعر بالدينار التونسي (TND)" : "Tarif en Dinars Tunisiens (TND)"}</span>
                  <input
                    name="priceTnd"
                    type="number"
                    min="1"
                    step="0.001"
                    value={priceTnd}
                    onChange={(e) => setPriceTnd(e.target.value)}
                    required={!isFree}
                  />
                </label>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 18 }}>
                  = {Math.round(Number(priceTnd) * 1000)} millimes
                </div>
              </div>
            )}
          </div>

          {/* VISIBILITY & FEATURED TOGGLES */}
          <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
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

            <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                name="featured"
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#f59e0b" }}
              />
              <span style={{ fontWeight: 600 }}>
                {ar ? "تمييز الدورة على الصفحة الرئيسية (Badge Featured / Recommandé)" : "Mettre en avant sur la page d'accueil (Badge Recommandé)"}
              </span>
            </label>
          </div>

          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setActiveTab("visual")}
              className="btn btn-secondary btn-sm"
              style={{ padding: "8px 16px" }}
            >
              {ar ? "متابعة: الغلاف والوسائط ←" : "Continuer : Visuel & Couverture →"}
            </button>
          </div>
        </fieldset>
      )}

      {/* TAB 4: VISUAL & COVER */}
      {activeTab === "visual" && (
        <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, background: "#fff" }}>
          <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
            {ar ? "٤. صورة الغلاف والوسائط الرسمية" : "4. Image de couverture & Visuel officiel"}
          </legend>

          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px" }}>
            {ar
              ? "اختر صورة احترافية تعكس البيئة التعليمية الدامجة (نسبة 16:9 موصى بها، جودة عالية JPG / WebP)."
              : "Téléversez une image professionnelle représentative de l'apprentissage inclusif (Format 16:9 recommandé, JPG / PNG / WebP)."}
          </p>

          <div style={{ maxWidth: 480 }}>
            <AdminObjectUpload
              locale={locale}
              name="coverImageObjectKey"
              category="course"
              accept="image/jpeg,image/png,image/webp"
              labelFr="Image de couverture de la formation"
              labelAr="صورة الغلاف الرسمية للدورة"
            />
          </div>
        </fieldset>
      )}

      {/* FOOTER ACTIONS */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          paddingTop: 8,
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
              ? "إنشاء ونشر الدورة التكوينية"
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

        <div style={{ fontSize: 12, color: "#64748b" }}>
          {ar ? "سيتم تحويلك مباشرة لإضافة المحتوى والدروس بعد الإنشاء." : "Vous pourrez configurer modules et quiz immédiatement après la création."}
        </div>
      </div>
    </form>
  );
}
