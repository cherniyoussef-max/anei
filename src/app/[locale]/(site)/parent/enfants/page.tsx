import { notFound } from "next/navigation";
import { Users, User } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getLinkedStudentsForParent } from "@/server/queries/relationships";
import { LearnerEmptyState } from "@/components/student/LearnerPages";
import { PersonaPanel, PersonaRow } from "@/modules/personas/components/PersonaPages";

export const dynamic = "force-dynamic";

export default async function ParentChildrenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "PARENT");
  const linkedStudents = await getLinkedStudentsForParent(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#a9752f]">{ar ? "مساحة الوالدين" : "Espace parent"}</span>
        <h1 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl font-semibold tracking-tight text-[#082D55] sm:text-3xl">{ar ? "أبنائي" : "Mes enfants"}</h1>
      </div>

      <PersonaPanel title={ar ? "قائمة الأبناء" : "Liste des enfants"}>
        {linkedStudents.length === 0 ? (
          <LearnerEmptyState
            icon={Users}
            title={ar ? "لا يوجد طفل مرتبط بعد" : "Aucun enfant associé pour le moment"}
            body={ar
              ? "لا يوجد أي متعلم مرتبط بحسابك حاليًا. لا يمكن ربط الأبناء إلا عبر فريق الأكاديمية."
              : "Aucun apprenant lié à votre compte. Le lien avec un enfant ne peut être établi que par l'équipe de l'Académie."}
          />
        ) : (
          <ul>
            {linkedStudents.map(({ link, student }) => (
              <PersonaRow key={link.id} icon={User} title={student.name} meta={`${ar ? "الصلة" : "Relation"} · ${link.relationshipType}`} />
            ))}
          </ul>
        )}
      </PersonaPanel>
    </div>
  );
}
