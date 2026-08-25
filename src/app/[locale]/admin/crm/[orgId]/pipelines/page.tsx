import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationById } from "@/server/queries/organizations";
import { listCrmPipelines, listCrmPipelineStages } from "@/server/queries/crm";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminCrmPipelineForm } from "@/components/admin/AdminCrmPipelineForm";
import { AdminCrmStageForm } from "@/components/admin/AdminCrmStageForm";

export const dynamic = "force-dynamic";

export default async function AdminCrmPipelinesPage({ params }: { params: Promise<{ locale: string; orgId: string }> }) {
  const { locale, orgId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success) notFound();
  await requireAdminPermission(locale, "crm.manage");
  const ar = locale === "ar";

  const organization = await getOrganizationById(orgId);
  if (!organization) notFound();

  const pipelines = await listCrmPipelines(orgId);
  const stagesByPipeline = await Promise.all(pipelines.map((p) => listCrmPipelineStages(p.id)));

  return <>
    <AdminPageHeader locale={locale} eyebrow={organization.name}
      title={ar ? "مسارات CRM" : "Pipelines CRM"}
      description={ar ? "إدارة المسارات والمراحل." : "Gérer les pipelines et leurs étapes."} />

    <section className="admin-surface"><AdminCrmPipelineForm organizationId={orgId} locale={locale} /></section>

    {pipelines.map((pipeline, i) => (
      <section className="admin-surface" key={pipeline.id}>
        <h3>{pipeline.name}</h3>
        <div className="admin-list">
          {stagesByPipeline[i].map((stage) => (
            <article key={stage.id}><div><strong>{stage.name}</strong><small>{ar ? "الترتيب" : "Position"}: {stage.position}</small></div></article>
          ))}
        </div>
        <AdminCrmStageForm organizationId={orgId} pipelineId={pipeline.id} nextPosition={stagesByPipeline[i].length} locale={locale} />
      </section>
    ))}
    {!pipelines.length ? <div className="admin-empty-state"><strong>{ar ? "لا توجد مسارات بعد" : "Aucun pipeline pour le moment"}</strong></div> : null}
  </>;
}
