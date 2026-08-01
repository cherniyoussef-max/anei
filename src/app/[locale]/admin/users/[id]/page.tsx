import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, formatMillimes, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminUserDetail } from "@/modules/admin/queries/admin-users";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminUserRole } from "@/components/admin/AdminUserRole";

export const dynamic = "force-dynamic";
export default async function AdminUserDetail({ params, searchParams }: {
  params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ tab?: string }>;
}) {
  const { locale, id } = await params; if (!isLocale(locale) || !z.string().uuid().safeParse(id).success) notFound();
  const session = await requireAdminPermission(locale, "users.read");
  const data = await getAdminUserDetail(id); if (!data) notFound();
  const ar = locale === "ar"; const tab = (await searchParams).tab ?? "overview";
  const tabs = [["overview",ar?"نظرة عامة":"Vue d’ensemble"],["learning",ar?"التعلّم":"Apprentissage"],["certificates",ar?"الشهادات":"Certificats"],["sessions",ar?"الجلسات":"Sessions"],["audit",ar?"التدقيق":"Audit"]] as const;
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
    <nav className="admin-tabs" aria-label={ar ? "أقسام ملف المستخدم" : "Sections de la fiche utilisateur"}>{tabs.map(([key,label])=><a key={key} className={tab===key?"active":""} href={`?tab=${key}`}>{label}</a>)}</nav>
    <section className="admin-surface admin-detail-panel">
      {tab === "learning" || tab === "overview" ? <div><h2>{ar?"مسار التعلّم":"Parcours d’apprentissage"}</h2><div className="admin-list">{data.enrollments.map((row) => {
        const item=row as Record<string,unknown>; return <article key={String(item.id)}><div><strong>{String(ar?item.title_ar:item.title_fr)}</strong><small>{formatDate(item.enrolled_at as Date,locale)} · {String(item.status)}</small></div><b>{String(item.progress_percent)}%</b></article>;
      })}{!data.enrollments.length?<p className="admin-empty">{ar?"لا توجد تسجيلات.":"Aucune inscription."}</p>:null}</div></div>:null}
      {tab === "certificates" ? <div><h2>{ar?"الشهادات":"Certificats"}</h2><div className="admin-list">{data.certificates.map((row) => {const item=row as Record<string,unknown>;return <article key={String(item.id)}><div><strong>{String(ar?item.title_ar:item.title_fr)}</strong><small>{String(item.code)}</small></div><b>{formatDate(item.issued_at as Date,locale)}</b></article>})}</div></div>:null}
      {tab === "sessions" ? <div><h2>{ar?"جلسات الحساب":"Sessions du compte"}</h2><div className="admin-list">{data.sessions.map((row) => {const item=row as Record<string,unknown>;return <article key={String(item.id)}><div><strong>{String(item.user_agent ?? (ar?"جهاز غير معروف":"Appareil inconnu"))}</strong><small>{item.ip_address?String(item.ip_address):"—"}</small></div><b>{formatDate(item.updated_at as Date,locale)}</b></article>})}</div><p className="admin-help">{ar?"إبطال جلسة طرف ثالث غير متاح بأمان في واجهة الخادم الحالية لـ Better Auth؛ لم تتم محاكاته يدويًا.":"La révocation administrative d’une session tierce n’est pas exposée de façon sûre par l’intégration Better Auth actuelle ; elle n’a pas été réinventée."}</p></div>:null}
      {tab === "audit" ? <p className="admin-empty">{ar?"استخدم سجل التدقيق مع معرّف المستخدم لتتبع العمليات.":"Utilisez le journal d’audit avec l’identifiant utilisateur pour retracer les opérations."}</p>:null}
    </section>
  </>;
}
