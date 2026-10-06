"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { slugify } from "@/lib/slug";
import { AdminObjectUpload } from "@/components/admin/AdminObjectUpload";

const TYPE_PRESETS = [
  { fr: "Guide pratique", ar: "دليل تطبيقي" },
  { fr: "Fiche pédagogique", ar: "بطاقة بيداغوجية" },
  { fr: "Grille d'évaluation", ar: "شبكة تقييم" },
  { fr: "Support de cours", ar: "دعائم تعليمية" },
  { fr: "Outil AVS", ar: "أدوات مرافقة مدرسية" },
  { fr: "Modèle administratif", ar: "نموذج إداري" },
];

const AUDIENCE_PRESETS = [
  { fr: "Enseignants & Éducateurs", ar: "المدرسون والمربون" },
  { fr: "AVS & Accompagnants", ar: "المرافقون المدرسيون" },
  { fr: "Parents d'élèves", ar: "أولياء الأمور" },
  { fr: "Spécialistes (Orthophonie / Psy)", ar: "الأخصائيون المعالجون" },
  { fr: "Tous publics", ar: "الجميع" },
];

export function AdminResourceForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();

  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [type, setType] = useState("Guide pratique");
  const [titleFr, setTitleFr] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [descriptionFr, setDescriptionFr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [audienceFr, setAudienceFr] = useState("Enseignants & Éducateurs");
  const [audienceAr, setAudienceAr] = useState("المدرسون والمربون");
  const [level, setLevel] = useState("beginner");
  const [priceTnd, setPriceTnd] = useState("0");
  const [published, setPublished] = useState(true);

  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [feedbackMsg, setFeedbackMsg] = useState("");

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

  const handleCopyFrToAr = () => {
    if (!titleAr) setTitleAr(titleFr);
    if (!descriptionAr) setDescriptionAr(descriptionFr);
    if (!audienceAr) setAudienceAr(audienceFr);
  };

  const handleSelectTypePreset = (preset: { fr: string; ar: string }) => {
    setType(preset.fr);
  };

  const handleSelectAudiencePreset = (preset: { fr: string; ar: string }) => {
    setAudienceFr(preset.fr);
    setAudienceAr(preset.ar);
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    setFeedbackMsg("");

    const form = e.currentTarget;
    const f = new FormData(form);
    const payload = {
      slug: slug.trim(),
      titleFr: titleFr.trim(),
      titleAr: titleAr.trim(),
      descriptionFr: descriptionFr.trim(),
      descriptionAr: descriptionAr.trim(),
      audienceFr: audienceFr.trim(),
      audienceAr: audienceAr.trim(),
      type: type.trim(),
      level,
      priceMillimes: Math.round(Number(priceTnd) * 1000),
      coverImageObjectKey: String(f.get("coverImageObjectKey") || "") || null,
      downloadObjectKey: String(f.get("downloadObjectKey") || "") || null,
      published,
    };

    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setState("done");
        setFeedbackMsg(ar ? "تمت إضافة المورد بنجاح!" : "Ressource ajoutée avec succès !");
        setTitleFr("");
        setTitleAr("");
        setSlug("");
        setSlugManuallyEdited(false);
        setDescriptionFr("");
        setDescriptionAr("");
        router.refresh();
      } else {
        setState("error");
        setFeedbackMsg(ar ? "تعذر الإنشاء. تحقق من صحة المعرف (Slug)." : "Création impossible. Vérifiez le slug ou les champs requis.");
      }
    } catch {
      setState("error");
      setFeedbackMsg(ar ? "حدث خطأ غير متوقع." : "Erreur imprévue.");
    }
  }

  return (
    <form className="admin-course-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* IDENTIFICATION & PRESETS */}
      <div className="field-row">
        <label style={{ flex: 1.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Slug</span>
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
            placeholder="guide-inclusion-scolaire"
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
            placeholder="Guide, fiche, grille..."
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
        </label>
      </div>

      {/* Type preset pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: -6 }}>
        <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center" }}>
          {ar ? "نماذج سريعة:" : "Modèles :"}
        </span>
        {TYPE_PRESETS.map((p) => (
          <button
            key={p.fr}
            type="button"
            onClick={() => handleSelectTypePreset(p)}
            style={{
              padding: "3px 8px",
              borderRadius: 14,
              fontSize: 11,
              fontWeight: type === p.fr ? 700 : 500,
              background: type === p.fr ? "#0284c7" : "#f1f5f9",
              color: type === p.fr ? "#fff" : "#334155",
              border: type === p.fr ? "1px solid #0284c7" : "1px solid #cbd5e1",
              cursor: "pointer",
            }}
          >
            {ar ? p.ar : p.fr}
          </button>
        ))}
      </div>

      {/* BILINGUAL TITLES */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -6 }}>
        <button
          type="button"
          onClick={handleCopyFrToAr}
          style={{
            padding: "3px 10px",
            borderRadius: 6,
            fontSize: 11,
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
          <span>Titre FR</span>
          <input
            name="titleFr"
            required
            placeholder="ex: Guide méthodologique de l'AVS"
            value={titleFr}
            onChange={(e) => handleTitleFrChange(e.target.value)}
          />
        </label>
        <label>
          <span>العنوان AR</span>
          <input
            name="titleAr"
            dir="rtl"
            required
            placeholder="مثال: الدليل المنهجي للمرافق المدرسي"
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label>
          <span>Description FR</span>
          <textarea
            name="descriptionFr"
            rows={4}
            required
            value={descriptionFr}
            onChange={(e) => setDescriptionFr(e.target.value)}
          />
        </label>
        <label>
          <span>الوصف AR</span>
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

      {/* TARGET AUDIENCE & PRESETS */}
      <div className="field-row">
        <label>
          <span>{ar ? "الفئة المستهدفة FR" : "Public visé FR"}</span>
          <input
            name="audienceFr"
            required
            value={audienceFr}
            onChange={(e) => setAudienceFr(e.target.value)}
          />
        </label>
        <label>
          <span>{ar ? "الفئة المستهدفة AR" : "Public visé AR"}</span>
          <input
            name="audienceAr"
            dir="rtl"
            required
            value={audienceAr}
            onChange={(e) => setAudienceAr(e.target.value)}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: -6 }}>
        <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center" }}>
          {ar ? "الجمهور المستهدف:" : "Publics :"}
        </span>
        {AUDIENCE_PRESETS.map((p) => (
          <button
            key={p.fr}
            type="button"
            onClick={() => handleSelectAudiencePreset(p)}
            style={{
              padding: "3px 8px",
              borderRadius: 14,
              fontSize: 11,
              fontWeight: audienceFr === p.fr ? 700 : 500,
              background: audienceFr === p.fr ? "#00796B" : "#f1f5f9",
              color: audienceFr === p.fr ? "#fff" : "#334155",
              border: audienceFr === p.fr ? "1px solid #00796B" : "1px solid #cbd5e1",
              cursor: "pointer",
            }}
          >
            {ar ? p.ar : p.fr}
          </button>
        ))}
      </div>

      {/* LEVEL & PRICING */}
      <div className="field-row" style={{ marginTop: 6 }}>
        <label>
          <span>{ar ? "مستوى الصعوبة" : "Niveau de difficulté"}</span>
          <select name="level" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="beginner">{ar ? "مبتدئ" : "Débutant"}</option>
            <option value="intermediate">{ar ? "متوسط" : "Intermédiaire"}</option>
            <option value="advanced">{ar ? "متقدم" : "Avancé"}</option>
          </select>
        </label>
        <label>
          <span>{ar ? "السعر بالدينار (0 = مجاني)" : "Prix (TND, 0 = Gratuit)"}</span>
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

      {/* UPLOADS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <AdminObjectUpload
          locale={locale}
          name="downloadObjectKey"
          category="resource"
          accept="application/pdf"
          labelFr="Fichier PDF téléchargeable de la ressource"
          labelAr="ملف PDF القابل للتحميل للمورد"
        />
        <AdminObjectUpload
          locale={locale}
          name="coverImageObjectKey"
          category="resource"
          accept="image/jpeg,image/png,image/webp"
          labelFr="Image de couverture (Aperçu visuel)"
          labelAr="صورة الغلاف (المعاينة)"
        />
      </div>

      <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 4 }}>
        <input
          name="published"
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: "#0284c7" }}
        />
        <span style={{ fontWeight: 600 }}>{ar ? "نشر المورد فوراً في المكتبة العامة" : "Publier immédiatement dans la bibliothèque"}</span>
      </label>

      {/* SUBMIT BUTTON */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button className="admin-primary-button" disabled={state === "loading"} style={{ padding: "10px 24px" }}>
          {state === "loading"
            ? ar
              ? "جارٍ الإضافة..."
              : "Ajout en cours..."
            : ar
            ? "إضافة المورد إلى المكتبة"
            : "Ajouter la ressource"}
        </button>
        {feedbackMsg && (
          <span style={{ fontSize: 13, fontWeight: 600, color: state === "done" ? "#16a34a" : "#dc2626" }}>
            {feedbackMsg}
          </span>
        )}
      </div>
    </form>
  );
}
