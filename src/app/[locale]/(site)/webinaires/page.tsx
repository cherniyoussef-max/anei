import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, isLocale } from "@/lib/i18n";
import { webinars as translations } from "@/lib/data";
import { PageHero } from "@/components/ui/PageHero";
import { Icon } from "@/components/ui/Icon";
import { MeetingProviderBadge } from "@/components/ui/MeetingProviderBadge";
import { WebinarRegisterButton } from "@/components/interactive/WebinarRegisterButton";
import { listPublishedWebinars } from "@/server/queries/catalog";
import { publicDataOr } from "@/server/queries/public-fallback";
import { localizeTrainerName } from "@/lib/arabic-locale";

export const dynamic = "force-dynamic";

export default async function WebinarsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const en = locale === "en";
  const rows = await publicDataOr("webinars", listPublishedWebinars, []);
  const dateLocale = ar ? "ar-TN" : en ? "en-GB" : "fr-FR";

  return (
    <>
      <PageHero
        eyebrow={ar ? "ندوات تفاعلية وإعادات مباشرة" : en ? "Live webinars & replays" : "Webinaires & replays interactifs"}
        title={ar ? "تعلّم مباشرة عبر Google Meet وTeams" : en ? "Learn live via Google Meet & Teams" : "Apprendre en direct, échanger et progresser"}
        description={ar
          ? "جلسات مباشرة مع كبار الأخصائيين بروابط سريعة وموثوقة عبر Google Meet وTeams، وتسجيل سهل ومجاني."
          : "Des sessions animées par des experts via Google Meet et Microsoft Teams, avec inscription instantanée et rappels dans votre agenda."}
      />

      <section className="section webinars-premium">
        <div className="container webinar-page-grid">
          <div className="webinar-list-large">
            {!rows.length ? (
              <div className="empty-state webinar-empty-state">
                <Icon name="calendar" size={24} />
                <strong>{ar ? "لا توجد ندوات مجدولة حاليًا" : en ? "No webinars currently scheduled" : "Aucun webinaire n’est programmé actuellement"}</strong>
                <p>{ar ? "ستظهر الجلسات الجديدة هنا فور نشرها." : en ? "New live sessions will appear here as soon as they are published." : "Les nouvelles sessions apparaîtront ici dès leur publication."}</p>
              </div>
            ) : null}

            {rows.map((webinar, index) => {
              const replay = Boolean(webinar.hasReplay);
              const translated = translations[index];
              const title = ar ? webinar.titleAr : en ? translated?.title.en ?? webinar.titleFr : webinar.titleFr;
              const description = ar ? webinar.descriptionAr : en ? translated?.description.en ?? webinar.descriptionFr : webinar.descriptionFr;

              return (
                <article className="webinar-large-card premium-card" key={webinar.id}>
                  <div className="webinar-date-block">
                    <strong>{webinar.startsAt.getDate()}</strong>
                    <span>{new Intl.DateTimeFormat(dateLocale, { month: "short" }).format(webinar.startsAt)}</span>
                  </div>

                  <div className="webinar-large-main">
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                      <span className={replay ? "status-pill replay" : "status-pill"}>
                        {replay ? (ar ? "إعادة" : en ? "Replay" : "Replay") : (ar ? "قادم" : en ? "Upcoming" : "À venir")}
                      </span>
                      <MeetingProviderBadge provider={webinar.meetingProvider} locale={locale} />
                    </div>

                    <h2 style={{ fontSize: "1.25rem", margin: "0.25rem 0 0.5rem" }}>
                      <Link href={`/${locale}/webinaires/${webinar.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {title}
                      </Link>
                    </h2>

                    <p style={{ margin: "0 0 0.75rem", color: "#475569", fontSize: "0.925rem", lineHeight: 1.5 }}>
                      {description}
                    </p>

                    <div className="meta-row" style={{ marginTop: "auto" }}>
                      <span>
                        <Icon name="calendar" size={16} />
                        {formatDate(webinar.startsAt, locale)}
                      </span>
                      <span>
                        <Icon name="clock" size={16} />
                        {new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(webinar.startsAt)}
                        {" · "}
                        {webinar.durationMinutes} {ar ? "دقيقة" : "min"}
                      </span>
                      <span>
                        <Icon name="user" size={16} />
                        {localizeTrainerName(webinar.trainerName, locale)}
                      </span>
                    </div>
                  </div>

                  <WebinarRegisterButton
                    webinarId={webinar.id}
                    webinarSlug={webinar.slug}
                    webinarTitle={ar ? webinar.titleAr : webinar.titleFr}
                    startsAt={webinar.startsAt}
                    locale={locale}
                    hasReplay={webinar.hasReplay}
                    meetingProvider={webinar.meetingProvider}
                    formFields={webinar.formFields}
                    requireApproval={webinar.requireApproval}
                    compact={true}
                  />
                </article>
              );
            })}
          </div>

          <aside className="calendar-card premium-card">
            <span className="eyebrow">{ar ? "المواعيد" : en ? "Schedule" : "Agenda"}</span>
            <h3>{ar ? "جلسات الأكاديمية" : en ? "ANEI sessions" : "Les rendez-vous ANEI"}</h3>
            <p>
              {ar
                ? "بعد التسجيل ستظهر الندوة تلقائيًا في مساحتك مع إمكانية إضافتها إلى Google Agenda أو Outlook."
                : "Après inscription, accédez directement à la réunion Google Meet / Teams et recevez l'événement dans votre agenda."}
            </p>

            <div className="mini-event-list">
              {rows.slice(0, 4).map((webinar, index) => {
                const translated = translations[index];
                const itemTitle = ar ? webinar.titleAr : en ? translated?.title.en ?? webinar.titleFr : webinar.titleFr;
                return (
                  <Link
                    key={webinar.id}
                    href={`/${locale}/webinaires/${webinar.slug}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div>
                      <span>{webinar.startsAt.getDate()}</span>
                      <div>
                        <strong>{itemTitle}</strong>
                        <small>{formatDate(webinar.startsAt, locale)}</small>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
