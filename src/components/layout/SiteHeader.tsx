import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/interactive/LocaleSwitcher";
import { MobileMenu } from "@/components/interactive/MobileMenu";
import { PublicNav } from "@/components/interactive/PublicNav";
import { AccountActions } from "@/components/auth/AccountActions";
import { Icon } from "@/components/ui/Icon";

export function SiteHeader({ locale }: { locale: Locale }) {
  const c = t(locale);
  const links = [
    ["", c.nav.home],
    ["about", c.nav.about],
    ["formations", c.nav.courses],
    ["webinaires", c.nav.webinars],
    ["bibliotheque", c.nav.library],
    ["avs", c.nav.avs],
    ["actualites", c.nav.news],
    ["contact", c.nav.contact],
  ] as const;
  const navigationLabel = locale === "ar" ? "التنقل الرئيسي" : locale === "fr" ? "Navigation principale" : "Primary navigation";
  const searchLabel = locale === "ar" ? "البحث عن دورة" : locale === "fr" ? "Rechercher une formation" : "Search courses";

  return (
    <>
      <div className="crest-bar">
        <div className="crest-bar-inner">
          <svg className="crest-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <rect x="6" y="8" width="52" height="6" rx="1" fill="currentColor" stroke="none" />
            <rect x="10" y="14" width="44" height="3" fill="currentColor" stroke="none" />
            <line x1="16" y1="17" x2="16" y2="48" strokeWidth="4" strokeLinecap="round" />
            <line x1="27" y1="17" x2="27" y2="48" strokeWidth="4" strokeLinecap="round" />
            <line x1="37" y1="17" x2="37" y2="48" strokeWidth="4" strokeLinecap="round" />
            <line x1="48" y1="17" x2="48" y2="48" strokeWidth="4" strokeLinecap="round" />
            <rect x="8" y="48" width="48" height="4" fill="currentColor" stroke="none" />
            <rect x="4" y="52" width="56" height="6" rx="1" fill="currentColor" stroke="none" />
          </svg>

          <Link href={`/${locale}`} className="crest-brand" aria-label={c.academy}>
            <svg className="crest-shield" viewBox="0 0 100 120" fill="none" aria-hidden="true">
              <path d="M50 6 L88 22 V65 C88 93 50 114 50 114 C50 114 12 93 12 65 V22 Z" fill="#082D55" />
              <path d="M23 26 L32 24 V88 C29 84 25 80 23 76 Z" fill="#C9913F" />
              <path d="M47 16 L80 28 V63 C80 87 50 104 47 105 Z" fill="#FFFFFF" />
              <path d="M62 46 C60 50 56 52 58 57 C59 60 63 61 63 64 C63 67 59 70 59 70 L67 70 C67 70 63 65 65 61 C67 57 65 50 62 46 Z" fill="#C9913F" />
              <path d="M59 72 H67 L65 85 H61 Z" fill="#C9913F" />
            </svg>
            <span className="crest-brand-text">
              <span className="crest-brand-name-row">
                <span className="crest-brand-name">Academy</span>
                <span className="crest-brand-tm">TM</span>
              </span>
              <span className="crest-brand-sub">Learning</span>
            </span>
          </Link>

          <Image className="crest-seal" src="/media/academy-home-seal.webp" alt="ANEI" width={300} height={301} unoptimized priority />
        </div>
      </div>

      <header className="site-header v5-site-header crest-nav">
        <div className="v5-container header-inner">
          <PublicNav locale={locale} label={navigationLabel} links={links} />
          <div className="header-actions">
            <Link className="header-search-link" href={`/${locale}/formations`} aria-label={searchLabel}><Icon name="search" size={19} /></Link>
            <LocaleSwitcher locale={locale} />
            <AccountActions locale={locale} />
            <MobileMenu locale={locale} />
          </div>
        </div>
      </header>
    </>
  );
}
