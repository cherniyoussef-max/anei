import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isLocale } from "@/lib/i18n";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import "./public-theme.css";
import "./public-reference.css";
import "./public-home.css";

export default async function SiteLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const pathname = (await headers()).get("x-anei-pathname") ?? "";
  const portalPrefixes = [`/${locale}/teacher`, `/${locale}/parent`, `/${locale}/specialist`, `/${locale}/organization`, `/${locale}/avs/espace`];
  const isProfessionalPortal = portalPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProfessionalPortal) {
    return <main className="persona-experience" id="main-content" tabIndex={-1}>{children}</main>;
  }

  return (
    <div className="public-experience">
      <SiteHeader locale={locale} />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <SiteFooter locale={locale} />
    </div>
  );
}
