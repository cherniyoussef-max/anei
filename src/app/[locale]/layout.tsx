import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ar" }, { locale: "fr" }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "ar" ? "الأكاديمية الوطنية للتربية الدامجة" : locale === "en" ? "National Academy for Inclusive Education" : "Académie Nationale de l’Éducation Inclusive";
  const description = locale === "ar" ? "تكوين عملي وموارد متخصصة ومرافقة مهنية من أجل تربية دامجة." : locale === "en" ? "Practical training, specialist resources and professional support for inclusive education." : "Plateforme de formation continue spécialisée dans l’éducation inclusive.";
  return {
    title,
    description,
  };
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="app-shell" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      {children}
    </div>
  );
}
