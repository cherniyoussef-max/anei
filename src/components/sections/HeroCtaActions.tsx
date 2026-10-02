"use client";

import Link from "next/link";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth-client";

interface HeroCtaActionsProps {
  locale: Locale;
  initialUser?: { id: string; role?: string } | null;
}

export function HeroCtaActions({ locale, initialUser }: HeroCtaActionsProps) {
  const { data, isPending } = useSession();

  // If client session is resolved, prefer it; otherwise fall back to SSR initialUser
  const currentUser = !isPending ? data?.user ?? null : initialUser ?? null;
  const isLoggedIn = Boolean(currentUser);
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(currentUser?.role));

  const ar = locale === "ar";
  const en = locale === "en";

  const primaryHref = isLoggedIn
    ? isAdmin
      ? `/${locale}/admin`
      : `/${locale}/dashboard`
    : `/${locale}/register`;

  const primaryLabel = isLoggedIn
    ? isAdmin
      ? ar
        ? "لوحة الإدارة"
        : en
          ? "Admin Console"
          : "Console d’administration"
      : ar
        ? "الذهاب إلى مساحتي"
        : en
          ? "Go to dashboard"
          : "Accéder à mon espace"
    : ar
      ? "إنشاء حساب"
      : en
        ? "Create an account"
        : "Créer mon compte";

  const secondaryHref = `/${locale}/formations`;
  const secondaryLabel = ar
    ? "استكشف الدورات"
    : en
      ? "Explore courses"
      : "Explorer les formations";

  return (
    <div className="ah-hero-actions">
      <Link href={primaryHref} className="ah-btn ah-btn-primary">
        <span>{primaryLabel}</span>
        <Icon name="arrow" size={16} />
      </Link>
      <Link href={secondaryHref} className="ah-btn ah-btn-outline">
        <span>{secondaryLabel}</span>
      </Link>
    </div>
  );
}
