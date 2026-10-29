"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/types";
import { authClient, useSession } from "@/lib/auth-client";
import { Icon } from "@/components/ui/Icon";

export type InitialAccountUser = {
  name: string;
  email: string;
  role: string;
  primaryPersona?: string | null;
  profileType?: string | null;
  portalHref: string;
} | null;

export function AccountActions({ locale, initialUser = null }: { locale: Locale; initialUser?: InitialAccountUser }) {
  const { data, isPending } = useSession();
  const router = useRouter();
  const ar = locale === "ar";
  const en = locale === "en";
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const hasSessionCookie = typeof document !== "undefined" && document.cookie.includes("session_token");

  // If initialUser is provided by SSR, use it to ensure 100% hydration matching with 0 layout shift
  const user = data?.user ?? (initialUser ? {
    name: initialUser.name,
    email: initialUser.email,
    role: initialUser.role,
    profileType: initialUser.profileType ?? undefined,
  } : null);

  if (!user) {
    if (isPending && hasSessionCookie) {
      return (
        <div
          className="account-chip-skeleton animate-pulse"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 38,
            width: 96,
            borderRadius: 9999,
            background: "rgba(15, 23, 42, 0.06)",
          }}
          aria-hidden="true"
        />
      );
    }

    return (
      <Link
        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:px-4.5 sm:py-2 rounded-full font-semibold text-[13px] bg-[#0b1f4b] text-white hover:bg-[#1b3a7a] transition-all shadow-xs hover:shadow-sm"
        href={`/${locale}/connexion`}
        aria-label={ar ? "تسجيل الدخول / حسابي" : en ? "Sign in / My account" : "Se connecter / Mon compte"}
      >
        <Icon name="user" size={16} />
        <span className="hidden sm:inline">
          {ar ? "تسجيل الدخول" : en ? "Sign In" : "Connexion"}
        </span>
      </Link>
    );
  }

  const firstName = user.name?.trim().split(/\s+/)[0] || (ar ? "حسابي" : en ? "Account" : "Compte");
  const initial = firstName.charAt(0).toLocaleUpperCase(locale);
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(user.role));
  const userProfileType = (user as { profileType?: string }).profileType;

  const portalPath = isAdmin
    ? `/${locale}/admin`
    : userProfileType === "parent"
      ? `/${locale}/parent`
      : userProfileType === "teacher"
        ? `/${locale}/teacher`
        : userProfileType === "avs"
          ? `/${locale}/avs/espace`
          : userProfileType === "specialist"
            ? `/${locale}/specialist`
            : userProfileType === "institution"
              ? `/${locale}/organization`
              : `/${locale}/dashboard`;

  const portalLabel = isAdmin
    ? (ar ? "لوحة الإدارة" : en ? "Admin Console" : "Console d’administration")
    : userProfileType === "parent"
      ? (ar ? "مساحة الولي" : en ? "Parent space" : "Espace parent")
      : userProfileType === "teacher"
        ? (ar ? "مساحة المكوّن" : en ? "Teacher space" : "Espace formateur")
        : userProfileType === "avs"
          ? (ar ? "مساحة المرافق" : en ? "AVS space" : "Espace AVS")
          : (ar ? "مساحتي التعليمية" : en ? "My learning" : "Mon espace");

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutFailed(false);
    const result = await authClient.signOut();
    if (result.error) {
      setLogoutFailed(true);
      setLoggingOut(false);
      return;
    }
    router.push(`/${locale}`);
    router.refresh();
  }
  return (
    <details className="account-actions account-menu desktop-action">
      <summary className="account-chip" aria-label={ar ? `قائمة حساب ${firstName}` : en ? `${firstName} account menu` : `Menu du compte de ${firstName}`}>
        <span>{initial}</span>
        <span>{firstName}</span>
        <Icon name="chevron" size={15} />
      </summary>
      <div className="account-menu-panel">
        {isAdmin ? (
          <Link href={`/${locale}/admin`}>
            <Icon name="shield" size={17} />
            {ar ? "لوحة الإدارة" : en ? "Admin Console" : "Console d’administration"}
          </Link>
        ) : (
          <>
            <Link href={portalPath}>
              <Icon name="graduation" size={17} />
              {portalLabel}
            </Link>
            <Link href={`/${locale}/dashboard/profil`}>
              <Icon name="user" size={17} />
              {ar ? "ملفي الشخصي" : en ? "My profile" : "Mon profil"}
            </Link>
            <Link href={`/${locale}/dashboard/notifications`}>
              <Icon name="bell" size={17} />
              {ar ? "الإشعارات" : en ? "Notifications" : "Notifications"}
            </Link>
          </>
        )}
        <button className="account-menu-signout" type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut}>
          <Icon name="arrow" size={16} />
          {loggingOut ? (ar ? "جارٍ الخروج..." : en ? "Signing out..." : "Déconnexion...") : (ar ? "تسجيل الخروج" : en ? "Sign out" : "Se déconnecter")}
        </button>
        {logoutFailed ? <span className="logout-error" role="alert">{ar ? "تعذر تسجيل الخروج." : en ? "Unable to sign out." : "Déconnexion impossible."}</span> : null}
      </div>
    </details>
  );
}
