import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationById } from "@/server/queries/organizations";
import { listCohorts } from "@/server/queries/cohorts";
import { listPublishedCourses } from "@/server/queries/catalog";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminCohortCreateForm, AdminCohortStatusSelect } from "@/components/admin/AdminCohortForms";

export const dynamic = "force-dynamic";

export default async function AdminCrmCohortsPage({ params }: { params: Promise<{ locale: string; orgId: string }> }) {
  const { locale, orgId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success) notFound();
  await requireAdminPermission(locale, "cohorts.manage");
  const ar = locale === "ar";

  const organization = await getOrganizationById(orgId);
  if (!organization) notFound();

  const [cohorts, courses] = await Promise.all([listCohorts(orgId), listPublishedCourses()]);

  return <>
    <AdminPageHeader locale={locale} eyebrow={organization.name}
      title={ar ? "المجموعات" : "Cohortes"}
      description={ar ? `${cohorts.length} مجموعة` : `${cohorts.length} cohortes`}
      actions={<>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}`}>{ar ? "العملاء" : "Contacts"}</Link>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/admissions`}>{ar ? "ملفات القبول" : "Admissions"}</Link>
      </>} />

    <AdminCohortCreateForm organizationId={orgId} locale={locale}
      courses={courses.map((c) => ({ id: c.id, titleFr: c.titleFr, titleAr: c.titleAr }))} />

    <div className="admin-table-surface">
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>{ar ? "الاسم" : "Nom"}</th><th>{ar ? "الدورة" : "Formation"}</th>
              <th>{ar ? "السعة" : "Capacité"}</th><th>{ar ? "الحالة" : "Statut"}</th>
              <th><span className="sr-only">{ar ? "إجراءات" : "Actions"}</span></th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map(({ cohort, course }) => (
              <tr key={cohort.id}>
                <td><strong>{cohort.name}</strong></td>
                <td>{ar ? course.titleAr : course.titleFr}</td>
                <td>{cohort.capacity ?? "—"}</td>
                <td><AdminCohortStatusSelect organizationId={orgId} cohortId={cohort.id} status={cohort.status} /></td>
                <td><Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/cohorts/${cohort.id}`}>{ar ? "الأعضاء" : "Roster"}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!cohorts.length ? (
        <div className="admin-empty-state"><strong>{ar ? "لا توجد مجموعات" : "Aucune cohorte"}</strong></div>
      ) : null}
    </div>
  </>;
}
