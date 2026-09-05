import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { StudentNavigation } from "@/components/student/StudentNavigation";
import { StudentSignOutButton } from "@/components/student/StudentSignOutButton";
import { StudentTopbar } from "@/components/student/StudentTopbar";

export function StudentShell({ children, locale, user, pointsBalance = 0, notificationCount = 0, assistantEnabled = false }: {
  children: React.ReactNode;
  locale: Locale;
  user: { name: string; email: string };
  pointsBalance?: number;
  notificationCount?: number;
  assistantEnabled?: boolean;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="student-app min-h-screen bg-[#FCFBF8] md:flex">
      <aside
        className="hidden md:fixed md:inset-y-0 md:start-0 md:z-30 md:flex md:w-72 md:flex-col bg-gradient-to-b from-[#082D55] to-[#061F3D]"
        aria-label={ar ? "مساحة المتعلم" : en ? "Learning space" : "Espace apprenant"}
      >
        <Link className="flex h-16 items-center gap-3 border-b border-white/10 px-6" href={`/${locale}/dashboard`}>
          <Image className="h-9 w-9 flex-none object-contain" src="/media/academy-home-seal.webp" alt="" width={300} height={301} priority sizes="36px" />
          <span className="flex flex-col leading-tight">
            <strong className="text-sm font-bold uppercase tracking-wider text-white">ANEI</strong>
            <small className="text-xs font-medium text-white/50">{ar ? "مساحة المتعلم" : en ? "Learning space" : "Espace Apprenant"}</small>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <StudentNavigation locale={locale} variant="desktop" />
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href={`/${locale}/dashboard/profil`}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-all duration-200 ease-in-out hover:bg-white/5"
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#C9913F] text-sm font-bold text-[#082D55]" aria-hidden="true">{initial}</span>
            <span className="flex min-w-0 flex-col leading-tight">
              <strong className="truncate text-sm text-white">{user.name}</strong>
              <small className="truncate text-xs text-white/50" dir="ltr">{user.email}</small>
            </span>
          </Link>
          <div className="mt-1">
            <StudentSignOutButton locale={locale} />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:ms-72">
        <div className="flex h-16 items-center gap-3 border-b border-[#E7E0D3] bg-[#FCFBF8] px-4 md:hidden">
          <Link className="flex items-center gap-2" href={`/${locale}/dashboard`} aria-label={ar ? "ANEI، مساحة المتعلم" : en ? "ANEI learning space" : "ANEI, espace apprenant"}>
            <Image className="h-9 w-9 object-contain" src="/media/academy-home-seal.webp" alt="" width={300} height={301} sizes="36px" />
            <strong className="font-bold tracking-wide text-[#082D55]">ANEI</strong>
          </Link>
        </div>

        <StudentTopbar locale={locale} userName={user.name} pointsBalance={pointsBalance} notificationCount={notificationCount} assistantEnabled={assistantEnabled} />

        <div className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</div>
        <StudentNavigation locale={locale} variant="mobile" />
      </div>
    </div>
  );
}
