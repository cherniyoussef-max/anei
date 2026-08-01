"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { authClient, useSession } from "@/lib/auth-client";
import { Icon } from "@/components/ui/Icon";

export function AccountActions({ locale }: { locale: Locale }) {
  const { data, isPending } = useSession();
  const router = useRouter();
  const ar = locale === "ar";
  if (isPending) return <><Link className="btn btn-ghost btn-sm desktop-action" href={`/${locale}/login`}>{ar ? "تسجيل الدخول" : "Se connecter"}</Link><Link className="btn btn-primary btn-sm desktop-action" href={`/${locale}/register`}>{ar ? "إنشاء حساب" : "Créer un compte"}</Link></>;
  if (!data?.user) return <><Link className="btn btn-ghost btn-sm desktop-action" href={`/${locale}/login`}>{ar ? "تسجيل الدخول" : "Se connecter"}</Link><Link className="btn btn-primary btn-sm desktop-action" href={`/${locale}/register`}>{ar ? "إنشاء حساب" : "Créer un compte"}</Link></>;

  const initial = data.user.name?.trim().charAt(0).toUpperCase() || "U";
  async function logout() {
    await authClient.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }
  return <div className="account-actions desktop-action"><Link className="account-chip" href={`/${locale}/dashboard`}><span>{initial}</span><span>{data.user.name}</span></Link><button className="icon-button logout-button" type="button" onClick={logout} aria-label={ar ? "تسجيل الخروج" : "Se déconnecter"}><Icon name="arrow" size={18}/></button></div>;
}
