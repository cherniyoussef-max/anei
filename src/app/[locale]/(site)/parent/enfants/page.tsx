import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getLinkedStudentsForParent } from "@/server/queries/relationships";
import { getParentAllChildrenCareSummary } from "@/server/queries/care-notes-documents";
import { ParentChildCareTeam } from "@/components/care/ParentChildCareTeam";
import { AddChildButton } from "@/components/parent/AddChildButton";

export const dynamic = "force-dynamic";

export default async function ParentChildrenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "PARENT");
  const _linkedStudents = await getLinkedStudentsForParent(session.user.id);
  const childrenSummaries = await getParentAllChildrenCareSummary(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0056D2]">
            {ar ? "مساحة الوالدين" : "Espace parent"}
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
            {ar ? "أبنائي ومسار المتابعة" : "Mes enfants & suivi"}
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {ar
              ? "فريق المتابعة المختص، الملاحظات الإكلينيكية المشتركة، والوثائق التأهيلية لأبنائكم."
              : "Équipe soignante, observations de séances et documents partagés pour vos enfants."}
          </p>
        </div>

        <AddChildButton
          locale={locale}
          label={ar ? "+ إضافة طفل" : "+ Ajouter un enfant"}
        />
      </div>

      <ParentChildCareTeam
        locale={locale}
        childrenSummaries={childrenSummaries}
      />
    </div>
  );
}
