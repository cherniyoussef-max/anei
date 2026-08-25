import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ["500", "600", "700"], display: "swap" });

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
  const requestedLocale = requestHeaders.get("x-anei-locale");
  const locale = requestedLocale === "ar" ? "ar" : requestedLocale === "en" ? "en" : "fr";
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const directionContract = `THESIS: ANEI is an institutional field guide turning inclusive education into daily practice; it refuses generic SaaS card-stack brochure layouts.
OWN-WORLD: Deep navy, gold, warm ivory, restrained cool surfaces, border-led depth, 8–12px radii, unified professional Latin/Arabic typography, and authentic documentary photography.
STORY: Visitors understand ANEI, choose their role, discover learning, see the method and human support, browse resources and news, then act.
FIRST VIEWPORT: A concise editorial split pairs mission copy and two actions with one real photograph; a three-part proof strip enters the lower viewport. The primary action is course discovery.
FORM: Established ANEI world, preservation-led editorial overhaul, assigned Grounded Concept 5, seed b30d51c8.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md`;
  const installDirectionContract = `document.currentScript?.parentNode?.insertBefore(document.createComment(${JSON.stringify(directionContract)}),document.currentScript);`;

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={fraunces.variable} data-scroll-behavior="smooth">
      <body>
        {/* Browsers intentionally hide nonce values from DOM attribute reads; suppress
            the resulting React hydration comparison while keeping CSP enforcement. */}
        <script suppressHydrationWarning nonce={nonce} dangerouslySetInnerHTML={{ __html: installDirectionContract }} />
        <a className="skip-link" href="#main-content">
          {locale === "ar" ? "الانتقال إلى المحتوى" : locale === "en" ? "Skip to content" : "Aller au contenu"}
        </a>
        {children}
      </body>
    </html>
  );
}
