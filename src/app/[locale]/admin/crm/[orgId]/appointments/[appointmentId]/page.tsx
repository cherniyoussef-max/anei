import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationById } from "@/server/queries/organizations";
import { getAppointment } from "@/server/queries/admission";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminAppointmentActions } from "@/components/admin/AdminAppointmentActions";

export const dynamic = "force-dynamic";

export default async function AdminCrmAppointmentDetailPage({ params }: { params: Promise<{ locale: string; orgId: string; appointmentId: string }> }) {
  const { locale, orgId, appointmentId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success || !z.string().uuid().safeParse(appointmentId).success) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";

  const organization = await getOrganizationById(orgId);
  if (!organization) notFound();

  const detail = await getAppointment(orgId, appointmentId);
  if (!detail) notFound();
  const { appointment: appt, contact, assignee, events } = detail;

  return <>
    <AdminPageHeader locale={locale} eyebrow={organization.name}
      title={ar ? "الموعد" : "Rendez-vous"}
      description={`${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`.trim() || (ar ? "بدون جهة اتصال" : "Sans contact")} />

    <section className="admin-surface">
      <div className="admin-list">
        <article><div><strong>{ar ? "النوع" : "Type"}</strong><small>{appt.type}</small></div></article>
        <article><div><strong>{ar ? "البداية" : "Début"}</strong><small>{formatDate(appt.startAt, locale)}</small></div></article>
        <article><div><strong>{ar ? "النهاية" : "Fin"}</strong><small>{formatDate(appt.endAt, locale)}</small></div></article>
        <article><div><strong>{ar ? "المسؤول" : "Assigné"}</strong><small>{assignee?.name ?? "—"}</small></div></article>
        <article><div><strong>{ar ? "جهة الاتصال" : "Contact"}</strong><small>{contact?.email ?? contact?.phone ?? "—"}</small></div></article>
        <article><div><strong>{ar ? "ملاحظة" : "Note"}</strong><small>{appt.note ?? "—"}</small></div></article>
      </div>
      <AdminAppointmentActions organizationId={orgId} appointmentId={appointmentId} status={appt.status} locale={locale} />
    </section>

    <section className="admin-surface">
      <h3>{ar ? "سجل الموعد" : "Historique du rendez-vous"}</h3>
      <div className="admin-list">
        {events.map((event) => (
          <article key={event.id}>
            <div>
              <strong>{event.eventType}</strong>
              <small>
                {event.previousStatus ? `${event.previousStatus} → ${event.newStatus}` : formatDate(event.createdAt, locale)}
              </small>
            </div>
          </article>
        ))}
        {!events.length ? <p>{ar ? "لا يوجد سجل بعد." : "Aucun historique pour le moment."}</p> : null}
      </div>
    </section>
  </>;
}