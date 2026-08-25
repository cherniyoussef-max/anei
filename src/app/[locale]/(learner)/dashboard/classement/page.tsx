import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLeaderboard, getPointsBalance } from "@/server/services/points";
import { LearnerPageHeader, LearnerEmptyState } from "@/components/student/LearnerPages";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const [rows, myBalance] = await Promise.all([getLeaderboard(50), getPointsBalance(session.user.id)]);

  return <div className="learner-page">
    <LearnerPageHeader title={ar ? "الترتيب" : "Classement"} description={ar ? "الترتيب حسب مجموع النقاط المكتسبة من الدروس والاختبارات." : "Classement selon le total de points gagnés en terminant leçons, formations et quiz."} />
    <div className="student-continue-card">
      <div><small>{ar ? "رصيدك الحالي" : "Votre solde actuel"}</small><strong>{myBalance} pts</strong></div>
    </div>
    {rows.length ? <div className="admin-table-surface"><div className="admin-table-scroll"><table className="admin-data-table">
      <thead><tr><th>#</th><th>{ar ? "المتعلم" : "Apprenant"}</th><th>{ar ? "النقاط" : "Points"}</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.userId} className={row.userId === session.user.id ? "is-current-user" : undefined}>
        <td>{index + 1}</td>
        <td>{row.displayName}</td>
        <td className="numeric">{row.total}</td>
      </tr>)}</tbody>
    </table></div></div> : <LearnerEmptyState icon="award" title={ar ? "لا يوجد ترتيب بعد" : "Aucun classement pour le moment"} body={ar ? "أكمل دروسًا واختبارات لتظهر في الترتيب." : "Terminez des leçons et des quiz pour apparaître dans le classement."} />}
  </div>;
}
