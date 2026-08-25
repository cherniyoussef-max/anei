"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/types";

export function PublicNav({
  locale,
  label,
  links,
}: {
  locale: Locale;
  label: string;
  links: readonly (readonly [string, string])[];
}) {
  const pathname = usePathname();

  return (
    <nav className="desktop-nav" aria-label={label}>
      {links.map(([href, text]) => {
        const target = href ? `/${locale}/${href}` : `/${locale}`;
        const current = href ? pathname === target || pathname.startsWith(`${target}/`) : pathname === target;
        return <Link key={href || "home"} href={target} aria-current={current ? "page" : undefined}>{text}</Link>;
      })}
    </nav>
  );
}
