import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Users,
  UserCheck,
  UserX,
  Phone,
  Download,
  MapPin,
  Sparkles,
  Calendar,
  FileText,
  Search,
  Filter,
  CheckCircle2,
} from "lucide-react";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import {
  getAdminMarketingAnalytics,
  getMarketingAudienceDirectory,
  type MarketingAudienceFilters,
} from "@/modules/admin/queries/admin-analytics";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";

export const dynamic = "force-dynamic";

function value(query: Record<string, string | string[] | undefined>, key: string) {
  return typeof query[key] === "string" ? (query[key] as string) : undefined;
}

export default async function AdminMarketingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "overview.read");

  const query = await searchParams;
  const filters: MarketingAudienceFilters = {
    q: value(query, "q"),
    governorate: value(query, "governorate"),
    persona: value(query, "persona"),
    status: value(query, "status"),
    hasPhone: value(query, "hasPhone"),
    page: Number(value(query, "page") || "1"),
    pageSize: Number(value(query, "pageSize") || "25"),
  };

  const [marketingData, directoryData] = await Promise.all([
    getAdminMarketingAnalytics(),
    getMarketingAudienceDirectory(filters),
  ]);

  const ar = locale === "ar";
  const numFmt = new Intl.NumberFormat(ar ? "ar-TN" : "fr-FR");

  const kpis = [
    {
      label: ar ? "إجمالي المسجلين" : "Total inscrits",
      value: numFmt.format(marketingData.stats.totalRegistered),
      sub: ar ? "قاعدة البيانات الكاملة" : "Base d'utilisateurs complète",
      icon: Users,
      tone: "blue" as const,
    },
    {
      label: ar ? "متعلمون نشطون (30 يوم)" : "Actifs (30 derniers jours)",
      value: numFmt.format(marketingData.stats.activeLast30d),
      sub: `${marketingData.stats.retentionRatePercent}% ${ar ? "معدل النشاط" : "taux d'activité"}`,
      icon: UserCheck,
      tone: "emerald" as const,
    },
    {
      label: ar ? "مستخدمون خاملون" : "Utilisateurs dormants",
      value: numFmt.format(marketingData.stats.dormantUsers),
      sub: ar ? "هدف حملات إعادة التنشيط" : "Cible campagnes de réactivation",
      icon: UserX,
      tone: "amber" as const,
    },
    {
      label: ar ? "أرقام هواتف متوفرة" : "Téléphones renseignés",
      value: numFmt.format(marketingData.stats.phoneProvidedCount),
      sub: ar ? "جاهزون للاتصال وواتساب" : "Prospects joignables WhatsApp/SMS",
      icon: Phone,
      tone: "blue" as const,
    },
  ];

  const href = (page: number) => {
    const next = new URLSearchParams();
    for (const key of ["q", "governorate", "persona", "status", "hasPhone", "pageSize"]) {
      const item = value(query, key);
      if (item) next.set(key, item);
    }
    next.set("page", String(page));
    return `/${locale}/admin/marketing?${next}#audience-directory`;
  };

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "الذكاء التسويقي والجمهور" : "Intelligence Marketing & Audience"}
        title={ar ? "تحليل البيانات والتسويق" : "Marketing & Analyse d'Audience"}
        description={
          ar
            ? "بيانات دقيقة حول تفضيلات المستخدمين، نقاط الانقطاع، التوزيع الجغرافي، وتصدير القوائم للحملات الإعلانية."
            : "Données précises sur les préférences utilisateurs, les points d'abandon, la répartition par gouvernorat et l'exportation des segments marketing."
        }
        actions={
          <div className="admin-row-actions">
            <a
              href="/api/admin/marketing/export"
              className="admin-primary-button"
              download
              title={ar ? "تصدير جميع المسجلين كملف CSV" : "Exporter tous les prospects en CSV"}
            >
              <Download size={16} />
              <span>{ar ? "تصدير الجمهور (CSV)" : "Exporter l'audience (CSV)"}</span>
            </a>
          </div>
        }
      />

      {/* Top Marketing KPI Cards */}
      <section className="admin-kpi-grid" aria-label={ar ? "مؤشرات التسويق الرئيسية" : "Indicateurs clés marketing"}>
        {kpis.map((kpi) => {
          const IconComp = kpi.icon;
          return (
            <article key={kpi.label} className="admin-kpi-card">
              <div className="admin-kpi-header">
                <span className={`admin-kpi-icon is-${kpi.tone}`} aria-hidden="true">
                  <IconComp size={20} strokeWidth={1.75} />
                </span>
                <span className="admin-kpi-period">{ar ? "بيانات حية" : "Temps réel"}</span>
              </div>
              <span className="admin-kpi-label">{kpi.label}</span>
              <strong className="admin-kpi-value">{kpi.value}</strong>
              <small className="admin-kpi-sub">{kpi.sub}</small>
            </article>
          );
        })}
      </section>

      {/* SECTION 1: USER PREFERENCES & COURSE ENGAGEMENT (WHAT THEY LIKE VS WHAT THEY DROP) */}
      <div className="admin-section-divider my-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-[#0056D2]" />
          <h2 className="text-lg font-bold text-[#0F172A]">
            {ar ? "تفضيلات المتعلمين ومعدلات التفاعل" : "Analyse des Préférences & Rétention Pédagogique"}
          </h2>
        </div>
      </div>

      <section className="admin-dashboard-grid mb-8">
        {/* Most Popular Courses with Completion Rate (What they like) */}
        <article className="admin-surface">
          <header>
            <div>
              <span className="text-[#0056D2]">{ar ? "ما يفضله المستخدمون" : "Formations Préférées"}</span>
              <h2>{ar ? "الدورات الأكثر تسجيلاً وإكمالاً" : "Top Formations & Taux d'Achèvement"}</h2>
            </div>
            <Link href={`/${locale}/admin/courses`}>
              <span>{ar ? "الكتالوج" : "Catalogue"}</span>
            </Link>
          </header>

          <div className="space-y-4">
            {marketingData.topCourses.map((c) => (
              <div key={c.id} className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <strong className="text-sm font-semibold text-[#0F172A] line-clamp-1">{c.title}</strong>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#EFF6FF] text-[#0056D2] flex-none">
                    {c.enrollments} {ar ? "اشتراك" : "inscrits"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-[#64748B] mb-2">
                  <div>
                    <span>{ar ? "المكتملة:" : "Terminés:"}</span>{" "}
                    <b className="text-[#0F172A]">{c.completed}</b>
                  </div>
                  <div>
                    <span>{ar ? "متوسط التقدم:" : "Progression:"}</span>{" "}
                    <b className="text-[#0F172A]">{c.avgProgress}%</b>
                  </div>
                  <div>
                    <span>{ar ? "نسبة النجاح:" : "Complétion:"}</span>{" "}
                    <b className="text-[#059669] font-bold">{c.completionRate}%</b>
                  </div>
                </div>
                <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0056D2] h-full rounded-full transition-all"
                    style={{ width: `${Math.max(5, c.avgProgress)}%` }}
                  />
                </div>
              </div>
            ))}
            {!marketingData.topCourses.length && (
              <p className="admin-empty">{ar ? "لا توجد بيانات تفاعل" : "Aucune donnée de progression"}</p>
            )}
          </div>
        </article>

        {/* Struggling Courses / Drop-offs (What they abandon or struggle with) */}
        <article className="admin-surface">
          <header>
            <div>
              <span className="text-[#D97706]">{ar ? "نقاط الانقطاع" : "Alertes Abandon"}</span>
              <h2>{ar ? "دورات تتطلب تحسين المحتوى أو الدعم" : "Formations à Fort Taux d'Abandon"}</h2>
            </div>
            <Link href={`/${locale}/admin/assessments`}>
              <span>{ar ? "التقييمات" : "Évaluations"}</span>
            </Link>
          </header>

          <div className="space-y-4">
            {marketingData.strugglingCourses.map((c) => (
              <div key={c.id} className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <strong className="text-sm font-semibold text-[#0F172A] line-clamp-1">{c.title}</strong>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] flex-none">
                    {c.dropOffs} {ar ? "انقطاع مبكر" : "abandons (<20%)"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-[#92400E] mb-2">
                  <div>
                    <span>{ar ? "إجمالي المسجلين:" : "Inscrits:"}</span>{" "}
                    <b>{c.enrollments}</b>
                  </div>
                  <div>
                    <span>{ar ? "متوسط الإكمال:" : "Progression:"}</span>{" "}
                    <b>{c.avgProgress}%</b>
                  </div>
                  <div>
                    <span>{ar ? "معدل الإتمام:" : "Taux d'achèvement:"}</span>{" "}
                    <b>{c.completionRate}%</b>
                  </div>
                </div>
                <div className="w-full bg-[#FDE68A] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#D97706] h-full rounded-full transition-all"
                    style={{ width: `${Math.max(5, c.avgProgress)}%` }}
                  />
                </div>
              </div>
            ))}
            {!marketingData.strugglingCourses.length && (
              <div className="p-6 text-center text-sm text-[#059669] bg-[#ECFDF5] rounded-lg">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-[#059669]" />
                <strong>{ar ? "ممتاز! لا توجد دورات ذات نسب انقطاع مرتفعة." : "Excellent ! Aucun cours avec un taux d'abandon critique."}</strong>
              </div>
            )}
          </div>
        </article>

        {/* Top Downloaded Resources */}
        <article className="admin-surface">
          <header>
            <div>
              <span>{ar ? "المكتبة" : "Bibliothèque"}</span>
              <h2>{ar ? "الموارد الأكثر طلباً وتحميلاً" : "Ressources & Guides Téléchargés"}</h2>
            </div>
            <Link href={`/${locale}/admin/resources`}>
              <span>{ar ? "المكتبة" : "Ressources"}</span>
            </Link>
          </header>
          <div className="space-y-3">
            {marketingData.topResources.map((res) => (
              <div key={res.id} className="flex items-center justify-between p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-[#EFF6FF] text-[#0056D2] rounded-md">
                    <FileText size={16} />
                  </span>
                  <div>
                    <strong className="text-sm font-semibold text-[#0F172A] block">{res.title}</strong>
                    <span className="text-xs text-[#64748B]">{res.type}</span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-[#FFFFFF] border border-[#E2E8F0] rounded-full text-[#0F172A]">
                  {res.ordersCount} {ar ? "طلب" : "commandes"}
                </span>
              </div>
            ))}
            {!marketingData.topResources.length && (
              <p className="admin-empty">{ar ? "لا توجد موارد بعد" : "Aucune ressource commandée"}</p>
            )}
          </div>
        </article>

        {/* Top Webinars */}
        <article className="admin-surface">
          <header>
            <div>
              <span>{ar ? "الفعاليات" : "Événements"}</span>
              <h2>{ar ? "الندوات الأكثر تسجيلاً" : "Webinaires les Plus Suivis"}</h2>
            </div>
            <Link href={`/${locale}/admin/webinars`}>
              <span>{ar ? "الندوات" : "Webinaires"}</span>
            </Link>
          </header>
          <div className="space-y-3">
            {marketingData.topWebinars.map((web) => (
              <div key={web.id} className="flex items-center justify-between p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-[#EFF6FF] text-[#0056D2] rounded-md">
                    <Calendar size={16} />
                  </span>
                  <div>
                    <strong className="text-sm font-semibold text-[#0F172A] block">{web.title}</strong>
                    <span className="text-xs text-[#64748B]">
                      {web.attendedCount} {ar ? "حضور مؤكد" : "présents confirmés"}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-[#FFFFFF] border border-[#E2E8F0] rounded-full text-[#0056D2]">
                  {web.registrationsCount} {ar ? "مسجل" : "inscrits"}
                </span>
              </div>
            ))}
            {!marketingData.topWebinars.length && (
              <p className="admin-empty">{ar ? "لا توجد ندوات بعد" : "Aucun webinaire programmé"}</p>
            )}
          </div>
        </article>
      </section>

      {/* SECTION 2: GEOGRAPHIC & AUDIENCE SEGMENTATION */}
      <div className="admin-section-divider my-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={18} className="text-[#0056D2]" />
          <h2 className="text-lg font-bold text-[#0F172A]">
            {ar ? "التوزيع الجغرافي وشرائح الجمهور المستهدف" : "Segmentation Géographique & Profils Utilisateurs"}
          </h2>
        </div>
      </div>

      <section className="admin-dashboard-grid mb-8">
        {/* Governorates Distribution */}
        <article className="admin-surface">
          <header>
            <div>
              <span>{ar ? "الجغرافيا" : "Géographie"}</span>
              <h2>{ar ? "التوزيع حسب الولاية (تونس)" : "Répartition par Gouvernorat"}</h2>
            </div>
          </header>
          <div className="admin-distribution">
            {marketingData.governorates.map((gov) => (
              <div key={gov.label}>
                <div className="admin-distribution-meta">
                  <span className="admin-distribution-label font-medium">{gov.label}</span>
                  <div className="admin-distribution-values">
                    <span className="admin-distribution-pct">{gov.percentage}%</span>
                    <strong>{numFmt.format(gov.count)}</strong>
                  </div>
                </div>
                <span className="distribution-track">
                  <i style={{ inlineSize: `${Math.max(3, gov.percentage)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Persona Distribution */}
        <article className="admin-surface">
          <header>
            <div>
              <span>{ar ? "الشرائح" : "Profils"}</span>
              <h2>{ar ? "توزيع الأدوار والشخصيات" : "Répartition par Persona"}</h2>
            </div>
          </header>
          <div className="admin-distribution">
            {marketingData.personas.map((p) => (
              <div key={p.label}>
                <div className="admin-distribution-meta">
                  <span className="admin-distribution-label font-medium">{p.label}</span>
                  <div className="admin-distribution-values">
                    <span className="admin-distribution-pct">{p.percentage}%</span>
                    <strong>{numFmt.format(p.count)}</strong>
                  </div>
                </div>
                <span className="distribution-track">
                  <i style={{ inlineSize: `${Math.max(3, p.percentage)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Education Level */}
        <article className="admin-surface">
          <header>
            <div>
              <span>{ar ? "المستوى الدراسي" : "Éducation"}</span>
              <h2>{ar ? "المستوى التعليمي للمسجلين" : "Niveau d'Études Déclaré"}</h2>
            </div>
          </header>
          <div className="admin-distribution">
            {marketingData.educationLevels.map((edu) => (
              <div key={edu.label}>
                <div className="admin-distribution-meta">
                  <span className="admin-distribution-label font-medium">{edu.label}</span>
                  <div className="admin-distribution-values">
                    <span className="admin-distribution-pct">{edu.percentage}%</span>
                    <strong>{numFmt.format(edu.count)}</strong>
                  </div>
                </div>
                <span className="distribution-track">
                  <i style={{ inlineSize: `${Math.max(3, edu.percentage)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Acquisition & Referrals */}
        <article className="admin-surface">
          <header>
            <div>
              <span>{ar ? "الاستقطاب" : "Acquisition"}</span>
              <h2>{ar ? "قنوات الدخول والإحالات" : "Connexion & Codes de Parrainage"}</h2>
            </div>
          </header>
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                {ar ? "مزودو الدخول" : "Fournisseurs d'authentification"}
              </span>
              <div className="grid grid-cols-2 gap-3">
                {marketingData.providers.map((pr) => (
                  <div key={pr.label} className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                    <span className="text-xs text-[#64748B] block">{pr.label}</span>
                    <strong className="text-lg font-bold text-[#0F172A]">{numFmt.format(pr.count)}</strong>
                    <span className="text-xs text-[#0056D2] font-semibold block mt-0.5">{pr.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                {ar ? "رموز الإحالة الأكثر فاعلية" : "Sources de parrainage"}
              </span>
              <div className="space-y-2">
                {marketingData.referrals.map((ref) => (
                  <div key={ref.referralCode} className="flex items-center justify-between p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-xs">
                    <span className="font-mono font-bold text-[#0F172A]">{ref.referralCode}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#64748B]">{ref.userCount} {ar ? "مستخدم" : "utilisateurs"}</span>
                      <span className="font-bold text-[#0056D2]">{ref.enrollmentsCount} {ar ? "اشتراك" : "inscriptions"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* SECTION 3: MARKETING AUDIENCE LEAD DIRECTORY & SEGMENTATION */}
      <div id="audience-directory" className="admin-section-divider my-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-[#0056D2]" />
            <h2 className="text-lg font-bold text-[#0F172A]">
              {ar ? "دليل الجمهور وتحديد الشرائح المستهدفة" : "Répertoire & Ciblage des Prospects"}
            </h2>
          </div>
          <span className="text-xs text-[#64748B]">
            {numFmt.format(directoryData.total)} {ar ? "مسجل مطابق للتصفية" : "profils filtrés"}
          </span>
        </div>
      </div>

      {/* Search & Filter Panel */}
      <form className="admin-filter-panel" method="get" role="search">
        <label>
          <span>{ar ? "البحث" : "Recherche"}</span>
          <input
            name="q"
            defaultValue={directoryData.filters.q}
            placeholder={ar ? "الاسم، البريد، الهاتف، الكود" : "Nom, e-mail, téléphone, code..."}
          />
        </label>
        <label>
          <span>{ar ? "الولاية" : "Gouvernorat"}</span>
          <select name="governorate" defaultValue={directoryData.filters.governorate ?? ""}>
            <option value="">{ar ? "جميع الولايات" : "Tous les gouvernorats"}</option>
            {marketingData.governorates.map((g) => (
              <option key={g.label} value={g.label}>
                {g.label} ({g.count})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{ar ? "الشخصية" : "Persona"}</span>
          <select name="persona" defaultValue={directoryData.filters.persona ?? ""}>
            <option value="">{ar ? "جميع الشرائح" : "Tous les personas"}</option>
            <option value="STUDENT">STUDENT (Apprenant)</option>
            <option value="PARENT">PARENT (Parent)</option>
            <option value="TEACHER">TEACHER (Enseignant)</option>
            <option value="AVS">AVS (Accompagnant)</option>
            <option value="SPECIALIST">SPECIALIST (Spécialiste)</option>
            <option value="ORGANIZATION">ORGANIZATION (Établissement)</option>
          </select>
        </label>
        <label>
          <span>{ar ? "الحالة" : "Activité"}</span>
          <select name="status" defaultValue={directoryData.filters.status ?? ""}>
            <option value="">{ar ? "الكل" : "Tous"}</option>
            <option value="active">{ar ? "نشط (آخر 30 يوم)" : "Actif (30j)"}</option>
            <option value="dormant">{ar ? "خامل (لإعادة التنشيط)" : "Dormant (à réactiver)"}</option>
          </select>
        </label>
        <label>
          <span>{ar ? "الهاتف" : "Téléphone"}</span>
          <select name="hasPhone" defaultValue={directoryData.filters.hasPhone ?? ""}>
            <option value="">{ar ? "الكل" : "Tous"}</option>
            <option value="yes">{ar ? "هاتف متوفر" : "Numéro présent"}</option>
            <option value="no">{ar ? "بدون هاتف" : "Sans numéro"}</option>
          </select>
        </label>
        <button type="submit" className="admin-primary-button">
          <Search size={14} />
          <span>{ar ? "تطبيق" : "Filtrer"}</span>
        </button>
      </form>

      {/* Audience Leads Table */}
      <div className="admin-table-surface">
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>{ar ? "المستخدم" : "Utilisateur"}</th>
                <th>{ar ? "الهاتف" : "Téléphone"}</th>
                <th>{ar ? "الولاية والمدينة" : "Localisation"}</th>
                <th>{ar ? "الشخصية" : "Persona"}</th>
                <th>{ar ? "المستوى" : "Niveau"}</th>
                <th className="numeric">{ar ? "الاشتراكات" : "Formations"}</th>
                <th>{ar ? "كود الإحالة" : "Parrain"}</th>
                <th>{ar ? "التاريخ" : "Inscription"}</th>
                <th>{ar ? "الحالة" : "Statut"}</th>
              </tr>
            </thead>
            <tbody>
              {directoryData.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="admin-user-cell" href={`/${locale}/admin/users/${item.id}`}>
                      <span>{item.name.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <small className="text-xs text-[#64748B] block">{item.email}</small>
                      </div>
                    </Link>
                  </td>
                  <td>
                    {item.phoneNumber ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs">{item.phoneNumber}</span>
                        {item.phoneVerified ? (
                          <span title="Vérifié">
                            <CheckCircle2 size={13} className="text-[#059669]" />
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[#94A3B8] text-xs">—</span>
                    )}
                  </td>
                  <td>
                    <span className="text-xs font-medium text-[#0F172A]">{item.governorate}</span>
                    {item.city ? <small className="text-[#64748B] block text-xs">{item.city}</small> : null}
                  </td>
                  <td>
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-[#EFF6FF] text-[#0056D2] border border-[#BFDBFE]">
                      {item.persona}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-[#475569]">{item.educationLevel}</span>
                  </td>
                  <td className="numeric">
                    <span className="font-semibold text-xs">{item.enrollmentsCount}</span>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-[#64748B]">{item.referredByCode || "DIRECT"}</span>
                  </td>
                  <td>
                    <span className="text-xs text-[#64748B]">{formatDate(item.joinedAt, locale)}</span>
                  </td>
                  <td>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        item.status === "ACTIVE"
                          ? "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]"
                          : "bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]"
                      }`}
                    >
                      {item.status === "ACTIVE" ? (ar ? "نشط" : "Actif") : (ar ? "خامل" : "Dormant")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!directoryData.items.length && (
          <div className="admin-empty-state">
            <strong>{ar ? "لا توجد نتائج مطابقة" : "Aucun prospect trouvé"}</strong>
            <p>{ar ? "جرب تغيير معايير التصفية أعلاه." : "Essayez de modifier les filtres de recherche."}</p>
          </div>
        )}

        <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
          <Link
            aria-disabled={directoryData.page <= 1}
            tabIndex={directoryData.page <= 1 ? -1 : undefined}
            href={href(Math.max(1, directoryData.page - 1))}
          >
            {ar ? "السابق" : "Précédent"}
          </Link>
          <span>
            {ar
              ? `صفحة ${directoryData.page} من ${directoryData.totalPages}`
              : `Page ${directoryData.page} sur ${directoryData.totalPages}`}
          </span>
          <Link
            aria-disabled={directoryData.page >= directoryData.totalPages}
            tabIndex={directoryData.page >= directoryData.totalPages ? -1 : undefined}
            href={href(Math.min(directoryData.totalPages, directoryData.page + 1))}
          >
            {ar ? "التالي" : "Suivant"}
          </Link>
        </nav>
      </div>
    </>
  );
}
