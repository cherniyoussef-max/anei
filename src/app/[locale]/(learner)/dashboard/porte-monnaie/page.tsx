import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getPointsBalance, getPointsLedgerPage } from "@/server/services/points";
import { LearnerPageHeader, LearnerEmptyState } from "@/components/student/LearnerPages";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, { fr: string; ar: string }> = {
  LESSON_COMPLETE: { fr: "Leçon terminée", ar: "درس مكتمل" },
  COURSE_COMPLETE: { fr: "Formation terminée", ar: "دورة مكتملة" },
  QUIZ_PASSED: { fr: "Quiz réussi", ar: "اجتياز اختبار" },
  REFERRAL_BONUS: { fr: "Bonus de parrainage", ar: "مكافأة الإحالة" },
  REWARD_REDEMPTION: { fr: "Échange boutique", ar: "استبدال من المتجر" },
  ADMIN_ADJUSTMENT: { fr: "Ajustement", ar: "تعديل" },
};

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const [balance, ledger] = await Promise.all([getPointsBalance(session.user.id), getPointsLedgerPage(session.user.id, 1, 50)]);

  return <div className="learner-page">
    <LearnerPageHeader title={ar ? "محفظتي" : "Mon porte-monnaie"} description={ar ? "رصيد نقاطك وتاريخ الحركات." : "Votre solde de points et l’historique des mouvements."} />
    <div className="student-continue-card"><div><small>{ar ? "الرصيد الحالي" : "Solde actuel"}</small><strong>{balance} pts</strong></div></div>
    {ledger.length ? <div className="admin-table-surface"><div className="admin-table-scroll"><table className="admin-data-table">
      <thead><tr><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "السبب" : "Motif"}</th><th>{ar ? "النقاط" : "Points"}</th></tr></thead>
      <tbody>{ledger.map((row) => <tr key={row.id}>
        <td>{formatDate(row.createdAt, locale)}</td>
        <td>{ar ? (REASON_LABEL[row.reason]?.ar ?? row.reason) : (REASON_LABEL[row.reason]?.fr ?? row.reason)}</td>
        <td className={row.delta >= 0 ? "numeric success-inline" : "numeric form-error"}>{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
      </tr>)}</tbody>
    </table></div></div> : <LearnerEmptyState icon="chart" title={ar ? "لا توجد حركات بعد" : "Aucun mouvement pour le moment"} body={ar ? "أكمل دروسًا واختبارات لكسب نقاطك الأولى." : "Terminez des leçons et des quiz pour gagner vos premiers points."} />}
  </div>;
}
