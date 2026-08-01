"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale() {
    const nextLocale = locale === "fr" ? "ar" : "fr";
    const parts = pathname.split("/");
    parts[1] = nextLocale;
    router.push(parts.join("/") || `/${nextLocale}`);
  }

  return (
    <button className="locale-switcher" onClick={switchLocale} type="button" aria-label="Changer de langue">
      <Icon name="globe" size={17} />
      <span>{locale === "fr" ? "العربية" : "Français"}</span>
    </button>
  );
}
