"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import type { Locale } from "@/types";
import { AneiLogo } from "@/components/brand/AneiLogo";
import { MobileMenu } from "@/components/interactive/MobileMenu";
import { AccountActions, type InitialAccountUser } from "@/components/auth/AccountActions";

export function SiteHeader({ locale, initialUser }: { locale: Locale; initialUser?: InitialAccountUser }) {
  const pathname = usePathname();
  const ar = locale === "ar";
  const isHome = pathname === `/${locale}` || pathname === `/${locale}/`;

  const links = [
    ["", ar ? "الرئيسية" : "Accueil"],
    ["formations", ar ? "التكوين" : "Formations"],
    ["bibliotheque", ar ? "المكتبة" : "Bibliothèque"],
    ["avs", ar ? "دليل AVS" : "AVS"],
    ["specialistes", ar ? "الأخصائيون" : "Spécialistes"],
    ["webinaires", ar ? "الندوات" : "Webinaires"],
    ["actualites", ar ? "الأخبار" : "Actualités"],
    ["contact", ar ? "اتصل بنا" : "Contact"],
  ] as const;

  // Language switch target paths
  const currentSegments = pathname.split("/");
  const arSegments = [...currentSegments];
  arSegments[1] = "ar";
  const arTarget = arSegments.join("/") || "/ar";

  const frSegments = [...currentSegments];
  frSegments[1] = "fr";
  const frTarget = frSegments.join("/") || "/fr";

  return (
    <header className="navbar-root">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 navbar-container">
        {/* Left: Always visible Logo + Navigation links */}
        <div className="flex items-center gap-4 lg:gap-6">
          <Link href={`/${locale}`} className="site-brand-link flex items-center flex-none me-3 hover:opacity-90 transition-opacity" aria-label={ar ? "الرئيسية ANEI" : "Accueil ANEI"}>
            <AneiLogo locale={locale} variant="mark" withText={false} height={38} priority />
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label={ar ? "التنقل الرئيسي" : "Navigation principale"}>
            {links.map(([segment, label]) => {
              const href = segment ? `/${locale}/${segment}` : `/${locale}`;
              const isActive = segment ? pathname === href || pathname.startsWith(`${href}/`) : isHome;
              return (
                <Link
                  key={segment || "home"}
                  href={href}
                  className={`relative flex items-center px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 rounded-lg ${
                    isActive
                      ? "bg-slate-900/[0.06] text-slate-950 font-semibold after:absolute after:bottom-0 after:inset-x-3 after:h-[2px] after:rounded-full after:bg-slate-900"
                      : "text-slate-600 hover:text-slate-950 hover:bg-slate-100/60"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Search, Divider, AR | FR, User account icon */}
        <div className="navbar-actions">
          <Link
            href={`/${locale}/formations`}
            className="navbar-search-btn"
            aria-label={ar ? "البحث عن دورة أو مورد" : "Rechercher une formation ou un sujet"}
          >
            <Search size={18} strokeWidth={1.8} />
          </Link>

          <span className="navbar-divider" aria-hidden="true" />

          <div className="navbar-lang-switch" aria-label={ar ? "تغيير اللغة" : "Changer de langue"}>
            <Link
              href={arTarget}
              className={locale === "ar" ? "is-active" : undefined}
              lang="ar"
            >
              AR
            </Link>
            <span className="text-[#CBD5E1]" aria-hidden="true">|</span>
            <Link
              href={frTarget}
              className={locale === "fr" ? "is-active" : undefined}
              lang="fr"
            >
              FR
            </Link>
          </div>

          <AccountActions locale={locale} initialUser={initialUser} />

          <div className="lg:hidden">
            <MobileMenu locale={locale} />
          </div>
        </div>
      </div>
    </header>
  );
}
