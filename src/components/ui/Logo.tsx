import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";

export function Logo({ locale, compact = false, priority = false }: { locale: Locale; compact?: boolean; priority?: boolean }) {
  const c = t(locale);
  return (
    <Link href={`/${locale}`} className={compact ? "logo is-compact" : "logo"} aria-label={c.academy}>
      <Image className="brand-logo-image" src="/media/anei-brand-logo.webp" alt="" width={520} height={174} priority={priority} sizes={compact ? "52px" : "(max-width: 640px) 150px, 210px"} />
    </Link>
  );
}
