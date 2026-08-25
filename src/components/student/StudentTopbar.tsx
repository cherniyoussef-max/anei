"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/types";
import { LocaleSwitcher } from "@/components/interactive/LocaleSwitcher";
import { Icon } from "@/components/ui/Icon";

const PAGE_LABELS = {
  formations: { en: "My courses", fr: "Mes formations", ar: "دوراتي" },
  "rendez-vous": { en: "My appointments", fr: "Mes rendez-vous", ar: "مواعيدي" },
  ressources: { en: "My resources", fr: "Mes ressources", ar: "مواردي" },
  certificats: { en: "My certificates", fr: "Mes certificats", ar: "شهاداتي" },
  profil: { en: "Profile and security", fr: "Profil et sécurité", ar: "الملف الشخصي والأمان" },
  notifications: { en: "Notifications", fr: "Notifications", ar: "الإشعارات" },
};

export function StudentTopbar({ locale, firstName, notificationCount = 0, assistantEnabled = false }: { locale: Locale; firstName: string; notificationCount?: number; assistantEnabled?: boolean }) {
  const pathname = usePathname();
  const ar = locale === "ar";
  const en = locale === "en";
  const segment = pathname.split("/")[3] as keyof typeof PAGE_LABELS | undefined;
  const pageLabel = segment && PAGE_LABELS[segment] ? PAGE_LABELS[segment][locale] : ar ? "مساحتي التعليمية" : en ? "My learning space" : "Mon espace d’apprentissage";

  return <header className="student-topbar">
    <div className="student-topbar-context"><strong>{pageLabel}</strong><small>{ar ? "مساحة تعلم شخصية وآمنة" : en ? "Your personal, secure learning space" : "Votre espace personnel et sécurisé"}</small></div>
    <div className="student-topbar-actions">
      {assistantEnabled ? <Link className="student-assistant-action" href={`/${locale}/dashboard?assistant=open`}><Icon name="spark" size={17} /><span>{ar ? "مساعد ANEI" : "Assistant ANEI"}</span></Link> : null}
      {notificationCount > 0 ? <Link className="student-icon-action" href={`/${locale}/dashboard/notifications`} aria-label={ar ? `${notificationCount} إشعارات غير مقروءة` : en ? `${notificationCount} unread notifications` : `${notificationCount} notifications non lues`}><Icon name="bell" size={20} /><span className="student-notification-count">{Math.min(notificationCount, 99)}</span></Link> : null}
      <LocaleSwitcher locale={locale} />
      <Link className="student-profile-chip" href={`/${locale}/dashboard/profil`} aria-label={ar ? `الملف الشخصي، ${firstName}` : locale === "en" ? `${firstName}, profile and security` : `${firstName}, profil et sécurité`}><span aria-hidden="true">{firstName.charAt(0).toLocaleUpperCase(locale)}</span><strong>{firstName}</strong></Link>
    </div>
  </header>;
}
