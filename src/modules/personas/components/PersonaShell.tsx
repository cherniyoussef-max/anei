import Link from "next/link";
import { AneiLogo } from "@/components/brand/AneiLogo";
import { Globe } from "lucide-react";
import type { Locale } from "@/types";
import { StudentSignOutButton } from "@/components/student/StudentSignOutButton";
import { PersonaNavigation, type PersonaNavItem } from "@/modules/personas/components/PersonaNavigation";
import { CareNotificationCenter } from "@/components/care/CareNotificationCenter";

export function PersonaShell({ children, locale, roleLabel, user, items, profileHref, base }: {
  children: React.ReactNode;
  locale: Locale;
  roleLabel: string;
  user: { name: string; email: string };
  items: PersonaNavItem[];
  profileHref: string;
  base: string;
}) {
  const ar = locale === "ar";
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";
  const profileItem: PersonaNavItem = { href: profileHref, icon: "UserCheck", fr: "Profil", ar: "الملف الشخصي" };
  const mobileItems = [...items, profileItem];

  return (
    <div className="student-app min-h-screen bg-[#F8FAFC] md:flex">
      <aside
        className="hidden md:fixed md:inset-y-0 md:start-0 md:z-30 md:flex md:w-64 md:flex-col bg-white border-e border-[#E2E8F0] shadow-xs"
        aria-label={roleLabel}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-4">
          <Link className="flex items-center gap-2.5 min-w-0 transition-opacity hover:opacity-90" href={items[0]?.href ?? `/${locale}`}>
            <AneiLogo locale={locale} variant="mark" height={30} priority />
            <div className="flex flex-col leading-tight truncate">
              <strong className="text-base font-bold tracking-tight text-[#0F172A]">ANEI</strong>
              <span className="text-[11px] font-semibold text-[#0056D2] truncate">{roleLabel}</span>
            </div>
          </Link>
          <CareNotificationCenter locale={locale} preferencesHref={profileHref} variant="light" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <PersonaNavigation locale={locale} items={items} base={base} variant="desktop" />
        </nav>

        <div className="border-t border-[#E2E8F0] p-3 bg-[#F8FAFC]">
          <Link
            href={profileHref}
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white hover:shadow-xs group"
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#0056D2] text-sm font-bold text-white shadow-xs" aria-hidden="true">{initial}</span>
            <span className="flex min-w-0 flex-col leading-tight">
              <strong className="truncate text-xs font-semibold text-[#1F2937] group-hover:text-[#0056D2]">{user.name}</strong>
              <small className="truncate text-[11px] font-medium text-[#64748B]">{roleLabel}</small>
            </span>
          </Link>
          <Link href={`/${locale}`} className="mt-1 flex min-h-[36px] items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[#64748B] transition-colors hover:bg-white hover:text-[#0056D2]">
            <Globe size={15} strokeWidth={1.75} className="text-[#94A3B8]" />
            <span>{ar ? "موقع ANEI العام" : "Site public ANEI"}</span>
          </Link>
          <div className="mt-1">
            <StudentSignOutButton locale={locale} />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:ms-64">
        <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:hidden">
          <Link className="flex items-center gap-2" href={items[0]?.href ?? `/${locale}`} aria-label={`ANEI, ${roleLabel}`}>
            <AneiLogo locale={locale} variant="mark" height={30} />
            <span className="flex flex-col leading-tight">
              <strong className="font-bold tracking-wide text-[#0F172A]">ANEI</strong>
              <small className="text-[11px] font-semibold text-[#0056D2]">{roleLabel}</small>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <CareNotificationCenter locale={locale} preferencesHref={profileHref} variant="light" />
          </div>
        </div>

        <div className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</div>
        <div className="persona-mobile-signout md:hidden">
          <StudentSignOutButton locale={locale} />
        </div>
        <PersonaNavigation locale={locale} items={mobileItems} base={base} variant="mobile" />
      </div>
    </div>
  );
}
