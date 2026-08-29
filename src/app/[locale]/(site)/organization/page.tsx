import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserOrganizationMemberships, getOrganizationMembers } from "@/server/queries/organizations";
import { listCohorts } from "@/server/queries/cohorts";
import { organizationRoleAtLeast } from "@/modules/relationships/domain/permissions";
import { Icon } from "@/components/ui/Icon";

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
    <>
      <div className="dashboard-heading dashboard-heading-human">
        <div className="dashboard-heading-copy">
          <span className="eyebrow">{ar ? "مساحة المؤسسة" : "Espace organisation"}</span>
          <h1>{ar ? `مرحبًا، ${session.user.name}` : `Bonjour, ${session.user.name}`}</h1>
          <p>{ar ? "نظرة عامة على مؤسساتك وفق دورك في كل منها." : "Vue d'ensemble de vos organisations, selon votre rôle dans chacune."}</p>
        </div>
      </div>

      {orgDetails.length === 0 ? (
        <div className="dashboard-panel wide">
          <p className="dashboard-empty-copy">
            {ar
              ? "لا توجد بيانات تشغيلية متاحة بعد لهذه المؤسسة."
              : "Aucune donnée opérationnelle n'est encore disponible pour cette organisation."}
          </p>
        </div>
      ) : (
        orgDetails.map(({ membership, organization, members, cohorts, canSeeRoster }) => (
          <div className="dashboard-panel wide dashboard-panel-spaced" key={membership.id}>
            <div className="panel-head">
              <h2>{organization.name}</h2>
              <small>{ar ? "دوري" : "Mon rôle"}: {membership.role}</small>
            </div>

            <div className="dashboard-kpis">
              {canSeeRoster && (
                <div>
                  <div className="kpi-icon"><Icon name="users" size={18} /></div>
                  <div><strong>{members.length}</strong><small>{ar ? "الأعضاء" : "Membres"}</small></div>
                </div>
              )}
              <div>
                <div className="kpi-icon"><Icon name="book" size={18} /></div>
                <div><strong>{cohorts.length}</strong><small>{ar ? "المجموعات" : "Cohortes"}</small></div>
              </div>
            </div>

            {cohorts.length === 0 ? (
              <p className="dashboard-empty-copy">
                {ar ? "لا توجد بيانات تشغيلية متاحة بعد لهذه المؤسسة." : "Aucune donnée opérationnelle n'est encore disponible pour cette organisation."}
              </p>
            ) : (
              <ul className="learning-list">
                {cohorts.slice(0, 5).map(({ cohort, course }) => (
                  <li key={cohort.id} className="learning-row">
                    <div className="learning-icon"><Icon name="book" size={18} /></div>
                    <div className="learning-main">
                      <strong>{cohort.name}</strong>
                      <small>{ar ? course.titleAr : course.titleFr}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </>
  );
}
