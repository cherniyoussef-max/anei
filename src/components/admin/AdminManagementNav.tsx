import Link from "next/link";
import type { Locale } from "@/types";

export function AdminManagementNav({ locale, active }: { locale: Locale; active: "dashboard" | "users" | "orders" | "audit" }) {
  const ar = locale === "ar";
  const links = [
    ["dashboard", `/${locale}/admin`, ar ? "نظرة عامة" : "Vue d’ensemble"],
    ["users", `/${locale}/admin/utilisateurs`, ar ? "المستخدمون" : "Utilisateurs"],
    ["orders", `/${locale}/admin/commandes`, ar ? "الطلبات" : "Commandes"],
    ["audit", `/${locale}/admin/audit`, ar ? "سجل التدقيق" : "Journal d’audit"],
  ] as const;
  return <nav className="admin-management-nav" aria-label={ar ? "إدارة المنصة" : "Gestion de la plateforme"}>
    {links.map(([key, href, label]) => <Link className={active === key ? "active" : ""} href={href} key={key}>{label}</Link>)}
  </nav>;
}
