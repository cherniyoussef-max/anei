"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { authClient, useSession } from "@/lib/auth-client";

import Image from "next/image";

export function MobileMenu({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const c = t(locale);
  const { data } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const ar = locale === "ar";
  const en = locale === "en";
  const links = [
    ["", c.nav.home],
    ["formations", c.nav.courses],
    ["bibliotheque", c.nav.library],
    ["avs", ar ? "المرافق المدرسي (AVS)" : "Accompagnement (AVS)"],
    ["specialistes", c.nav.specialists],
    ["webinaires", c.nav.webinars],
    ["actualites", c.nav.news],
    ["contact", c.nav.contact],
  ];
  const localeOrder: Locale[] = ["fr", "ar"];
  const localeLabel: Record<Locale, string> = { fr: "Français", ar: "العربية", en: "Français" };
  const nextLocale = localeOrder[(localeOrder.indexOf(locale) + 1) % localeOrder.length];
  const nextLocaleLabel = localeLabel[nextLocale];
  const nextLocaleParts = pathname.split("/");
  nextLocaleParts[1] = nextLocale;
  const nextLocaleTarget = nextLocaleParts.join("/") || `/${nextLocale}`;

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

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(data?.user?.role));
  const userProfileType = (data?.user as { profileType?: string } | undefined)?.profileType;
  const portalPath = isAdmin
    ? `/${locale}/admin`
    : userProfileType === "parent"
      ? `/${locale}/parent`
      : userProfileType === "teacher"
        ? `/${locale}/teacher`
        : userProfileType === "avs"
          ? `/${locale}/avs/espace`
          : userProfileType === "specialist"
            ? `/${locale}/specialist`
            : userProfileType === "institution"
              ? `/${locale}/organization`
              : `/${locale}/dashboard`;

  const portalLabel = isAdmin
    ? (ar ? "لوحة الإدارة" : en ? "Admin Console" : "Console d’administration")
    : userProfileType === "parent"
      ? (ar ? "مساحة الولي" : en ? "Parent space" : "Espace parent")
      : userProfileType === "teacher"
        ? (ar ? "مساحة المكوّن" : en ? "Teacher space" : "Espace formateur")
        : userProfileType === "avs"
          ? (ar ? "مساحة المرافق" : en ? "AVS space" : "Espace AVS")
          : c.actions.dashboard;

  return (
    <div className="mobile-menu-wrap">
      <button
        ref={triggerRef}
        className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-[#0b1f4b] hover:bg-[#eef4fc] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1f4b]"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="public-mobile-menu"
        aria-label={open ? (ar ? "إغلاق القائمة" : en ? "Close menu" : "Fermer le menu") : (ar ? "فتح القائمة" : en ? "Open menu" : "Ouvrir le menu")}
      >
        <Icon name={open ? "close" : "menu"} size={22} />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 bg-[#0b1f4b]/50 backdrop-blur-xs z-50 transition-opacity"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            id="public-mobile-menu"
            className="fixed inset-y-0 end-0 z-50 w-full max-w-[340px] bg-white shadow-2xl flex flex-col p-6 overflow-y-auto transition-transform"
            role="dialog"
            aria-modal="true"
            aria-label={ar ? "قائمة التنقل" : "Menu de navigation"}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Image
                  src="/media/home-v5/logo-nav.png"
                  alt="ANEI"
                  width={110}
                  height={32}
                  className="h-[30px] w-auto object-contain"
                />
              </div>
              <button
                autoFocus
                type="button"
                onClick={closeMenu}
                className="p-2 -me-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1f4b]"
                aria-label={ar ? "إغلاق القائمة" : en ? "Close menu" : "Fermer le menu"}
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <nav className="flex flex-col gap-1 overflow-y-auto" aria-label={ar ? "التنقل الرئيسي" : en ? "Primary navigation" : "Navigation principale"}>
              {links.map(([href, label]) => {
                const target = href ? `/${locale}/${href}` : `/${locale}`;
                const current = href ? pathname === target || pathname.startsWith(`${target}/`) : pathname === target;
                return (
                  <Link
                    key={href}
                    href={target}
                    prefetch={true}
                    onClick={closeMenu}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center min-h-[46px] px-3.5 py-2 rounded-xl text-[14.5px] transition-colors ${
                      current
                        ? "bg-[#eef4fc] text-[#0b1f4b] font-bold border-s-4 border-[#8c651e]"
                        : "text-slate-700 hover:bg-slate-50 hover:text-[#0b1f4b] font-medium"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 pt-4 border-t border-slate-200 shrink-0">
              <Link
                href={nextLocaleTarget}
                onClick={closeMenu}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Icon name="globe" size={18} className="text-[#0b1f4b]" />
                  <span>{ar ? "Changer de langue" : "تغيير اللغة"}</span>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-bold text-[#0b1f4b]">
                  {nextLocaleLabel}
                </span>
              </Link>
            </div>

            <div className="mt-auto pt-6 border-t border-slate-200 flex flex-col gap-2.5 shrink-0">
              {data?.user ? (
                <>
                  <Link
                    href={portalPath}
                    onClick={closeMenu}
                    className="w-full inline-flex items-center justify-center min-h-[46px] rounded-xl bg-[#0b1f4b] text-white font-semibold text-sm hover:bg-[#1b3a7a] transition-colors shadow-xs"
                  >
                    {portalLabel}
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full inline-flex items-center justify-center min-h-[46px] rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                  >
                    {ar ? "تسجيل الخروج" : en ? "Sign out" : "Se déconnecter"}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={`/${locale}/connexion`}
                    onClick={closeMenu}
                    className="w-full inline-flex items-center justify-center min-h-[46px] rounded-xl bg-[#0b1f4b] text-white font-semibold text-sm hover:bg-[#1b3a7a] transition-colors shadow-xs"
                  >
                    {ar ? "تسجيل الدخول" : "Connexion"}
                  </Link>
                  <Link
                    href={`/${locale}/formations`}
                    onClick={closeMenu}
                    className="w-full inline-flex items-center justify-center min-h-[46px] rounded-xl border border-slate-200 text-[#0b1f4b] font-semibold text-sm hover:bg-slate-50 transition-colors"
                  >
                    {ar ? "استكشف التكوينات" : "Découvrir les formations"}
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
