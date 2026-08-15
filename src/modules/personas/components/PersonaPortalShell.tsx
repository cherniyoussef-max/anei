import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Locale } from "@/types";

type NavItem = { href: string; icon: IconName; fr: string; ar: string };

// Minimal shared shell for the Phase 1 professional portal foundations
// (separate route/layout per persona, not one dashboard with hidden links).
// Deeper per-persona features (rosters, relationships, cohorts) land in
// later phases per docs/premium/ROADMAP.md.
export function PersonaPortalShell({ locale, user, items, children }: {
  locale: Locale;
  user: { name: string; email: string };
  items: NavItem[];
  children: React.ReactNode;
}) {
  const ar = locale === "ar";
  return <section className="dashboard-section"><div className="container dashboard-layout">
    <aside className="dashboard-sidebar">
      <div className="dashboard-profile"><div className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
      <nav aria-label={ar ? "التنقل" : "Navigation"}>
        {items.map((item) => <Link key={item.href} href={item.href}><Icon name={item.icon} size={18}/>{ar ? item.ar : item.fr}</Link>)}
      </nav>
      <div className="dashboard-sidebar-actions">
        <Link className="btn btn-ghost btn-block" href={`/${locale}/dashboard/profil`}>{ar ? "الملف والأمان" : "Profil & sécurité"}</Link>
      </div>
    </aside>
    <div className="dashboard-main">{children}</div>
  </div></section>;
}
