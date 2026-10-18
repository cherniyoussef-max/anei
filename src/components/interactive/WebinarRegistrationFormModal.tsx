"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import {
  DEFAULT_WEBINAR_FORM_FIELDS,
  getProviderMeta,
  type WebinarFormField,
} from "@/lib/webinars";
import type { Locale } from "@/types";

export interface WebinarRegistrationFormModalProps {
  webinarId: string;
  webinarSlug: string;
  webinarTitle: string;
  startsAt: Date | string;
  meetingProvider?: string | null;
  formFields?: WebinarFormField[] | null;
  requireApproval?: boolean;
  locale: Locale;
  isOpen: boolean;
  onClose: () => void;
  onRegistered: (data: {
    status: string;
    accessCode?: string | null;
    joinUrl?: string;
    directMeetingUrl?: string | null;
    googleCalendarUrl?: string;
    icsDownloadUrl?: string;
  }) => void;
}

export function WebinarRegistrationFormModal({
  webinarId,
  webinarSlug,
  webinarTitle,
  meetingProvider,
  formFields,
  locale,
  isOpen,
  onClose,
  onRegistered,
}: WebinarRegistrationFormModalProps) {
  const ar = locale === "ar";
  const fields = formFields && formFields.length > 0 ? formFields : DEFAULT_WEBINAR_FORM_FIELDS;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "loading" | "unauthorized" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  if (!isOpen) return null;

  const providerMeta = getProviderMeta(meetingProvider);
  const providerLabel = ar ? providerMeta.nameAr : providerMeta.name;
  const currentPath = typeof window !== "undefined" ? window.location.pathname : `/${locale}/webinaires/${webinarSlug}`;

  function handleFieldChange(fieldId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/webinars/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webinarId,
          answers,
        }),
      });

      if (res.status === 401) {
        setState("unauthorized");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setState("error");
        if (data.error === "MISSING_REQUIRED_FIELDS") {
          setErrorMsg(
            ar
              ? "يرجى ملء جميع الحقول الإلزامية في الاستمارة."
              : "Veuillez remplir tous les champs obligatoires du formulaire."
          );
        } else if (data.error === "WEBINAR_FULL") {
          setErrorMsg(
            ar
              ? "عذرًا، اكتمل العدد الأقصى للمشاركين في هذه الندوة."
              : "Désolé, la capacité maximale de ce webinaire est atteinte."
          );
        } else {
          setErrorMsg(
            ar
              ? "تعذر إرسال استمارة التسجيل. يرجى المحاولة لاحقًا."
              : "Une erreur est survenue lors de l'enregistrement."
          );
        }
        return;
      }

      onRegistered({
        status: data.status,
        accessCode: data.accessCode,
        joinUrl: data.joinUrl,
        directMeetingUrl: data.directMeetingUrl,
        googleCalendarUrl: data.googleCalendarUrl,
        icsDownloadUrl: data.icsDownloadUrl,
      });
      onClose();
    } catch {
      setState("error");
      setErrorMsg(ar ? "خطأ في الاتصال بالشبكة." : "Erreur de connexion au serveur.");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(8, 45, 85, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir={ar ? "rtl" : "ltr"}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
          padding: "1.75rem",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: ar ? "auto" : "1.25rem",
            left: ar ? "1.25rem" : "auto",
            background: "none",
            border: "none",
            fontSize: "1.25rem",
            color: "#64748b",
            cursor: "pointer",
            padding: "0.25rem",
          }}
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {state === "unauthorized" ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(8, 45, 85, 0.08)",
                color: "#082d55",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
              }}
            >
              <Icon name="user" size={30} />
            </div>

            <h3 style={{ fontSize: "1.35rem", color: "#082d55", fontWeight: 700, marginBottom: "0.75rem" }}>
              {ar ? "حساب ANEI إلزامي للمشاركة" : "Un compte ANEI est obligatoire"}
            </h3>

            <p style={{ color: "#475569", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              {ar
                ? "للمشاركة في الندوة، والحصول على رمز الدخول الفردي لـ Google Meet وشهادة الحضور، يجب تسجيل الدخول أو إنشاء حساب جديد."
                : "Pour participer au webinaire, recevoir votre code d'accès unique Google Meet et obtenir votre attestation, vous devez être connecté(e)."}
            </p>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href={`/${locale}/login?next=${encodeURIComponent(currentPath)}`}
                className="btn btn-primary"
                style={{ padding: "0.65rem 1.5rem" }}
              >
                {ar ? "تسجيل الدخول" : "Se connecter"}
              </Link>
              <Link
                href={`/${locale}/register?next=${encodeURIComponent(currentPath)}`}
                className="btn btn-secondary"
                style={{ padding: "0.65rem 1.5rem" }}
              >
                {ar ? "إنشاء حساب مجاني" : "Créer un compte"}
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: "1.25rem" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#00796B",
                }}
              >
                {ar ? "استمارة التسجيل الرسمية" : "Formulaire d'inscription"}
              </span>
              <h3 style={{ fontSize: "1.25rem", color: "#082d55", fontWeight: 800, margin: "0.25rem 0" }}>
                {webinarTitle}
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                {ar
                  ? `املأ الاستمارة لتأكيد مشاركتك واستلام رمز الدخول عبر ${providerLabel}.`
                  : `Remplissez les champs requis pour valider votre place et recevoir votre pass pour ${providerLabel}.`}
              </p>
            </div>

            {errorMsg ? (
              <div
                style={{
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  color: "#991b1b",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                {errorMsg}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {fields.map((f) => {
                const label = ar ? f.labelAr : f.labelFr;
                const placeholder = ar ? f.placeholderAr : f.placeholderFr;
                const value = answers[f.id] || "";

                return (
                  <label key={f.id} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>
                      {label} {f.required ? <span style={{ color: "#dc2626" }}>*</span> : null}
                    </span>

                    {f.type === "textarea" ? (
                      <textarea
                        rows={3}
                        required={f.required}
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => handleFieldChange(f.id, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem",
                          borderRadius: "0.5rem",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.9rem",
                        }}
                      />
                    ) : f.type === "select" ? (
                      <select
                        required={f.required}
                        value={value}
                        onChange={(e) => handleFieldChange(f.id, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem",
                          borderRadius: "0.5rem",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.9rem",
                          backgroundColor: "#fff",
                        }}
                      >
                        <option value="">{ar ? "-- اختر من القائمة --" : "-- Sélectionnez une option --"}</option>
                        {f.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {ar ? opt.labelAr : opt.labelFr}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type === "phone" ? "tel" : "text"}
                        required={f.required}
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => handleFieldChange(f.id, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem",
                          borderRadius: "0.5rem",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.9rem",
                        }}
                      />
                    )}
                  </label>
                );
              })}

              <div
                style={{
                  background: "#f8fafc",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.8rem",
                  color: "#64748b",
                }}
              >
                <Icon name="shield" size={14} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                {ar
                  ? "يتم إرسال رمز الدخول الفردي ورابط الاجتماع عبر البريد الإلكتروني وفي إشعارات حسابك بعد التأكيد."
                  : "Votre code d'accès unique et le lien de visioconférence vous seront envoyés par e-mail et dans vos notifications après validation."}
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={state === "loading"}
                  style={{ flex: 1, padding: "0.65rem 1rem", fontSize: "0.95rem" }}
                >
                  {state === "loading"
                    ? (ar ? "جارٍ إرسال الاستمارة..." : "Transmission en cours...")
                    : (ar ? "تأكيد وإرسال الاستمارة" : "Valider mon inscription")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ padding: "0.65rem 1rem" }}
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
