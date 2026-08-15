import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listOrganizations } from "@/server/queries/organizations";
import { getAdmission } from "@/server/queries/admission";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminAdmissionActions } from "@/components/admin/AdminAdmissionActions";

export const dynamic = "force-dynamic";

export default async function AdminCrmAdmissionDetailPage({ params }: { params: Promise<{ locale: string; orgId: string; admissionId: string }> }) {
  const { locale, orgId, admissionId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success || !z.string().uuid().safeParse(admissionId).success) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";

  const organizations = await listOrganizations();
  const organization = organizations.find((org) => org.id === orgId);
  if (!organization) notFound();

  const detail = await getAdmission(orgId, admissionId);
  if (!detail) notFound();
  const { admission: row, contact, decider } = detail;

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
    </section>
  </>;
}