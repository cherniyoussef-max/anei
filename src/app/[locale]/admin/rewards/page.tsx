import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { rewardItem } from "@/server/db/schema";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminRewardForm } from "@/components/admin/AdminRewardForm";
import { AdminRewardRow } from "@/components/admin/AdminRewardRow";

export const dynamic = "force-dynamic";

export default async function AdminRewardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "rewards.manage");
  const ar = locale === "ar";
  const items = await db.select().from(rewardItem).orderBy(desc(rewardItem.createdAt)).limit(100);

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "التحفيز" : "Gamification"}
      title={ar ? "متجر المكافآت" : "Boutique de récompenses"}
      description={ar ? `${items.length} مكافأة. يمكن للمتعلمين استبدال نقاطهم بها.` : `${items.length} récompenses. Les apprenants peuvent les échanger contre leurs points.`} />
    <section className="admin-surface">
      <h2>{ar ? "إضافة مكافأة جديدة" : "Ajouter une nouvelle récompense"}</h2>
      <AdminRewardForm locale={locale} />
    </section>
    <div className="admin-table-surface">
      <div className="admin-table-scroll"><table className="admin-data-table">
        <thead><tr><th>{ar ? "العنوان" : "Titre"}</th><th>{ar ? "التكلفة" : "Coût"}</th><th>{ar ? "المخزون" : "Stock"}</th><th>{ar ? "الحالة" : "Statut"}</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{items.map((item) => <AdminRewardRow key={item.id} locale={locale} reward={item} />)}</tbody>
      </table></div>
      {!items.length ? <div className="admin-empty-state"><strong>{ar ? "لا توجد مكافآت بعد" : "Aucune récompense pour le moment"}</strong></div> : null}
    </div>
  </>;
}
