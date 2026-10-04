"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Contact, UserCheck, Inbox, MessageSquare, GraduationCap, BookOpen } from "lucide-react";
import type { Locale } from "@/types";

// Server Component layouts build the nav item list, but a lucide icon is a
// function reference — React cannot serialize that across the server/client
// boundary into this "use client" component. Items carry a name instead,
// resolved to the actual icon component only here, entirely client-side.
const PERSONA_ICONS = { LayoutDashboard, Users, Contact, UserCheck, Inbox, MessageSquare, GraduationCap, BookOpen };
export type PersonaIconName = keyof typeof PERSONA_ICONS;
export type PersonaNavItem = { href: string; icon: PersonaIconName; fr: string; ar: string };

function isCurrent(pathname: string, href: string, base: string) {
  if (href === base) return pathname === base;
  // Only allow prefix-matching (so a sub-route stays highlighted) for links
  // within this portal's own section — an item pointing outside the base
  // (e.g. AVS's public-directory link) must match exactly, otherwise a
  // short outside path can accidentally prefix-match this section's own URL.
  const isWithinSection = href === base || href.startsWith(`${base}/`);
  return pathname === href || (isWithinSection && pathname.startsWith(`${href}/`));
}

export function PersonaNavigation({ locale, items, base, variant }: { locale: Locale; items: PersonaNavItem[]; base: string; variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  const ar = locale === "ar";

  if (variant === "mobile") {
    return (
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-[#E2E8F0] bg-white px-2 py-2 md:hidden shadow-lg sticky bottom-0 z-30" aria-label={ar ? "التنقل" : "Navigation"}>
        {items.map((item) => {
          const active = isCurrent(pathname, item.href, base);
          const ItemIcon = PERSONA_ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={active
                ? "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg bg-[#F0F6FF] px-2 py-2 text-[11px] font-bold text-[#0056D2]"
                : "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium text-[#64748B] hover:text-[#0F172A]"}
            >
              <ItemIcon size={19} strokeWidth={active ? 2.2 : 1.75} className={active ? "text-[#0056D2]" : "text-[#718096]"} />
              <span className="max-w-full truncate">{ar ? item.ar : item.fr}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1" aria-label={ar ? "التنقل" : "Navigation"}>
      {items.map((item) => {
        const active = isCurrent(pathname, item.href, base);
        const ItemIcon = PERSONA_ICONS[item.icon];
        return (
          <Link
            href={item.href}
            key={item.href}
            aria-current={active ? "page" : undefined}
            className={active
              ? "flex items-center gap-3 rounded-lg border-s-4 border-[#0056D2] bg-[#F0F6FF] py-2.5 ps-3 pe-3 text-sm font-semibold text-[#0056D2] transition-colors shadow-xs"
              : "flex items-center gap-3 rounded-lg border-s-4 border-transparent py-2.5 ps-3 pe-3 text-sm font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"}
          >
            <ItemIcon size={19} strokeWidth={active ? 2.2 : 1.75} className={active ? "text-[#0056D2]" : "text-[#64748B]"} />
            <span>{ar ? item.ar : item.fr}</span>
          </Link>
        );
      })}
    </nav>
  );
}
