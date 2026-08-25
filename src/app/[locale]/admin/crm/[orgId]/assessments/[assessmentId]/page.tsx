import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationById } from "@/server/queries/organizations";
import { getAssessment } from "@/server/queries/admission";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminAssessmentActions } from "@/components/admin/AdminAssessmentActions";

export const dynamic = "force-dynamic";

export default async function AdminCrmAssessmentDetailPage({ params }: { params: Promise<{ locale: string; orgId: string; assessmentId: string }> }) {
  const { locale, orgId, assessmentId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success || !z.string().uuid().safeParse(assessmentId).success) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";

  const organization = await getOrganizationById(orgId);
  if (!organization) notFound();

  const detail = await getAssessment(orgId, assessmentId);
  if (!detail) notFound();
  const { assessment: row, contact, assessor } = detail;

  return <>
    <AdminPageHeader locale={locale} eyebrow={organization.name}
      title={ar ? "التقييم" : "Évaluation"}
      description={`${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`.trim() || (ar ? "بدون جهة اتصال" : "Sans contact")} />

    <section className="admin-surface">
      <div className="admin-list">
        <article><div><strong>{ar ? "المقيّم" : "Évaluateur"}</strong><small>{assessor?.name ?? "—"}</small></div></article>
        <article><div><strong>{ar ? "الدرجة" : "Score"}</strong><small>{row.score ?? "—"}{row.maxScore ? ` / ${row.maxScore}` : ""}</small></div></article>
        <article><div><strong>{ar ? "الملخص" : "Résumé"}</strong><small>{row.summary ?? "—"}</small></div></article>
        {row.completedAt ? <article><div><strong>{ar ? "تاريخ الإنهاء" : "Terminé le"}</strong><small>{formatDate(row.completedAt, locale)}</small></div></article> : null}
      </div>
      <AdminAssessmentActions
        organizationId={orgId}
        assessmentId={assessmentId}
        status={row.status}
        score={row.score}
        maxScore={row.maxScore}
        summary={row.summary}
        locale={locale}
      />
    </section>
  </>;
}