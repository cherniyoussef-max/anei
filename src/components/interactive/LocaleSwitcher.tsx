"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";

const LOCALE_ORDER: Locale[] = ["fr", "en", "ar"];
const LOCALE_LABEL: Record<Locale, string> = { fr: "Français", en: "English", ar: "العربية" };
const ACCESSIBLE_LABEL: Record<Locale, string> = {
  fr: "Afficher le site en français",
  en: "View the site in English",
  ar: "عرض الموقع بالعربية",
};

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const nextLocale = LOCALE_ORDER[(LOCALE_ORDER.indexOf(locale) + 1) % LOCALE_ORDER.length];
  const parts = pathname.split("/");
  parts[1] = nextLocale;
  const target = parts.join("/") || `/${nextLocale}`;

  return (
    <Link className="locale-switcher" href={target} aria-label={ACCESSIBLE_LABEL[nextLocale]} lang={nextLocale}>
      <Icon name="globe" size={17} />
      <span>{LOCALE_LABEL[nextLocale]}</span>
    </Link>
  );
}
