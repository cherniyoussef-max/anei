import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getSpecialistCareRequests } from "@/server/queries/care-relationships";
import { SpecialistRequestsManager } from "@/components/care/SpecialistRequestsManager";

export const dynamic = "force-dynamic";

export default async function SpecialistDemandesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requireActivePersona(locale, "SPECIALIST");
  const requests = await getSpecialistCareRequests(session.user.id);

  return (
    <SpecialistRequestsManager
      locale={locale}
      initialRequests={requests}
    />
  );
}
