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
  Video,
  MessageSquare,
} from "lucide-react";
import { formatMillimes, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import {
  getAdminDistributions,
  getAdminGrowth,
  getAdminOnboardingAnalytics,
  getAdminOverview,
  parseAdminPeriod,
} from "@/modules/admin/queries/admin-analytics";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminSectionCard } from "@/modules/admin/components/AdminSectionCard";
import { AdminActionCard, AdminActionGrid } from "@/modules/admin/components/AdminActionCard";
import { AdminInfoBanner } from "@/modules/admin/components/AdminInfoBanner";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";
import { Distribution, TrendChart } from "@/modules/admin/components/AdminCharts";

export const dynamic = "force-dynamic";

export default async function AdminOverview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "overview.read");
  const period = parseAdminPeriod((await searchParams).period);
  const fallbackOverview = {
    period,
    totalUsers: 0,
    newUsers: 0,
    activeLearners: 0,
    publishedCourses: 0,
    enrollments: 0,
    completionRate: 0,
    certificatesIssued: 0,
    upcomingWebinars: 0,
    pendingContacts: 0,
    revenueMillimes: 0,
    successfulPayments: 0,
    failedPayments: 0,
    activeEscrowMillimes: 0,
    platformCommissionsMillimes: 0,
    inPersonConsultationsCount: 0,
    candidatesUnderReviewCount: 0,
    passedInterviewsCount: 0,
    approvedPractitionersCount: 0,
    courseSalesCount: 0,
    webinarRegistrationsCount: 0,
    webinarToCourseConversionsCount: 0,
    webinarConversionRate: 0,
  };
  const fallbackDistributions = {
    roles: [],
    providers: [],
    topCourses: [],
    governorates: [],
    disciplines: [],
  };
  const fallbackOnboarding = {
    categories: [],
    subSpecialties: [],
    territorialBalancing: [],
    pathologiesCoverage: [],
    acquisitionSources: [],
  };

  const [overview, growth, distributions, onboardingAnalytics] = await Promise.all([
    getAdminOverview(period).catch(() => fallbackOverview),
    getAdminGrowth(period).catch(() => []),
    getAdminDistributions().catch(() => fallbackDistributions),
    getAdminOnboardingAnalytics().catch(() => fallbackOnboarding),
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "القيادة التنفيذية والأكاديمية" : "Cockpit Exécutif & Décisionnel"}
        title={ar ? "لوحة القيادة والمؤشرات" : "Cockpit Plateforme & Pilotage"}
        description={
          ar
            ? "مؤشرات حقيقية ومحدثة تغطي مبيعات التكوين، الضمان المالي، مسار الاعتماد المهني، وتوزيع الممارسين."
            : "Indicateurs réels : Ventes formations, Séquestre hybride, Pipeline d'agrément et cartographie des praticiens."
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href={`/${locale}/admin/marketing`}
              className="h-9 px-3.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-medium text-slate-700 inline-flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <TrendingUp className="h-4 w-4 text-[#0056D2]" />
              <span>{ar ? "تحليل الجمهور والتسويق" : "Marketing & Audience"}</span>
            </Link>

            <form className="flex items-center gap-1.5" method="get">
              <label htmlFor="period" className="sr-only">
                {ar ? "الفترة" : "Période"}
              </label>
              <select
                id="period"
                name="period"
                defaultValue={period}
                className="h-9 px-3 rounded-md border border-slate-300 bg-white text-[13px] font-medium text-[#0A192F] focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2] outline-none shadow-2xs"
              >
                <option value="7d">{ar ? "7 أيام" : "7 derniers jours"}</option>
                <option value="30d">{ar ? "30 يوم" : "30 derniers jours"}</option>
                <option value="90d">{ar ? "90 يوم" : "90 derniers jours"}</option>
                <option value="365d">{ar ? "سنة كاملة" : "1 an"}</option>
              </select>
              <button
                type="submit"
                className="h-9 px-3.5 rounded-md bg-[#0056D2] hover:bg-[#00419E] text-white text-[13px] font-semibold transition-colors shadow-2xs cursor-pointer"
              >
                {ar ? "تطبيق" : "Appliquer"}
              </button>
            </form>
          </div>
        }
      />

      {/* Info Status Banner */}
      <AdminInfoBanner>
        {ar
          ? "وحدة تحكم الإدارة متصلة بقاعدة البيانات الحية. جميع المؤشرات والعمليات يتم تحديثها فوريًا على الخادم."
          : "Console d'administration connectée à la base de production PostgreSQL. Toutes les métriques opérationnelles sont calculées en temps réel."}
      </AdminInfoBanner>

      {/* Quick Action Navigation Grid */}
      <AdminSectionCard
        title={ar ? "الوصول السريع إلى الأدوات التنفيذية" : "Outils & Raccourcis Opérationnels"}
        infoTooltip={ar ? "روابط سريعة لأكثر المهام استخداماً في الإدارة" : "Accès direct aux modules les plus fréquemment sollicités"}
      >
        <AdminActionGrid>
          <AdminActionCard
            title={ar ? "إدارة التكوينات والمحتوى" : "Gestion des Formations & Modules"}
            description={ar ? "إضافة وتعديل الدورات، رفع الفيديوهات وتنظيم الوحدات التعليمية." : "Créer et éditer les cours, vidéos Cloudflare Stream, chapitres et leçons."}
            icon={BookOpen}
            badge={ar ? `${overview.publishedCourses} دورة` : `${overview.publishedCourses} cours`}
            href={`/${locale}/admin/courses`}
          />
          <AdminActionCard
            title={ar ? "إدارة الحسابات والمستخدمين" : "Utilisateurs & Profils"}
            description={ar ? "البحث، ترقية الحسابات، مراجعة الوثائق وتعيين الأدوار والصلاحيات." : "Filtrer les comptes, attribuer des rôles et instruire les agréments professionnels."}
            icon={Users}
            badge={ar ? `${number.format(overview.totalUsers)} مستخدم` : `${number.format(overview.totalUsers)} comptes`}
            href={`/${locale}/admin/users`}
          />
          <AdminActionCard
            title={ar ? "واتساب ومركز المحادثات CRM" : "WhatsApp CRM & Messagerie"}
            description={ar ? "مراسلة المترشحين، استلام الإشعارات وتأكيد المواعيد عبر واتساب." : "Conversations en direct, relances automatiques et notifications WhatsApp Meta Cloud."}
            icon={MessageSquare}
            badge="WhatsApp API"
            href={`/${locale}/admin/crm/whatsapp`}
          />
          <AdminActionCard
            title={ar ? "دليل ومواعيد المرافقين (AVS)" : "Annuaire & Rendez-vous AVS"}
            description={ar ? "متابعة طلبات المرافقة المدرسية وتأكيد الجلسات الحضورية وعن بعد." : "Instruire les dossiers d'accompagnement scolaire et valider les réservations."}
            icon={ShieldCheck}
            badge="Annuaire /avs"
            href={`/${locale}/admin/avs`}
          />
          <AdminActionCard
            title={ar ? "الندوات التفاعلية والبث المباشر" : "Directs & Webinaires"}
            description={ar ? "برمجة الندوات، إدارة قوائم الحضور وأكواد الدخول الآمنة." : "Planifier les sessions en direct, listes d'émargement et codes d'accès sécurisés."}
            icon={Video}
            badge={ar ? `${overview.upcomingWebinars} قادمة` : `${overview.upcomingWebinars} à venir`}
            href={`/${locale}/admin/live`}
          />
          <AdminActionCard
            title={ar ? "التقييمات والشهادات الرسمية" : "Évaluations & Certificats"}
            description={ar ? "مراجعة نتائج الاختبارات الأكاديمية وإصدار الشهادات المعتمدة." : "Vérifier les scores des apprenants et valider la délivrance des diplômes ANEI."}
            icon={Award}
            badge={ar ? `${number.format(overview.certificatesIssued)} شهادة` : `${number.format(overview.certificatesIssued)} délivrés`}
            href={`/${locale}/admin/assessments`}
          />
        </AdminActionGrid>
      </AdminSectionCard>

      {/* Key KPI Performance Section */}
      <AdminSectionCard
        title={ar ? "المؤشرات الرئيسية للأداء" : "Indicateurs Clés & Performance"}
        infoTooltip={ar ? "إحصائيات شاملة للفترة المحددة" : "Métriques consolidées sur la période d'observation"}
      >
        <div className="admin-kpi-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((kpi) => {
            const IconComponent = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-md bg-[#F8FAFC] border border-slate-200 flex items-center justify-center text-[#0A192F]">
                    <IconComponent className="h-4 w-4 stroke-[1.7]" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {period}
                  </span>
                </div>
                <div className="text-[12px] font-medium text-slate-500 truncate mb-1">{kpi.label}</div>
                <div className="text-xl sm:text-2xl font-bold text-[#0A192F] tracking-tight">{kpi.value}</div>
                {kpi.sub && <div className="text-[11px] text-slate-400 mt-1 truncate">{kpi.sub}</div>}
              </div>
            );
          })}
        </div>
      </AdminSectionCard>

      {/* Strategic Funnel Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. Academic Promotion Pipeline Funnel */}
        <AdminSectionCard
          title={ar ? "مسار ترقية الممارسين" : "Funnel de Promotion AVS & Spécialistes"}
          infoTooltip={ar ? "مراحل الاعتماد الأكاديمي" : "Progression des candidats à l'agrément officiel"}
          headerActions={
            <Link
              href={`/${locale}/admin/users`}
              className="text-[12px] font-semibold text-[#0056D2] hover:underline inline-flex items-center gap-1"
            >
              <span>{ar ? "إدارة" : "Gérer"}</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-[#F8FAFC] p-3 rounded-md border border-slate-200">
              <span className="text-[11px] text-slate-500 block">{ar ? "قيد الدراسة" : "En revue"}</span>
              <strong className="text-lg font-bold text-amber-600 block mt-1">
                {overview.candidatesUnderReviewCount}
              </strong>
              <small className="text-[10px] text-slate-400">{ar ? "أكملوا التكوين" : "Validés"}</small>
            </div>
            <div className="bg-[#F8FAFC] p-3 rounded-md border border-slate-200">
              <span className="text-[11px] text-slate-500 block">{ar ? "مقابلات ناجحة" : "Entretiens OK"}</span>
              <strong className="text-lg font-bold text-[#0056D2] block mt-1">
                {overview.passedInterviewsCount}
              </strong>
              <small className="text-[10px] text-slate-400">{ar ? "جاهزون للاعتماد" : "Prêts"}</small>
            </div>
            <div className="bg-emerald-50/70 p-3 rounded-md border border-emerald-200/80">
              <span className="text-[11px] text-emerald-800 block">{ar ? "معتمدون رسميًا" : "Agréés"}</span>
              <strong className="text-lg font-bold text-emerald-700 block mt-1">
                {overview.approvedPractitionersCount}
              </strong>
              <small className="text-[10px] text-emerald-600">{ar ? "في الدليل" : "En ligne"}</small>
            </div>
          </div>
        </AdminSectionCard>

        {/* 2. Hybrid Escrow & Financial Performance */}
        <AdminSectionCard
          title={ar ? "الضمان المالي والعمولات" : "Séquestre & Ventilation Tarifs"}
          infoTooltip={ar ? "توزيع الإيرادات بين الفيديو والعيادة" : "Ventilation hybride visio sous séquestre vs cabinet 0%"}
          headerActions={
            <Link
              href={`/${locale}/admin/payments`}
              className="text-[12px] font-semibold text-[#0056D2] hover:underline inline-flex items-center gap-1"
            >
              <span>{ar ? "تفاصيل" : "Paiements"}</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#EFF6FF] p-3 rounded-md border border-[#BFDBFE]">
              <span className="text-[11px] text-[#1E40AF] block truncate">
                {ar ? "استشارات فيديو (15%)" : "Consultations Visio (15%)"}
              </span>
              <strong className="text-base font-bold text-[#1D4ED8] block mt-1">
                {formatMillimes(overview.activeEscrowMillimes, locale)}
              </strong>
              <small className="text-[10px] text-blue-600 block mt-0.5">
                {ar ? "محمية بالضمان المالي" : "Sous séquestre"}
              </small>
            </div>
            <div className="bg-[#F8FAFC] p-3 rounded-md border border-slate-200">
              <span className="text-[11px] text-slate-600 block truncate">
                {ar ? "استشارات بالعيادة (0%)" : "Séances Cabinet (0%)"}
              </span>
              <strong className="text-base font-bold text-[#0A192F] block mt-1">
                {number.format(overview.inPersonConsultationsCount)} {ar ? "جلسة" : "RDV"}
              </strong>
              <small className="text-[10px] text-slate-500 block mt-0.5">
                {ar ? "دفع مباشر 100%" : "100% direct praticien"}
              </small>
            </div>
          </div>
        </AdminSectionCard>

        {/* 3. Webinar-to-Course Conversion Funnel */}
        <AdminSectionCard
          title={ar ? "تحويل الندوات إلى تكوينات" : "Funnel Webinaires ➔ Formations"}
          infoTooltip={ar ? "تحويل المسجلين بالندوات لدورات مدفوعة" : "Taux de transformation des webinaires vers les cours"}
          headerActions={
            <Link
              href={`/${locale}/admin/live`}
              className="text-[12px] font-semibold text-[#0056D2] hover:underline inline-flex items-center gap-1"
            >
              <span>{ar ? "الندوات" : "Webinaires"}</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-[#F8FAFC] p-3 rounded-md border border-slate-200">
              <span className="text-[11px] text-slate-500 block">{ar ? "المسجلون" : "Inscrits"}</span>
              <strong className="text-lg font-bold text-[#0A192F] block mt-1">
                {overview.webinarRegistrationsCount}
              </strong>
              <small className="text-[10px] text-slate-400">{ar ? "مشاركون" : "Participants"}</small>
            </div>
            <div className="bg-[#F8FAFC] p-3 rounded-md border border-slate-200">
              <span className="text-[11px] text-slate-500 block">{ar ? "تحويل" : "Convertis"}</span>
              <strong className="text-lg font-bold text-[#0056D2] block mt-1">
                {overview.webinarToCourseConversionsCount}
              </strong>
              <small className="text-[10px] text-slate-400">{ar ? "في الدورات" : "Formations"}</small>
            </div>
            <div className="bg-emerald-50/70 p-3 rounded-md border border-emerald-200/80">
              <span className="text-[11px] text-emerald-800 block">{ar ? "النسبة" : "Taux"}</span>
              <strong className="text-lg font-bold text-emerald-700 block mt-1">
                {overview.webinarConversionRate}%
              </strong>
              <small className="text-[10px] text-emerald-600">{ar ? "تحويل" : "Ratio"}</small>
            </div>
          </div>
        </AdminSectionCard>
      </div>

      {/* Onboarding & Demographic Intelligence Section */}
      <AdminSectionCard
        title={ar ? "الذكاء الديموغرافي وقنوات التسجيل والتوازن الإقليمي" : "Intelligence Démographique & Équilibrage Territorial"}
        infoTooltip={ar ? "تحليل الطلب حسب الولاية ونوع الاضطراب" : "Répartition géographique et adéquation de l'offre et de la demande"}
        headerActions={
          <Link
            href={`/${locale}/admin/users`}
            className="text-[12px] font-semibold text-[#0056D2] hover:underline inline-flex items-center gap-1"
          >
            <span>{ar ? "عرض المستخدمين" : "Consulter utilisateurs"}</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Pillar 1: Categories */}
          <div className="p-4 rounded-md border border-slate-200 bg-[#F8FAFC]/50">
            <h3 className="text-[13px] font-bold text-[#0A192F] mb-3">
              {ar ? "توزيع المستخدمين حسب الفئة" : "Répartition par Profil"}
            </h3>
            <div className="space-y-3">
              {onboardingAnalytics.categories.map((cat) => (
                <div key={cat.label} className="text-[12px]">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-slate-700">{cat.label}</span>
                    <span className="font-bold text-[#0A192F]">
                      {cat.count} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0A192F] rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pillar 2: Territorial Balancing */}
          <div className="p-4 rounded-md border border-slate-200 bg-[#F8FAFC]/50">
            <h3 className="text-[13px] font-bold text-[#0A192F] mb-3">
              {ar ? "التوازن الإقليمي (أسر vs ممارسون)" : "Équilibre Régional (Familles / Praticiens)"}
            </h3>
            <div className="space-y-2">
              {onboardingAnalytics.territorialBalancing.slice(0, 5).map((row) => (
                <div
                  key={row.governorate}
                  className="flex items-center justify-between text-[12px] py-1 border-b border-slate-200/60 last:border-0"
                >
                  <div>
                    <strong className="text-slate-800 block leading-tight">{row.governorate}</strong>
                    <span className="text-[10.5px] text-slate-400">
                      {row.learnersCount} {ar ? "متعلم" : "apprenants"} • {row.practitionersCount} {ar ? "ممارس" : "praticiens"}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      row.practitionersCount === 0
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {row.ratio}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pillar 3: Pathologies */}
          <div className="p-4 rounded-md border border-slate-200 bg-[#F8FAFC]/50">
            <h3 className="text-[13px] font-bold text-[#0A192F] mb-3">
              {ar ? "تغطية الاحتياجات (طلب vs عرض)" : "Couverture des Besoins (Demande vs Offre)"}
            </h3>
            <div className="space-y-3">
              {onboardingAnalytics.pathologiesCoverage.slice(0, 5).map((patho) => (
                <div key={patho.name} className="text-[12px]">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-slate-700">{patho.name}</span>
                    <span className="text-[10.5px] text-slate-500">
                      {ar ? "طلب:" : "Demande:"} <b className="text-[#0A192F]">{patho.learnersDemand}</b> • {ar ? "عرض:" : "Offre:"} <b className="text-[#0056D2]">{patho.practitionersSupply}</b>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full flex overflow-hidden">
                    <div
                      className="h-full bg-[#0056D2]"
                      style={{ width: `${Math.min(100, Math.max(10, patho.learnersDemand * 10))}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.min(100, Math.max(10, patho.practitionersSupply * 10))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminSectionCard>

      {/* Growth Trend & Distributions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AdminSectionCard
          title={ar ? "تطور التسجيلات والمستخدمين" : "Évolution des Inscriptions & Utilisateurs"}
          infoTooltip={ar ? "مخطط زمني للمنحنى اليومي" : "Évolution chronologique sur la période"}
        >
          <TrendChart points={growth} locale={locale} />
        </AdminSectionCard>

        <AdminSectionCard
          title={ar ? "التخصصات المهنية والعيادات" : "Disciplines & Spécialités"}
          infoTooltip={ar ? "توزيع الممارسين حسب التخصص" : "Répartition des praticiens par discipline d'exercice"}
        >
          <Distribution
            rows={distributions.disciplines || []}
            locale={locale}
            empty={ar ? "لا توجد بيانات" : "Aucune donnée"}
          />
        </AdminSectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <AdminSectionCard
          title={ar ? "أكثر الدورات تسجيلاً" : "Formations les Plus Suivies"}
          infoTooltip={ar ? "ترتيب الدورات حسب الإقبال" : "Top des cours par volume d'apprenants"}
        >
          <Distribution
            rows={distributions.topCourses}
            locale={locale}
            empty={ar ? "لا توجد تسجيلات" : "Aucune inscription"}
          />
        </AdminSectionCard>

        <AdminSectionCard
          title={ar ? "توزيع الأدوار والصلاحيات" : "Répartition des Rôles"}
          infoTooltip={ar ? "توزيع المستخدمين حسب الرتبة" : "Statut des comptes de la plateforme"}
        >
          <Distribution
            rows={distributions.roles}
            locale={locale}
            empty={ar ? "لا توجد بيانات" : "Aucune donnée"}
          />
        </AdminSectionCard>

        <AdminSectionCard
          title={ar ? "طرق الدخول والمصادقة" : "Fournisseurs de Connexion"}
          infoTooltip={ar ? "Google vs البريد الإلكتروني" : "Part de Google OAuth vs authentification par e-mail"}
        >
          <Distribution
            rows={distributions.providers}
            locale={locale}
            empty={ar ? "لا توجد حسابات" : "Aucun compte"}
          />
        </AdminSectionCard>
      </div>

      {/* Admin Footer */}
      <AdminFooter locale={locale} />
    </div>
  );
}
