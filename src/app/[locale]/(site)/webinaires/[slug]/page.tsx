import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, isLocale } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { MeetingProviderBadge } from "@/components/ui/MeetingProviderBadge";
import { WebinarCountdown } from "@/components/interactive/WebinarCountdown";
import { WebinarRegisterButton } from "@/components/interactive/WebinarRegisterButton";
import { getWebinarBySlug } from "@/server/queries/catalog";
import { getProviderMeta } from "@/lib/webinars";
import type { Locale } from "@/types";
import { localizeTrainerName, localizeTrainerInitials } from "@/lib/arabic-locale";

export const dynamic = "force-dynamic";

export default async function WebinarDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const ar = locale === "ar";
  const en = locale === "en";
  const webinar = await getWebinarBySlug(slug);

  if (!webinar) {
    notFound();
  }

  const title = ar ? webinar.titleAr : webinar.titleFr;
  const description = ar ? webinar.descriptionAr : webinar.descriptionFr;
  const replay = Boolean(webinar.hasReplay);
  const dateLocale = ar ? "ar-TN" : en ? "en-GB" : "fr-FR";
  const providerMeta = getProviderMeta(webinar.meetingProvider);

  return (
    <div className="webinar-detail-page">
      {/* Top Banner / Breadcrumb */}
      <section
        style={{
          background: "linear-gradient(135deg, #1B3A5C 0%, #24476E 100%)",
          color: "#ffffff",
          padding: "3rem 1rem 3.5rem",
        }}
      >
        <div className="container" style={{ maxWidth: "1140px", margin: "0 auto" }}>
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.85rem",
              color: "#94a3b8",
              marginBottom: "1.25rem",
            }}
          >
            <Link href={`/${locale}`} style={{ color: "#94a3b8", textDecoration: "none" }}>
              {ar ? "الرئيسية" : "Accueil"}
            </Link>
            <span>{ar ? "‹" : "›"}</span>
            <Link href={`/${locale}/webinaires`} style={{ color: "#94a3b8", textDecoration: "none" }}>
              {ar ? "الندوات" : "Webinaires"}
            </Link>
            <span>{ar ? "‹" : "›"}</span>
            <span style={{ color: "#e2e8f0" }}>{title}</span>
          </nav>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
            <MeetingProviderBadge provider={webinar.meetingProvider} locale={locale as Locale} />
            <span
              style={{
                fontSize: "0.775rem",
                fontWeight: 600,
                padding: "0.25rem 0.65rem",
                borderRadius: "9999px",
                background: replay ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                color: replay ? "#fca5a5" : "#6ee7b7",
                border: `1px solid ${replay ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
              }}
            >
              {replay ? (ar ? "إعادة مسجلة" : "Replay disponible") : (ar ? "جلسة تفاعلية مباشرة" : "Session interactive en direct")}
            </span>
            {webinar.targetAudience ? (
              <span
                style={{
                  fontSize: "0.775rem",
                  padding: "0.25rem 0.65rem",
                  borderRadius: "9999px",
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#e2e8f0",
                }}
              >
                {ar ? `الجمهور: ${webinar.targetAudience}` : `Public : ${webinar.targetAudience}`}
              </span>
            ) : null}
          </div>

          <h1
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
              fontWeight: 700,
              fontFamily: "var(--font-sans), system-ui, sans-serif",
              color: "#ffffff",
              lineHeight: 1.25,
              marginBottom: "1rem",
              maxWidth: "850px",
            }}
          >
            {title}
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              flexWrap: "wrap",
              color: "#cbd5e1",
              fontSize: "0.95rem",
              marginTop: "1.5rem",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <Icon name="calendar" size={18} />
              {formatDate(webinar.startsAt, locale)}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <Icon name="clock" size={18} />
              {new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(webinar.startsAt)}
              {" · "}
              {webinar.durationMinutes} {ar ? "دقيقة" : "min"}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <Icon name="user" size={18} />
              {localizeTrainerName(webinar.trainerName, locale)}
            </span>
            {webinar.location ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                <Icon name="map" size={18} />
                <span>{webinar.location}</span>
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <section style={{ padding: "3rem 1rem", background: "#F4F7FA" }}>
        <div
          className="container"
          style={{
            maxWidth: "1140px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "2.5rem",
            alignItems: "start",
          }}
        >
          {/* Left Column: Presentation & Objectives */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {/* Live Countdown Card */}
            {!replay ? (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  padding: "1.5rem",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.04)",
                  border: "1px solid #E3E8EF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div>
                  <strong style={{ color: "#1B3A5C", fontSize: "1rem", display: "block" }}>
                    {ar ? "موعد انطلاق البث المباشر" : "Compte à rebours avant le direct"}
                  </strong>
                  <small style={{ color: "#64748b" }}>
                    {ar
                      ? "تأكد من التسجيل لتصلك التنبيهات ورابط الاجتماع."
                      : "Inscrivez-vous pour recevoir votre lien de connexion sécurisé."}
                  </small>
                </div>
                <WebinarCountdown startsAt={webinar.startsAt} locale={locale as Locale} />
              </div>
            ) : null}

            {/* Description Card */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "1rem",
                padding: "2rem",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.04)",
                border: "1px solid #E3E8EF",
              }}
            >
              <h2 style={{ fontSize: "1.35rem", color: "#1B3A5C", marginBottom: "1rem", fontWeight: 700 }}>
                {ar ? "عن هذا الويبينار" : "Présentation de la session"}
              </h2>
              <div
                style={{
                  fontSize: "1rem",
                  lineHeight: 1.7,
                  color: "#334155",
                  whiteSpace: "pre-line",
                }}
              >
                {description}
              </div>
            </div>

            {/* How to Join Steps Card */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "1rem",
                padding: "2rem",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.04)",
                border: "1px solid #E3E8EF",
              }}
            >
              <h3 style={{ fontSize: "1.2rem", color: "#1B3A5C", marginBottom: "1.25rem", fontWeight: 700 }}>
                {ar ? "كيفية المشاركة والانضمام" : "Comment se déroule la session ?"}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {[
                  {
                    step: "1",
                    title: ar ? "تسجيل فوري بدون تعقيد" : "Inscription instantanée",
                    desc: ar
                      ? "سجل بنقرة واحدة عبر حسابك أو عبر بريدك الإلكتروني كزائر."
                      : "Inscrivez-vous en 1 clic avec votre compte ou simplement votre e-mail en tant qu'invité.",
                  },
                  {
                    step: "2",
                    title: ar
                      ? `رابط مباشر عبر ${providerMeta.nameAr}`
                      : `Accès direct sur ${providerMeta.name}`,
                    desc: ar
                      ? `توليد فوري لتذكرتك ورابط الاجتماع على ${providerMeta.nameAr} بدون برامج إضافية.`
                      : `Obtenez immédiatement votre lien de réunion sécurisé sur ${providerMeta.name}.`,
                  },
                  {
                    step: "3",
                    title: ar ? "إضافة إلى التقويم والتذكير" : "Ajout au calendrier & rappels",
                    desc: ar
                      ? "أضف الموعد بنقرة واحدة إلى Google Agenda أو Outlook / Apple Calendar."
                      : "Ajoutez l’événement en 1 clic à votre Google Agenda ou téléchargez le fichier .ics.",
                  },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#1B3A5C",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        flexShrink: 0,
                      }}
                    >
                      {item.step}
                    </span>
                    <div>
                      <strong style={{ color: "#1B3A5C", fontSize: "0.95rem" }}>{item.title}</strong>
                      <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trainer Bio */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "1rem",
                padding: "1.75rem",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.04)",
                border: "1px solid #E3E8EF",
                display: "flex",
                gap: "1.25rem",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#e0e7ff",
                  color: "#3730a3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {localizeTrainerInitials(webinar.trainerName, locale)}
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                  {ar ? "المدرب والمحاضر" : "Intervenant expert"}
                </span>
                <h4 style={{ margin: "0.15rem 0 0.35rem", color: "#1B3A5C", fontSize: "1.1rem" }}>
                  {localizeTrainerName(webinar.trainerName, locale)}
                </h4>
                <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
                  {ar
                    ? "أخصائي وخبير معتمد في التربية الدامجة ومرافقة ذوي الاحتياجات الخاصة لدى أكاديمية ANEI."
                    : "Formateur et spécialiste de l’inclusion scolaire au sein du réseau ANEI."}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Registration Box & Calendar Widget */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", position: "sticky", top: "2rem" }}>
            <div
              style={{
                background: "#ffffff",
                borderRadius: "1rem",
                padding: "2rem",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                border: "1px solid #E3E8EF",
              }}
            >
              <h3 style={{ fontSize: "1.25rem", color: "#1B3A5C", marginBottom: "0.5rem", fontWeight: 700 }}>
                {ar ? "حجز مقعدك في الندوة" : "Participer au webinaire"}
              </h3>
              <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
                {ar
                  ? "المشاركة مجانية ومتاحة لجميع المعلمين والأولياء والمرافقين."
                  : "Accès gratuit pour l’ensemble des membres et éducateurs de la communauté."}
              </p>

              <WebinarRegisterButton
                webinarId={webinar.id}
                webinarSlug={webinar.slug}
                webinarTitle={title}
                startsAt={webinar.startsAt}
                locale={locale as Locale}
                hasReplay={webinar.hasReplay}
                meetingProvider={webinar.meetingProvider}
                formFields={webinar.formFields}
                requireApproval={webinar.requireApproval}
                isPast={webinar.isPast}
              />

              <div
                style={{
                  marginTop: "1.5rem",
                  paddingTop: "1.25rem",
                  borderTop: "1px solid #E3E8EF",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  fontSize: "0.85rem",
                  color: "#475569",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Icon name="shield" size={16} />
                  <span>{ar ? "منصة آمنة وروابط موثوقة" : "Session sécurisée sans publicité"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Icon name="check" size={16} />
                  <span>{ar ? "شهادة حضور للمشاركين" : "Attestation de participation délivrée"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Icon name="play" size={16} />
                  <span>{ar ? "إعادة مسجلة بعد انتهاء الجلسة" : "Accès au replay après le direct"}</span>
                </div>
              </div>
            </div>

            {/* Platform Help Card */}
            <div
              style={{
                background: "rgba(8, 45, 85, 0.03)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                border: "1px solid rgba(8, 45, 85, 0.08)",
                fontSize: "0.85rem",
                color: "#64748b",
              }}
            >
              <strong style={{ color: "#1B3A5C", display: "block", marginBottom: "0.25rem" }}>
                {ar ? "تحتاج إلى مساعدة؟" : "Besoin d'aide pour vous connecter ?"}
              </strong>
              {ar
                ? "فريق الدعم الفني لأكاديمية ANEI متاح عبر المحادثة المباشرة وواتساب للإجابة عن جميع استفساراتكم."
                : "Notre équipe pédagogique et technique est disponible via le chat en direct ou WhatsApp pour vous guider."}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
