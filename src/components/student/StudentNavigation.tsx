"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/types";
import { Icon, type IconName } from "@/components/ui/Icon";
import { StudentSignOutButton } from "@/components/student/StudentSignOutButton";

type StudentNavItem = { href: string; icon: IconName; en: string; fr: string; ar: string; shortEn: string; shortFr: string; shortAr: string };

function learnerItems(locale: Locale): StudentNavItem[] {
  const base = `/${locale}/dashboard`;
  return [
    { href: base, icon: "play", en: "Continue", fr: "Continuer", ar: "متابعة التعلم", shortEn: "Continue", shortFr: "Continuer", shortAr: "متابعة" },
    { href: `${base}/formations`, icon: "graduation", en: "My courses", fr: "Mes formations", ar: "دوراتي", shortEn: "Courses", shortFr: "Formations", shortAr: "دوراتي" },
    { href: `${base}/rendez-vous`, icon: "calendar", en: "My appointments", fr: "Mes rendez-vous", ar: "مواعيدي", shortEn: "Appointments", shortFr: "Rendez-vous", shortAr: "مواعيدي" },
    { href: `${base}/ressources`, icon: "book", en: "My resources", fr: "Mes ressources", ar: "مواردي", shortEn: "Resources", shortFr: "Ressources", shortAr: "مواردي" },
    { href: `${base}/certificats`, icon: "award", en: "My certificates", fr: "Mes certificats", ar: "شهاداتي", shortEn: "Certificates", shortFr: "Certificats", shortAr: "شهاداتي" },
    { href: `${base}/classement`, icon: "chart", en: "Leaderboard", fr: "Classement", ar: "الترتيب", shortEn: "Leaderboard", shortFr: "Classement", shortAr: "الترتيب" },
    { href: `${base}/boutique`, icon: "gift", en: "Shop", fr: "Boutique", ar: "المتجر", shortEn: "Shop", shortFr: "Boutique", shortAr: "المتجر" },
    { href: `${base}/porte-monnaie`, icon: "wallet", en: "Wallet", fr: "Porte-monnaie", ar: "المحفظة", shortEn: "Wallet", shortFr: "Porte-monnaie", shortAr: "المحفظة" },
    { href: `${base}/parrainage`, icon: "users", en: "Referral", fr: "Parrainage", ar: "الإحالة", shortEn: "Referral", shortFr: "Parrainage", shortAr: "الإحالة" },
    { href: `${base}/profil`, icon: "user", en: "Profile", fr: "Profil", ar: "الملف الشخصي", shortEn: "Profile", shortFr: "Profil", shortAr: "الملف" },
  ];
}

function isCurrent(pathname: string, href: string, base: string) {
  return href === base ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
}

export function StudentNavigation({ locale, variant }: { locale: Locale; variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  const ar = locale === "ar";
  const en = locale === "en";
  const base = `/${locale}/dashboard`;
  const items = learnerItems(locale);

  if (variant === "mobile") return <StudentMobileNavigation locale={locale} items={items} pathname={pathname} />;

  return <nav className="student-primary-nav" aria-label={ar ? "التنقل في مساحة المتعلم" : en ? "Learning space navigation" : "Navigation de l’espace apprenant"}>
    {items.map((item) => {
      const active = isCurrent(pathname, item.href, base);
      return <Link href={item.href} key={item.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}><Icon name={item.icon} size={19} /><span>{ar ? item.ar : en ? item.en : item.fr}</span></Link>;
    })}
  </nav>;
}

function StudentMobileNavigation({ locale, items, pathname }: { locale: Locale; items: StudentNavItem[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ar = locale === "ar";
  const en = locale === "en";
  const base = `/${locale}/dashboard`;
  const primary = items.slice(0, 3);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return <>
    <nav className="student-mobile-nav" aria-label={ar ? "التنقل السريع" : en ? "Quick navigation" : "Navigation rapide"}>
      {primary.map((item) => {
        const active = isCurrent(pathname, item.href, base);
        return <Link href={item.href} key={item.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}><Icon name={item.icon} size={20} /><span>{ar ? item.shortAr : en ? item.shortEn : item.shortFr}</span></Link>;
      })}
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="student-mobile-drawer"><Icon name="menu" size={20} /><span>{ar ? "القائمة" : "Menu"}</span></button>
    </nav>
    {open ? <div className="student-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section id="student-mobile-drawer" className="student-mobile-drawer" role="dialog" aria-modal="true" aria-labelledby="student-drawer-title">
        <header><div><strong id="student-drawer-title">{ar ? "مساحة المتعلم" : en ? "Learning space" : "Espace apprenant"}</strong><small>{ar ? "اختر وجهتك" : en ? "Choose a destination" : "Choisissez votre destination"}</small></div><button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={ar ? "إغلاق القائمة" : en ? "Close menu" : "Fermer le menu"}><Icon name="close" size={22} /></button></header>
        <nav aria-label={ar ? "كل صفحات المتعلم" : en ? "All learner pages" : "Toutes les pages apprenant"}>{items.map((item) => {
          const active = isCurrent(pathname, item.href, base);
          return <Link href={item.href} key={item.href} onClick={() => setOpen(false)} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}><Icon name={item.icon} size={21} /><span>{ar ? item.ar : en ? item.en : item.fr}</span><Icon className="student-directional-icon" name="chevron" size={17} /></Link>;
        })}</nav>
        <StudentSignOutButton locale={locale} />
      </section>
    </div> : null}
  </>;
}
