import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import { Logo } from "@/components/ui/Logo";
import { StudentSignOutButton } from "@/components/student/StudentSignOutButton";

type NavItem = { href: string; icon: IconName; fr: string; ar: string };

// Minimal shared shell for the Phase 1 professional portal foundations
// (separate route/layout per persona, not one dashboard with hidden links).
// Deeper per-persona features (rosters, relationships, cohorts) land in
// later phases per docs/premium/ROADMAP.md.
export function PersonaPortalShell({ locale, user, items, profileHref, children }: {
  locale: Locale;
  user: { name: string; email: string };
  items: NavItem[];
  profileHref: string;
  children: React.ReactNode;
}) {
  const ar = locale === "ar";
  return <section className="dashboard-section persona-portal"><div className="container dashboard-layout">
    <aside className="dashboard-sidebar">
      <div className="persona-portal-brand"><Logo locale={locale} compact priority/><span>{ar ? "المساحة المهنية" : "Espace professionnel"}</span></div>
      <div className="dashboard-profile"><div className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
      <nav aria-label={ar ? "التنقل" : "Navigation"}>
        {items.map((item) => <Link key={item.href} href={item.href}><Icon name={item.icon} size={18}/>{ar ? item.ar : item.fr}</Link>)}
      </nav>
      <div className="dashboard-sidebar-actions">
        <Link className="btn btn-ghost btn-block" href={profileHref}>{ar ? "الملف والأمان" : "Profil & sécurité"}</Link>
        <Link className="persona-public-link" href={`/${locale}`}><Icon name="globe" size={17}/>{ar ? "موقع ANEI" : "Site ANEI"}</Link>
        <StudentSignOutButton locale={locale}/>
      </div>
    </aside>
    <div className="dashboard-main">{children}</div>
  </div></section>;
}
