import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, formatMillimes, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { hasAdminPermission } from "@/modules/admin/domain/permissions";
import { getAdminUserDetail } from "@/modules/admin/queries/admin-users";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminUserRole } from "@/components/admin/AdminUserRole";
import { AdminUserCategorySelect } from "@/components/admin/AdminUserCategorySelect";
import { AdminUserSupportConsole } from "@/modules/admin/components/AdminUserSupportConsole";
import { AdminUserPersonas } from "@/components/admin/AdminUserPersonas";
import { getUserPersonas } from "@/server/queries/personas";
import {
  getAvsProfileForUser,
  getOrganizationProfileForUser,
  getSpecialistProfileForUser,
  getTeacherProfileForUser,
} from "@/server/services/persona-profiles";

import { AdminUserPromotionPanel } from "@/components/admin/AdminUserPromotionPanel";

export const dynamic = "force-dynamic";
export default async function AdminUserDetail({ params, searchParams }: {
  params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ tab?: string }>;
}) {
  const { locale, id } = await params; if (!isLocale(locale) || !z.string().uuid().safeParse(id).success) notFound();
  const session = await requireAdminPermission(locale, "users.read");
  const data = await getAdminUserDetail(id); if (!data) notFound();
  const ar = locale === "ar"; const tab = (await searchParams).tab ?? "overview";
  const tabs = [
    ["overview", ar ? "نظرة عامة" : "Vue d’ensemble"],
    ["learning", ar ? "التعلّم" : "Apprentissage"],
    ["certificates", ar ? "الشهادات" : "Certificats"],
    ["promotion", ar ? "الترقية المهنية" : "Promotion & Agrément"],
    ["sessions", ar ? "الجلسات" : "Sessions"],
    ["personas", ar ? "الأدوار" : "Personas"],
    ["audit", ar ? "التدقيق" : "Audit"],
  ] as const;

  const qualifyingCoursesData = (data.qualifyingCourses ?? []).map((qc) => {
    const enrollment = data.enrollments.find((e) => String(e.course_id) === qc.id) as Record<string, unknown> | undefined;
    const isCompleted = Boolean(enrollment && (enrollment.status === "COMPLETED" || Number(enrollment.progress_percent) >= 100));
    return {
      id: qc.id,
      titleFr: qc.title_fr,
      titleAr: qc.title_ar,
      targetType: qc.qualifying_target_type,
      targetCategory: qc.qualifying_target_category,
      isEnrolled: Boolean(enrollment),
      isCompleted,
      progressPercent: enrollment ? Number(enrollment.progress_percent) || 0 : 0,
    };
  });

  const certificatesData = data.certificates.map((c) => {
    const item = c as Record<string, unknown>;
    return {
      id: String(item.id),
      courseTitleFr: String(item.title_fr || ""),
      courseTitleAr: String(item.title_ar || ""),
      issuedAt: item.issued_at as Date,
      code: String(item.code || ""),
    };
  });
  // Uncached (unlike getAdminUserDetail's Redis-cached SQL blob) to keep the
  // admin persona-mutation → invalidateAdminUserCaches path simple: this
  // section always reflects the current DB state without a separate cache
  // key to invalidate.
  const personaMemberships = tab === "personas" ? await getUserPersonas(id) : [];
  // Read-only professional-profile detail for the reviewer, scoped to
  // whichever professional personas this user actually holds - never a
  // second authorization path, purely display to inform admin approval.
  const professionalPersonas = new Set(personaMemberships.map((m) => m.persona));
  const [teacherProfile, avsProfile, specialistProfile, organizationProfile] = tab === "personas"
    ? await Promise.all([
        professionalPersonas.has("TEACHER") ? getTeacherProfileForUser(id) : Promise.resolve(null),
        professionalPersonas.has("AVS") ? getAvsProfileForUser(id) : Promise.resolve(null),
        professionalPersonas.has("SPECIALIST") ? getSpecialistProfileForUser(id) : Promise.resolve(null),
        professionalPersonas.has("ORGANIZATION") ? getOrganizationProfileForUser(id) : Promise.resolve(null),
      ])
    : [null, null, null, null];
  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "ملف المستخدم" : "Fiche utilisateur"} title={data.user.name}
      description={`${data.user.email} · ${data.user.provider === "google" ? "Google" : "Email"}`}
      actions={
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <AdminUserCategorySelect
            userId={id}
            currentCategory={data.user.professional_post_status || data.user.profile_type || "LEARNER"}
            canEdit={hasAdminPermission(String(session.user.role), "users.manage")}
            locale={locale}
          />
          <AdminUserRole userId={id} role={data.user.role} canEdit={String(session.user.role)==="SUPER_ADMIN"}/>
        </div>
      }/>
    <section className="admin-user-summary">
      <article><span>{ar?"الفئة":"Catégorie"}</span><strong>{data.user.professional_post_status === "APPROVED_AVS" ? (ar ? "AVS معتمد" : "AVS Certifié") : data.user.professional_post_status === "APPROVED_SPECIALIST" ? (ar ? "أخصائي معتمد" : "Spécialiste") : (ar ? "متعلم" : "Apprenant")}</strong></article>
      <article><span>{ar?"الدور":"Rôle"}</span><strong>{data.user.role}</strong></article>
      <article><span>{ar?"انضم":"Inscrit le"}</span><strong>{formatDate(data.user.joined_at,locale)}</strong></article>
      <article><span>{ar?"التسجيلات":"Inscriptions"}</span><strong>{data.user.enrollments}</strong></article>
      <article><span>{ar?"متوسط التقدم":"Progression moyenne"}</span><strong>{data.user.completion}%</strong></article>
      <article><span>{ar?"الشهادات":"Certificats"}</span><strong>{data.user.certificates}</strong></article>
      <article><span>{ar?"المدفوع":"Total payé"}</span><strong>{formatMillimes(data.user.paid_millimes,locale)}</strong></article>
    </section>
    
    {hasAdminPermission(String(session.user.role), "users.manage") && (
      <AdminUserSupportConsole
        userId={id}
        user={data.user}
        allCourses={data.allCourses}
        enrollments={data.enrollments}
        certificates={data.certificates}
        quizAttempts={data.quizAttempts}
        locale={locale}
      />
    )}

    <nav className="admin-tabs" aria-label={ar ? "أقسام ملف المستخدم" : "Sections de la fiche utilisateur"}>{tabs.map(([key,label])=><a key={key} className={tab===key?"active":""} href={`?tab=${key}`}>{label}</a>)}</nav>
    <section className="admin-surface admin-detail-panel">
      {tab === "learning" || tab === "overview" ? <div><h2>{ar?"مسار التعلّم (الدورات)":"Parcours d’apprentissage (Formations)"}</h2><div className="admin-list">{data.enrollments.map((row) => {
        const item=row as Record<string,unknown>; return <article key={String(item.id)}><div><strong>{String(ar?item.title_ar:item.title_fr)}</strong><small>{formatDate(item.enrolled_at as Date,locale)} · {String(item.status)}</small></div><b>{String(item.progress_percent)}%</b></article>;
      })}{!data.enrollments.length?<p className="admin-empty">{ar?"لا توجد تسجيلات.":"Aucune inscription."}</p>:null}</div>
      
      <h2 className="admin-section-heading-spaced">{ar?"التقدم في الفيديوهات":"Progression vidéo"}</h2>
      <div className="admin-list">{data.videoProgress.map((row) => {
        const item=row as Record<string,unknown>;
        const duration = Number(item.duration_seconds) || 0;
        const watched = Number(item.watched_seconds) || 0;
        const pct = duration > 0 ? Math.min(100, Math.round((watched / duration) * 100)) : (item.completed ? 100 : 0);
        return <article key={String(item.id)}><div><strong>{String(ar?item.title_ar:item.title_fr)}</strong><small>{String(ar?item.course_ar:item.course_fr)}</small></div><div className="admin-user-progress-wrap">
          <progress className="admin-user-progress" max={100} value={pct} aria-label={`${String(ar?item.title_ar:item.title_fr)} ${pct}%`} />
          <b>{pct}%</b>
        </div></article>;
      })}{!data.videoProgress.length?<p className="admin-empty">{ar?"لا توجد مقاطع فيديو تمت مشاهدتها.":"Aucune vidéo visionnée."}</p>:null}</div>

      <h2 className="admin-section-heading-spaced">{ar?"نتائج الاختبارات والتقييمات":"Résultats aux quiz & évaluations"}</h2>
      <div className="admin-list">{data.quizAttempts?.map((row) => {
        const item = row as Record<string, unknown>;
        const passed = Boolean(item.passed);
        return (
          <article key={String(item.id)}>
            <div>
              <strong>{String(ar ? item.assessment_title_ar : item.assessment_title_fr)}</strong>
              <small>
                {String(ar ? item.course_title_ar : item.course_title_fr)} · {ar ? `المحاولة #${item.attempt_number}` : `Tentative #${item.attempt_number}`} · {item.submitted_at ? formatDate(item.submitted_at as Date, locale) : "—"}
              </small>
            </div>
            <div className="admin-quiz-score-badge">
              <span className={`admin-status ${passed ? "is-success" : "is-danger"}`}>
                {passed ? (ar ? "ناجح" : "Réussi") : (ar ? "غير ناجح" : "Non réussi")}
              </span>
              <b>{String(item.percentage)}%</b>
              <small>({String(item.raw_points)}/{String(item.max_points)} pts)</small>
            </div>
          </article>
        );
      })}{!data.quizAttempts?.length ? <p className="admin-empty">{ar ? "لا توجد محاولات تقييم لهذا المستخدم." : "Aucune tentative d’évaluation pour cet utilisateur."}</p> : null}</div>
      
      </div>:null}
      {tab === "certificates" ? <div><h2>{ar?"الشهادات":"Certificats"}</h2><div className="admin-list">{data.certificates.map((row) => {const item=row as Record<string,unknown>;return <article key={String(item.id)}><div><strong>{String(ar?item.title_ar:item.title_fr)}</strong><small>{String(item.code)}</small></div><b>{formatDate(item.issued_at as Date,locale)}</b></article>})}</div></div>:null}
      {tab === "promotion" ? (
        <AdminUserPromotionPanel
          locale={locale}
          userId={id}
          userName={data.user.name}
          currentPostStatus={data.user.professional_post_status}
          qualifyingCourses={qualifyingCoursesData}
          certificates={certificatesData}
        />
      ) : null}
      {tab === "sessions" ? <div><h2>{ar?"جلسات الحساب":"Sessions du compte"}</h2><div className="admin-list">{data.sessions.map((row) => {const item=row as Record<string,unknown>;return <article key={String(item.id)}><div><strong>{String(item.user_agent ?? (ar?"جهاز غير معروف":"Appareil inconnu"))}</strong><small>{item.ip_address?String(item.ip_address):"—"}</small></div><b>{formatDate(item.updated_at as Date,locale)}</b></article>})}</div><p className="admin-help">{ar?"يمكنك إنهاء وإبطال كافة الجلسات النشطة من لوحة دعم Super Admin أعلاه (قسم الأمان والجلسات).":"Vous pouvez révoquer l'ensemble des sessions actives depuis la console support ci-dessus (onglet Sécurité & Accès)."}</p></div>:null}
      {tab === "personas" ? <div><h2>{ar?"الأدوار (Personas)":"Personas"}</h2><AdminUserPersonas userId={id} memberships={personaMemberships.map((m) => ({ persona: m.persona, status: m.status, isPrimary: m.isPrimary }))} canEdit={hasAdminPermission(String(session.user.role), "personas.manage")}/>
        {teacherProfile && <article className="admin-persona-profile admin-persona-profile-first"><div><strong>{ar?"ملف التدريس":"Profil enseignant"}</strong><small>{[teacherProfile.discipline, teacherProfile.qualification, teacherProfile.experienceYears != null ? `${teacherProfile.experienceYears} ${ar?"سنة خبرة":"ans d'expérience"}` : null, teacherProfile.professionalInstitution].filter(Boolean).join(" · ") || (ar?"لا توجد تفاصيل":"Aucun détail")}</small></div></article>}
        {avsProfile && <article className="admin-persona-profile"><div><strong>{ar?"ملف AVS":"Profil AVS"}</strong><small>{[avsProfile.qualification, avsProfile.experienceYears != null ? `${avsProfile.experienceYears} ${ar?"سنة خبرة":"ans d'expérience"}` : null, avsProfile.interventionDomains?.join(", ")].filter(Boolean).join(" · ") || (ar?"لا توجد تفاصيل":"Aucun détail")}</small></div></article>}
        {specialistProfile && <article className="admin-persona-profile"><div><strong>{ar?"ملف الأخصائي":"Profil spécialiste"}</strong><small>{[specialistProfile.specialty, specialistProfile.qualification, specialistProfile.experienceYears != null ? `${specialistProfile.experienceYears} ${ar?"سنة خبرة":"ans d'expérience"}` : null, specialistProfile.practiceStructure].filter(Boolean).join(" · ") || (ar?"لا توجد تفاصيل":"Aucun détail")}</small></div></article>}
        {organizationProfile && <article className="admin-persona-profile"><div><strong>{ar?"ملف المؤسسة":"Profil organisation"}</strong><small>{[organizationProfile.organizationName, organizationProfile.organizationType, organizationProfile.representativeRole].filter(Boolean).join(" · ") || (ar?"لا توجد تفاصيل":"Aucun détail")}</small></div></article>}
      </div>:null}
      {tab === "audit" ? (
        <div className="admin-empty-state">
          <strong>{ar ? "سجل التدقيق المرتبط" : "Journal d’audit lié"}</strong>
          <p>
            {ar
              ? "تتبع كافة العمليات والأنشطة والولوج المرتبطة بهذا المستخدم مباشرة في سجل التدقيق."
              : "Retrouvez l’ensemble des opérations, connexions et accès associés à cet utilisateur."}
          </p>
          <div className="mt-3">
            <Link className="admin-primary-button" href={`/${locale}/admin/audit?q=${data.user.email}`}>
              {ar ? "عرض سجل تدقيق هذا المستخدم" : "Consulter le journal d’audit"}
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  </>;
}
