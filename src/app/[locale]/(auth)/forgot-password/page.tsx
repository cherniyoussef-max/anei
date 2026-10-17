import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordWizard } from "@/components/auth/ForgotPasswordWizard";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <AuthShell locale={locale} mode="recovery">
      <ForgotPasswordWizard locale={locale} />
    </AuthShell>
  );
}
