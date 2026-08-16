import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationMembers, listOrganizations } from "@/server/queries/organizations";
import { getContactActivity, getContactNotes, getContactTags, getCrmContact, listCrmPipelines, listCrmPipelineStages, listCrmTags } from "@/server/queries/crm";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminCrmContactActions } from "@/components/admin/AdminCrmContactActions";
import { AdminWhatsAppContactSection } from "@/components/admin/AdminWhatsAppContactSection";
import { AdminAccountInvitationSection } from "@/components/admin/AdminAccountInvitationSection";
import { getAccountInvitationForContact } from "@/server/queries/account-invitations";
import { evaluateInvitationEligibility } from "@/server/services/account-invitations";

export const dynamic = "force-dynamic";

export default async function AdminCrmContactDetailPage({ params }: { params: Promise<{ locale: string; orgId: string; contactId: string }> }) {
  const { locale, orgId, contactId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success || !z.string().uuid().safeParse(contactId).success) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";

  const organizations = await listOrganizations();
  const organization = organizations.find((org) => org.id === orgId);
  if (!organization) notFound();

  const contact = await getCrmContact(orgId, contactId);
  if (!contact) notFound();

  const [contactTags, allTags, notes, activity, members, pipelines, invitation, eligibility] = await Promise.all([
    getContactTags(contactId),
    listCrmTags(orgId),
    getContactNotes(contactId),
    getContactActivity(contactId),
    getOrganizationMembers(orgId),
    listCrmPipelines(orgId),
    getAccountInvitationForContact(orgId, contactId),
    evaluateInvitationEligibility(orgId, contactId),
  ]);
  const stageLists = await Promise.all(pipelines.map((p) => listCrmPipelineStages(p.id)));
  const stages = stageLists.flat().map((s) => ({ id: s.id, name: s.name }));
  const activeMembers = members.filter((m) => m.status === "ACTIVE").map((m) => ({ userId: m.userId, role: m.role }));

  return <>
    <AdminPageHeader locale={locale} eyebrow={organization.name}
      title={`${contact.firstName} ${contact.lastName}`}
      description={contact.email ?? contact.phone ?? ""} />

    <section className="admin-surface">
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

    <section className="admin-surface">
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
