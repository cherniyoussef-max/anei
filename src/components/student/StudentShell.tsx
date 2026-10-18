import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Locale } from "@/types";
import { AneiLogo } from "@/components/brand/AneiLogo";
import { StudentNavigation } from "@/components/student/StudentNavigation";
import { StudentSignOutButton } from "@/components/student/StudentSignOutButton";
import { StudentTopbar } from "@/components/student/StudentTopbar";
import { GlobalWebinarBanner } from "@/components/student/GlobalWebinarBanner";

export function StudentShell({
  children,
  locale,
  user,
  pointsBalance = 0,
  notificationCount = 0,
  assistantEnabled = false,
  impersonation,
}: {
  children: React.ReactNode;
  locale: Locale;
  user: { name: string; email: string };
  pointsBalance?: number;
  notificationCount?: number;
  assistantEnabled?: boolean;
  impersonation?: {
    active: boolean;
    impersonatorId: string;
    impersonatorName: string;
    impersonatorEmail: string;
  };
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="student-app min-h-screen bg-[#F8FAFC]">
      {impersonation?.active ? (
        <aside
          className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-[#FEF3C7] px-4 py-2.5 text-xs text-[#92400E] border-b border-[#FDE68A] shadow-xs"
          role="alert"
          aria-label={ar ? "تنبيه وضع المعاينة" : "Alerte mode prévisualisation"}
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-[#92400E] shrink-0" aria-hidden="true" />
            <span>
              {ar
                ? `أنت في وضع معاينة الدعم (للقراءة فقط): تتصفح حساب ${user.name} (${user.email}). الإجراءات الحساسة معطلة.`
                : `Mode Prévisualisation Support (Lecture seule) : Vous naviguez sur le compte de ${user.name} (${user.email}). Actions sensibles bloquées.`}
            </span>
          </div>
          <Link
            href="/api/admin/impersonate/exit"
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#78350F] px-3 py-1 font-semibold text-white transition-opacity hover:opacity-90"
          >
            <span>{ar ? "إنهاء المعاينة والعودة للإدارة" : "Quitter la session support"}</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </aside>
      ) : null}
      <GlobalWebinarBanner locale={locale} />
      <div className="md:flex">
      <aside
        className="hidden md:fixed md:inset-y-0 md:start-0 md:z-30 md:flex md:w-64 md:flex-col bg-white border-e border-[#E2E8F0] shadow-xs"
        aria-label={ar ? "مساحة المتعلم" : en ? "Learning space" : "Espace apprenant"}
      >
        <div className="flex h-16 items-center border-b border-[#E2E8F0] px-5">
          <Link className="flex items-center gap-2.5 transition-opacity hover:opacity-90" href={`/${locale}/dashboard`} aria-label={ar ? "ANEI، مساحة المتعلم" : en ? "ANEI learning space" : "ANEI, espace apprenant"}>
            <AneiLogo locale={locale} variant="mark" height={32} priority />
            <div className="flex flex-col leading-tight">
              <strong className="text-base font-bold tracking-tight text-[#082D55]">ANEI</strong>
              <span className="text-[11px] font-semibold text-[#0056D2]">{ar ? "مساحة المتعلّم" : en ? "Learning Space" : "Espace Apprenant"}</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <StudentNavigation locale={locale} variant="desktop" />
        </nav>

        <div className="border-t border-[#E2E8F0] p-3 bg-[#F8FAFC]">
          <Link
            href={`/${locale}/dashboard/profil`}
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white hover:shadow-xs group"
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#0056D2] text-sm font-bold text-white shadow-xs" aria-hidden="true">{initial}</span>
            <span className="flex min-w-0 flex-col leading-tight">
              <strong className="truncate text-xs font-semibold text-[#1F2937] group-hover:text-[#0056D2]">{user.name}</strong>
              <small className="truncate text-[11px] font-medium text-[#64748B]">{ar ? "متعلّم معتمد" : en ? "Certified Learner" : "Apprenant certifié"}</small>
            </span>
          </Link>
          <div className="mt-1">
            <StudentSignOutButton locale={locale} />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:ms-64">
        <div className="flex h-16 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 md:hidden">
          <Link className="flex items-center gap-2" href={`/${locale}/dashboard`} aria-label={ar ? "ANEI، مساحة المتعلم" : en ? "ANEI learning space" : "ANEI, espace apprenant"}>
            <AneiLogo locale={locale} variant="mark" height={32} />
            <strong className="font-bold tracking-wide text-[#082D55]">ANEI</strong>
          </Link>
        </div>

        <StudentTopbar locale={locale} userName={user.name} pointsBalance={pointsBalance} notificationCount={notificationCount} assistantEnabled={assistantEnabled} />

        <div className="flex-1 px-4 pt-6 pb-24 md:px-8 md:py-8">{children}</div>
        <div className="md:hidden">
          <StudentNavigation locale={locale} variant="mobile" />
        </div>
      </div>
      </div>
    </div>
  );
}
