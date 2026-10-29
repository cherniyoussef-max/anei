"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import type { Locale } from "@/types";
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
    ["avs", ar ? "المرافق المدرسي (AVS)" : "Accompagnement (AVS)"],
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
    <header className="navbar-root sticky top-0 z-50 h-[76px] bg-white/95 backdrop-blur-md border-b border-[#dde9f8] transition-all">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Always visible Logo + Navigation links */}
        <div className="flex items-center gap-3.5 xl:gap-5 min-w-0">
          <Link
            href={`/${locale}`}
            prefetch={true}
            className="site-brand-link flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity"
            aria-label={ar ? "الرئيسية ANEI" : "Accueil ANEI"}
          >
            <Image
              src="/media/home-v5/logo-nav.png"
              alt="ANEI"
              width={160}
              height={46}
              priority
              unoptimized
              className="h-[40px] sm:h-[44px] w-auto object-contain shrink-0"
            />
            <div className="hidden min-[1680px]:flex flex-col text-start leading-tight shrink-0">
              <b className="font-semibold text-[13px] text-[#0b1f4b] tracking-tight">
                L’Académie Nationale de l’Éducation Inclusive
              </b>
              <span dir="rtl" lang="ar" className="text-[12px] font-bold text-[#b8923a]">
                الأكاديمية الوطنية للتربية الدامجة
              </span>
            </div>
          </Link>

          <nav
            className="hidden xl:flex items-center gap-2 lg:gap-2.5 2xl:gap-3.5 min-w-0"
            aria-label={ar ? "التنقل الرئيسي" : "Navigation principale"}
          >
            {links.map(([segment, label]) => {
              const href = segment ? `/${locale}/${segment}` : `/${locale}`;
              const isActive = segment ? pathname === href || pathname.startsWith(`${href}/`) : isHome;
              return (
                <Link
                  key={segment || "home"}
                  href={href}
                  prefetch={true}
                  className={`relative py-1 text-[13px] 2xl:text-[13.5px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1f4b] focus-visible:ring-offset-2 rounded ${
                    isActive
                      ? "text-[#0b1f4b] font-bold after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] after:bg-[#b8923a]"
                      : "text-[#46557a] hover:text-[#0b1f4b] hover:after:absolute hover:after:bottom-0 hover:after:inset-x-0 hover:after:h-[2px] hover:after:bg-[#b8923a]"
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
        <div className="navbar-actions flex items-center gap-2.5 sm:gap-3.5 shrink-0 z-10">
          <Link
            href={`/${locale}/formations`}
            prefetch={true}
            className="navbar-search-btn p-2 rounded-full text-[#0b1f4b] hover:bg-[#eef4fc] transition-colors shrink-0"
            aria-label={ar ? "البحث عن دورة أو مورد" : "Rechercher une formation ou un sujet"}
          >
            <Search size={18} strokeWidth={1.8} />
          </Link>

          <span className="navbar-divider w-[1px] h-5 bg-[#dde9f8] shrink-0 hidden sm:block" aria-hidden="true" />

          {/* AR | FR Language Switcher Pill */}
          <div
            className="navbar-lang-switch flex items-center p-0.5 rounded-full bg-[#f1f5f9] border border-[#dde9f8] text-[12.5px] font-semibold text-[#5b6b90] shrink-0"
            aria-label={ar ? "تغيير اللغة" : "Changer de langue"}
            dir="ltr"
          >
            <Link
              href={arTarget}
              prefetch={true}
              className={`px-2 py-0.5 rounded-full transition-all ${
                locale === "ar"
                  ? "bg-[#0b1f4b] text-white shadow-xs font-bold"
                  : "text-[#5b6b90] hover:text-[#0b1f4b]"
              }`}
              lang="ar"
              aria-current={locale === "ar" ? "true" : undefined}
            >
              AR
            </Link>
            <span className="text-[#cbd5e1] text-[11px]" aria-hidden="true">|</span>
            <Link
              href={frTarget}
              prefetch={true}
              className={`px-2 py-0.5 rounded-full transition-all ${
                locale === "fr"
                  ? "bg-[#0b1f4b] text-white shadow-xs font-bold"
                  : "text-[#5b6b90] hover:text-[#0b1f4b]"
              }`}
              lang="fr"
              aria-current={locale === "fr" ? "true" : undefined}
            >
              FR
            </Link>
          </div>

          <AccountActions locale={locale} initialUser={initialUser} />

          <div className="xl:hidden shrink-0">
            <MobileMenu locale={locale} />
          </div>
        </div>
      </div>
    </header>
  );
}
