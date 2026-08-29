import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, formatMillimes, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { hasAdminPermission } from "@/modules/admin/domain/permissions";
import { getAdminUserDetail } from "@/modules/admin/queries/admin-users";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminUserRole } from "@/components/admin/AdminUserRole";
import { AdminUserCrmActions } from "@/modules/admin/components/AdminUserCrmActions";
import { AdminUserPersonas } from "@/components/admin/AdminUserPersonas";
import { getUserPersonas } from "@/server/queries/personas";
import {
  getAvsProfileForUser,
  getOrganizationProfileForUser,
  getSpecialistProfileForUser,
  getTeacherProfileForUser,
} from "@/server/services/persona-profiles";

export const dynamic = "force-dynamic";
export default async function AdminUserDetail({ params, searchParams }: {
  params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ tab?: string }>;
}) {
  const { locale, id } = await params; if (!isLocale(locale) || !z.string().uuid().safeParse(id).success) notFound();
  const session = await requireAdminPermission(locale, "users.read");
  const data = await getAdminUserDetail(id); if (!data) notFound();
  const ar = locale === "ar"; const tab = (await searchParams).tab ?? "overview";
  const tabs = [["overview",ar?"نظرة عامة":"Vue d’ensemble"],["learning",ar?"التعلّم":"Apprentissage"],["certificates",ar?"الشهادات":"Certificats"],["sessions",ar?"الجلسات":"Sessions"],["personas",ar?"الأدوار":"Personas"],["audit",ar?"التدقيق":"Audit"]] as const;
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
      actions={<AdminUserRole userId={id} role={data.user.role} canEdit={String(session.user.role)==="SUPER_ADMIN"}/>}/>
    <section className="admin-user-summary">
      <article><span>{ar?"الدور":"Rôle"}</span><strong>{data.user.role}</strong></article>
      <article><span>{ar?"انضم":"Inscrit le"}</span><strong>{formatDate(data.user.joined_at,locale)}</strong></article>
      <article><span>{ar?"التسجيلات":"Inscriptions"}</span><strong>{data.user.enrollments}</strong></article>
      <article><span>{ar?"متوسط التقدم":"Progression moyenne"}</span><strong>{data.user.completion}%</strong></article>
      <article><span>{ar?"الشهادات":"Certificats"}</span><strong>{data.user.certificates}</strong></article>
      <article><span>{ar?"المدفوع":"Total payé"}</span><strong>{formatMillimes(data.user.paid_millimes,locale)}</strong></article>
    </section>
    
    {String(session.user.role) === "SUPER_ADMIN" && (
      <AdminUserCrmActions userId={id} userEmail={data.user.email} userName={data.user.name} locale={locale} />
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
      
      </div>:null}
      {tab === "certificates" ? <div><h2>{ar?"الشهادات":"Certificats"}</h2><div className="admin-list">{data.certificates.map((row) => {const item=row as Record<string,unknown>;return <article key={String(item.id)}><div><strong>{String(ar?item.title_ar:item.title_fr)}</strong><small>{String(item.code)}</small></div><b>{formatDate(item.issued_at as Date,locale)}</b></article>})}</div></div>:null}
      {tab === "sessions" ? <div><h2>{ar?"جلسات الحساب":"Sessions du compte"}</h2><div className="admin-list">{data.sessions.map((row) => {const item=row as Record<string,unknown>;return <article key={String(item.id)}><div><strong>{String(item.user_agent ?? (ar?"جهاز غير معروف":"Appareil inconnu"))}</strong><small>{item.ip_address?String(item.ip_address):"—"}</small></div><b>{formatDate(item.updated_at as Date,locale)}</b></article>})}</div><p className="admin-help">{ar?"إبطال جلسة طرف ثالث غير متاح بأمان في واجهة الخادم الحالية لـ Better Auth؛ لم تتم محاكاته يدويًا.":"La révocation administrative d’une session tierce n’est pas exposée de façon sûre par l’intégration Better Auth actuelle ; elle n’a pas été réinventée."}</p></div>:null}
      {tab === "personas" ? <div><h2>{ar?"الأدوار (Personas)":"Personas"}</h2><AdminUserPersonas userId={id} memberships={personaMemberships.map((m) => ({ persona: m.persona, status: m.status, isPrimary: m.isPrimary }))} canEdit={hasAdminPermission(String(session.user.role), "personas.manage")}/>
        {teacherProfile && <article className="admin-persona-profile admin-persona-profile-first"><div><strong>{ar?"ملف التدريس":"Profil enseignant"}</strong><small>{[teacherProfile.discipline, teacherProfile.qualification, teacherProfile.experienceYears != null ? `${teacherProfile.experienceYears} ${ar?"سنة خبرة":"ans d'expérience"}` : null, teacherProfile.professionalInstitution].filter(Boolean).join(" · ") || (ar?"لا توجد تفاصيل":"Aucun détail")}</small></div></article>}
        {avsProfile && <article className="admin-persona-profile"><div><strong>{ar?"ملف AVS":"Profil AVS"}</strong><small>{[avsProfile.qualification, avsProfile.experienceYears != null ? `${avsProfile.experienceYears} ${ar?"سنة خبرة":"ans d'expérience"}` : null, avsProfile.interventionDomains?.join(", ")].filter(Boolean).join(" · ") || (ar?"لا توجد تفاصيل":"Aucun détail")}</small></div></article>}
        {specialistProfile && <article className="admin-persona-profile"><div><strong>{ar?"ملف الأخصائي":"Profil spécialiste"}</strong><small>{[specialistProfile.specialty, specialistProfile.qualification, specialistProfile.experienceYears != null ? `${specialistProfile.experienceYears} ${ar?"سنة خبرة":"ans d'expérience"}` : null, specialistProfile.practiceStructure].filter(Boolean).join(" · ") || (ar?"لا توجد تفاصيل":"Aucun détail")}</small></div></article>}
        {organizationProfile && <article className="admin-persona-profile"><div><strong>{ar?"ملف المؤسسة":"Profil organisation"}</strong><small>{[organizationProfile.organizationName, organizationProfile.organizationType, organizationProfile.representativeRole].filter(Boolean).join(" · ") || (ar?"لا توجد تفاصيل":"Aucun détail")}</small></div></article>}
      </div>:null}
      {tab === "audit" ? <p className="admin-empty">{ar?"استخدم سجل التدقيق مع معرّف المستخدم لتتبع العمليات.":"Utilisez le journal d’audit avec l’identifiant utilisateur pour retracer les opérations."}</p>:null}
    </section>
  </>;
}
