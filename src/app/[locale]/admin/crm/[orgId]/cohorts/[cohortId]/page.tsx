import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listOrganizations } from "@/server/queries/organizations";
import { getCohortRoster } from "@/server/queries/cohorts";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function AdminCrmCohortDetailPage({ params }: { params: Promise<{ locale: string; orgId: string; cohortId: string }> }) {
  const { locale, orgId, cohortId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success || !z.string().uuid().safeParse(cohortId).success) notFound();
  await requireAdminPermission(locale, "cohorts.manage");
  const ar = locale === "ar";

  const organizations = await listOrganizations();
  const organization = organizations.find((org) => org.id === orgId);
  if (!organization) notFound();

  const detail = await getCohortRoster(orgId, cohortId);
  if (!detail) notFound();
  const { cohort, course, roster } = detail;

  return <>
    <AdminPageHeader locale={locale} eyebrow={organization.name}
      title={cohort.name}
      description={`${ar ? course.titleAr : course.titleFr} · ${roster.length}${cohort.capacity ? `/${cohort.capacity}` : ""} ${ar ? "طالب" : "étudiants"}`} />

    <div className="admin-table-surface">
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr><th>{ar ? "الطالب" : "Étudiant"}</th><th>{ar ? "البريد" : "E-mail"}</th><th>{ar ? "مصدر التسجيل" : "Source"}</th></tr>
          </thead>
          <tbody>
            {roster.map(({ membership, enrollment, student }) => (
              <tr key={membership.id}>
                <td><strong>{student.name}</strong></td>
                <td>{student.email}</td>
                <td>{enrollment.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!roster.length ? (
        <div className="admin-empty-state"><strong>{ar ? "لا يوجد أعضاء" : "Aucun membre"}</strong></div>
      ) : null}
    </div>
  </>;
}
