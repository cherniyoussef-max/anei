"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Bell } from "lucide-react";
import type { Locale } from "@/types";
import { LocaleSwitcher } from "@/components/interactive/LocaleSwitcher";

const PAGE_LABELS = {
  formations: { en: "My courses", fr: "Mes formations", ar: "دوراتي" },
  "rendez-vous": { en: "My appointments", fr: "Mes rendez-vous", ar: "مواعيدي" },
  ressources: { en: "My resources", fr: "Mes ressources", ar: "مواردي" },
  certificats: { en: "My certificates", fr: "Mes certificats", ar: "شهاداتي" },
  profil: { en: "Profile and security", fr: "Profil et sécurité", ar: "الملف الشخصي والأمان" },
  notifications: { en: "Notifications", fr: "Notifications", ar: "الإشعارات" },
};

export function StudentTopbar({ locale, userName, notificationCount = 0, assistantEnabled: _assistantEnabled = false }: {
  locale: Locale;
  userName: string;
  pointsBalance?: number;
  notificationCount?: number;
  assistantEnabled?: boolean;
}) {
  const pathname = usePathname();
  const ar = locale === "ar";
  const en = locale === "en";
  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const segment = pathname.split("/")[3] as keyof typeof PAGE_LABELS | undefined;
  const dashboardLabel = ar ? "لوحة التحكم" : en ? "Dashboard" : "Tableau de bord";
  const pageLabel = segment && PAGE_LABELS[segment] ? PAGE_LABELS[segment][locale] : dashboardLabel;
  const spaceLabel = ar ? "مساحتي" : en ? "My space" : "Mon espace";

  return (
    <header className="student-topbar-shell sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white/95 px-4 backdrop-blur-md md:px-8">
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden text-[#5E6E82] sm:inline">{spaceLabel}</span>
        <ChevronRight className="hidden text-[#CBD5E1] rtl:rotate-180 sm:inline" size={14} strokeWidth={1.75} />
        <strong className="truncate font-semibold text-[#1F1F1F]">{pageLabel}</strong>
      </div>

      <div className="flex flex-none items-center gap-2 md:gap-3">
        <div className="hidden sm:block">
          <LocaleSwitcher locale={locale} />
        </div>

        <Link
          href={`/${locale}/dashboard/notifications`}
          aria-label={ar ? `${notificationCount} إشعارات غير مقروءة` : en ? `${notificationCount} unread notifications` : `${notificationCount} notifications non lues`}
          className="relative grid h-10 w-10 flex-none place-items-center rounded-full text-[#1F1F1F]/70 transition-all duration-200 ease-in-out hover:bg-[#F0F6FF] hover:text-[#0056D2]"
        >
          <Bell size={19} strokeWidth={1.75} />
          {notificationCount > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#0056D2]" aria-hidden="true" /> : null}
        </Link>

        <Link
          href={`/${locale}/dashboard/profil`}
          aria-label={ar ? `الملف الشخصي، ${firstName}` : en ? `${firstName}, profile and security` : `${firstName}, profil et sécurité`}
          className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[#0056D2] text-sm font-bold text-white ring-2 ring-white transition-all duration-200 ease-in-out hover:ring-[#00419E]"
        >
          <span aria-hidden="true">{firstName.charAt(0).toLocaleUpperCase(locale)}</span>
        </Link>
      </div>
    </header>
  );
}
