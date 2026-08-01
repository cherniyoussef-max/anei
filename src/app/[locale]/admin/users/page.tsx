import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminUsers } from "@/modules/admin/queries/admin-users";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminUserRole } from "@/components/admin/AdminUserRole";

export const dynamic = "force-dynamic";
function value(query: Record<string, string | string[] | undefined>, key: string) {
  return typeof query[key] === "string" ? query[key] as string : undefined;
}
export default async function AdminUsers({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const session = await requireAdminPermission(locale, "users.read");
  const query = await searchParams;
  const data = await getAdminUsers({
    q: value(query,"q"), role: value(query,"role"), provider: value(query,"provider"),
    status: value(query,"status"), sort: value(query,"sort"), direction: value(query,"direction"),
    page: Number(value(query,"page")), pageSize: Number(value(query,"pageSize")),
  });
  const ar = locale === "ar"; const canEdit = String(session.user.role) === "SUPER_ADMIN";
  const href = (page: number) => {
    const next = new URLSearchParams();
    for (const key of ["q","role","provider","status","sort","direction","pageSize"]) { const item=value(query,key); if(item) next.set(key,item); }
    next.set("page", String(page)); return `/${locale}/admin/users?${next}`;
  };
  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "الحسابات والوصول" : "Comptes & accès"}
      title={ar ? "المستخدمون" : "Utilisateurs"}
      description={ar ? `${data.total} حساب، مع ترقيم وتصفية على الخادم.` : `${data.total} comptes, paginés et filtrés côté serveur.`}/>
    <form className="admin-filter-panel" method="get" role="search">
      <label><span>{ar ? "البحث" : "Recherche"}</span><input name="q" defaultValue={data.filters.q} placeholder={ar ? "الاسم أو البريد الإلكتروني" : "Nom ou adresse e-mail"}/></label>
      <label><span>{ar ? "الدور" : "Rôle"}</span><select name="role" defaultValue={data.filters.role ?? ""}><option value="">{ar ? "الكل" : "Tous"}</option><option>USER</option><option>ADMIN</option><option>SUPER_ADMIN</option></select></label>
      <label><span>{ar ? "مزود الدخول" : "Connexion"}</span><select name="provider" defaultValue={data.filters.provider ?? ""}><option value="">{ar ? "الكل" : "Tous"}</option><option value="credential">Email</option><option value="google">Google</option></select></label>
      <label><span>{ar ? "النشاط" : "Activité"}</span><select name="status" defaultValue={data.filters.status ?? ""}><option value="">{ar ? "الكل" : "Tous"}</option><option value="active">{ar ? "نشط" : "Actif"}</option><option value="inactive">{ar ? "غير نشط" : "Inactif"}</option></select></label>
      <label><span>{ar ? "الترتيب" : "Tri"}</span><select name="sort" defaultValue={data.filters.sort}><option value="joined">{ar ? "تاريخ الانضمام" : "Date d’inscription"}</option><option value="name">{ar ? "الاسم" : "Nom"}</option><option value="email">Email</option><option value="role">{ar ? "الدور" : "Rôle"}</option><option value="activity">{ar ? "آخر نشاط" : "Dernière activité"}</option></select></label>
      <button className="admin-primary-button">{ar ? "تطبيق" : "Appliquer"}</button>
    </form>
    <div className="admin-table-surface">
      <div className="admin-table-scroll"><table className="admin-data-table">
        <thead><tr><th>{ar ? "المستخدم" : "Utilisateur"}</th><th>Email</th><th>{ar ? "الدور" : "Rôle"}</th><th>{ar ? "المزود" : "Connexion"}</th><th>{ar ? "آخر نشاط" : "Dernière activité"}</th><th>{ar ? "التسجيلات" : "Inscriptions"}</th><th>{ar ? "التقدم" : "Progression"}</th><th><span className="sr-only">{ar ? "إجراءات" : "Actions"}</span></th></tr></thead>
        <tbody>{data.items.map((item) => <tr key={item.id}>
          <td><Link className="admin-user-cell" href={`/${locale}/admin/users/${item.id}`}><span>{item.name.slice(0,2).toUpperCase()}</span><strong>{item.name}</strong></Link></td>
          <td>{item.email}</td><td><AdminUserRole userId={item.id} role={item.role} canEdit={canEdit}/></td>
          <td><span className="admin-provider">{item.provider === "google" ? "Google" : "Email"}</span></td>
          <td>{item.last_activity ? formatDate(item.last_activity,locale) : "—"}</td><td className="numeric">{item.enrollments}</td><td className="numeric">{item.completion}%</td>
          <td><Link className="admin-row-link" href={`/${locale}/admin/users/${item.id}`}>{ar ? "فتح" : "Ouvrir"}</Link></td>
        </tr>)}</tbody>
      </table></div>
      {!data.items.length ? <div className="admin-empty-state"><strong>{ar ? "لا توجد نتائج" : "Aucun résultat"}</strong><p>{ar ? "غيّر معايير البحث." : "Modifiez les critères de recherche."}</p></div> : null}
      <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
        <Link aria-disabled={data.page <= 1} tabIndex={data.page <= 1 ? -1 : undefined} href={href(Math.max(1,data.page-1))}>{ar ? "السابق" : "Précédent"}</Link>
        <span>{ar ? `صفحة ${data.page} من ${data.totalPages}` : `Page ${data.page} sur ${data.totalPages}`}</span>
        <Link aria-disabled={data.page >= data.totalPages} tabIndex={data.page >= data.totalPages ? -1 : undefined} href={href(Math.min(data.totalPages,data.page+1))}>{ar ? "التالي" : "Suivant"}</Link>
      </nav>
    </div>
  </>;
}
