import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Download, Search } from "lucide-react";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearnerResourcesPage } from "@/server/queries/account";
import { LearnerEmptyState, LearnerPageHeader } from "@/components/student/LearnerPages";

export const dynamic = "force-dynamic";

export default async function LearnerResourcesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; type?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const input = await searchParams;
  const q = input.q?.trim().slice(0, 80).toLocaleLowerCase(locale) ?? "";
  const type = input.type?.trim().slice(0, 40) ?? "";
  const rows = await getLearnerResourcesPage(session.user.id);
  const types = [...new Set(rows.map(({ resource }) => resource.type))];
  const visible = rows.filter(({ resource }) => (!q || `${resource.titleFr} ${resource.titleAr} ${resource.descriptionFr} ${resource.descriptionAr}`.toLocaleLowerCase(locale).includes(q)) && (!type || resource.type === type));

  return <div className="learner-page"><LearnerPageHeader title={ar ? "مواردي" : "Mes ressources"} description={ar ? "ابحث في الوثائق والأدوات التي يتيحها لك حسابك." : "Retrouvez les documents et outils auxquels votre compte donne accès."} action={<Link className="student-secondary-action" href={`/${locale}/bibliotheque`}>{ar ? "عرض المكتبة" : "Voir la bibliothèque"}</Link>} />
    {rows.length ? <><form className="learner-filter-bar" method="get"><label><span>{ar ? "البحث" : "Rechercher"}</span><input name="q" defaultValue={input.q ?? ""} maxLength={80} placeholder={ar ? "عنوان المورد" : "Titre de la ressource"} /></label><label><span>{ar ? "النوع" : "Type"}</span><select name="type" defaultValue={type}><option value="">{ar ? "كل الأنواع" : "Tous les types"}</option>{types.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><button className="student-primary-action" type="submit">{ar ? "تصفية" : "Filtrer"}</button></form>
      {visible.length ? <div className="learner-resource-list">{visible.map(({ purchase, resource }) => <article key={resource.id}><span className="learner-resource-icon" aria-hidden="true"><BookOpen size={21} strokeWidth={1.75} /></span><div><span className="learner-object-meta">{resource.type}</span><h2>{ar ? resource.titleAr : resource.titleFr}</h2><p>{ar ? resource.descriptionAr : resource.descriptionFr}</p><small>{ar ? "متاح منذ" : "Disponible depuis le"} {formatDate(purchase.grantedAt, locale)}</small></div><a className="student-secondary-action" href={`/api/resources/${resource.id}/download`}><Download size={17} strokeWidth={1.75} />{ar ? "تحميل" : "Télécharger"}</a></article>)}</div> : <LearnerEmptyState icon={Search} title={ar ? "لا توجد نتيجة" : "Aucun résultat"} body={ar ? "غيّر كلمات البحث أو نوع المورد." : "Modifiez la recherche ou le type de ressource."} action={{ href: `/${locale}/dashboard/ressources`, label: ar ? "إعادة الضبط" : "Réinitialiser" }} />}</> : <LearnerEmptyState icon={BookOpen} title={ar ? "لا توجد موارد بعد" : "Aucune ressource pour le moment"} body={ar ? "ستظهر هنا الموارد التي تشتريها أو تحصل عليها ضمن دوراتك." : "Les ressources achetées ou obtenues avec vos formations apparaîtront ici."} action={{ href: `/${locale}/bibliotheque`, label: ar ? "استكشف المكتبة" : "Explorer la bibliothèque" }} />}
  </div>;
}
