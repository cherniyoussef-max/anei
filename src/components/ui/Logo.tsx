import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";

export function Logo({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const c = t(locale);
  return (
    <Link href={`/${locale}`} className="logo" aria-label={c.academy}>
      <span className="logo-mark" aria-hidden="true"><Icon name="graduation" size={22}/></span>
      {!compact && <span className="logo-copy"><strong>ANEI</strong><small>{locale === "fr" ? "Éducation inclusive" : "التربية الدامجة"}</small></span>}
    </Link>
  );
}
