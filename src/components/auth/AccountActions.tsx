"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/types";
import { authClient, useSession } from "@/lib/auth-client";
import { Icon } from "@/components/ui/Icon";

export function AccountActions({ locale }: { locale: Locale }) {
  const { data, isPending } = useSession();
  const router = useRouter();
  const ar = locale === "ar";
  const en = locale === "en";
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  if (isPending) return <><Link className="btn btn-ghost btn-sm desktop-action" href={`/${locale}/login`}>{ar ? "تسجيل الدخول" : en ? "Sign in" : "Se connecter"}</Link><Link className="btn btn-primary btn-sm desktop-action" href={`/${locale}/register`}>{ar ? "إنشاء حساب" : en ? "Create account" : "Créer un compte"}</Link></>;
  if (!data?.user) return <><Link className="btn btn-ghost btn-sm desktop-action" href={`/${locale}/login`}>{ar ? "تسجيل الدخول" : en ? "Sign in" : "Se connecter"}</Link><Link className="btn btn-primary btn-sm desktop-action" href={`/${locale}/register`}>{ar ? "إنشاء حساب" : en ? "Create account" : "Créer un compte"}</Link></>;

  const firstName = data.user.name?.trim().split(/\s+/)[0] || (ar ? "حسابي" : en ? "Account" : "Compte");
  const initial = firstName.charAt(0).toLocaleUpperCase(locale);
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(data.user.role));
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
  return <details className="account-actions account-menu desktop-action"><summary className="account-chip" aria-label={ar ? `قائمة حساب ${firstName}` : en ? `${firstName} account menu` : `Menu du compte de ${firstName}`}><span>{initial}</span><span>{firstName}</span><Icon name="chevron" size={15}/></summary><div className="account-menu-panel">{isAdmin ? <Link href={`/${locale}/admin`}><Icon name="shield" size={17}/>{ar ? "لوحة الإدارة" : en ? "Admin Console" : "Console d’administration"}</Link> : <><Link href={`/${locale}/dashboard`}><Icon name="graduation" size={17}/>{ar ? "مساحتي التعليمية" : en ? "My learning" : "Mon espace"}</Link><Link href={`/${locale}/dashboard/profil`}><Icon name="user" size={17}/>{ar ? "ملفي الشخصي" : en ? "My profile" : "Mon profil"}</Link><Link href={`/${locale}/dashboard/notifications`}><Icon name="bell" size={17}/>{ar ? "الإشعارات" : en ? "Notifications" : "Notifications"}</Link></>}<button className="account-menu-signout" type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut}><Icon name="arrow" size={16}/>{loggingOut ? (ar ? "جارٍ الخروج..." : en ? "Signing out..." : "Déconnexion...") : (ar ? "تسجيل الخروج" : en ? "Sign out" : "Se déconnecter")}</button>{logoutFailed ? <span className="logout-error" role="alert">{ar ? "تعذر تسجيل الخروج." : en ? "Unable to sign out." : "Déconnexion impossible."}</span> : null}</div></details>;
}
