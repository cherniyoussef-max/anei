import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdmin } from "@/server/auth/session";
import { searchAuditLogs } from "@/server/queries/admin";
import { AdminManagementNav } from "@/components/admin/AdminManagementNav";
import { Pagination } from "@/components/ui/Pagination";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound(); await requireAdmin(locale); const query = await searchParams; const q = typeof query.q === "string" ? query.q : undefined; const page = typeof query.page === "string" ? Number(query.page) : 1; const data = await searchAuditLogs({ q, page }); const ar = locale === "ar";
  return <section className="admin-section"><div className="container admin-management-page"><AdminManagementNav locale={locale} active="audit"/><header className="management-head"><div><span className="eyebrow">Security</span><h1>{ar ? "سجل التدقيق" : "Journal d’audit"}</h1><p>{ar ? "سجل العمليات الحساسة والإدارية." : "Traçabilité des opérations sensibles et administratives."}</p></div></header><form className="admin-filter-bar" method="get"><input name="q" defaultValue={q} placeholder={ar ? "الإجراء أو الكيان" : "Action ou entité"}/><button className="btn btn-secondary">{ar ? "بحث" : "Rechercher"}</button></form><div className="admin-panel wide"><div className="admin-table"><div className="admin-table-row admin-audit-row header"><span>{ar ? "الإجراء" : "Action"}</span><span>{ar ? "الكيان" : "Entité"}</span><span>{ar ? "الممثل" : "Acteur"}</span><span>{ar ? "التاريخ" : "Date"}</span></div>{data.items.map(item=><div className="admin-table-row admin-audit-row" key={item.id}><span>{item.action}</span><span>{item.entityType}{item.entityId?` · ${item.entityId.slice(0,8)}`:""}</span><span className="mono">{item.actorUserId?.slice(0,8) ?? "system"}</span><span>{formatDate(item.createdAt,locale)}</span></div>)}</div></div><Pagination locale={locale} basePath={`/${locale}/admin/audit`} page={data.page} totalPages={data.totalPages} params={{ q }}/></div></section>;
}
