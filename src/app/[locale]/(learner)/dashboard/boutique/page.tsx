import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { rewardItem } from "@/server/db/schema";
import { getPointsBalance } from "@/server/services/points";
import { LearnerPageHeader, LearnerEmptyState } from "@/components/student/LearnerPages";
import { RewardRedeemButton } from "@/components/student/RewardRedeemButton";

export const dynamic = "force-dynamic";

export default async function RewardShopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const [items, balance] = await Promise.all([
    db.select().from(rewardItem).where(eq(rewardItem.published, true)).orderBy(desc(rewardItem.createdAt)).limit(60),
    getPointsBalance(session.user.id),
  ]);

  return <div className="learner-page">
    <LearnerPageHeader title={ar ? "متجر المكافآت" : "Boutique de récompenses"} description={ar ? "استبدل نقاطك المكتسبة بمكافآت." : "Échangez vos points gagnés contre des récompenses."} />
    <div className="student-continue-card"><div><small>{ar ? "رصيدك الحالي" : "Votre solde actuel"}</small><strong>{balance} pts</strong></div></div>
    {items.length ? <div className="resource-grid">{items.map((item) => {
      const affordable = balance >= item.costPoints && (item.stock === null || item.stock > 0);
      return <div className="resource-card" key={item.id}>
        <div className="resource-card-body">
          <h3>{ar ? item.titleAr : item.titleFr}</h3>
          <p>{ar ? item.descriptionAr : item.descriptionFr}</p>
          <div className="resource-meta-row">
            <strong>{item.costPoints} pts</strong>
            <span className="resource-level">{item.stock === null ? (ar ? "غير محدود" : "Illimité") : `${item.stock} ${ar ? "متبقي" : "restant(s)"}`}</span>
          </div>
          <RewardRedeemButton locale={locale} rewardId={item.id} affordable={affordable} />
        </div>
      </div>;
    })}</div> : <LearnerEmptyState icon="award" title={ar ? "لا توجد مكافآت بعد" : "Aucune récompense pour le moment"} body={ar ? "عد قريبًا لاكتشاف مكافآت جديدة." : "Revenez bientôt pour découvrir de nouvelles récompenses."} />}
  </div>;
}
