import { notFound } from "next/navigation";
import { Users, BookOpen } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserOrganizationMemberships, getOrganizationMembers } from "@/server/queries/organizations";
import { listCohorts } from "@/server/queries/cohorts";
import { organizationRoleAtLeast } from "@/modules/relationships/domain/permissions";
import { LearnerEmptyState } from "@/components/student/LearnerPages";
import { PersonaMetricCard, PersonaPanel, PersonaRow } from "@/modules/personas/components/PersonaPages";

export default async function OrganizationPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "ORGANIZATION");
  const memberships = await getUserOrganizationMemberships(session.user.id);

  const orgDetails = await Promise.all(
    memberships.map(async ({ membership, organization }) => {
      const canSeeRoster = organizationRoleAtLeast(membership.role as "OWNER" | "MANAGER" | "STAFF" | "VIEWER", "STAFF");
      const [members, cohorts] = await Promise.all([
        canSeeRoster ? getOrganizationMembers(organization.id) : Promise.resolve([]),
        listCohorts(organization.id),
      ]);
      return { membership, organization, members, cohorts, canSeeRoster };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#a9752f]">{ar ? "مساحة المؤسسة" : "Espace organisation"}</span>
        <h1 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl font-semibold tracking-tight text-[#082D55] sm:text-3xl">{ar ? `مرحبًا، ${session.user.name}` : `Bonjour, ${session.user.name}`}</h1>
        <p className="mt-1 text-sm text-[#7a7261]">{ar ? "نظرة عامة على مؤسساتك وفق دورك في كل منها." : "Vue d'ensemble de vos organisations, selon votre rôle dans chacune."}</p>
      </div>

      {orgDetails.length === 0 ? (
        <PersonaPanel title={ar ? "المؤسسات" : "Organisations"}>
          <LearnerEmptyState
            icon={Users}
            title={ar ? "لا توجد بيانات بعد" : "Aucune donnée pour le moment"}
            body={ar ? "لا توجد بيانات تشغيلية متاحة بعد لهذه المؤسسة." : "Aucune donnée opérationnelle n'est encore disponible pour cette organisation."}
          />
        </PersonaPanel>
      ) : (
        orgDetails.map(({ membership, organization, members, cohorts, canSeeRoster }) => (
          <PersonaPanel
            key={membership.id}
            title={organization.name}
            action={<span className="text-xs font-semibold text-[#7a7261]">{ar ? "دوري" : "Mon rôle"} · {membership.role}</span>}
          >
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {canSeeRoster && <PersonaMetricCard icon={Users} tone="navy" label={ar ? "الأعضاء" : "Membres"} value={members.length} />}
              <PersonaMetricCard icon={BookOpen} tone="gold" label={ar ? "المجموعات" : "Cohortes"} value={cohorts.length} />
            </div>

            {cohorts.length === 0 ? (
              <LearnerEmptyState icon={BookOpen} title={ar ? "لا توجد بيانات بعد" : "Aucune donnée pour le moment"} body={ar ? "لا توجد بيانات تشغيلية متاحة بعد لهذه المؤسسة." : "Aucune donnée opérationnelle n'est encore disponible pour cette organisation."} />
            ) : (
              <ul>
                {cohorts.slice(0, 5).map(({ cohort, course }) => (
                  <PersonaRow key={cohort.id} icon={BookOpen} title={cohort.name} meta={ar ? course.titleAr : course.titleFr} />
                ))}
              </ul>
            )}
          </PersonaPanel>
        ))
      )}
    </div>
  );
}
