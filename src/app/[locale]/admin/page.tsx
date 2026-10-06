import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Users,
  UserCheck,
  UserPlus,
  BookOpen,
  GraduationCap,
  TrendingUp,
  Award,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
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

  const kpis = [
    {
      label: ar ? "إجمالي المستخدمين" : "Total utilisateurs",
      value: number.format(overview.totalUsers),
      icon: Users,
      tone: "navy" as const,
      sub: ar ? "حسابات مسجلة" : "Comptes enregistrés",
    },
    {
      label: ar ? "متعلمون نشطون" : "Apprenants actifs",
      value: number.format(overview.activeLearners),
      icon: UserCheck,
      tone: "gold" as const,
      sub: ar ? "تسجيلات جارية" : "Inscriptions actives",
    },
    {
      label: ar ? "مستخدمون جدد" : "Nouveaux utilisateurs",
      value: number.format(overview.newUsers),
      icon: UserPlus,
      tone: "cream" as const,
      sub: ar ? `خلال ${period}` : `Sur ${period}`,
    },
    {
      label: ar ? "دورات منشورة" : "Formations publiées",
      value: number.format(overview.publishedCourses),
      icon: BookOpen,
      tone: "navy" as const,
      sub: ar ? "متاحة في الكتالوج" : "Visibles au catalogue",
    },
    {
      label: ar ? "التسجيلات" : "Inscriptions",
      value: number.format(overview.enrollments),
      icon: GraduationCap,
      tone: "gold" as const,
      sub: ar ? "إجمالي الاشتراكات" : "Total des accès",
    },
    {
      label: ar ? "نسبة الإكمال" : "Taux de complétion",
      value: `${overview.completionRate}%`,
      icon: TrendingUp,
      tone: "navy" as const,
      sub: ar ? "دورات مكتملة" : "Formations menées à terme",
    },
    {
      label: ar ? "شهادات صادرة" : "Certificats délivrés",
      value: number.format(overview.certificatesIssued),
      icon: Award,
      tone: "gold" as const,
      sub: ar ? "شهادات قابلة للتحقق" : "Attestations officielles",
    },
    {
      label: ar ? "ندوات قادمة" : "Webinaires à venir",
      value: number.format(overview.upcomingWebinars),
      icon: Calendar,
      tone: "cream" as const,
      sub: ar ? "جلسات مبرمجة" : "Sessions programmées",
    },
  ];

  return <>
    <AdminPageHeader
      locale={locale}
      eyebrow={ar ? "القيادة التشغيلية" : "Pilotage opérationnel"}
      title={ar ? "نظرة عامة" : "Vue d’ensemble"}
      description={ar ? "مؤشرات حقيقية ومحدثة محسوبة من بيانات منصة ANEI." : "Indicateurs réels, calculés à partir des données de la plateforme ANEI."}
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Link href={`/${locale}/admin/marketing`} className="admin-primary-button">
            <TrendingUp size={15} />
            <span>{ar ? "تحليل الجمهور والتسويق" : "Marketing & Audience"}</span>
          </Link>
          <form className="admin-period-form" method="get">
            <label htmlFor="period">{ar ? "الفترة" : "Période"}</label>
            <select id="period" name="period" defaultValue={period}>
              <option value="7d">{ar ? "آخر 7 أيام" : "7 derniers jours"}</option>
              <option value="30d">{ar ? "آخر 30 يوم" : "30 derniers jours"}</option>
              <option value="90d">{ar ? "آخر 90 يوم" : "90 derniers jours"}</option>
              <option value="365d">{ar ? "سنة كاملة" : "1 an"}</option>
            </select>
            <button type="submit">{ar ? "تطبيق" : "Appliquer"}</button>
          </form>
        </div>
      }
    />

    <section className="admin-kpi-grid" aria-label={ar ? "المؤشرات الرئيسية" : "Indicateurs clés"}>
      {kpis.map((kpi) => {
        const IconComponent = kpi.icon;
        return (
          <article key={kpi.label} className="admin-kpi-card">
            <div className="admin-kpi-header">
              <span className={`admin-kpi-icon is-${kpi.tone}`} aria-hidden="true">
                <IconComponent size={20} strokeWidth={1.75} />
              </span>
              <span className="admin-kpi-period">{period}</span>
            </div>
            <span className="admin-kpi-label">{kpi.label}</span>
            <strong className="admin-kpi-value">{kpi.value}</strong>
            {kpi.sub ? <small className="admin-kpi-sub">{kpi.sub}</small> : null}
          </article>
        );
      })}
    </section>

    <section className="admin-dashboard-grid">
      <article className="admin-surface admin-span-2">
        <header>
          <div>
            <span>{ar ? "النمو" : "Croissance"}</span>
            <h2>{ar ? "المستخدمون والتسجيلات" : "Utilisateurs et inscriptions"}</h2>
          </div>
        </header>
        <TrendChart points={growth} locale={locale} />
      </article>

      <article className="admin-surface">
        <header>
          <div>
            <span>{ar ? "الحسابات" : "Comptes"}</span>
            <h2>{ar ? "توزيع الأدوار" : "Répartition des rôles"}</h2>
          </div>
          <Link href={`/${locale}/admin/users`}>
            <span>{ar ? "عرض" : "Voir"}</span>
            <ArrowUpRight size={13} className="admin-directional-icon" />
          </Link>
        </header>
        <Distribution rows={distributions.roles} locale={locale} empty={ar ? "لا توجد بيانات" : "Aucune donnée"} />
      </article>

      <article className="admin-surface">
        <header>
          <div>
            <span>{ar ? "المصادقة" : "Authentification"}</span>
            <h2>{ar ? "مزودو الدخول" : "Fournisseurs de connexion"}</h2>
          </div>
        </header>
        <Distribution rows={distributions.providers} locale={locale} empty={ar ? "لا توجد حسابات" : "Aucun compte"} />
      </article>

      <article className="admin-surface">
        <header>
          <div>
            <span>{ar ? "التعلّم" : "Apprentissage"}</span>
            <h2>{ar ? "أكثر الدورات تسجيلاً" : "Formations les plus suivies"}</h2>
          </div>
          <Link href={`/${locale}/admin/courses`}>
            <span>{ar ? "عرض" : "Voir"}</span>
            <ArrowUpRight size={13} className="admin-directional-icon" />
          </Link>
        </header>
        <Distribution rows={distributions.topCourses} locale={locale} empty={ar ? "لا توجد تسجيلات" : "Aucune inscription"} />
      </article>

      <article className="admin-surface admin-finance-card">
        <header>
          <div>
            <span>{ar ? "التجارة" : "Commerce"}</span>
            <h2>{ar ? "المدفوعات" : "Paiements"}</h2>
          </div>
          <Link href={`/${locale}/admin/payments`}>
            <span>{ar ? "عرض" : "Voir"}</span>
            <ArrowUpRight size={13} className="admin-directional-icon" />
          </Link>
        </header>
        <div className="admin-finance-body">
          <div className="admin-finance-main">
            <span className="admin-finance-label">{ar ? "الإيرادات المحصلة" : "Chiffre d'affaires"}</span>
            <strong>{formatMillimes(overview.revenueMillimes, locale)}</strong>
          </div>
          <div className="admin-finance-breakdown">
            <span className="admin-stat-tag is-success">
              {ar ? "ناجحة" : "Réussis"} <b>{overview.successfulPayments}</b>
            </span>
            <span className="admin-stat-tag is-failed">
              {ar ? "فاشلة" : "Échoués"} <b>{overview.failedPayments}</b>
            </span>
          </div>
        </div>
      </article>

      <article className="admin-surface admin-alert-card">
        <header>
          <div>
            <span>{ar ? "الدعم" : "Support"}</span>
            <h2>{ar ? "رسائل في الانتظار" : "Contacts en attente"}</h2>
          </div>
          <Link href={`/${locale}/admin/contacts`}>
            <span>{ar ? "معالجة" : "Traiter"}</span>
            <ArrowUpRight size={13} className="admin-directional-icon" />
          </Link>
        </header>
        <div className="admin-alert-body">
          <strong>{number.format(overview.pendingContacts)}</strong>
          <p>
            {overview.pendingContacts > 0
              ? (ar ? "رسائل جديدة تتطلب المتابعة والرد." : "Demandes de contact nécessitant un traitement.")
              : (ar ? "جميع رسائل الدعم تمت معالجتها." : "Toutes les demandes de contact sont traitées.")}
          </p>
        </div>
      </article>
    </section>
  </>;
}
