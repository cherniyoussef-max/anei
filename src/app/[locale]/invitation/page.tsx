import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { InvitationFlow } from "@/components/interactive/InvitationFlow";

export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) notFound();
  return <InvitationFlow token={token} locale={locale} />;
}