import { notFound } from "next/navigation";
import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearnerNotifications } from "@/server/queries/account";
import { LearnerEmptyState, LearnerPageHeader } from "@/components/student/LearnerPages";

export const dynamic = "force-dynamic";
export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound(); const session = await requireUser(locale); const ar = locale === "ar"; const rows = await getLearnerNotifications(session.user.id);
  return <div className="learner-page"><LearnerPageHeader title={ar ? "الإشعارات" : "Notifications"} description={ar ? "آخر التحديثات المرتبطة بحسابك ومسارك التعليمي." : "Les dernières informations liées à votre compte et à votre parcours."} />{rows.length ? <div className="learner-notification-list">{rows.map((row) => <article className={row.read ? undefined : "is-unread"} key={row.id}><span aria-hidden="true"><Bell size={19} strokeWidth={1.75} /></span><div><h2>{row.title}</h2><p>{row.body}</p><small>{formatDate(row.createdAt, locale)}</small></div>{row.href ? <Link href={row.href}><span>{ar ? "فتح" : "Ouvrir"}</span><ArrowRight className="student-directional-icon" size={16} strokeWidth={1.75} /></Link> : null}</article>)}</div> : <LearnerEmptyState icon={Bell} title={ar ? "لا توجد إشعارات" : "Aucune notification"} body={ar ? "ستظهر هنا المعلومات المهمة المتعلقة بحسابك." : "Les informations importantes liées à votre compte apparaîtront ici."} />}</div>;
}
