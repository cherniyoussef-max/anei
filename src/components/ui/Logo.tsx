import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { AneiLogo } from "@/components/brand/AneiLogo";

export function Logo({
  locale,
  compact = false,
  priority = false,
}: {
  locale: Locale;
  compact?: boolean;
  priority?: boolean;
}) {
  const c = t(locale);
  return (
    <Link href={`/${locale}`} className={compact ? "logo is-compact" : "logo"} aria-label={c.academy}>
      <AneiLogo
        locale={locale}
        variant={compact ? "mark" : "full"}
        height={compact ? 40 : 72}
        priority={priority}
      />
    </Link>
  );
}

export { AneiLogo } from "@/components/brand/AneiLogo";
