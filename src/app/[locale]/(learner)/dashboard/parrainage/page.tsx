import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getOrCreateReferralCode, getReferralConversions } from "@/server/services/referrals";
import { LearnerPageHeader, LearnerEmptyState } from "@/components/student/LearnerPages";
import { ReferralLinkCard } from "@/components/student/ReferralLinkCard";

export const dynamic = "force-dynamic";

export default async function ReferralPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const [code, conversions] = await Promise.all([getOrCreateReferralCode(session.user.id), getReferralConversions(session.user.id)]);
  const rewarded = conversions.filter((row) => row.status === "REWARDED").length;

  return <div className="learner-page">
    <LearnerPageHeader title={ar ? "الإحالة" : "Parrainage"} description={ar ? "شارك رابطك واكسب نقاطًا عند انضمام من تدعوهم." : "Partagez votre lien et gagnez des points lorsque vos invités rejoignent la plateforme."} />
    <ReferralLinkCard locale={locale} code={code} />
    {conversions.length ? <div className="admin-table-surface"><div className="admin-table-scroll"><table className="admin-data-table">
      <thead><tr><th>{ar ? "المدعو" : "Invité(e)"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "الحالة" : "Statut"}</th></tr></thead>
      <tbody>{conversions.map((row) => <tr key={row.id}>
        <td>{row.referredName}</td>
        <td>{formatDate(row.createdAt, locale)}</td>
        <td>{row.status === "REWARDED" ? (ar ? "تمت المكافأة" : "Récompensé") : (ar ? "قيد الانتظار" : "En attente")}</td>
      </tr>)}</tbody>
    </table></div><p className="admin-help">{ar ? `${rewarded} إحالة مكافأة من أصل ${conversions.length}.` : `${rewarded} parrainage(s) récompensé(s) sur ${conversions.length}.`}</p></div>
      : <LearnerEmptyState icon="users" title={ar ? "لم تتم أي إحالة بعد" : "Aucun parrainage pour le moment"} body={ar ? "شارك رابطك مع من قد يستفيد من المنصة." : "Partagez votre lien avec des personnes qui pourraient bénéficier de la plateforme."} />}
  </div>;
}
