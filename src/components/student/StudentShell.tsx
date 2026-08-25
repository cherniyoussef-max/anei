import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { StudentNavigation } from "@/components/student/StudentNavigation";
import { StudentSignOutButton } from "@/components/student/StudentSignOutButton";
import { StudentTopbar } from "@/components/student/StudentTopbar";

export function StudentShell({ children, locale, user, notificationCount = 0, assistantEnabled = false }: {
  children: React.ReactNode;
  locale: Locale;
  user: { name: string; email: string };
  notificationCount?: number;
  assistantEnabled?: boolean;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";
  const firstName = user.name.trim().split(/\s+/)[0] || (ar ? "حسابي" : locale === "en" ? "Account" : "Compte");

  return (
    <div className="student-app">
      <aside className="student-sidebar" aria-label={ar ? "مساحة المتعلم" : en ? "Learning space" : "Espace apprenant"}>
        <Link className="student-brand" href={`/${locale}/dashboard`} aria-label={ar ? "ANEI، مساحة المتعلم" : en ? "ANEI learning space" : "ANEI, espace apprenant"}>
          <Image className="student-brand-image" src="/media/anei-brand-logo.webp" alt="" width={520} height={174} priority sizes="180px" />
          <span className="student-brand-copy"><small>{ar ? "مساحة المتعلم" : en ? "Learning space" : "Espace apprenant"}</small></span>
        </Link>

        <div className="student-identity">
          <span className="student-avatar" aria-hidden="true">{initial}</span>
          <span className="student-identity-copy"><strong>{user.name}</strong><small dir="ltr">{user.email}</small></span>
        </div>

        <StudentNavigation locale={locale} variant="desktop" />

        <div className="student-sidebar-footer">
          <p>{ar ? "تقدمك محفوظ في حسابك" : en ? "Your progress is saved" : "Votre progression est enregistrée"}</p>
          <StudentSignOutButton locale={locale} />
        </div>
      </aside>

      <div className="student-workspace">
        <div className="student-mobile-brand-row">
          <Link className="student-mobile-brand" href={`/${locale}/dashboard`} aria-label={ar ? "ANEI، مساحة المتعلم" : en ? "ANEI learning space" : "ANEI, espace apprenant"}>
            <Image className="student-mobile-brand-image" src="/media/anei-brand-logo.webp" alt="" width={520} height={174} sizes="116px" />
          </Link>
        </div>
        <StudentTopbar locale={locale} firstName={firstName} notificationCount={notificationCount} assistantEnabled={assistantEnabled} />

        <div className="student-content">{children}</div>
        <StudentNavigation locale={locale} variant="mobile" />
      </div>
    </div>
  );
}
