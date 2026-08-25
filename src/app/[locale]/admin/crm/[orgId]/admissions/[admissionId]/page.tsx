import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationById } from "@/server/queries/organizations";
import { getAdmission } from "@/server/queries/admission";
import { listCohorts } from "@/server/queries/cohorts";
import { listPublishedCourses } from "@/server/queries/catalog";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminAdmissionActions } from "@/components/admin/AdminAdmissionActions";
import { AdminEnrollForm } from "@/components/admin/AdminEnrollForm";

export const dynamic = "force-dynamic";

export default async function AdminCrmAdmissionDetailPage({ params }: { params: Promise<{ locale: string; orgId: string; admissionId: string }> }) {
  const { locale, orgId, admissionId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success || !z.string().uuid().safeParse(admissionId).success) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";

  const organization = await getOrganizationById(orgId);
  if (!organization) notFound();

  const detail = await getAdmission(orgId, admissionId);
  if (!detail) notFound();
  const { admission: row, contact, decider } = detail;

  // Enrollment is only offered once the admission funnel has actually
  // reached a linked account — an ACCEPTED admission alone never enrolls
  // (docs/premium/ROADMAP.md Phase 7 §N).
  const canEnroll = row.decision === "ACCEPTED" && Boolean(contact?.linkedUserId);
  const [courses, cohorts] = canEnroll
    ? await Promise.all([listPublishedCourses(), listCohorts(orgId)])
    : [[], []];

  return <>
    <AdminPageHeader locale={locale} eyebrow={organization.name}
      title={ar ? "ملف القبول" : "Dossier d’admission"}
      description={`${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`.trim() || (ar ? "بدون جهة اتصال" : "Sans contact")} />

    <section className="admin-surface">
      <div className="admin-list">
        <article><div><strong>{ar ? "القرار" : "Décision"}</strong><small>{row.decision}</small></div></article>
        <article><div><strong>{ar ? "البّت بواسطة" : "Décidé par"}</strong><small>{decider?.name ?? "—"}</small></div></article>
        <article><div><strong>{ar ? "السبب" : "Motif"}</strong><small>{row.reason ?? "—"}</small></div></article>
        {row.decidedAt ? <article><div><strong>{ar ? "تاريخ البت" : "Décidé le"}</strong><small>{formatDate(row.decidedAt, locale)}</small></div></article> : null}
      </div>
      <AdminAdmissionActions organizationId={orgId} admissionId={admissionId} decision={row.decision} locale={locale} />

      {canEnroll ? (
        <AdminEnrollForm organizationId={orgId} contactId={row.contactId} locale={locale}
          courses={courses.map((c) => ({ id: c.id, titleFr: c.titleFr, titleAr: c.titleAr }))}
          cohorts={cohorts.map(({ cohort }) => ({ id: cohort.id, name: cohort.name, courseId: cohort.courseId }))} />
      ) : null}
    </section>
  </>;
}