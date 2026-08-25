import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { searchGlobalCrmContacts } from "@/server/queries/crm";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function AdminCrmOrganizationsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : undefined;
  const page = typeof query.page === "string" ? Number(query.page) : 1;
  const data = await searchGlobalCrmContacts(q ?? "", page);
  const href = (p: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(p));
    return `/${locale}/admin/crm?${next}`;
  };

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "إدارة العملاء" : "CRM"}
      title={ar ? "مركز جهات الاتصال" : "Centre de contacts"}
      description={ar ? "ابحث عن متعلم بالاسم أو البريد أو الهاتف أو المرجع أو المؤسسة." : "Retrouvez un apprenant par nom, e-mail, téléphone, référence ou organisation."} />
    <form className="admin-filter-panel" method="get" role="search">
      <label><span>{ar ? "البحث العام" : "Recherche globale"}</span><input name="q" defaultValue={q} placeholder={ar ? "الاسم، البريد، الهاتف، المؤسسة…" : "Nom, e-mail, téléphone, organisation…"} /></label>
      <button className="admin-primary-button">{ar ? "بحث" : "Rechercher"}</button>
    </form>
    <div className="admin-list">
      {data.items.map((contact) => (
        <article key={contact.id}>
          <div><strong>{contact.firstName} {contact.lastName}</strong><small>{contact.email ?? "—"} · {contact.organizationName} · {contact.persona ?? (ar ? "غير محدد" : "Non défini")}</small></div>
          <Link className="admin-row-link" href={`/${locale}/admin/crm/${contact.organizationId}/contacts/${contact.id}`}>{ar ? "فتح الملف" : "Ouvrir la fiche"}</Link>
        </article>
      ))}
      {!q ? (
        <div className="admin-empty-state">
          <strong>{ar ? "ابدأ ببحث" : "Commencez par une recherche"}</strong>
          <p>{ar ? "أدخل معلومة واحدة على الأقل لعرض جهات الاتصال." : "Saisissez au moins un critère pour afficher les contacts."}</p>
        </div>
      ) : !data.items.length ? <div className="admin-empty-state"><strong>{ar ? "لا توجد نتيجة" : "Aucun résultat"}</strong><p>{ar ? "تحقق من الكتابة أو جرّب معياراً آخر." : "Vérifiez l’orthographe ou essayez un autre critère."}</p></div> : null}
      {q ? <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
        <Link aria-disabled={data.page <= 1} tabIndex={data.page <= 1 ? -1 : undefined} href={href(Math.max(1, data.page - 1))}>{ar ? "السابق" : "Précédent"}</Link>
        <span>{ar ? `صفحة ${data.page} من ${data.totalPages}` : `Page ${data.page} sur ${data.totalPages}`}</span>
        <Link aria-disabled={data.page >= data.totalPages} tabIndex={data.page >= data.totalPages ? -1 : undefined} href={href(Math.min(data.totalPages, data.page + 1))}>{ar ? "التالي" : "Suivant"}</Link>
      </nav> : null}
    </div>
  </>;
}
