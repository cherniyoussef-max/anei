import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { headers } from "next/headers";

export function generateStaticParams() {
  return [{ locale: "fr" }, { locale: "ar" }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "ar" ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l’Éducation Inclusive",
    description: locale === "ar" ? "منصة تكوين مستمر متخصصة في التربية الدامجة." : "Plateforme de formation continue spécialisée dans l’éducation inclusive."
  };
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const isAdmin = (await headers()).get("x-anei-admin") === "1";

  return (
    <div className="app-shell" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      {!isAdmin ? <SiteHeader locale={locale} /> : null}
      <main id="main-content" tabIndex={-1}>{children}</main>
      {!isAdmin ? <SiteFooter locale={locale} /> : null}
    </div>
  );
}
