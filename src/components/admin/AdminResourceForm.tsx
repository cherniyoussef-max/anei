"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import type { Locale } from "@/types";
import { slugify } from "@/lib/slug";
import { AdminObjectUpload } from "@/components/admin/AdminObjectUpload";
import { Icon } from "@/components/ui/Icon";

const TYPE_PRESETS = [
  { fr: "Guide pratique", ar: "دليل تطبيقي", desc: "Protocoles d'accueil et guides méthodologiques" },
  { fr: "Fiche pédagogique", ar: "بطاقة بيداغوجية", desc: "Fiches d'adaptation curriculaire et exercices adaptés" },
  { fr: "Grille d'évaluation", ar: "شبكة تقييم", desc: "Grilles d'observation de l'élève en classe et bilans" },
  { fr: "Support de cours", ar: "دعائم تعليمية", desc: "Diaporamas, synthèses et schémas conceptuels" },
  { fr: "Outil AVS", ar: "أدوات مرافقة مدرسية", desc: "Pictogrammes, timers visuels, réglettes de communication" },
  { fr: "Modèle administratif", ar: "نموذج إداري", desc: "Formulaires types PAI, PPS et conventions de scolarisation" },
];

const AUDIENCE_PRESETS = [
  { fr: "AVS & Accompagnants", ar: "المرافقون المدرسيون" },
  { fr: "Enseignants & Éducateurs", ar: "المدرسون والمربون" },
  { fr: "Parents d'élèves", ar: "أولياء الأمور" },
  { fr: "Spécialistes (Orthophonie / Psy)", ar: "الأخصائيون المعالجون" },
  { fr: "Directions d'établissement", ar: "إدارات المؤسسات التعليمية" },
  { fr: "Tous publics", ar: "الجميع" },
];

type CreatedResourceInfo = {
  id: string;
  slug: string;
  titleFr: string;
  titleAr: string;
  type: string;
  audienceFr: string;
};

