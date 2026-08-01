import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMillimes, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminDistributions, getAdminGrowth, getAdminOverview, parseAdminPeriod } from "@/modules/admin/queries/admin-analytics";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { Distribution, TrendChart } from "@/modules/admin/components/AdminCharts";

export const dynamic = "force-dynamic";
export default async function AdminOverview({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "overview.read");
  const period = parseAdminPeriod((await searchParams).period);
  const [overview, growth, distributions] = await Promise.all([
    getAdminOverview(period), getAdminGrowth(period), getAdminDistributions(),
  ]);
  const ar = locale === "ar";
  const number = new Intl.NumberFormat(ar ? "ar-TN" : "fr-FR");
  const metrics = [
    [ar ? "إجمالي المستخدمين" : "Total utilisateurs", number.format(overview.totalUsers)],
    [ar ? "متعلمون نشطون" : "Apprenants actifs", number.format(overview.activeLearners)],
    [ar ? "مستخدمون جدد" : "Nouveaux utilisateurs", number.format(overview.newUsers)],
    [ar ? "دورات منشورة" : "Formations publiées", number.format(overview.publishedCourses)],
    [ar ? "التسجيلات" : "Inscriptions", number.format(overview.enrollments)],
    [ar ? "نسبة الإكمال" : "Taux de complétion", `${overview.completionRate}%`],
    [ar ? "شهادات صادرة" : "Certificats délivrés", number.format(overview.certificatesIssued)],
    [ar ? "ندوات قادمة" : "Webinaires à venir", number.format(overview.upcomingWebinars)],
  ];
  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "القيادة التشغيلية" : "Pilotage opérationnel"}
      title={ar ? "نظرة عامة" : "Vue d’ensemble"}
      description={ar ? "مؤشرات حقيقية محسوبة من بيانات المنصة." : "Indicateurs réels, calculés à partir des données de la plateforme."}
      actions={<form className="admin-period-form"><label htmlFor="period">{ar ? "الفترة" : "Période"}</label><select id="period" name="period" defaultValue={period}>{["7d","30d","90d","365d"].map((value) => <option key={value}>{value}</option>)}</select><button>{ar ? "تطبيق" : "Appliquer"}</button></form>}/>
    <section className="admin-kpi-grid" aria-label={ar ? "المؤشرات الرئيسية" : "Indicateurs clés"}>{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{period}</small></article>)}</section>
    <section className="admin-dashboard-grid">
      <article className="admin-surface admin-span-2"><header><div><span>{ar ? "النمو" : "Croissance"}</span><h2>{ar ? "المستخدمون والتسجيلات" : "Utilisateurs et inscriptions"}</h2></div></header><TrendChart points={growth} locale={locale}/></article>
      <article className="admin-surface"><header><div><span>{ar ? "الحسابات" : "Comptes"}</span><h2>{ar ? "توزيع الأدوار" : "Répartition des rôles"}</h2></div></header><Distribution rows={distributions.roles} locale={locale} empty={ar ? "لا توجد بيانات" : "Aucune donnée"}/></article>
      <article className="admin-surface"><header><div><span>{ar ? "المصادقة" : "Authentification"}</span><h2>{ar ? "مزودو الدخول" : "Fournisseurs de connexion"}</h2></div></header><Distribution rows={distributions.providers} locale={locale} empty={ar ? "لا توجد حسابات" : "Aucun compte"}/></article>
      <article className="admin-surface"><header><div><span>{ar ? "التعلّم" : "Apprentissage"}</span><h2>{ar ? "أكثر الدورات تسجيلاً" : "Formations les plus suivies"}</h2></div></header><Distribution rows={distributions.topCourses} locale={locale} empty={ar ? "لا توجد تسجيلات" : "Aucune inscription"}/></article>
      <article className="admin-surface admin-finance-card"><header><div><span>{ar ? "التجارة" : "Commerce"}</span><h2>{ar ? "المدفوعات" : "Paiements"}</h2></div><Link href={`/${locale}/admin/payments`}>{ar ? "عرض" : "Voir"}</Link></header><strong>{formatMillimes(overview.revenueMillimes, locale)}</strong><div><span>{ar ? "ناجحة" : "Réussis"} <b>{overview.successfulPayments}</b></span><span>{ar ? "فاشلة" : "Échoués"} <b>{overview.failedPayments}</b></span></div></article>
      <article className="admin-surface admin-alert-card"><header><div><span>{ar ? "الدعم" : "Support"}</span><h2>{ar ? "رسائل في الانتظار" : "Contacts en attente"}</h2></div><Link href={`/${locale}/admin/contacts`}>{ar ? "معالجة" : "Traiter"}</Link></header><strong>{number.format(overview.pendingContacts)}</strong></article>
    </section>
  </>;
}
