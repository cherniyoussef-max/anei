"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  WEBINAR_PROVIDERS,
  DEFAULT_WEBINAR_FORM_FIELDS,
  type WebinarMeetingProvider,
  type WebinarFormField,
} from "@/lib/webinars";
import type { Locale } from "@/types";

export function AdminWebinarForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [provider, setProvider] = useState<WebinarMeetingProvider>("google_meet");
  const [dateError, setDateError] = useState("");

  // Form fields configuration
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    phone: true,
    role: true,
    organization: true,
    expectations: true,
  });
  const [requireApproval, setRequireApproval] = useState(true);
  const [customQuestions, setCustomQuestions] = useState<WebinarFormField[]>([]);
  const [newQuestionFr, setNewQuestionFr] = useState("");
  const [newQuestionAr, setNewQuestionAr] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<"text" | "textarea">("text");
  const [newQuestionRequired, setNewQuestionRequired] = useState(false);

  function toggleField(id: string) {
    setEnabledFields((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function addCustomQuestion() {
    if (!newQuestionFr.trim()) return;
    const qId = `custom_${Date.now()}`;
    setCustomQuestions((prev) => [
      ...prev,
      {
        id: qId,
        labelFr: newQuestionFr.trim(),
        labelAr: newQuestionAr.trim() || newQuestionFr.trim(),
        type: newQuestionType,
        required: newQuestionRequired,
      },
    ]);
    setNewQuestionFr("");
    setNewQuestionAr("");
    setNewQuestionRequired(false);
  }

  function removeCustomQuestion(id: string) {
    setCustomQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    const form = e.currentTarget;
    const f = new FormData(form);
    const startsAtLocal = String(f.get("startsAt") || "").trim();

    if (!startsAtLocal) {
      setDateError(ar ? "يرجى تحديد تاريخ ووقت صالحين." : "Veuillez renseigner une date et une heure valides.");
      setState("error");
      return;
    }

    const parsedDate = new Date(startsAtLocal);
    if (Number.isNaN(parsedDate.getTime())) {
      setDateError(ar ? "صيغة التاريخ غير صالحة." : "Format de date invalide.");
      setState("error");
      return;
    }
    setDateError("");

    // Assemble final form fields
    const finalFormFields: WebinarFormField[] = [
      ...DEFAULT_WEBINAR_FORM_FIELDS.filter((df) => enabledFields[df.id]),
      ...customQuestions,
    ];

    const isOnline = provider !== "in_person";
    const meetingUrl = isOnline ? (String(f.get("meetingUrl") || "").trim() || null) : null;
    const location = !isOnline ? (String(f.get("location") || "").trim() || null) : null;

    const payload = {
      slug: String(f.get("slug")),
      titleFr: String(f.get("titleFr")),
      titleAr: String(f.get("titleAr")),
      descriptionFr: String(f.get("descriptionFr")),
      descriptionAr: String(f.get("descriptionAr")),
      trainerName: String(f.get("trainerName")),
      startsAt: parsedDate.toISOString(),
      durationMinutes: Number(f.get("durationMinutes")),
      meetingProvider: provider,
      meetingUrl,
      location,
      meetingId: String(f.get("meetingId") || "") || null,
      meetingPasscode: String(f.get("meetingPasscode") || "") || null,
      targetAudience: String(f.get("targetAudience") || "ALL"),
      maxParticipants: Number(f.get("maxParticipants") || 250),
      replayUrl: String(f.get("replayUrl") || "") || null,
      published: f.get("published") === "on",
      formFields: finalFormFields,
      requireApproval,
    };

    const res = await fetch("/api/admin/webinars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setState(res.ok ? "done" : "error");
    if (res.ok) {
      form.reset();
      setCustomQuestions([]);
      router.refresh();
    }
  }

  const currentProviderMeta = WEBINAR_PROVIDERS[provider];

  return (
    <form className="admin-course-form" onSubmit={submit}>
      <div className="field-row">
        <label>
          <span>Slug</span>
          <input name="slug" required pattern="[a-z0-9-]+" placeholder="webinaire-inclusion" />
        </label>
        <label>
          <span>{ar ? "المدرب" : "Intervenant"}</span>
          <input name="trainerName" required placeholder="Dr. Amina Ben Salem" />
        </label>
      </div>

      <div className="field-row">
        <label>
          <span>Titre FR</span>
          <input name="titleFr" required placeholder="L'inclusion scolaire au quotidien" />
        </label>
        <label>
          <span>العنوان AR</span>
          <input name="titleAr" dir="rtl" required placeholder="الدمج المدرسي في الممارسة اليومية" />
        </label>
      </div>

      <div className="field-row">
        <label>
          <span>Description FR</span>
          <textarea name="descriptionFr" rows={4} required />
        </label>
        <label>
          <span>الوصف AR</span>
          <textarea name="descriptionAr" dir="rtl" rows={4} required />
        </label>
      </div>

      <div className="field-row">
        <label>
          <span>{ar ? "التاريخ والوقت" : "Date et heure"}</span>
          <input
            name="startsAt"
            type="datetime-local"
            required
            onChange={() => {
              if (dateError) setDateError("");
            }}
          />
          {dateError ? (
            <small className="form-error" style={{ color: "#dc2626", marginTop: "0.25rem", display: "block" }}>
              {dateError}
            </small>
          ) : null}
        </label>
        <label>
          <span>{ar ? "المدة بالدقائق" : "Durée (minutes)"}</span>
          <input name="durationMinutes" type="number" min="15" max="1440" defaultValue="60" required />
        </label>
      </div>

      {/* Meeting Provider & Helper Links */}
      <div className="field-row">
        <label>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{ar ? "منصة الاجتماع" : "Fournisseur de réunion"}</span>
            {currentProviderMeta.helperUrl ? (
              <a
                href={currentProviderMeta.helperUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "0.75rem", color: "#00796B", fontWeight: 600, textDecoration: "underline" }}
              >
                + {currentProviderMeta.helperLabel}
              </a>
            ) : null}
          </div>
          <select
            name="meetingProvider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as WebinarMeetingProvider)}
          >
            <option value="google_meet">Google Meet (Recommandé)</option>
            <option value="teams">Microsoft Teams</option>
            <option value="zoom">Zoom</option>
            <option value="in_person">{ar ? "حضوري (في عين المكان)" : "En présentiel"}</option>
            <option value="custom">{ar ? "رابط مخصص" : "Lien personnalisé"}</option>
          </select>
        </label>

        {provider === "in_person" ? (
          <label>
            <span>{ar ? "عنوان أو مكان الحضور (إلزامي)" : "Adresse ou lieu de la session (requis)"}</span>
            <input
              name="location"
              type="text"
              required
              placeholder={ar ? "مثال: قاعة الندوات - تونس العاصمة" : "Ex: Salle des conférences, Tunis"}
            />
          </label>
        ) : (
          <label>
            <span>{ar ? "رابط الاجتماع المباشر (HTTPS)" : "Lien de réunion direct (HTTPS)"}</span>
            <input
              name="meetingUrl"
              type="url"
              required
              placeholder={
                provider === "google_meet"
                  ? "https://meet.google.com/abc-defg-hij"
                  : provider === "teams"
                  ? "https://teams.microsoft.com/l/meetup-join/..."
                  : provider === "zoom"
                  ? "https://us02web.zoom.us/j/123456789"
                  : "https://..."
              }
            />
          </label>
        )}
      </div>

      <div className="field-row">
        <label>
          <span>{ar ? "معرف الاجتماع (اختياري)" : "ID de réunion (optionnel)"}</span>
          <input name="meetingId" placeholder="123-456-789" />
        </label>
        <label>
          <span>{ar ? "رمز المرور (اختياري)" : "Code secret / Passcode (optionnel)"}</span>
          <input name="meetingPasscode" placeholder="anei2026" />
        </label>
      </div>

      <div className="field-row">
        <label>
          <span>{ar ? "الجمهور المستهدف" : "Public cible"}</span>
          <input name="targetAudience" defaultValue="Enseignants, Parents, AVS" placeholder="Enseignants, Parents, AVS" />
        </label>
        <label>
          <span>{ar ? "الحد الأقصى للمشاركين" : "Capacité max de participants"}</span>
          <input name="maxParticipants" type="number" min="10" max="5000" defaultValue="250" />
        </label>
      </div>

      {/* REGISTRATION FORM CONFIGURATION SECTION */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          margin: "1rem 0",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div>
          <h4 style={{ margin: "0 0 0.25rem", color: "#082d55", fontSize: "1rem", fontWeight: 700 }}>
            {ar ? "تخصيص استمارة التسجيل المطلوبة للمشاركين" : "Configuration du formulaire d'inscription"}
          </h4>
          <p style={{ margin: 0, fontSize: "0.825rem", color: "#64748b" }}>
            {ar
              ? "اختر الحقول والأسئلة التي يجب على المستخدم الإجابة عنها عند التسجيل."
              : "Choisissez les champs et questions obligatoires ou facultatifs que l'utilisateur doit renseigner."}
          </p>
        </div>

        {/* Standard Fields Toggles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          {DEFAULT_WEBINAR_FORM_FIELDS.map((df) => (
            <label
              key={df.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.85rem",
                color: "#1e293b",
                cursor: "pointer",
                background: "#ffffff",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(enabledFields[df.id])}
                onChange={() => toggleField(df.id)}
              />
              <span>{ar ? df.labelAr : df.labelFr}</span>
              {df.required ? (
                <span style={{ fontSize: "0.7rem", color: "#dc2626", marginLeft: "auto" }}>
                  {ar ? "إلزامي" : "Requis"}
                </span>
              ) : null}
            </label>
          ))}
        </div>

        {/* Custom Questions List */}
        {customQuestions.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>
              {ar ? "الأسئلة المخصصة المضافة :" : "Questions personnalisées :"}
            </span>
            {customQuestions.map((q) => (
              <div
                key={q.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#ffffff",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <strong>{q.labelFr}</strong> {q.labelAr ? `(${q.labelAr})` : ""}
                  <small style={{ color: "#64748b", marginLeft: "0.5rem" }}>
                    [{q.type === "textarea" ? "Texte long" : "Texte court"}] {q.required ? "• Requis" : ""}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomQuestion(q.id)}
                  style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  ✕ Supprimer
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Add Question Row */}
        <div
          style={{
            background: "#ffffff",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: "1px dashed #94a3b8",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#082d55" }}>
            {ar ? "+ إضافة سؤال مخصص للاستمارة" : "+ Ajouter une question personnalisée"}
          </span>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Question en Français"
              value={newQuestionFr}
              onChange={(e) => setNewQuestionFr(e.target.value)}
              style={{ flex: 1, minWidth: "180px", padding: "0.4rem 0.6rem", fontSize: "0.85rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
            />
            <input
              type="text"
              dir="rtl"
              placeholder="السؤال بالعربية"
              value={newQuestionAr}
              onChange={(e) => setNewQuestionAr(e.target.value)}
              style={{ flex: 1, minWidth: "180px", padding: "0.4rem 0.6rem", fontSize: "0.85rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
            />
            <select
              value={newQuestionType}
              onChange={(e) => setNewQuestionType(e.target.value as "text" | "textarea")}
              style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
            >
              <option value="text">Texte court</option>
              <option value="textarea">Texte long</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: "#475569", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={newQuestionRequired}
                onChange={(e) => setNewQuestionRequired(e.target.checked)}
              />
              <span>Obligatoire</span>
            </label>
            <button
              type="button"
              onClick={addCustomQuestion}
              className="btn btn-secondary"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
            >
              Ajouter
            </button>
          </div>
        </div>

        {/* Approval Checkbox */}
        <label className="checkbox-row" style={{ marginTop: "0.25rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={requireApproval}
            onChange={(e) => setRequireApproval(e.target.checked)}
          />
          <span style={{ fontWeight: 600, color: "#082d55" }}>
            {ar
              ? "موافقة الإدارة المسبقة مطلوبة (يتم إرسال رمز الدخول الفردي عبر البريد والإشعارات بعد موافقة المشرف)"
              : "Validation manuelle requise par l'administrateur (le code Google Meet unique est généré et envoyé par e-mail après acceptation)"}
          </span>
        </label>
      </div>

      <div className="field-row">
        <label>
          <span>{ar ? "رابط الإعادة (Replay)" : "Lien de replay (optionnel)"}</span>
          <input name="replayUrl" type="url" placeholder="https://youtube.com/... ou vimeo" />
        </label>
      </div>

      <label className="checkbox-row">
        <input name="published" type="checkbox" defaultChecked />
        <span>{ar ? "نشر الندوة مباشرة في الموقع" : "Publier le webinaire immédiatement sur le site"}</span>
      </label>

      <button className="btn btn-primary" disabled={state === "loading"}>
        {state === "loading"
          ? (ar ? "جارٍ الإنشاء..." : "Création...")
          : (ar ? "إضافة الندوة" : "Ajouter le webinaire")}
      </button>

      {state === "done" ? (
        <small className="success-inline">{ar ? "تم الإنشاء بنجاح." : "Webinaire créé avec succès."}</small>
      ) : dateError ? (
        <small className="form-error">{dateError}</small>
      ) : state === "error" ? (
        <small className="form-error">
          {ar ? "تعذر الإنشاء. يرجى التحقق من الحقول أو المعرف (slug)." : "Création impossible. Vérifiez les champs ou le slug."}
        </small>
      ) : null}
    </form>
  );
}
