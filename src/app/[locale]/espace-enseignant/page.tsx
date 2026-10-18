import { redirect } from "next/navigation";

export default async function EspaceEnseignantRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/classe-inclusive`);
}
