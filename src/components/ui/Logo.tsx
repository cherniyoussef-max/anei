import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";

export function Logo({ locale, compact = false, priority = false }: { locale: Locale; compact?: boolean; priority?: boolean }) {
  const c = t(locale);
  return (
    <Link href={`/${locale}`} className={compact ? "logo is-compact" : "logo"} aria-label={c.academy}>
      <Image className="brand-logo-image" src="/media/academy-home-seal.webp" alt="" width={300} height={301} priority={priority} sizes={compact ? "40px" : "52px"} />
    </Link>
  );
}
