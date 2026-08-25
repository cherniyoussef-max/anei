import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearnerNotifications } from "@/server/queries/account";
import { LearnerEmptyState, LearnerPageHeader } from "@/components/student/LearnerPages";
import { Icon } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";
export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound(); const session = await requireUser(locale); const ar = locale === "ar"; const rows = await getLearnerNotifications(session.user.id);
  return <div className="learner-page"><LearnerPageHeader title={ar ? "الإشعارات" : "Notifications"} description={ar ? "آخر التحديثات المرتبطة بحسابك ومسارك التعليمي." : "Les dernières informations liées à votre compte et à votre parcours."} />{rows.length ? <div className="learner-notification-list">{rows.map((row) => <article className={row.read ? undefined : "is-unread"} key={row.id}><span aria-hidden="true"><Icon name="bell" size={19} /></span><div><h2>{row.title}</h2><p>{row.body}</p><small>{formatDate(row.createdAt, locale)}</small></div>{row.href ? <Link href={row.href}><span>{ar ? "فتح" : "Ouvrir"}</span><Icon className="student-directional-icon" name="arrow" size={16} /></Link> : null}</article>)}</div> : <LearnerEmptyState icon="bell" title={ar ? "لا توجد إشعارات" : "Aucune notification"} body={ar ? "ستظهر هنا المعلومات المهمة المتعلقة بحسابك." : "Les informations importantes liées à votre compte apparaîtront ici."} />}</div>;
}
