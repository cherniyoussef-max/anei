"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Sparkles, Wallet, Bell } from "lucide-react";
import type { Locale } from "@/types";
import { LocaleSwitcher } from "@/components/interactive/LocaleSwitcher";

const PAGE_LABELS = {
  formations: { en: "My courses", fr: "Mes formations", ar: "دوراتي" },
  "rendez-vous": { en: "My appointments", fr: "Mes rendez-vous", ar: "مواعيدي" },
  ressources: { en: "My resources", fr: "Mes ressources", ar: "مواردي" },
  certificats: { en: "My certificates", fr: "Mes certificats", ar: "شهاداتي" },
  classement: { en: "Leaderboard", fr: "Classement", ar: "الترتيب" },
  boutique: { en: "Shop", fr: "Boutique", ar: "المتجر" },
  profil: { en: "Profile and security", fr: "Profil et sécurité", ar: "الملف الشخصي والأمان" },
  notifications: { en: "Notifications", fr: "Notifications", ar: "الإشعارات" },
};

export function StudentTopbar({ locale, userName, pointsBalance = 0, notificationCount = 0, assistantEnabled = false }: {
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
    <header className="student-topbar-shell sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[#E7E0D3] bg-[#FCFBF8]/90 px-4 backdrop-blur-md md:px-8">
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden text-[#7a7261] sm:inline">{spaceLabel}</span>
        <ChevronRight className="hidden text-[#c9bfa8] rtl:rotate-180 sm:inline" size={14} strokeWidth={1.75} />
        <strong className="truncate font-semibold text-[#082D55]">{pageLabel}</strong>
      </div>

      <div className="flex flex-none items-center gap-2 md:gap-3">
        {assistantEnabled ? (
          <Link
            className="hidden items-center gap-1.5 rounded-full border border-[#E7E0D3] bg-white px-3 py-1.5 text-sm font-medium text-[#082D55] transition-all duration-200 ease-in-out hover:border-[#C9913F] sm:flex"
            href={`/${locale}/dashboard?assistant=open`}
          >
            <Sparkles className="text-[#C9913F]" size={16} strokeWidth={1.75} />
            <span>{ar ? "مساعد ANEI" : "Assistant ANEI"}</span>
          </Link>
        ) : null}

        <Link
          href={`/${locale}/dashboard/boutique`}
          className="flex items-center gap-1.5 rounded-full border border-[#E7E0D3] bg-white px-3 py-1.5 text-sm font-semibold text-[#082D55] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-all duration-200 ease-in-out hover:border-[#C9913F]"
        >
          <Wallet className="text-[#C9913F]" size={16} strokeWidth={1.75} />
          <span>{pointsBalance} pts</span>
        </Link>

        <div className="hidden sm:block">
          <LocaleSwitcher locale={locale} />
        </div>

        <Link
          href={`/${locale}/dashboard/notifications`}
          aria-label={ar ? `${notificationCount} إشعارات غير مقروءة` : en ? `${notificationCount} unread notifications` : `${notificationCount} notifications non lues`}
          className="relative grid h-10 w-10 flex-none place-items-center rounded-full text-[#082D55]/70 transition-all duration-200 ease-in-out hover:bg-[#F6F1E7] hover:text-[#082D55]"
        >
          <Bell size={19} strokeWidth={1.75} />
          {notificationCount > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#C9913F]" aria-hidden="true" /> : null}
        </Link>

        <Link
          href={`/${locale}/dashboard/profil`}
          aria-label={ar ? `الملف الشخصي، ${firstName}` : en ? `${firstName}, profile and security` : `${firstName}, profil et sécurité`}
          className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[#082D55] text-sm font-bold text-white ring-2 ring-white transition-all duration-200 ease-in-out hover:ring-[#C9913F]"
        >
          <span aria-hidden="true">{firstName.charAt(0).toLocaleUpperCase(locale)}</span>
        </Link>
      </div>
    </header>
  );
}
