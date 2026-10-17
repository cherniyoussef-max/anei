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
  ShieldCheck,
  CreditCard,
  Stethoscope,
  Briefcase,
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
      label: ar ? "الضمان المالي (السيولة المحجوزة)" : "Séquestre actif (Garantie)",
      value: formatMillimes(overview.activeEscrowMillimes, locale),
      icon: ShieldCheck,
      tone: "gold" as const,
      sub: ar ? "جلسات فيديو جارية" : "Consultations visio en attente",
    },
    {
      label: ar ? "عمولات ANEI (15% عن بعد)" : "Commissions ANEI perçues",
      value: formatMillimes(overview.platformCommissionsMillimes, locale),
      icon: CreditCard,
      tone: "navy" as const,
      sub: ar ? "15% عن بعد + 0% حضوري" : "15% visio • 0% présentiel",
    },
    {
      label: ar ? "استشارات حضورية (0% عمولة)" : "Consultations cabinet (0%)",
      value: number.format(overview.inPersonConsultationsCount),
      icon: Stethoscope,
      tone: "cream" as const,
      sub: ar ? "دفع مباشر بالعيادة" : "Paiement direct sur place",
    },
    {
      label: ar ? "مرشحون للاعتماد المهني" : "Candidats à l'agrément",
      value: number.format(overview.candidatesUnderReviewCount),
      icon: Briefcase,
      tone: "gold" as const,
      sub: ar ? "بانتظار المقابلة الشفوية" : "Sous revue académique",
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
      eyebrow={ar ? "القيادة التنفيذية والأكاديمية" : "Cockpit Exécutif & Décisionnel"}
      title={ar ? "لوحة القيادة والمؤشرات" : "Cockpit Plateforme & Pilotage"}
      description={ar ? "مؤشرات حقيقية ومحدثة تغطي مبيعات التكوين، الضمان المالي، مسار الاعتماد المهني، وتوزيع الممارسين." : "Indicateurs réels : Ventes formations, Séquestre hybride, Pipeline d'agrément et cartographie des praticiens."}
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

    {/* Cockpit Executive Cards */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem", margin: "1.5rem 0" }}>
      {/* 1. Academic Promotion Pipeline Funnel */}
      <article className="admin-surface" style={{ padding: "1.25rem", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#B58D3D", letterSpacing: "0.08em" }}>
              {ar ? "المسار الأكاديمي" : "Pipeline d'Agrément"}
            </span>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#142B47", margin: "2px 0 0" }}>
              {ar ? "مسار ترقية الممارسين" : "Funnel de Promotion AVS & Spécialistes"}
            </h2>
          </div>
          <Link href={`/${locale}/admin/users`} style={{ fontSize: "0.8125rem", color: "#0056D2", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <span>{ar ? "إدارة المستخدمين" : "Gérer"}</span>
            <ArrowUpRight size={14} />
          </Link>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", textAlign: "center" }}>
          <div style={{ background: "#F8FAFC", padding: "0.875rem", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748B", display: "block" }}>{ar ? "قيد الدراسة" : "En revue"}</span>
            <strong style={{ fontSize: "1.375rem", color: "#D97706", display: "block", marginTop: 2 }}>{overview.candidatesUnderReviewCount}</strong>
            <small style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{ar ? "أكملوا التكوين" : "Formations validées"}</small>
          </div>
          <div style={{ background: "#F8FAFC", padding: "0.875rem", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748B", display: "block" }}>{ar ? "مقابلات ناجحة" : "Entretiens OK"}</span>
            <strong style={{ fontSize: "1.375rem", color: "#0284C7", display: "block", marginTop: 2 }}>{overview.passedInterviewsCount}</strong>
            <small style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{ar ? "جاهزون للاعتماد" : "Prêts pour Sudo"}</small>
          </div>
          <div style={{ background: "#F0FDF4", padding: "0.875rem", borderRadius: "8px", border: "1px solid #BBF7D0" }}>
            <span style={{ fontSize: "0.75rem", color: "#166534", display: "block" }}>{ar ? "معتمدون رسميًا" : "Agréés ANEI"}</span>
            <strong style={{ fontSize: "1.375rem", color: "#15803D", display: "block", marginTop: 2 }}>{overview.approvedPractitionersCount}</strong>
            <small style={{ fontSize: "0.6875rem", color: "#16A34A" }}>{ar ? "في الدليل العام" : "En ligne dans l'annuaire"}</small>
          </div>
        </div>
      </article>

      {/* 2. Hybrid Escrow & Financial Performance */}
      <article className="admin-surface" style={{ padding: "1.25rem", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#B58D3D", letterSpacing: "0.08em" }}>
              {ar ? "النموذج الهجين" : "Modèle Hybride"}
            </span>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#142B47", margin: "2px 0 0" }}>
              {ar ? "الضمان المالي والعمولات" : "Séquestre & Ventilation Tarifs"}
            </h2>
          </div>
          <Link href={`/${locale}/admin/payments`} style={{ fontSize: "0.8125rem", color: "#0056D2", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <span>{ar ? "تفاصيل المدفوعات" : "Paiements"}</span>
            <ArrowUpRight size={14} />
          </Link>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div style={{ background: "#EFF6FF", padding: "0.875rem", borderRadius: "8px", border: "1px solid #BFDBFE" }}>
            <span style={{ fontSize: "0.75rem", color: "#1E40AF", display: "block" }}>{ar ? "استشارات فيديو (15% عمولة)" : "Consultations Visio (15%)"}</span>
            <strong style={{ fontSize: "1.125rem", color: "#1D4ED8", display: "block", marginTop: 2 }}>
              {formatMillimes(overview.activeEscrowMillimes, locale)}
            </strong>
            <small style={{ fontSize: "0.6875rem", color: "#3B82F6" }}>{ar ? "محمية بالضمان المالي" : "Sous séquestre plateforme"}</small>
          </div>
          <div style={{ background: "#F8FAFC", padding: "0.875rem", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: "0.75rem", color: "#475569", display: "block" }}>{ar ? "استشارات بالعيادة (0% عمولة)" : "Séances Cabinet (0% ANEI)"}</span>
            <strong style={{ fontSize: "1.125rem", color: "#0F172A", display: "block", marginTop: 2 }}>
              {number.format(overview.inPersonConsultationsCount)} {ar ? "جلسة" : "RDV"}
            </strong>
            <small style={{ fontSize: "0.6875rem", color: "#64748B" }}>{ar ? "دفع مباشر 100% للممارس" : "100% direct praticien"}</small>
          </div>
        </div>
      </article>

      {/* 3. Webinar-to-Course Conversion Funnel */}
      <article className="admin-surface" style={{ padding: "1.25rem", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#B58D3D", letterSpacing: "0.08em" }}>
              {ar ? "أثر الندوات" : "Acquisition Événementielle"}
            </span>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#142B47", margin: "2px 0 0" }}>
              {ar ? "تحويل الندوات إلى تكوينات" : "Funnel Webinaires ➔ Formations"}
            </h2>
          </div>
          <Link href={`/${locale}/admin/live`} style={{ fontSize: "0.8125rem", color: "#0056D2", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <span>{ar ? "الندوات" : "Webinaires"}</span>
            <ArrowUpRight size={14} />
          </Link>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", textAlign: "center" }}>
          <div style={{ background: "#F8FAFC", padding: "0.875rem", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748B", display: "block" }}>{ar ? "المسجلون" : "Inscrits"}</span>
            <strong style={{ fontSize: "1.375rem", color: "#082D55", display: "block", marginTop: 2 }}>{overview.webinarRegistrationsCount}</strong>
            <small style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{ar ? "كل الندوات" : "Participants"}</small>
          </div>
          <div style={{ background: "#F8FAFC", padding: "0.875rem", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748B", display: "block" }}>{ar ? "التحقوا بالدورة" : "Convertis"}</span>
            <strong style={{ fontSize: "1.375rem", color: "#0284C7", display: "block", marginTop: 2 }}>{overview.webinarToCourseConversionsCount}</strong>
            <small style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{ar ? "دورة مرتبطة" : "Formations liées"}</small>
          </div>
          <div style={{ background: "#F0FDF4", padding: "0.875rem", borderRadius: "8px", border: "1px solid #BBF7D0" }}>
            <span style={{ fontSize: "0.75rem", color: "#166534", display: "block" }}>{ar ? "نسبة التحويل" : "Taux Conv."}</span>
            <strong style={{ fontSize: "1.375rem", color: "#15803D", display: "block", marginTop: 2 }}>{overview.webinarConversionRate}%</strong>
            <small style={{ fontSize: "0.6875rem", color: "#16A34A" }}>{ar ? "تحويل مباشر" : "Webinar-to-Course"}</small>
          </div>
        </div>
      </article>
    </div>

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

      {/* Practitioner Disciplines Distribution */}
      <article className="admin-surface">
        <header>
          <div>
            <span>{ar ? "المهن والتخصصات" : "Disciplines & Métiers"}</span>
            <h2>{ar ? "توزيع الممارسين" : "Répartition par Discipline"}</h2>
          </div>
          <Link href={`/${locale}/admin/avs`}>
            <span>{ar ? "عرض" : "Voir"}</span>
            <ArrowUpRight size={13} className="admin-directional-icon" />
          </Link>
        </header>
        <Distribution rows={distributions.disciplines || []} locale={locale} empty={ar ? "لا توجد بيانات" : "Aucune donnée"} />
      </article>

      {/* Practitioner Governorates Distribution */}
      <article className="admin-surface">
        <header>
          <div>
            <span>{ar ? "الجغرافيا" : "Territoire"}</span>
            <h2>{ar ? "الممارسون حسب الولاية" : "Praticiens par Gouvernorat"}</h2>
          </div>
          <Link href={`/${locale}/specialistes`}>
            <span>{ar ? "عرض" : "Voir"}</span>
            <ArrowUpRight size={13} className="admin-directional-icon" />
          </Link>
        </header>
        <Distribution rows={distributions.governorates || []} locale={locale} empty={ar ? "لا توجد بيانات" : "Aucune donnée"} />
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
