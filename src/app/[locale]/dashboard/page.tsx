import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/server/auth/session";
import { getDashboardData } from "@/server/queries/account";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const data = await getDashboardData(session.user.id);
  const avg = data.enrollmentRows.length ? Math.round(data.enrollmentRows.reduce((sum, row) => sum + row.enrollment.progressPercent, 0) / data.enrollmentRows.length) : 0;
  const continueItem = data.enrollmentRows.find(({ enrollment }) => enrollment.progressPercent < 100) ?? data.enrollmentRows[0];

  return <section className="dashboard-section"><div className="container dashboard-layout">
    <aside className="dashboard-sidebar">
      <div className="dashboard-profile"><div className="profile-avatar">{session.user.name.slice(0, 1).toUpperCase()}</div><div><strong>{session.user.name}</strong><small>{session.user.email}</small></div></div>
      <nav aria-label={ar ? "مساحة المتعلم" : "Espace apprenant"}>
        <a className="active" href="#continue"><Icon name="play" size={18}/>{ar ? "متابعة التعلم" : "Continuer"}</a>
        <a href="#formations"><Icon name="graduation" size={18}/>{ar ? "دوراتي" : "Mes formations"}</a>
        <a href="#webinars"><Icon name="calendar" size={18}/>{ar ? "الندوات" : "Webinaires"}</a>
        <a href="#achats"><Icon name="book" size={18}/>{ar ? "مواردي" : "Mes ressources"}</a>
        <a href="#certificats"><Icon name="award" size={18}/>{ar ? "شهاداتي" : "Certificats"}</a>
      </nav>
      <div className="dashboard-sidebar-actions">
        {["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role)) ? <Link className="btn btn-secondary btn-block" href={`/${locale}/admin`}>{ar ? "الإدارة" : "Administration"}</Link> : null}
        <Link className="btn btn-ghost btn-block" href={`/${locale}/dashboard/profil`}>{ar ? "الملف والأمان" : "Profil & sécurité"}</Link>
      </div>
    </aside>

    <div className="dashboard-main">
      <div className="dashboard-heading dashboard-heading-human"><div className="dashboard-heading-copy"><span className="eyebrow">{ar ? "مساحتي" : "Espace apprenant"}</span><h1>{ar ? `مرحبًا، ${session.user.name}` : `Bonjour ${session.user.name}`}</h1><p>{ar ? "ابدأ بما يلي، ثم تابع تقدمك ومواعيدك ومواردك من نفس المساحة." : "Commencez par votre prochaine étape, puis suivez votre progression, vos rendez-vous et vos ressources au même endroit."}</p><div className="dashboard-heading-actions"><Link className="btn btn-primary btn-sm" href={`/${locale}/formations`}><Icon name="search" size={15}/>{ar ? "استكشف الدورات" : "Explorer le catalogue"}</Link><span className="notification-badge" aria-label={ar ? "إشعارات غير مقروءة" : "Notifications non lues"}><Icon name="bell" size={19}/>{data.notifications.filter((n) => !n.read).length}</span></div></div><div className="dashboard-heading-photo"><Image src="/media/anei-learning-path.webp" alt="" fill sizes="(max-width: 900px) 0px, 260px"/><div><span>{ar ? "تعلم بمرونة" : "Votre rythme"}</span><strong>{ar ? "تقدم خطوة بخطوة" : "Progressez, étape par étape"}</strong></div></div></div>

      <section className="continue-card" id="continue">
        {continueItem ? <>
          <div className="continue-card-main"><span className="eyebrow">{ar ? "خطوتك التالية" : "À reprendre"}</span><h2>{ar ? continueItem.course.titleAr : continueItem.course.titleFr}</h2><p>{continueItem.enrollment.progressPercent}% {ar ? "من المسار مكتمل. تابع من آخر نقطة وصلت إليها." : "du parcours complété. Reprenez exactement là où vous vous êtes arrêté."}</p><div className="progress"><span style={{ width: `${continueItem.enrollment.progressPercent}%` }}/></div><Link className="btn btn-primary" href={`/${locale}/apprendre/${continueItem.course.slug}`}><Icon name="play" size={17}/>{ar ? "متابعة التعلم" : "Continuer la formation"}</Link></div>
          <div className="continue-card-progress"><strong>{continueItem.enrollment.progressPercent}%</strong><span>{ar ? "التقدم" : "progression"}</span><small>{ar ? "يُحفظ تلقائيًا" : "Sauvegardé automatiquement"}</small></div>
        </> : <div className="continue-empty"><span className="kpi-icon"><Icon name="graduation" size={22}/></span><div><h2>{ar ? "ابدأ أول مسار لك" : "Commencez votre premier parcours"}</h2><p>{ar ? "استكشف الكتالوج واختر التكوين المناسب لاحتياجاتك." : "Explorez le catalogue et choisissez une formation adaptée à vos objectifs."}</p></div><Link className="btn btn-primary" href={`/${locale}/formations`}>{ar ? "استكشف الدورات" : "Explorer le catalogue"}</Link></div>}
      </section>

      <div className="dashboard-kpis">
        <div><span className="kpi-icon"><Icon name="graduation" size={20}/></span><div><strong>{data.enrollmentRows.length}</strong><small>{ar ? "دورات" : "formations"}</small></div></div>
        <div><span className="kpi-icon"><Icon name="chart" size={20}/></span><div><strong>{avg}%</strong><small>{ar ? "تقدم متوسط" : "progression moyenne"}</small></div></div>
        <div><span className="kpi-icon"><Icon name="award" size={20}/></span><div><strong>{data.certificateRows.length}</strong><small>{ar ? "شهادات" : "certificats"}</small></div></div>
        <div><span className="kpi-icon"><Icon name="book" size={20}/></span><div><strong>{data.purchaseRows.length}</strong><small>{ar ? "موارد" : "ressources"}</small></div></div>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel wide" id="formations"><div className="panel-head"><div><small>{ar ? "التعلم" : "Apprentissage"}</small><h2>{ar ? "دوراتي" : "Mes formations"}</h2></div><Link className="text-link" href={`/${locale}/formations`}>{ar ? "الكتالوج" : "Catalogue"}<Icon name="arrow" size={15}/></Link></div>{data.enrollmentRows.length ? <div className="learning-list">{data.enrollmentRows.map(({ enrollment, course }) => <div className="learning-row" key={enrollment.id}><div className="learning-icon"><Icon name="graduation" size={20}/></div><div className="learning-main"><strong>{ar ? course.titleAr : course.titleFr}</strong><div className="progress slim"><span style={{ width: `${enrollment.progressPercent}%` }}/></div><small>{enrollment.progressPercent}% {ar ? "مكتمل" : "complété"}</small></div><Link className="btn btn-secondary btn-sm" href={`/${locale}/apprendre/${course.slug}`}><Icon name="play" size={15}/>{ar ? "متابعة" : "Continuer"}</Link></div>)}</div> : <div className="empty-panel"><Icon name="graduation" size={28}/><p>{ar ? "لم تسجل في أي دورة بعد." : "Vous n’êtes inscrit à aucune formation pour le moment."}</p><Link className="text-link" href={`/${locale}/formations`}>{ar ? "عرض الدورات" : "Voir les formations"}</Link></div>}</section>

        <section className="dashboard-panel" id="webinars"><div className="panel-head"><div><small>{ar ? "المواعيد" : "Agenda"}</small><h2>{ar ? "ندواتي" : "Mes webinaires"}</h2></div></div>{data.upcomingWebinars.slice(0, 3).map(({ webinar }) => <div className="dashboard-event" key={webinar.id}><span className="date-dot"><Icon name="calendar" size={16}/></span><div><strong>{ar ? webinar.titleAr : webinar.titleFr}</strong><small>{formatDate(webinar.startsAt, locale)} · {webinar.trainerName}</small>{webinar.meetingUrl ? <a className="text-link" href={webinar.meetingUrl} target="_blank" rel="noreferrer">{ar ? "الدخول للجلسة" : "Accéder à la session"}</a> : null}</div></div>)}{!data.upcomingWebinars.length ? <p className="small-muted">{ar ? "لا توجد ندوات مسجلة." : "Aucun webinaire inscrit."}</p> : null}</section>

        <section className="dashboard-panel wide" id="achats"><div className="panel-head"><div><small>{ar ? "المكتبة" : "Bibliothèque"}</small><h2>{ar ? "مواردي" : "Mes ressources"}</h2></div></div><div className="purchase-list">{data.purchaseRows.map(({ purchase, resource }) => resource ? <div key={purchase.id}><span className="resource-type"><Icon name="book" size={17}/></span><div><strong>{ar ? resource.titleAr : resource.titleFr}</strong><small>{formatDate(purchase.grantedAt, locale)}</small></div><a className="btn btn-ghost btn-sm" href={`/api/resources/${resource.id}/download`}><Icon name="download" size={16}/>{ar ? "تحميل" : "Télécharger"}</a></div> : null)}</div>{!data.purchaseRows.length ? <p className="small-muted">{ar ? "لا توجد مشتريات بعد." : "Aucun achat pour le moment."}</p> : null}</section>

        <section className="dashboard-panel" id="certificats"><div className="panel-head"><div><small>{ar ? "الإنجاز" : "Réussite"}</small><h2>{ar ? "شهاداتي" : "Certificats"}</h2></div></div>{data.certificateRows.map(({ certificate, course }) => <Link className="certificate-link" key={certificate.id} href={`/${locale}/certificats/${certificate.code}`}><Icon name="award" size={20}/><span><strong>{ar ? course.titleAr : course.titleFr}</strong><small>{certificate.code}</small></span><Icon name="chevron" size={16}/></Link>)}{!data.certificateRows.length ? <p className="small-muted">{ar ? "أكمل مسارًا للحصول على شهادتك." : "Terminez un parcours pour obtenir votre certificat."}</p> : null}</section>
      </div>
    </div>
  </div></section>;
}
