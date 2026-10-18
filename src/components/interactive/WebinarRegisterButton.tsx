"use client";

import { useState } from "react";
import Link from "next/link";
import { XCircle, CheckCircle2 } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { WebinarRegistrationFormModal } from "@/components/interactive/WebinarRegistrationFormModal";
import type { WebinarFormField } from "@/lib/webinars";
import type { Locale } from "@/types";

interface RegistrationDetails {
  status?: string;
  accessCode?: string | null;
  joinUrl?: string;
  directMeetingUrl?: string | null;
  googleCalendarUrl?: string;
  icsDownloadUrl?: string;
  alreadyRegistered?: boolean;
}

export function WebinarRegisterButton({
  webinarId,
  webinarSlug = "",
  webinarTitle = "",
  startsAt = "",
  locale,
  replayUrl,
  hasReplay,
  meetingProvider,
  formFields,
  requireApproval = true,
  compact = false,
  isPast = false,
}: {
  webinarId: string;
  webinarSlug?: string;
  webinarTitle?: string;
  startsAt?: Date | string;
  locale: Locale;
  replayUrl?: string | null;
  hasReplay?: boolean;
  meetingProvider?: string | null;
  formFields?: WebinarFormField[] | null;
  requireApproval?: boolean;
  compact?: boolean;
  isPast?: boolean;
}) {
  const ar = locale === "ar";
  const en = locale === "en";

  const [modalOpen, setModalOpen] = useState(false);
  const [regDetails, setRegDetails] = useState<RegistrationDetails | null>(null);
  const [copied, setCopied] = useState(false);

  if (hasReplay || replayUrl) {
    return (
      <Link
        className="btn btn-secondary"
        href={`/api/webinars/${webinarId}/join`}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
      >
        <Icon name="play" size={16} />
        {ar ? "مشاهدة الإعادة" : en ? "Watch replay" : "Voir le replay"}
      </Link>
    );
  }

  if (isPast) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.85rem", color: "#64748b", background: "#f1f5f9", padding: "0.4rem 0.85rem", borderRadius: "999px", fontWeight: 500 }}>
          {ar ? "انتهت الجلسة" : en ? "Session ended" : "Session terminée"}
        </span>
        {webinarSlug && compact ? (
          <Link
            href={`/${locale}/webinaires/${webinarSlug}`}
            className="btn btn-secondary"
            style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem", borderRadius: "999px" }}
          >
            {ar ? "التفاصيل" : "Détails"}
          </Link>
        ) : null}
      </div>
    );
  }

  function handleRegistrationSuccess(data: RegistrationDetails) {
    setRegDetails(data);
  }

  function copyCodeOrLink(textToCopy: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  // PENDING APPROVAL STATE
  if (regDetails?.status === "PENDING_APPROVAL") {
    return (
      <div
        style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "0.75rem",
          padding: compact ? "0.85rem" : "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
        dir={ar ? "rtl" : "ltr"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.25rem" }}>⏳</span>
          <strong style={{ color: "#92400e", fontSize: "0.95rem" }}>
            {ar ? "طلب التسجيل قيد المراجعة" : "Demande transmise avec succès"}
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#b45309", lineHeight: 1.5 }}>
          {ar
            ? "تم استلام استمارتك بنجاح! سيتم مراجعة الطلب من قبل الإدارة وستصلك إشعار بالمنصة وبريد إلكتروني يتضمن رمز الدخول الفردي فور القبول."
            : "Votre formulaire a bien été enregistré. Dès validation par l'administration, vous recevrez une notification sur la plateforme et un e-mail avec votre code d'accès Google Meet."}
        </p>
      </div>
    );
  }

  // REJECTED STATE
  if (regDetails?.status === "REJECTED") {
    return (
      <div
        style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "0.75rem",
          padding: compact ? "0.85rem" : "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
        dir={ar ? "rtl" : "ltr"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          <strong style={{ color: "#991b1b", fontSize: "0.95rem" }}>
            {ar ? "تم رفض طلب التسجيل" : "Inscription non retenue"}
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#b91c1c", lineHeight: 1.5 }}>
          {ar
            ? "نأسف، لم يتم قبول طلب تسجيلك في هذه الندوة."
            : "Votre demande d'inscription pour cette session n'a pas été retenue par les organisateurs."}
        </p>
      </div>
    );
  }

  // ACCEPTED / ATTENDED STATE
  if (regDetails?.status === "ACCEPTED" || regDetails?.status === "ATTENDED") {
    const isMeet = meetingProvider === "google_meet" || !meetingProvider;
    const providerLabel = isMeet ? "Google Meet" : "Microsoft Teams";
    const joinHref = regDetails.joinUrl || regDetails.directMeetingUrl || "#";

    return (
      <div
        className="webinar-registered-card"
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "0.75rem",
          padding: compact ? "0.85rem" : "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
        dir={ar ? "rtl" : "ltr"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <strong style={{ color: "#166534", fontSize: "0.95rem" }}>
            {ar ? "تم تأكيد تسجيلك بنجاح !" : "Inscription validée & confirmée !"}
          </strong>
        </div>

        {regDetails.accessCode ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px dashed #22c55e",
              borderRadius: "0.5rem",
              padding: "0.6rem 0.85rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <div>
              <span style={{ fontSize: "0.725rem", color: "#15803d", display: "block", textTransform: "uppercase", fontWeight: 700 }}>
                {ar ? "رمز الدخول الخاص بك (استخدام فردي)" : "Code d'accès unique (usage unique)"}
              </span>
              <strong style={{ fontSize: "1.1rem", fontFamily: "monospace", color: "#166534", letterSpacing: "1px" }}>
                {regDetails.accessCode}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => copyCodeOrLink(regDetails.accessCode || "")}
              style={{
                background: "rgba(34, 197, 94, 0.12)",
                border: "none",
                color: "#166534",
                padding: "0.35rem 0.65rem",
                borderRadius: "0.375rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {copied ? (ar ? "تم النسخ !" : "Copié !") : (ar ? "نسخ" : "Copier")}
            </button>
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {joinHref !== "#" ? (
            <a
              href={joinHref}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                backgroundColor: isMeet ? "#00796B" : "#5059C9",
                borderColor: isMeet ? "#00796B" : "#5059C9",
                fontSize: "0.85rem",
                padding: "0.45rem 0.9rem",
              }}
            >
              <Icon name="video" size={16} />
              {ar ? `الانضمام عبر ${providerLabel}` : `Rejoindre sur ${providerLabel}`}
            </a>
          ) : null}

          {regDetails.googleCalendarUrl ? (
            <a
              href={regDetails.googleCalendarUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                padding: "0.45rem 0.85rem",
              }}
            >
              <Icon name="calendar" size={16} />
              {ar ? "جوجل أجندة" : "Google Agenda"}
            </a>
          ) : null}

          {regDetails.icsDownloadUrl ? (
            <a
              href={regDetails.icsDownloadUrl}
              download
              className="btn btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                padding: "0.45rem 0.85rem",
              }}
              title="Fichier Outlook / Apple Calendar / Teams"
            >
              <Icon name="download" size={16} />
              {ar ? "ملف (.ics)" : "Fichier .ics"}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  // IDLE BUTTON STATE
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setModalOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", borderRadius: "999px" }}
        >
          <Icon name="arrow" size={15} className="directional-icon" />
          <span>{ar ? "التسجيل في الندوة" : en ? "Register" : "S'inscrire"}</span>
        </button>

        {webinarSlug && compact ? (
          <Link
            href={`/${locale}/webinaires/${webinarSlug}`}
            className="btn btn-secondary"
            style={{ fontSize: "0.85rem", borderRadius: "999px" }}
          >
            {ar ? "تفاصيل الندوة" : en ? "Details" : "En savoir plus"}
          </Link>
        ) : null}
      </div>

      <WebinarRegistrationFormModal
        webinarId={webinarId}
        webinarSlug={webinarSlug}
        webinarTitle={webinarTitle}
        startsAt={startsAt}
        meetingProvider={meetingProvider}
        formFields={formFields}
        requireApproval={requireApproval}
        locale={locale}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onRegistered={handleRegistrationSuccess}
      />
    </>
  );
}
