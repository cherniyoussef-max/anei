import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { webinars as translations } from "@/lib/data";
import { PageHero } from "@/components/ui/PageHero";
import { Icon } from "@/components/ui/Icon";
import { WebinarRegisterButton } from "@/components/interactive/WebinarRegisterButton";
import { listPublishedWebinars } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

export default async function WebinarsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const en = locale === "en";
  const rows = await listPublishedWebinars();
  const dateLocale = ar ? "ar-TN" : en ? "en-GB" : "fr-FR";
  return <>
    <PageHero eyebrow={ar ? "ندوات مباشرة وإعادات" : en ? "Live webinars and replays" : "Webinaires & replays"} title={ar ? "تعلّم مباشرة واحتفظ بإمكانية الرجوع" : en ? "Learn live. Ask questions. Revisit the session." : "Apprendre en direct, échanger, revoir"} description={ar ? "جلسات مع مختصين وتسجيل مرتبط بحسابك وإعادات للمشاركين." : en ? "Sessions with specialists, account-based registration and replays for participants." : "Des sessions avec des spécialistes, une inscription liée à votre compte et des replays pour les participants."}/>
    <section className="section webinars-premium"><div className="container webinar-page-grid"><div className="webinar-list-large">
      {!rows.length ? <div className="empty-state webinar-empty-state"><Icon name="calendar" size={24}/><strong>{ar ? "لا توجد ندوات مجدولة حاليًا" : en ? "No webinars are currently scheduled" : "Aucun webinaire n’est programmé actuellement"}</strong><p>{ar ? "ستظهر الجلسات الجديدة هنا فور نشرها." : en ? "New live sessions will appear here as soon as they are published." : "Les nouvelles sessions apparaîtront ici dès leur publication."}</p></div> : null}
      {rows.map((webinar, index) => {
        const replay = Boolean(webinar.replayUrl);
        const translated = translations[index];
        const title = ar ? webinar.titleAr : en ? translated?.title.en ?? webinar.titleFr : webinar.titleFr;
        const description = ar ? webinar.descriptionAr : en ? translated?.description.en ?? webinar.descriptionFr : webinar.descriptionFr;
        return <article className="webinar-large-card premium-card" key={webinar.id}><div className="webinar-date-block"><strong>{webinar.startsAt.getDate()}</strong><span>{new Intl.DateTimeFormat(dateLocale,{month:"short"}).format(webinar.startsAt)}</span></div><div className="webinar-large-main"><span className={replay?"status-pill replay":"status-pill"}>{replay?(ar?"إعادة":en?"Replay":"Replay"):(ar?"قادم":en?"Upcoming":"À venir")}</span><h2>{title}</h2><p>{description}</p><div className="meta-row"><span><Icon name="calendar" size={16}/>{formatDate(webinar.startsAt,locale)}</span><span><Icon name="clock" size={16}/>{new Intl.DateTimeFormat(dateLocale,{hour:"2-digit",minute:"2-digit"}).format(webinar.startsAt)}</span><span><Icon name="user" size={16}/>{webinar.trainerName}</span></div></div><WebinarRegisterButton webinarId={webinar.id} locale={locale} replayUrl={webinar.replayUrl}/></article>;
      })}
    </div><aside className="calendar-card premium-card"><span className="eyebrow">{ar?"المواعيد":en?"Schedule":"Agenda"}</span><h3>{ar?"جلسات الأكاديمية":en?"ANEI sessions":"Les rendez-vous ANEI"}</h3><p>{ar?"بعد التسجيل ستظهر الندوة تلقائيًا في مساحتك الشخصية.":en?"After registration, the session appears automatically in your personal space.":"Après inscription, la session apparaît automatiquement dans votre espace personnel."}</p><div className="mini-event-list">{rows.slice(0,4).map((webinar,index)=>{const translated=translations[index];return <div key={webinar.id}><span>{webinar.startsAt.getDate()}</span><div><strong>{ar?webinar.titleAr:en?translated?.title.en??webinar.titleFr:webinar.titleFr}</strong><small>{formatDate(webinar.startsAt,locale)}</small></div></div>;})}</div></aside></div></section>
  </>;
}
