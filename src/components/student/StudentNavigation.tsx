"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayCircle, GraduationCap, CalendarDays, BookOpen, Award, Trophy, ShoppingBag, UserCheck, Menu, X, ChevronRight, type LucideIcon } from "lucide-react";
import type { Locale } from "@/types";
import { StudentSignOutButton } from "@/components/student/StudentSignOutButton";

type StudentNavItem = { href: string; icon: LucideIcon; en: string; fr: string; ar: string; shortEn: string; shortFr: string; shortAr: string };

function learnerItems(locale: Locale): StudentNavItem[] {
  const base = `/${locale}/dashboard`;
  return [
    { href: base, icon: PlayCircle, en: "Continue", fr: "Continuer", ar: "متابعة التعلم", shortEn: "Continue", shortFr: "Continuer", shortAr: "متابعة" },
    { href: `${base}/formations`, icon: GraduationCap, en: "My courses", fr: "Mes formations", ar: "دوراتي", shortEn: "Courses", shortFr: "Formations", shortAr: "دوراتي" },
    { href: `${base}/rendez-vous`, icon: CalendarDays, en: "My appointments", fr: "Mes rendez-vous", ar: "مواعيدي", shortEn: "Appointments", shortFr: "Rendez-vous", shortAr: "مواعيدي" },
    { href: `${base}/ressources`, icon: BookOpen, en: "My resources", fr: "Mes ressources", ar: "مواردي", shortEn: "Resources", shortFr: "Ressources", shortAr: "مواردي" },
    { href: `${base}/certificats`, icon: Award, en: "My certificates", fr: "Mes certificats", ar: "شهاداتي", shortEn: "Certificates", shortFr: "Certificats", shortAr: "شهاداتي" },
    { href: `${base}/classement`, icon: Trophy, en: "Leaderboard", fr: "Classement", ar: "الترتيب", shortEn: "Leaderboard", shortFr: "Classement", shortAr: "الترتيب" },
    { href: `${base}/boutique`, icon: ShoppingBag, en: "Shop", fr: "Boutique", ar: "المتجر", shortEn: "Shop", shortFr: "Boutique", shortAr: "المتجر" },
    { href: `${base}/profil`, icon: UserCheck, en: "Profile", fr: "Profil", ar: "الملف الشخصي", shortEn: "Profile", shortFr: "Profil", shortAr: "الملف" },
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

  return <nav className="flex flex-col gap-1" aria-label={ar ? "التنقل في مساحة المتعلم" : en ? "Learning space navigation" : "Navigation de l’espace apprenant"}>
    {items.map((item) => {
      const active = isCurrent(pathname, item.href, base);
      const ItemIcon = item.icon;
      return <Link
        href={item.href}
        key={item.href}
        aria-current={active ? "page" : undefined}
        className={active
          ? "flex items-center gap-3 rounded-xl border-s-4 border-[#C9913F] bg-white/10 py-2.5 ps-3 pe-3 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition-all duration-150"
          : "flex items-center gap-3 rounded-xl border-s-4 border-transparent py-2.5 ps-3 pe-3 text-sm text-white/60 transition-all duration-150 hover:bg-white/5 hover:text-white"}
      >
        <ItemIcon size={19} strokeWidth={1.75} />
        <span>{ar ? item.ar : en ? item.en : item.fr}</span>
      </Link>;
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
        const ItemIcon = item.icon;
        return <Link href={item.href} key={item.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}><ItemIcon size={20} strokeWidth={1.75} /><span>{ar ? item.shortAr : en ? item.shortEn : item.shortFr}</span></Link>;
      })}
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="student-mobile-drawer"><Menu size={20} strokeWidth={1.75} /><span>{ar ? "القائمة" : "Menu"}</span></button>
    </nav>
    {open ? <div className="student-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section id="student-mobile-drawer" className="student-mobile-drawer" role="dialog" aria-modal="true" aria-labelledby="student-drawer-title">
        <header><div><strong id="student-drawer-title">{ar ? "مساحة المتعلم" : en ? "Learning space" : "Espace apprenant"}</strong><small>{ar ? "اختر وجهتك" : en ? "Choose a destination" : "Choisissez votre destination"}</small></div><button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={ar ? "إغلاق القائمة" : en ? "Close menu" : "Fermer le menu"}><X size={22} strokeWidth={1.75} /></button></header>
        <nav aria-label={ar ? "كل صفحات المتعلم" : en ? "All learner pages" : "Toutes les pages apprenant"}>{items.map((item) => {
          const active = isCurrent(pathname, item.href, base);
          const ItemIcon = item.icon;
          return <Link href={item.href} key={item.href} onClick={() => setOpen(false)} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}><ItemIcon size={21} strokeWidth={1.75} /><span>{ar ? item.ar : en ? item.en : item.fr}</span><ChevronRight className="student-directional-icon" size={17} strokeWidth={1.75} /></Link>;
        })}</nav>
        <StudentSignOutButton locale={locale} />
      </section>
    </div> : null}
  </>;
}
