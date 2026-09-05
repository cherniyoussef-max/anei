"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Contact, UserCheck } from "lucide-react";
import type { Locale } from "@/types";

// Server Component layouts build the nav item list, but a lucide icon is a
// function reference — React cannot serialize that across the server/client
// boundary into this "use client" component. Items carry a name instead,
// resolved to the actual icon component only here, entirely client-side.
const PERSONA_ICONS = { LayoutDashboard, Users, Contact, UserCheck };
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
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-[#E7E0D3] bg-[#FCFBF8] px-2 py-2 md:hidden" aria-label={ar ? "التنقل" : "Navigation"}>
        {items.map((item) => {
          const active = isCurrent(pathname, item.href, base);
          const ItemIcon = PERSONA_ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={active
                ? "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl bg-[#F6F1E7] px-2 py-2 text-[11px] font-semibold text-[#082D55]"
                : "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium text-[#7a7261]"}
            >
              <ItemIcon size={19} strokeWidth={1.75} />
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
              ? "flex items-center gap-3 rounded-xl border-s-4 border-[#C9913F] bg-white/10 py-2.5 ps-3 pe-3 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition-all duration-150"
              : "flex items-center gap-3 rounded-xl border-s-4 border-transparent py-2.5 ps-3 pe-3 text-sm text-white/60 transition-all duration-150 hover:bg-white/5 hover:text-white"}
          >
            <ItemIcon size={19} strokeWidth={1.75} />
            <span>{ar ? item.ar : item.fr}</span>
          </Link>
        );
      })}
    </nav>
  );
}
