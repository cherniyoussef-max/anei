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
    <div className="min-h-screen bg-[#FCFBF8] md:flex">
      <aside
        className="hidden md:fixed md:inset-y-0 md:start-0 md:z-30 md:flex md:w-72 md:flex-col bg-gradient-to-b from-[#082D55] to-[#061F3D]"
        aria-label={roleLabel}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <Link className="flex items-center gap-2.5 min-w-0" href={items[0]?.href ?? `/${locale}`}>
            <span className="inline-flex items-center justify-center bg-white p-1 rounded-lg shadow-sm flex-none">
              <AneiLogo locale={locale} variant="mark" height={22} priority />
            </span>
            <span className="flex flex-col leading-tight truncate">
              <strong className="text-sm font-bold uppercase tracking-wider text-white">ANEI</strong>
              <small className="text-[11px] font-medium text-white/50 truncate">{roleLabel}</small>
            </span>
          </Link>
          <CareNotificationCenter locale={locale} preferencesHref={profileHref} variant="dark" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <PersonaNavigation locale={locale} items={items} base={base} variant="desktop" />
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href={profileHref}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-all duration-200 ease-in-out hover:bg-white/5"
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#C9913F] text-sm font-bold text-[#082D55]" aria-hidden="true">{initial}</span>
            <span className="flex min-w-0 flex-col leading-tight">
              <strong className="truncate text-sm text-white">{user.name}</strong>
              <small className="truncate text-xs text-white/50" dir="ltr">{user.email}</small>
            </span>
          </Link>
          <Link href={`/${locale}`} className="mt-1 flex min-h-[38px] items-center gap-2 rounded-xl px-2 text-xs font-medium text-white/50 transition-colors duration-150 hover:bg-white/5 hover:text-white">
            <Globe size={16} strokeWidth={1.75} />
            {ar ? "موقع ANEI" : "Site ANEI"}
          </Link>
          <div className="mt-1">
            <StudentSignOutButton locale={locale} />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:ms-72">
        <div className="flex h-16 items-center justify-between border-b border-[#E7E0D3] bg-[#FCFBF8] px-4 md:hidden">
          <Link className="flex items-center gap-2" href={items[0]?.href ?? `/${locale}`} aria-label={`ANEI, ${roleLabel}`}>
            <AneiLogo locale={locale} variant="mark" height={32} />
            <span className="flex flex-col leading-tight">
              <strong className="font-bold tracking-wide text-[#082D55]">ANEI</strong>
              <small className="text-[11px] font-medium text-[#7a7261]">{roleLabel}</small>
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
