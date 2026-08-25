import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { Logo } from "@/components/ui/Logo";
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
  return <header className="site-header v5-site-header"><div className="v5-container header-inner">
    <Logo locale={locale} priority/>
    <PublicNav locale={locale} label={navigationLabel} links={links}/>
    <div className="header-actions">
      <Link className="header-search-link" href={`/${locale}/formations`} aria-label={searchLabel}><Icon name="search" size={19}/></Link>
      <LocaleSwitcher locale={locale}/>
      <AccountActions locale={locale}/>
      <MobileMenu locale={locale}/>
    </div>
  </div></header>;
}
