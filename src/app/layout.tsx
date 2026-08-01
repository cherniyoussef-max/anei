import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "ANEI — Académie Nationale de l’Éducation Inclusive",
    template: "%s | ANEI",
  },
  description: "Plateforme bilingue de formation continue dédiée à l’éducation inclusive.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The proxy derives the locale from the URL so the actual document language is
  // correct for assistive technology; a nested div with lang/dir is not enough.
  const requestHeaders = await headers();
  const locale = requestHeaders.get("x-anei-locale") === "ar" ? "ar" : "fr";

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <a className="skip-link" href="#main-content">
          {locale === "ar" ? "الانتقال إلى المحتوى" : "Aller au contenu"}
        </a>
        {children}
      </body>
    </html>
  );
}
