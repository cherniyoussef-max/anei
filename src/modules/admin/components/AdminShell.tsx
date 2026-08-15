"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Locale } from "@/types";

type NavItem = { href: string; icon: IconName; fr: string; ar: string };
type NavGroup = { fr: string; ar: string; items: NavItem[] };

export function AdminShell({ children, locale, user }: {
  children: React.ReactNode; locale: Locale; user: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const ar = locale === "ar";
  const base = `/${locale}/admin`;
  const groups: NavGroup[] = [
    { fr: "Pilotage", ar: "القيادة", items: [
      { href: base, icon: "chart", fr: "Vue d’ensemble", ar: "نظرة عامة" },
      { href: `${base}/users`, icon: "users", fr: "Utilisateurs", ar: "المستخدمون" },
      { href: `${base}/learning`, icon: "graduation", fr: "Apprentissage", ar: "التعلّم" },
      { href: `${base}/courses`, icon: "book", fr: "Formations", ar: "الدورات" },
      { href: `${base}/enrollments`, icon: "check", fr: "Inscriptions", ar: "التسجيلات" },
      { href: `${base}/certificates`, icon: "award", fr: "Certificats", ar: "الشهادات" },
      { href: `${base}/webinars`, icon: "calendar", fr: "Webinaires", ar: "الندوات" },
      { href: `${base}/resources`, icon: "download", fr: "Bibliothèque", ar: "المكتبة" },
      { href: `${base}/news`, icon: "spark", fr: "Actualités", ar: "الأخبار" },
      { href: `${base}/organizations`, icon: "map", fr: "Organisations", ar: "المؤسسات" },
      { href: `${base}/relationships`, icon: "users", fr: "Relations", ar: "العلاقات" },
      { href: `${base}/crm`, icon: "spark", fr: "CRM", ar: "إدارة العملاء" },
    ]},
    { fr: "Commerce", ar: "التجارة", items: [
      { href: `${base}/orders`, icon: "book", fr: "Commandes", ar: "الطلبات" },
      { href: `${base}/payments`, icon: "shield", fr: "Paiements", ar: "المدفوعات" },
    ]},
    { fr: "Opérations", ar: "العمليات", items: [
      { href: `${base}/contacts`, icon: "mail", fr: "Contacts", ar: "الرسائل" },
      { href: `${base}/audit`, icon: "shield", fr: "Journal d’audit", ar: "سجل التدقيق" },
      { href: `${base}/system`, icon: "spark", fr: "Système", ar: "النظام" },
    ]},
  ];
  const nav = <nav className="admin-app-nav" aria-label={ar ? "التنقل الإداري" : "Navigation d’administration"}>
    {groups.map((group) => <div className="admin-nav-group" key={group.fr}>
      <span className="admin-nav-label">{ar ? group.ar : group.fr}</span>
      {group.items.map((item) => {
        const active = item.href === base ? pathname === base : pathname.startsWith(item.href);
        const label = ar ? item.ar : item.fr;
        return <Link href={item.href} key={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}
          title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)}>
          <Icon name={item.icon} size={19}/><span>{label}</span>
        </Link>;
      })}
    </div>)}
  </nav>;
  return <div className={`admin-app ${collapsed ? "is-collapsed" : ""}`}>
    <aside className="admin-app-sidebar">
      <div className="admin-app-brand"><span className="admin-brand-mark">A</span><div><strong>ANEI</strong><small>Admin Console</small></div></div>
      {nav}
      <div className="admin-app-profile"><span>{user.name.slice(0, 2).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.role}</small></div></div>
    </aside>
    {mobileOpen ? <button className="admin-drawer-backdrop" aria-label={ar ? "إغلاق القائمة" : "Fermer le menu"} onClick={() => setMobileOpen(false)}/> : null}
    <aside className={`admin-mobile-drawer ${mobileOpen ? "open" : ""}`} aria-hidden={!mobileOpen}>
      <div className="admin-app-brand"><span className="admin-brand-mark">A</span><div><strong>ANEI</strong><small>Admin Console</small></div>
        <button className="admin-icon-button" onClick={() => setMobileOpen(false)} aria-label={ar ? "إغلاق" : "Fermer"}><Icon name="close"/></button>
      </div>{nav}
    </aside>
    <div className="admin-app-body">
      <header className="admin-app-topbar">
        <button className="admin-icon-button desktop-collapse" onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? (ar ? "توسيع القائمة" : "Développer le menu") : (ar ? "طي القائمة" : "Réduire le menu")}>
          <Icon name="menu"/>
        </button>
        <button className="admin-icon-button mobile-menu-trigger" onClick={() => setMobileOpen(true)}
          aria-label={ar ? "فتح القائمة" : "Ouvrir le menu"}><Icon name="menu"/></button>
        <div className="admin-topbar-title"><strong>{ar ? "وحدة تحكم الإدارة" : "Console d’administration"}</strong><small>{user.email}</small></div>
        <Link className="admin-locale-link" href={`/${ar ? "fr" : "ar"}${pathname.replace(/^\/(fr|ar)/, "")}`} hrefLang={ar ? "fr" : "ar"}>{ar ? "FR" : "العربية"}</Link>
        <Link className="admin-exit-link" href={`/${locale}/dashboard`}>{ar ? "مساحة المتعلم" : "Espace apprenant"}</Link>
      </header>
      <div className="admin-app-content">{children}</div>
    </div>
  </div>;
}
