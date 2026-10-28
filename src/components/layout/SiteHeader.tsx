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
    <header className="navbar-root sticky top-0 z-50 h-[76px] bg-white/95 backdrop-blur-md border-b border-[#dde9f8] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Left: Always visible Logo + Navigation links */}
        <div className="flex items-center gap-4 lg:gap-8">
          <Link
            href={`/${locale}`}
            prefetch={true}
            className="site-brand-link flex items-center gap-3 flex-none hover:opacity-90 transition-opacity"
            aria-label={ar ? "الرئيسية ANEI" : "Accueil ANEI"}
          >
            <Image
              src="/media/home-v5/logo-nav.png"
              alt="ANEI"
              width={160}
              height={46}
              priority
              unoptimized
              className="h-[46px] w-auto object-contain shrink-0"
            />
            <div className="hidden sm:flex flex-col text-start leading-tight">
              <b className="font-semibold text-[13.5px] text-[#0b1f4b] tracking-tight">
                L’Académie Nationale de l’Éducation Inclusive
              </b>
              <span dir="rtl" lang="ar" className="text-[12.5px] font-bold text-[#b8923a]">
                الأكاديمية الوطنية للتربية الدامجة
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-6" aria-label={ar ? "التنقل الرئيسي" : "Navigation principale"}>
            {links.map(([segment, label]) => {
              const href = segment ? `/${locale}/${segment}` : `/${locale}`;
              const isActive = segment ? pathname === href || pathname.startsWith(`${href}/`) : isHome;
              return (
                <Link
                  key={segment || "home"}
                  href={href}
                  prefetch={true}
                  className={`relative py-1 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1f4b] focus-visible:ring-offset-2 rounded ${
                    isActive
                      ? "text-[#0b1f4b] font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] after:bg-[#b8923a]"
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
        <div className="navbar-actions flex items-center gap-3 sm:gap-4">
          <Link
            href={`/${locale}/formations`}
            prefetch={true}
            className="navbar-search-btn p-2 rounded-full text-[#0b1f4b] hover:bg-[#eef4fc] transition-colors"
            aria-label={ar ? "البحث عن دورة أو مورد" : "Rechercher une formation ou un sujet"}
          >
            <Search size={18} strokeWidth={1.8} />
          </Link>

          <span className="navbar-divider w-[1px] h-5 bg-[#dde9f8]" aria-hidden="true" />

          <div className="navbar-lang-switch flex items-center gap-1.5 text-[13px] font-medium text-[#5b6b90]" aria-label={ar ? "تغيير اللغة" : "Changer de langue"}>
            <Link
              href={arTarget}
              prefetch={true}
              className={`px-1.5 py-0.5 rounded transition-colors ${locale === "ar" ? "text-[#0b1f4b] font-bold" : "hover:text-[#0b1f4b]"}`}
              lang="ar"
            >
              AR
            </Link>
            <span className="text-[#CBD5E1]" aria-hidden="true">|</span>
            <Link
              href={frTarget}
              prefetch={true}
              className={`px-1.5 py-0.5 rounded transition-colors ${locale === "fr" ? "text-[#0b1f4b] font-bold" : "hover:text-[#0b1f4b]"}`}
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
