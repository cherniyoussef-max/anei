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
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  if (isPending) return <><Link className="btn btn-ghost btn-sm desktop-action" href={`/${locale}/login`}>{ar ? "تسجيل الدخول" : "Se connecter"}</Link><Link className="btn btn-primary btn-sm desktop-action" href={`/${locale}/register`}>{ar ? "إنشاء حساب" : "Créer un compte"}</Link></>;
  if (!data?.user) return <><Link className="btn btn-ghost btn-sm desktop-action" href={`/${locale}/login`}>{ar ? "تسجيل الدخول" : "Se connecter"}</Link><Link className="btn btn-primary btn-sm desktop-action" href={`/${locale}/register`}>{ar ? "إنشاء حساب" : "Créer un compte"}</Link></>;

  const initial = data.user.name?.trim().charAt(0).toUpperCase() || "U";
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
  return <div className="account-actions desktop-action"><Link className="account-chip" href={`/${locale}/dashboard`}><span>{initial}</span><span>{data.user.name}</span></Link><button className="btn btn-ghost btn-sm logout-button" type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut}><Icon name="arrow" size={16}/><span>{loggingOut ? (ar ? "جارٍ الخروج..." : "Déconnexion…") : (ar ? "تسجيل الخروج" : "Se déconnecter")}</span></button>{logoutFailed ? <span className="logout-error" role="alert">{ar ? "تعذر تسجيل الخروج." : "Déconnexion impossible."}</span> : null}</div>;
}
