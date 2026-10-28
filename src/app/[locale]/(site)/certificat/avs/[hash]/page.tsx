import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function DedicatedAvsCertificateRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; hash: string }>;
}) {
  const { locale, hash } = await params;
  const currentLocale = isLocale(locale) ? locale : "fr";
  redirect(`/${currentLocale}/certificats/${hash}`);
}
