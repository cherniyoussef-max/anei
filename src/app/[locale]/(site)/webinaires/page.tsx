import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { formatDate, isLocale } from "@/lib/i18n";
import { webinars as translations } from "@/lib/data";
import { PageHero } from "@/components/ui/PageHero";
import { Icon } from "@/components/ui/Icon";
import { MeetingProviderBadge } from "@/components/ui/MeetingProviderBadge";
import { WebinarRegisterButton } from "@/components/interactive/WebinarRegisterButton";
import { listPublishedWebinars } from "@/server/queries/catalog";
import { getPushedLiveWebinars } from "@/server/queries/live";
import { publicDataOr } from "@/server/queries/public-fallback";
import { localizeTrainerName } from "@/lib/arabic-locale";

export const dynamic = "force-dynamic";

const WEBINAR_CATEGORIES = [
  { id: "ALL", labelFr: "Tous les webinaires", labelAr: "جميع الندوات" },
  { id: "EDUCATION_INCLUSIVE", labelFr: "Éducation inclusive", labelAr: "التربية الدامجة" },
  { id: "TROUBLES_APPRENTISSAGE", labelFr: "Troubles des apprentissages (DYS)", labelAr: "صعوبات التعلم" },
  { id: "SANTE_MENTALE", labelFr: "Santé mentale & Neurodéveloppement", labelAr: "الصحة النفسية" },
  { id: "PARENTALITE", labelFr: "Parentalité & Coéducation", labelAr: "الوالدية والتربية المشتركة" },
  { id: "PRATIQUE_AVS", labelFr: "Pratique AVS & Spécialistes", labelAr: "ممارسة AVS والأخصائيين" },
];

