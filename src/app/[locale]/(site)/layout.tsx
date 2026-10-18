import { notFound } from "next/navigation";
import { headers, cookies } from "next/headers";
import { isLocale } from "@/lib/i18n";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { auth } from "@/server/auth";
import { getUserPersonas } from "@/server/queries/personas";
import { resolveUserHomePath } from "@/lib/security/safe-redirect";
import type { InitialAccountUser } from "@/components/auth/AccountActions";
import { PublicAssistantDrawer } from "@/components/ai/PublicAssistantDrawer";
import { GlobalWebinarBanner } from "@/components/student/GlobalWebinarBanner";
import { getPushedLiveWebinars } from "@/server/queries/live";
import type { Locale } from "@/types";
import "./public-theme.css";
import "./public-reference.css";
import "./public-home.css";
import "./academy-home.css";
import "./about/about-page.css";

export default async function SiteLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const reqHeaders = await headers();
  const pathname = reqHeaders.get("x-anei-pathname") ?? "";
  const portalPrefixes = [`/${locale}/teacher`, `/${locale}/parent`, `/${locale}/specialist`, `/${locale}/organization`, `/${locale}/avs/espace`];
  const isProfessionalPortal = portalPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProfessionalPortal) {
    return <main className="persona-experience" id="main-content" tabIndex={-1}>{children}</main>;
  }

  let initialUser: InitialAccountUser = null;
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.getAll().some((c) => c.name.includes("session_token"));

  if (hasAuthCookie) {
    try {
      const session = await auth.api.getSession({ headers: reqHeaders });
      if (session?.user) {
        const memberships = await getUserPersonas(session.user.id);
        const primary = memberships.find((m) => m.isPrimary);
        const primaryPersona = primary?.persona ?? null;
        const profileType = (session.user as { profileType?: string }).profileType;
        const portalHref = resolveUserHomePath(locale, {
          role: session.user.role,
          primaryPersona,
          profileType,
        });

        initialUser = {
          name: session.user.name,
          email: session.user.email,
          role: String(session.user.role),
          primaryPersona,
          profileType,
          portalHref,
        };
      }
    } catch {
      // Graceful fallback to client session check if session resolution is unavailable
    }
  }

  const isAssistantPage = pathname.includes("/assistant");
  let pushedWebinars: Awaited<ReturnType<typeof getPushedLiveWebinars>> = [];
  try {
    pushedWebinars = await getPushedLiveWebinars();
  } catch {
    // Graceful fallback if database read fails
  }

  return (
    <div className="public-experience">
      <GlobalWebinarBanner locale={locale as Locale} initialSessions={pushedWebinars} />
      <SiteHeader locale={locale} initialUser={initialUser} />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <SiteFooter locale={locale} />
      {!isAssistantPage && <PublicAssistantDrawer locale={locale as "fr" | "ar"} />}
    </div>
  );
}
