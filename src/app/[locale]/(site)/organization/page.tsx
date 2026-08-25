import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserOrganizationMemberships } from "@/server/queries/organizations";

export default async function OrganizationPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "ORGANIZATION");
  const memberships = await getUserOrganizationMemberships(session.user.id);
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة المؤسسة" : "Espace organisation"}</span>
      <h1>{ar ? "مرحبًا بك في مساحتك" : "Bienvenue dans votre espace"}</h1>
      {memberships.length === 0 ? (
        <p>{ar
          ? "لست عضوًا في أي مؤسسة حاليًا."
          : "Vous n’êtes membre d’aucune organisation pour le moment."}</p>
      ) : (
        <ul>
          {memberships.map(({ membership, organization }) => (
            <li key={membership.id}>{organization.name} — {membership.role}</li>
          ))}
        </ul>
      )}
    </div>
  </div>;
}
