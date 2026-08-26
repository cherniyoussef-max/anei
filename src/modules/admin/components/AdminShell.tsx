"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Pilotage: true, Apprentissage: true, Gestion: true, Commerce: true, "Opérations": true,
  });
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ar = locale === "ar";
  const base = `/${locale}/admin`;
  const groups: NavGroup[] = [
    { fr: "Pilotage", ar: "القيادة", items: [
      { href: base, icon: "chart", fr: "Vue d’ensemble", ar: "نظرة عامة" },
      { href: `${base}/users`, icon: "users", fr: "Utilisateurs", ar: "المستخدمون" },
      { href: `${base}/crm`, icon: "users", fr: "CRM", ar: "إدارة العملاء" },
    ]},
    { fr: "Apprentissage", ar: "التعلّم", items: [
      { href: `${base}/courses`, icon: "book", fr: "Formations", ar: "الدورات" },
      { href: `${base}/courses/editor`, icon: "spark", fr: "Éditeur de cours", ar: "محرر الدورات" },
      { href: `${base}/enrollments`, icon: "check", fr: "Inscriptions", ar: "التسجيلات" },
      { href: `${base}/assessments`, icon: "chart", fr: "Évaluations & résultats", ar: "التقييمات والنتائج" },
      { href: `${base}/certificates`, icon: "award", fr: "Certificats", ar: "الشهادات" },
      { href: `${base}/webinars`, icon: "calendar", fr: "Webinaires", ar: "الندوات" },
      { href: `${base}/resources`, icon: "download", fr: "Bibliothèque", ar: "المكتبة" },
      { href: `${base}/rewards`, icon: "award", fr: "Boutique de récompenses", ar: "متجر المكافآت" },
    ]},
    { fr: "Gestion", ar: "الإدارة", items: [
      { href: `${base}/organizations`, icon: "map", fr: "Organisations", ar: "المؤسسات" },
    ]},
    { fr: "Commerce", ar: "التجارة", items: [
      { href: `${base}/orders`, icon: "book", fr: "Commandes", ar: "الطلبات" },
      { href: `${base}/payments`, icon: "shield", fr: "Paiements", ar: "المدفوعات" },
    ]},
    { fr: "Opérations", ar: "العمليات", items: [
      { href: `${base}/audit`, icon: "shield", fr: "Journal d’audit", ar: "سجل التدقيق" },
      { href: `${base}/system`, icon: "spark", fr: "Système", ar: "النظام" },
    ]},
  ];
  const activeHref = groups.flatMap((group) => group.items).filter((item) => item.href === base ? pathname === base : pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const activeGroup = groups.find((group) => group.items.some((item) => item.href === activeHref));
  const activeItem = activeGroup?.items.find((item) => item.href === activeHref);
  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = triggerRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", close); trigger?.focus(); };
  }, [mobileOpen]);
  function toggleCollapsed() {
    setCollapsed((current) => !current);
  }
  const nav = <nav className="admin-app-nav" aria-label={ar ? "التنقل الإداري" : "Navigation d’administration"}>
    {groups.map((group) => <div className="admin-nav-group" key={group.fr}>
      <button type="button" className="admin-nav-group-trigger" aria-expanded={openGroups[group.fr] !== false}
        onClick={() => setOpenGroups((current) => ({ ...current, [group.fr]: current[group.fr] === false }))}>
        <span>{ar ? group.ar : group.fr}</span><Icon name="chevron" size={14}/>
      </button>
      <div className="admin-nav-group-items" hidden={!collapsed && openGroups[group.fr] === false}>{group.items.map((item) => {
        const active = item.href === activeHref;
        const label = ar ? item.ar : item.fr;
        return <Link href={item.href} key={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}
          title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)}>
          <Icon name={item.icon} size={19}/><span>{label}</span>
        </Link>;
      })}</div>
    </div>)}
  </nav>;
  return <div className={`admin-app ${collapsed ? "is-collapsed" : ""}`}>
    <aside className="admin-app-sidebar">
      <div className="admin-app-brand"><span className="admin-brand-mark"><Image src="/media/anei-brand-logo.webp" width={347} height={347} alt="" priority/></span><div><strong>ANEI</strong><small>{ar ? "وحدة تحكم الإدارة" : "Console d’administration"}</small></div></div>
      {nav}
      <div className="admin-app-profile"><span>{user.name.slice(0, 2).toUpperCase()}</span><div><strong>{user.name}</strong><small className="admin-role-badge">{user.role}</small></div></div>
    </aside>
    {mobileOpen ? <button className="admin-drawer-backdrop" aria-label={ar ? "إغلاق القائمة" : "Fermer le menu"} onClick={() => setMobileOpen(false)}/> : null}
    <aside className={`admin-mobile-drawer ${mobileOpen ? "open" : ""}`} aria-hidden={!mobileOpen} role="dialog" aria-modal="true" aria-label={ar ? "قائمة الإدارة" : "Menu d’administration"}>
      <div className="admin-app-brand"><span className="admin-brand-mark"><Image src="/media/anei-brand-logo.webp" width={347} height={347} alt=""/></span><div><strong>ANEI</strong><small>{ar ? "وحدة تحكم الإدارة" : "Console d’administration"}</small></div>
        <button ref={closeRef} className="admin-icon-button" onClick={() => setMobileOpen(false)} aria-label={ar ? "إغلاق" : "Fermer"}><Icon name="close"/></button>
      </div>{nav}
    </aside>
    <div className="admin-app-body">
      <header className="admin-app-topbar">
        <button className="admin-icon-button desktop-collapse" onClick={toggleCollapsed}
          aria-label={collapsed ? (ar ? "توسيع القائمة" : "Développer le menu") : (ar ? "طي القائمة" : "Réduire le menu")}>
          <Icon name="menu"/>
        </button>
        <button ref={triggerRef} className="admin-icon-button mobile-menu-trigger" onClick={() => setMobileOpen(true)}
          aria-label={ar ? "فتح القائمة" : "Ouvrir le menu"}><Icon name="menu"/></button>
        <div className="admin-topbar-context">
          <nav className="admin-breadcrumbs" aria-label={ar ? "مسار التنقل" : "Fil d’Ariane"}>
            <Link href={base}>{ar ? "الإدارة" : "Administration"}</Link>
            {activeGroup ? <><Icon className="admin-directional-icon" name="chevron" size={12}/><span>{ar ? activeGroup.ar : activeGroup.fr}</span></> : null}
          </nav>
          <strong>{activeItem ? (ar ? activeItem.ar : activeItem.fr) : (ar ? "وحدة تحكم الإدارة" : "Console d’administration")}</strong>
        </div>
        <Link className="admin-locale-link" href={`/${ar ? "fr" : "ar"}${pathname.replace(/^\/(fr|ar)/, "")}`} hrefLang={ar ? "fr" : "ar"}>{ar ? "FR" : "العربية"}</Link>
      </header>
      <main className="admin-app-content" id="main-content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
