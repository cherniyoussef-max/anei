"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { authClient, useSession } from "@/lib/auth-client";

export function MobileMenu({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const c = t(locale);
  const { data } = useSession();
  const router = useRouter();
  const ar = locale === "ar";
  const links = [["", c.nav.home], ["about", c.nav.about], ["formations", c.nav.courses], ["webinaires", c.nav.webinars], ["bibliotheque", c.nav.library], ["avs", c.nav.avs], ["actualites", c.nav.news], ["contact", c.nav.contact]];

  function closeMenu() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("a, button")];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  async function logout() {
    await authClient.signOut();
    setOpen(false);
    router.push(`/${locale}`);
    router.refresh();
  }

  return <div className="mobile-menu-wrap">
    <button ref={triggerRef} className="icon-button mobile-menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="public-mobile-menu" aria-label={open ? (ar ? "إغلاق القائمة" : "Fermer le menu") : (ar ? "فتح القائمة" : "Ouvrir le menu")}><Icon name={open ? "close" : "menu"} size={22}/></button>
    {open ? <>
      <button className="mobile-menu-backdrop" type="button" aria-label={ar ? "إغلاق القائمة" : "Fermer le menu"} onClick={closeMenu}/>
      <div ref={panelRef} id="public-mobile-menu" className="mobile-menu-panel" role="dialog" aria-modal="true" aria-label={ar ? "التنقل" : "Navigation"}>
        <div className="mobile-menu-heading"><strong>ANEI</strong><button className="icon-button" type="button" onClick={closeMenu} aria-label={ar ? "إغلاق القائمة" : "Fermer le menu"}><Icon name="close" size={20}/></button></div>
        <nav aria-label={ar ? "التنقل الرئيسي" : "Navigation principale"}>{links.map(([href, label]) => <Link key={href} href={`/${locale}/${href}`} onClick={closeMenu}>{label}</Link>)}</nav>
        <div className="mobile-menu-actions">{data?.user ? <><Link className="btn btn-primary" href={`/${locale}/dashboard`} onClick={closeMenu}>{c.actions.dashboard}</Link><button className="btn btn-ghost" type="button" onClick={logout}>{ar ? "تسجيل الخروج" : "Se déconnecter"}</button></> : <><Link className="btn btn-ghost" href={`/${locale}/login`} onClick={closeMenu}>{c.actions.login}</Link><Link className="btn btn-primary" href={`/${locale}/register`} onClick={closeMenu}>{c.actions.register}</Link></>}</div>
      </div>
    </> : null}
  </div>;
}