export function AdminResourceForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";

  // Identification & Type
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [type, setType] = useState("Guide pratique");

  // Bilingual Titles & Descriptions
  const [titleFr, setTitleFr] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [descriptionFr, setDescriptionFr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");

  // Target Audience & Level
  const [audienceFr, setAudienceFr] = useState("Enseignants & Éducateurs");
  const [audienceAr, setAudienceAr] = useState("المدرسون والمربون");
  const [level, setLevel] = useState("beginner");

  // Pricing & Publication
  const [isFree, setIsFree] = useState(true);
  const [priceTnd, setPriceTnd] = useState("0");
  const [published, setPublished] = useState(true);

  // Uploaded keys
  const [downloadKey, setDownloadKey] = useState<string | null>(null);
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);

  // States
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [createdResource, setCreatedResource] = useState<CreatedResourceInfo | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);

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
    if (!descriptionAr) setDescriptionAr(descriptionFr);
    if (!audienceAr) setAudienceAr(audienceFr);
    setFeedbackMsg(ar ? "تم نسخ المحتوى الفرنسي للترجمة السريعة." : "Champs FR dupliqués vers AR pour traduction.");
    setTimeout(() => setFeedbackMsg(""), 3500);
  };

  const handleSelectTypePreset = (preset: { fr: string; ar: string }) => {
    setType(preset.fr);
  };

  const handleSelectAudiencePreset = (preset: { fr: string; ar: string }) => {
    setAudienceFr(preset.fr);
    setAudienceAr(preset.ar);
  };

  // Resource Readiness Score (0 - 100%)
  const qualityScore = useMemo(() => {
    let score = 0;
    if (slug.trim().length >= 3) score += 15;
    if (type.trim().length >= 2) score += 15;
    if (titleFr.trim() && titleAr.trim()) score += 20;
    if (descriptionFr.trim().length >= 20 && descriptionAr.trim().length >= 20) score += 20;
    if (audienceFr.trim() && audienceAr.trim()) score += 15;
    if (downloadKey || coverImageKey) score += 15;
    return Math.min(100, score);
  }, [slug, type, titleFr, titleAr, descriptionFr, descriptionAr, audienceFr, audienceAr, downloadKey, coverImageKey]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    setFeedbackMsg("");

    const form = e.currentTarget;
    const f = new FormData(form);

    const uploadedCoverKey = String(f.get("coverImageObjectKey") || "") || coverImageKey || null;
    const uploadedDownloadKey = String(f.get("downloadObjectKey") || "") || downloadKey || null;

    const payload = {
      slug: slug.trim(),
      titleFr: titleFr.trim(),
      titleAr: titleAr.trim() || titleFr.trim(),
      descriptionFr: descriptionFr.trim(),
      descriptionAr: descriptionAr.trim() || descriptionFr.trim(),
      audienceFr: audienceFr.trim(),
      audienceAr: audienceAr.trim() || audienceFr.trim(),
      type: type.trim(),
      level,
      priceMillimes: isFree ? 0 : Math.round(Number(priceTnd) * 1000),
      coverImageObjectKey: uploadedCoverKey,
      downloadObjectKey: uploadedDownloadKey,
      published,
    };

    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setState("done");
        setCreatedResource({
          id: data.resource.id,
          slug: data.resource.slug,
          titleFr: data.resource.titleFr,
          titleAr: data.resource.titleAr,
          type: data.resource.type,
          audienceFr: data.resource.audienceFr,
        });
      } else {
        const errData = await res.json().catch(() => null);
        setState("error");
        setFeedbackMsg(
          errData?.error === "SLUG_EXISTS"
            ? ar
              ? "معرف المورد (Slug) مستخدم بالفعل، اختر معرفاً آخر."
              : "Le slug est déjà utilisé par une autre ressource."
            : ar
            ? "تعذر الإنشاء. يرجى التحقق من صحة المعرف والحقول المطلوبة."
            : "Création impossible. Vérifiez le slug ou les champs requis.",
        );
      }
    } catch {
      setState("error");
      setFeedbackMsg(ar ? "حدث خطأ غير متوقع في الاتصال." : "Erreur de connexion serveur.");
    }
  }

  const handleResetForNewResource = () => {
    setCreatedResource(null);
    setState("idle");
    setFeedbackMsg("");
    setTitleFr("");
    setTitleAr("");
    setSlug("");
    setSlugManuallyEdited(false);
    setDescriptionFr("");
    setDescriptionAr("");
    setDownloadKey(null);
    setCoverImageKey(null);
    setIsFree(true);
    setPriceTnd("0");
  };

  // If resource was successfully created, show Enterprise Handoff View
  if (state === "done" && createdResource) {
    return (
      <div
        className="admin-surface"
        style={{
          border: "2px solid #10b981",
          borderRadius: 12,
          padding: 24,
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
            <Check style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: "#065f46" }}>
              {ar ? "تمت إضافة المورد بنجاح إلى المكتبة !" : "Ressource ajoutée avec succès à la bibliothèque !"}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#047857" }}>
              {ar ? createdResource.titleAr : createdResource.titleFr} ({createdResource.slug})
            </p>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d1fae5",
            borderRadius: 8,
            padding: 14,
            marginBottom: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            fontSize: 13,
          }}
        >
          <div>
            <span style={{ color: "#64748b", display: "block" }}>{ar ? "النوع" : "Type de document"}</span>
            <strong>{createdResource.type}</strong>
          </div>
          <div>
            <span style={{ color: "#64748b", display: "block" }}>{ar ? "الجمهور المستهدف" : "Public visé"}</span>
            <strong>{createdResource.audienceFr}</strong>
          </div>
          <div>
            <span style={{ color: "#64748b", display: "block" }}>{ar ? "الحالة" : "Visibilité"}</span>
            <span style={{ color: "#059669", fontWeight: 700 }}>
              {published ? (ar ? "منشور في المكتبة العامة" : "Publié dans la bibliothèque") : (ar ? "مسودة خاصة" : "Brouillon privé")}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Link
            href={`/${locale}/bibliotheque?q=${createdResource.slug}`}
            target="_blank"
            className="admin-primary-button"
            style={{
              padding: "11px 22px",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon name="play" size={16} />
            {ar ? "عرض في المكتبة العامة للمستخدمين ←" : "Consulter dans la bibliothèque publique →"}
          </Link>

          <button
            type="button"
            onClick={handleResetForNewResource}
            className="btn btn-secondary"
            style={{ padding: "10px 18px", fontSize: 13, fontWeight: 600 }}
          >
            {ar ? "+ إضافة مورد آخر" : "+ Ajouter une autre ressource"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="admin-course-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* HEADER: READINESS SCORE & CONTROLS */}
      <div
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 10,
          padding: "12px 16px",
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
              {ar ? "مؤشر اكتمال المورد (Resource Readiness)" : "Indicateur d'exhaustivité documentaire"}
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
                ? (ar ? "إخفاء بطاقة المكتبة" : "Masquer aperçu carte")
                : (ar ? "معاينة بطاقة المكتبة" : "Aperçu carte bibliothèque")}
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
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Copy style={{ width: 13, height: 13 }} />
              {ar ? "نسخ FR نحو AR" : "Dupliquer FR vers AR"}
            </button>
          </div>
        </div>

        {/* Quality Progress bar */}
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

      {/* LIVE LIBRARY CARD PREVIEW */}
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
            {ar ? "معاينة حية: كيف ستظهر البطاقة في المكتبة الرقمية العامة" : "Aperçu en direct : Rendu de la ressource dans la bibliothèque"}
          </div>
          <div
            style={{
              maxWidth: 360,
              background: "#fff",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                height: 120,
                background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {coverImageKey ? "Aperçu de couverture chargé" : (titleFr || "Visuel du document")}
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ background: "#ecfdf5", color: "#065f46", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                  {type}
                </span>
                <span style={{ color: "#64748b" }}>{level}</span>
              </div>
              <strong style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.3 }}>
                {titleFr || "Titre de la ressource..."}
              </strong>
              {descriptionFr && (
                <p style={{ fontSize: 12, color: "#475569", margin: 0, lineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {descriptionFr}
                </p>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 11, color: "#047857", fontWeight: 600 }}>
                  {audienceFr}
                </span>
                <strong style={{ fontSize: 13, color: isFree ? "#10b981" : "#0284c7" }}>
                  {isFree ? (ar ? "مجاني (PDF)" : "Gratuit (PDF)") : `${priceTnd} DT`}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: IDENTIFICATION & TYPOLOGY */}
      <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#f8fafc" }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
          {ar ? "١. نوع الوثيقة والمعرف الرقمي" : "1. Typologie documentaire & Identifiant"}
        </legend>

        <div className="field-row">
          <label style={{ flex: 1.5 }}>
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
              placeholder="guide-adaptation-classe-inclusive"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugManuallyEdited(true);
              }}
            />
          </label>

          <label style={{ flex: 2 }}>
            <span>{ar ? "نوع الوثيقة أو المورد" : "Type de document"}</span>
            <input
              name="type"
              required
              placeholder="Guide pratique, Fiche pédagogique, Grille..."
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </label>
        </div>

        {/* Enhanced Type presets pills with descriptive tags */}
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
            {ar ? "نماذج وأنواع الوثائق المعتمدة:" : "Modèles documentaires certifiés ANEI :"}
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TYPE_PRESETS.map((p) => (
              <button
                key={p.fr}
                type="button"
                onClick={() => handleSelectTypePreset(p)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: type === p.fr ? 700 : 500,
                  background: type === p.fr ? "#0284c7" : "#fff",
                  color: type === p.fr ? "#fff" : "#334155",
                  border: type === p.fr ? "1px solid #0284c7" : "1px solid #cbd5e1",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {ar ? p.ar : p.fr}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      {/* SECTION 2: BILINGUAL TITLES & DESCRIPTIONS */}
      <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#fff" }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
          {ar ? "٢. العناوين والوصف البيداغوجي المزدوج" : "2. Titres & Descriptifs bilingues"}
        </legend>

        <div className="field-row">
          <label>
            <span>Titre en français (FR)</span>
            <input
              name="titleFr"
              required
              placeholder="ex: Guide méthodologique de l'accompagnement scolaire"
              value={titleFr}
              onChange={(e) => handleTitleFrChange(e.target.value)}
            />
          </label>
          <label>
            <span>العنوان بالعربية (AR)</span>
            <input
              name="titleAr"
              dir="rtl"
              required
              placeholder="مثال: الدليل المنهجي للمرافقة المدرسية الشاملة"
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
            />
          </label>
        </div>

        <div className="field-row" style={{ marginTop: 10 }}>
          <label>
            <span>Description détaillée & Modalités d&apos;utilisation (FR)</span>
            <textarea
              name="descriptionFr"
              rows={4}
              required
              placeholder="Précisez le contexte d'utilisation, le contenu du livrable et les bénéfices pour le professionnel ou la famille."
              value={descriptionFr}
              onChange={(e) => setDescriptionFr(e.target.value)}
            />
          </label>
          <label>
            <span>الوصف المفصل ودليل الاستخدام (AR)</span>
            <textarea
              name="descriptionAr"
              dir="rtl"
              rows={4}
              required
              placeholder="وضّح كيفية استثمار هذا المورد والنتائج المرجوة في الميدان المدرسي."
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      {/* SECTION 3: TARGET AUDIENCE & PRESETS */}
      <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#f8fafc" }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
          {ar ? "٣. الفئة المستهدفة والمستوى" : "3. Public cible & Niveau d'expertise"}
        </legend>

        <div className="field-row">
          <label>
            <span>{ar ? "الفئة المستهدفة (FR)" : "Public visé (FR)"}</span>
            <input
              name="audienceFr"
              required
              value={audienceFr}
              onChange={(e) => setAudienceFr(e.target.value)}
            />
          </label>
          <label>
            <span>{ar ? "الفئة المستهدفة (AR)" : "Public visé (AR)"}</span>
            <input
              name="audienceAr"
              dir="rtl"
              required
              value={audienceAr}
              onChange={(e) => setAudienceAr(e.target.value)}
            />
          </label>
        </div>

        {/* Audience Presets */}
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 6 }}>
            {ar ? "اختيار سريع للمستفيدين:" : "Sélection rapide des bénéficiaires :"}
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {AUDIENCE_PRESETS.map((p) => (
              <button
                key={p.fr}
                type="button"
                onClick={() => handleSelectAudiencePreset(p)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 14,
                  fontSize: 11,
                  fontWeight: audienceFr === p.fr ? 700 : 500,
                  background: audienceFr === p.fr ? "#00796B" : "#fff",
                  color: audienceFr === p.fr ? "#fff" : "#334155",
                  border: audienceFr === p.fr ? "1px solid #00796B" : "1px solid #cbd5e1",
                  cursor: "pointer",
                }}
              >
                {ar ? p.ar : p.fr}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row" style={{ marginTop: 12 }}>
          <label>
            <span>{ar ? "مستوى الصعوبة" : "Niveau de difficulté"}</span>
            <select name="level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="beginner">{ar ? "مبتدئ (تحسيس ومفاهيم أولية)" : "Débutant (Sensibilisation & Repères)"}</option>
              <option value="intermediate">{ar ? "متوسط (ممارسة ميدانية)" : "Intermédiaire (Pratique de terrain)"}</option>
              <option value="advanced">{ar ? "متقدم (تخصص سريري وبيداغوجي)" : "Avancé (Spécialisation)"}</option>
            </select>
          </label>
        </div>
      </fieldset>

      {/* SECTION 4: FILE UPLOADS */}
      <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#fff" }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
          {ar ? "٤. الملفات والمستندات القابلة للتحميل" : "4. Fichiers & Livrables téléchargeables"}
        </legend>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <AdminObjectUpload
            locale={locale}
            name="downloadObjectKey"
            category="resource"
            accept="application/pdf"
            labelFr="Fichier PDF téléchargeable officiel"
            labelAr="ملف PDF الرسمي القابل للتحميل"
          />
          <AdminObjectUpload
            locale={locale}
            name="coverImageObjectKey"
            category="resource"
            accept="image/jpeg,image/png,image/webp"
            labelFr="Image de couverture (Aperçu visuel)"
            labelAr="صورة الغلاف (المعاينة البصرية)"
          />
        </div>
      </fieldset>

      {/* SECTION 5: PRICING & PUBLICATION */}
      <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#f8fafc" }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", color: "#1e293b" }}>
          {ar ? "٥. التسعير والنشر" : "5. Tarification & Publication"}
        </legend>

        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="radio"
              name="resourcePricingChoice"
              checked={isFree}
              onChange={() => {
                setIsFree(true);
                setPriceTnd("0");
              }}
              style={{ width: 16, height: 16 }}
            />
            <strong style={{ fontSize: 13, color: isFree ? "#10b981" : "#334155" }}>
              {ar ? "مورد مجاني متاح للجميع (0 DT)" : "Ressource gratuite (Accès libre)"}
            </strong>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="radio"
              name="resourcePricingChoice"
              checked={!isFree}
              onChange={() => {
                setIsFree(false);
                if (priceTnd === "0") setPriceTnd("15");
              }}
              style={{ width: 16, height: 16 }}
            />
            <strong style={{ fontSize: 13, color: !isFree ? "#0284c7" : "#334155" }}>
              {ar ? "مورد مدفوع" : "Ressource payante"}
            </strong>
          </label>
        </div>

        {!isFree && (
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ maxWidth: 220 }}>
              <span>{ar ? "السعر بالدينار التونسي (TND)" : "Prix en Dinars Tunisiens (TND)"}</span>
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

        <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            name="published"
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "#0284c7" }}
          />
          <span style={{ fontWeight: 600 }}>
            {ar ? "نشر المورد فوراً في المكتبة العامة" : "Publier immédiatement dans la bibliothèque publique"}
          </span>
        </label>
      </fieldset>

      {/* SUBMIT BUTTON */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="admin-primary-button"
            disabled={state === "loading"}
            style={{ padding: "12px 28px", fontSize: 14, fontWeight: 700 }}
          >
            {state === "loading"
              ? ar
                ? "جارٍ الإضافة..."
                : "Ajout en cours..."
              : ar
              ? "إضافة المورد إلى المكتبة"
              : "Ajouter la ressource"}
          </button>

          {feedbackMsg && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: state === "done" ? "#16a34a" : "#dc2626",
              }}
            >
              {feedbackMsg}
            </span>
          )}
        </div>

        <div style={{ fontSize: 12, color: "#64748b" }}>
          {ar ? "سيتم التحقق من حماية الملف وتأمينه تلقائياً." : "Accès sécurisé et livraison protégée par jeton d'achat."}
        </div>
      </div>
    </form>
  );
}
