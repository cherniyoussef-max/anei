import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getLinkedStudentsForParent } from "@/server/queries/relationships";
import {
  getParentCareRequests,
  searchActiveSpecialists,
} from "@/server/queries/care-relationships";
import { ParentSpecialistDirectory } from "@/components/care/ParentSpecialistDirectory";

export const dynamic = "force-dynamic";

export default async function ParentSpecialistesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requireActivePersona(locale, "PARENT");

  const [linkedData, specialistsData, requestsData] = await Promise.all([
    getLinkedStudentsForParent(session.user.id),
    searchActiveSpecialists({ limit: 50 }),
    getParentCareRequests(session.user.id),
  ]);

  const linkedChildren = linkedData.map((row) => ({
    id: row.student.id,
    name: row.student.name ?? "Enfant",
  }));

  return (
    <ParentSpecialistDirectory
      locale={locale}
      initialSpecialists={specialistsData.specialists}
      linkedChildren={linkedChildren}
      existingRequests={requestsData}
    />
  );
}
