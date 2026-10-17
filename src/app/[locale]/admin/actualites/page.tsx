import { redirect } from "next/navigation";

export default async function AdminActualitesRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/admin/news`);
}
