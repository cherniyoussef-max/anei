import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminAvsAssignmentForm, AdminParentLinkForm, AdminSpecialistAssignmentForm, AdminTeacherAssignmentForm } from "@/components/admin/AdminRelationshipForms";

export const dynamic = "force-dynamic";

export default async function AdminRelationshipsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "relationships.manage");
  const ar = locale === "ar";

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "العلاقات" : "Relations"}
      title={ar ? "إدارة العلاقات" : "Gestion des relations"}
      description={ar
        ? "ربط الوالدين بالطلاب، وتعيين مرافقي الحياة المدرسية والأخصائيين. إدارة يدوية من الطاقم الإداري فقط."
        : "Lier les parents aux élèves, assigner les AVS et les spécialistes. Gestion manuelle réservée à l’équipe administrative."} />
    <section className="admin-surface">
      <h2>{ar ? "روابط الوالدين والطلاب" : "Liens parent-élève"}</h2>
      <AdminParentLinkForm locale={locale} />
    </section>
    <section className="admin-surface">
      <h2>{ar ? "تعيينات مرافق الحياة المدرسية" : "Assignations AVS"}</h2>
      <AdminAvsAssignmentForm locale={locale} />
    </section>
    <section className="admin-surface">
      <h2>{ar ? "تعيينات الأخصائي" : "Assignations spécialiste"}</h2>
      <AdminSpecialistAssignmentForm locale={locale} />
    </section>
    <section className="admin-surface">
      <h2>{ar ? "تعيينات المكوّنين" : "Assignations formateur"}</h2>
      <AdminTeacherAssignmentForm locale={locale} />
    </section>
  </>;
}
