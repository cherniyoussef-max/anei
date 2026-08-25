import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import "./public-theme.css";
import "./public-reference.css";
import "./public-home.css";

export default async function SiteLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="public-experience">
      <SiteHeader locale={locale} />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <SiteFooter locale={locale} />
    </div>
  );
}
