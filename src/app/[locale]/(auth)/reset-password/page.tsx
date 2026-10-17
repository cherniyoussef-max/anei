import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordWizard } from "@/components/auth/ResetPasswordWizard";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <AuthShell locale={locale} mode="recovery">
      <Suspense
        fallback={
          <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-10 shadow-xs text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#0056D2] mx-auto mb-4" />
            <p className="text-slate-500 text-sm font-medium">
              {locale === "ar" ? "جارٍ التحميل..." : "Chargement..."}
            </p>
          </div>
        }
      >
        <ResetPasswordWizard locale={locale} />
      </Suspense>
    </AuthShell>
  );
}
