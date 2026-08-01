import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/interactive/LocaleSwitcher";
import { MobileMenu } from "@/components/interactive/MobileMenu";
import { AccountActions } from "@/components/auth/AccountActions";
import { Icon } from "@/components/ui/Icon";

export function SiteHeader({ locale }: { locale: Locale }) {
  const c = t(locale);
  const links = [
    ["formations", c.nav.courses],
    ["webinaires", c.nav.webinars],
    ["bibliotheque", c.nav.library],
    ["avs", c.nav.avs],
    ["actualites", c.nav.news],
  ];
  return <header className="site-header"><div className="container header-inner">
    <Logo locale={locale}/>
    <nav className="desktop-nav" aria-label={locale === "fr" ? "Navigation principale" : "التنقل الرئيسي"}>{links.map(([href,label]) => <Link key={href} href={`/${locale}/${href}`}>{label}</Link>)}</nav>
    <div className="header-actions">
      <Link className="header-search-link" href={`/${locale}/formations`} aria-label={locale === "fr" ? "Rechercher une formation" : "البحث عن دورة"}><Icon name="search" size={19}/></Link>
      <LocaleSwitcher locale={locale}/>
      <AccountActions locale={locale}/>
      <MobileMenu locale={locale}/>
    </div>
  </div></header>;
}