export default async function WebinarsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const rawParams = await searchParams;
  const activeCategory = rawParams?.category || "ALL";

  const ar = locale === "ar";
  const en = locale === "en";
  const [allRows, allPushedLives] = await Promise.all([
    publicDataOr("webinars", listPublishedWebinars, []),
    getPushedLiveWebinars().catch(() => []),
  ]);
  const dateLocale = ar ? "ar-TN" : en ? "en-GB" : "fr-FR";

  const breadcrumbs = [
    { label: ar ? "الرئيسية" : "Accueil", href: `/${locale}` },
    { label: ar ? "الندوات" : "Webinaires" },
  ];

  const now = new Date();

  // Filter by category if specified
  const rows = activeCategory === "ALL"
    ? allRows
    : allRows.filter((w) => w.category === activeCategory);

  const pushedLives = activeCategory === "ALL"
    ? allPushedLives
    : allPushedLives.filter((l) => l.category === activeCategory);

  const upcomingRows = rows.filter((w) => !w.hasReplay && new Date(w.startsAt).getTime() >= now.getTime());

  return (
    <>
      <PageHero
        breadcrumbs={breadcrumbs}
        eyebrow={ar ? "ندوات تفاعلية وإعادات مباشرة" : en ? "Live webinars & replays" : "Webinaires & replays interactifs"}
        title={ar ? "تعلّم مباشرة، تبادل الخبرات وتطوّر" : en ? "Learn live, exchange and advance" : "Apprendre en direct, échanger et progresser"}
        description={ar
          ? "جلسات مباشرة مع كبار الأخصائيين بروابط سريعة وموثوقة عبر Google Meet وTeams، وتسجيل سهل ومجاني."
          : "Des sessions animées par des experts via Google Meet et Microsoft Teams, avec inscription instantanée et rappels dans votre agenda."}
      />

      {/* Category Filter Pills */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none" role="tablist" aria-label="Catégories de webinaires">
          {WEBINAR_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const href = cat.id === "ALL" ? `/${locale}/webinaires` : `/${locale}/webinaires?category=${cat.id}`;
            return (
              <Link
                key={cat.id}
                href={href}
                className={`inline-flex items-center px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap no-underline ${
                  isActive
                    ? "bg-[#142B47] text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {ar ? cat.labelAr : cat.labelFr}
              </Link>
            );
          })}
        </div>
      </div>

      <section className="section webinars-premium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 webinar-page-grid">
          <div className="webinar-list-large">
            {pushedLives.map((live) => (
              <article
                key={live.id}
                className="webinar-large-card premium-card rounded-2xl border-2 border-red-500 bg-red-50/30 shadow-md p-5 sm:p-6 mb-4"
              >
                <div className="webinar-date-block !bg-red-600 text-white flex flex-col items-center justify-center p-3 rounded-xl">
                  <span className="flex h-3 w-3 relative my-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                  <strong className="text-xs uppercase tracking-wider">{ar ? "مباشر" : "DIRECT"}</strong>
                </div>

                <div className="webinar-large-main">
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                    <span className="bg-red-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>{ar ? "جلسة مباشرة الآن" : "SESSION EN DIRECT"}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                      {live.provider === "GOOGLE_MEET" && "Google Meet"}
                      {live.provider === "ZOOM" && "Zoom"}
                      {live.provider === "MICROSOFT_TEAMS" && "Teams"}
                      {live.provider === "JITSI" && "Jitsi Meet"}
                      {live.provider === "CUSTOM_EMBED" && "Direct ANEI"}
                    </span>
                  </div>

                  <h2 style={{ fontSize: "1.25rem", margin: "0.25rem 0 0.5rem" }} className="font-sans font-bold text-slate-900 leading-snug">
                    {ar ? live.titleAr : live.titleFr}
                  </h2>

                  {live.courseSlug && (
                    <div className="mb-2.5">
                      <Link
                        href={`/${locale}/formations/${live.courseSlug}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors border border-blue-200/80 no-underline"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{ar ? `التكوين المرتبط: ${live.courseTitleAr || live.courseTitleFr}` : `Formation liée : ${live.courseTitleFr || live.courseTitleAr}`}</span>
                        <span aria-hidden="true" className={ar ? "rotate-180 inline-block" : "inline-block"}>&rarr;</span>
                      </Link>
                    </div>
                  )}

                  {(live.descriptionFr || live.descriptionAr) && (
                    <p style={{ margin: "0 0 0.75rem", color: "#475569", fontSize: "0.925rem", lineHeight: 1.5 }}>
                      {ar ? live.descriptionAr : live.descriptionFr}
                    </p>
                  )}

                  <div className="meta-row" style={{ marginTop: "auto" }}>
                    <span>
                      <Icon name="clock" size={16} />
                      {live.durationMinutes} {ar ? "دقيقة" : "min"}
                    </span>
                    {live.speakerName && (
                      <span>
                        <Icon name="user" size={16} />
                        {live.speakerName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <Link
                    href={`/${locale}/learning/live/${live.id}`}
                    prefetch={false}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-5 py-3 shadow-sm transition-all hover:scale-105 active:scale-95"
                  >
                    <span>{ar ? "الانضمام للبث المباشر" : "Rejoindre le Direct"}</span>
                    <span aria-hidden="true" className={ar ? "rotate-180 inline-block" : "inline-block"}>
                      &rarr;
                    </span>
                  </Link>
                </div>
              </article>
            ))}

            {!rows.length && !pushedLives.length ? (
              <div className="empty-state webinar-empty-state">
                <Icon name="calendar" size={24} />
                <strong>{ar ? "لا توجد ندوات مجدولة حاليًا" : en ? "No webinars currently scheduled" : "Aucun webinaire n’est programmé actuellement"}</strong>
                <p>{ar ? "ستظهر الجلسات الجديدة هنا فور نشرها." : en ? "New live sessions will appear here as soon as they are published." : "Les nouvelles sessions apparaîtront ici dès leur publication."}</p>
              </div>
            ) : null}

            {rows.map((webinar, index) => {
              const replay = Boolean(webinar.hasReplay);
              const isPast = new Date(webinar.startsAt).getTime() < now.getTime();
              const translated = translations[index];
              const title = ar ? webinar.titleAr : en ? translated?.title.en ?? webinar.titleFr : webinar.titleFr;
              const description = ar ? webinar.descriptionAr : en ? translated?.description.en ?? webinar.descriptionFr : webinar.descriptionFr;

              return (
                <article className="webinar-large-card premium-card rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6" key={webinar.id}>
                  <div className="webinar-date-block">
                    <strong>{webinar.startsAt.getDate()}</strong>
                    <span>{new Intl.DateTimeFormat(dateLocale, { month: "short" }).format(webinar.startsAt)}</span>
                  </div>

                  <div className="webinar-large-main">
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                      <span className={replay ? "status-pill replay" : isPast ? "status-pill ended" : "status-pill"}>
                        {replay ? (ar ? "إعادة" : "Replay") : isPast ? (ar ? "انتهت" : "Terminée") : (ar ? "قادم" : en ? "Upcoming" : "À venir")}
                      </span>
                      <MeetingProviderBadge provider={webinar.meetingProvider} locale={locale} />
                      {webinar.category && (
                        <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                          {webinar.category === "EDUCATION_INCLUSIVE" ? (ar ? "التربية الدامجة" : "Éducation inclusive")
                            : webinar.category === "TROUBLES_APPRENTISSAGE" ? (ar ? "صعوبات التعلم" : "Troubles DYS")
                            : webinar.category === "SANTE_MENTALE" ? (ar ? "الصحة النفسية" : "Santé mentale")
                            : webinar.category === "PARENTALITE" ? (ar ? "الوالدية" : "Parentalité")
                            : (ar ? "ممارسة مهنية" : "Pratique AVS")}
                        </span>
                      )}
                    </div>

                    <h2 style={{ fontSize: "1.25rem", margin: "0.25rem 0 0.5rem" }} className="font-sans font-semibold text-slate-900 leading-snug">
                      <Link href={`/${locale}/webinaires/${webinar.slug}`} className="hover:text-[#1E3F66] transition-colors" style={{ color: "inherit", textDecoration: "none" }}>
                        {title}
                      </Link>
                    </h2>

                    {webinar.courseSlug && (
                      <div className="mb-2.5">
                        <Link
                          href={`/${locale}/formations/${webinar.courseSlug}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors border border-blue-200/80 no-underline"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{ar ? `التكوين المرتبط: ${webinar.courseTitleAr || webinar.courseTitleFr}` : `Formation liée : ${webinar.courseTitleFr || webinar.courseTitleAr}`}</span>
                          <span aria-hidden="true" className={ar ? "rotate-180 inline-block" : "inline-block"}>&rarr;</span>
                        </Link>
                      </div>
                    )}

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
                    isPast={webinar.isPast}
                  />
                </article>
              );
            })}
          </div>

          <aside className="calendar-card premium-card bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 lg:sticky lg:top-24 self-start">
            <div className="inline-flex items-center gap-2.5 mb-2">
              <span className="w-6 h-[1.5px] bg-[#B58D3D] shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B58D3D]">{ar ? "المواعيد" : en ? "Schedule" : "Agenda"}</span>
            </div>
            <h3 className="text-xl font-sans font-semibold text-slate-900 mb-2">{ar ? "جلسات الأكاديمية" : en ? "ANEI sessions" : "Les rendez-vous ANEI"}</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {ar
                ? "بعد التسجيل ستظهر الندوة تلقائيًا في مساحتك مع إمكانية إضافتها إلى Google Agenda أو Outlook."
                : "Après inscription, accédez directement à la réunion Google Meet / Teams et recevez l'événement dans votre agenda."}
            </p>

            <div className="divide-y divide-slate-100">
              {upcomingRows.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 italic">
                  {ar ? "لا توجد ندوات قادمة حاليًا." : "Aucun rendez-vous à venir pour le moment."}
                </p>
              ) : (
                upcomingRows.slice(0, 5).map((webinar, index) => {
                  const translated = translations[index];
                  const itemTitle = ar ? webinar.titleAr : en ? translated?.title.en ?? webinar.titleFr : webinar.titleFr;
                  const dayNum = webinar.startsAt.getDate();
                  const monthStr = new Intl.DateTimeFormat(dateLocale, { month: "short" }).format(webinar.startsAt);
                  const timeStr = new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(webinar.startsAt);

                  return (
                    <Link
                      key={webinar.id}
                      href={`/${locale}/webinaires/${webinar.slug}`}
                      className="group flex items-start gap-3.5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/80 -mx-2 px-2 rounded-lg transition-colors no-underline"
                    >
                      {/* Mini-badge calendrier structuré */}
                      <div className="w-11 h-11 rounded-xl bg-slate-100 text-[#142B47] flex flex-col items-center justify-center shrink-0">
                        <span className="text-sm font-bold leading-none">{dayNum}</span>
                        <span className="text-[10px] uppercase font-semibold text-slate-500 mt-0.5">{monthStr}</span>
                      </div>
                      {/* Titre et heure */}
                      <div className="flex-1 min-w-0">
                        <strong className="text-sm font-semibold text-[#142B47] line-clamp-1 group-hover:text-[#1E3F66] transition-colors block">
                          {itemTitle}
                        </strong>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          {timeStr} · {webinar.durationMinutes} {ar ? "دقيقة" : "min"}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
