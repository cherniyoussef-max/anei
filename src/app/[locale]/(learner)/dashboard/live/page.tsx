import { redirect } from "next/navigation";

export default async function DashboardLiveRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/learning/live`);
}
