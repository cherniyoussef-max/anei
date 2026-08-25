import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationById, getOrganizationMembers } from "@/server/queries/organizations";
import { getContactActivity, getContactNotes, getContactTags, getCrmContact, getStagesForPipelines, listCrmPipelines, listCrmTags } from "@/server/queries/crm";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminCrmContactActions } from "@/components/admin/AdminCrmContactActions";
import { AdminWhatsAppContactSection } from "@/components/admin/AdminWhatsAppContactSection";
import { AdminAccountInvitationSection } from "@/components/admin/AdminAccountInvitationSection";
import { getAccountInvitationForContact } from "@/server/queries/account-invitations";
import { evaluateInvitationEligibility } from "@/server/services/account-invitations";
import { getCrmLearnerOperationalDetail } from "@/modules/admin/queries/admin-learning";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminCrmContactDetailPage({ params }: { params: Promise<{ locale: string; orgId: string; contactId: string }> }) {
  const { locale, orgId, contactId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success || !z.string().uuid().safeParse(contactId).success) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";

  const organization = await getOrganizationById(orgId);
  if (!organization) notFound();

  const contact = await getCrmContact(orgId, contactId);
  if (!contact) notFound();

  const [contactTags, allTags, notes, activity, members, pipelines, invitation, eligibility, learner] = await Promise.all([
    getContactTags(contactId),
    listCrmTags(orgId),
    getContactNotes(contactId),
    getContactActivity(contactId),
    getOrganizationMembers(orgId),
    listCrmPipelines(orgId),
    getAccountInvitationForContact(orgId, contactId),
    evaluateInvitationEligibility(orgId, contactId),
    getCrmLearnerOperationalDetail(orgId, contactId),
  ]);
  const stageRows = await getStagesForPipelines(pipelines.map((p) => p.id));
  const stages = stageRows.map((s) => ({ id: s.id, name: s.name }));
  const activeMembers = members.filter((m) => m.status === "ACTIVE").map((m) => ({ userId: m.userId, role: m.role }));

  return <>
    <AdminPageHeader locale={locale} eyebrow={organization.name}
      title={`${contact.firstName} ${contact.lastName}`}
      description={contact.email ?? contact.phone ?? ""}
      actions={contact.linkedUserId ? <Link className="admin-primary-button" href={`/${locale}/admin/users/${contact.linkedUserId}`}>{ar ? "عرض حساب المستخدم" : "Voir le compte utilisateur"}</Link> : undefined}/>

    <section className="admin-contact-summary" aria-label={ar ? "ملخص جهة الاتصال" : "Résumé du contact"}>
      <article><span>{ar?"الحالة":"Statut"}</span><strong>{contact.status}</strong></article>
      <article><span>{ar?"الشخصية":"Persona"}</span><strong>{learner?.personas.find((item)=>item.primary)?.persona ?? "—"}</strong></article>
      <article><span>{ar?"اكتمال الملف":"Profil complété"}</span><strong>{learner?.contact.profile?.completedAt ? (ar?"نعم":"Oui") : (ar?"لا":"Non")}</strong></article>
      <article><span>{ar?"الهاتف الموثق":"Téléphone vérifié"}</span><strong>{learner?.contact.profile?.phoneVerifiedAt ? learner.contact.profile.phone : "—"}</strong></article>
    </section>

    <nav className="admin-tabs" aria-label={ar ? "تفاصيل جهة الاتصال" : "Détail du contact"}><a href="#overview">{ar?"نظرة عامة":"Vue d’ensemble"}</a><a href="#learning">{ar?"التعلّم":"Apprentissage"}</a><a href="#appointments">{ar?"المواعيد":"Rendez-vous"}</a><a href="#crm">CRM</a><a href="#activity">{ar?"النشاط":"Activité"}</a></nav>

    <section id="learning" className="admin-surface"><h2>{ar?"التعلّم والتقدم":"Apprentissage et progression"}</h2><div className="admin-list">{learner?.enrollments.map((row)=><article key={row.enrollment.id}><div><strong>{ar?row.course.titleAr:row.course.titleFr}</strong><small>{row.enrollment.status} · {row.completedLessons} {ar?"دروس مكتملة":"leçons terminées"}</small></div><b>{row.enrollment.progressPercent}%</b></article>)}{!learner?.enrollments.length?<p className="admin-empty">{ar?"لا توجد تسجيلات.":"Aucune inscription."}</p>:null}</div><h3>{ar?"نتائج الاختبارات":"Résultats des quiz"}</h3><div className="admin-list">{learner?.attempts.map((row)=><article key={row.attempt.id}><div><strong>{ar?row.assessment.titleAr:row.assessment.titleFr}</strong><small>{row.attempt.status} · {row.attempt.attemptNumber}</small></div><b>{row.attempt.percentage??"—"}%</b></article>)}{!learner?.attempts.length?<p className="admin-empty">{ar?"لا توجد محاولات.":"Aucune tentative."}</p>:null}</div></section>

    <section id="appointments" className="admin-surface"><h2>{ar?"المواعيد":"Rendez-vous"}</h2><div className="admin-list">{learner?.appointments.map((row)=><article key={row.id}><div><strong>{formatDate(row.startAt,locale)}</strong><small>{row.type} · Africa/Tunis</small></div><b>{row.status}</b></article>)}{!learner?.appointments.length?<p className="admin-empty">{ar?"لا توجد مواعيد.":"Aucun rendez-vous."}</p>:null}</div></section>

    <section id="crm" className="admin-surface">
      <AdminCrmContactActions
        organizationId={orgId}
        contactId={contactId}
        status={contact.status}
        linkedUserId={contact.linkedUserId}
        assignedToUserId={contact.assignedToUserId}
        currentStageId={contact.currentStageId}
        stages={stages}
        members={activeMembers}
        tags={allTags.map((t) => ({ id: t.id, name: t.name }))}
        contactTags={contactTags}
        locale={locale}
      />
    </section>

    <AdminWhatsAppContactSection organizationId={orgId} contactId={contactId} locale={locale} />

    <AdminAccountInvitationSection
      organizationId={orgId}
      contactId={contactId}
      locale={locale}
      eligible={eligibility.kind === "eligible"}
      invitation={
        invitation
          ? {
              status: invitation.status,
              destinationPhone: invitation.destinationPhone,
              sentAt: invitation.sentAt?.toISOString() ?? null,
              phoneVerifiedAt: invitation.phoneVerifiedAt?.toISOString() ?? null,
              consumedAt: invitation.consumedAt?.toISOString() ?? null,
              revokedAt: invitation.revokedAt?.toISOString() ?? null,
            }
          : null
      }
    />

    <section id="activity" className="admin-surface">
      <h3>{ar ? "الملاحظات" : "Notes"}</h3>
      <div className="admin-list">
        {notes.items.map((note) => (
          <article key={note.id}>
            <div><p>{note.body}</p><small>{formatDate(note.createdAt, locale)}</small></div>
          </article>
        ))}
        {!notes.items.length ? <p>{ar ? "لا توجد ملاحظات بعد." : "Aucune note pour le moment."}</p> : null}
      </div>
    </section>

    <section className="admin-surface">
      <h3>{ar ? "سجل النشاط" : "Historique d’activité"}</h3>
      <div className="admin-list">
        {activity.items.map((entry) => (
          <article key={entry.id}>
            <div><strong>{entry.type}</strong><small>{formatDate(entry.createdAt, locale)}</small></div>
          </article>
        ))}
        {!activity.items.length ? <p>{ar ? "لا يوجد نشاط بعد." : "Aucune activité pour le moment."}</p> : null}
      </div>
    </section>
  </>;
}
