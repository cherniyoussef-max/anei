import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { StudentShell } from "@/components/student/StudentShell";
import { getUnreadNotificationCount } from "@/server/queries/account";
import { getPointsBalance } from "@/server/services/points";
import { env } from "@/server/env";
import "./dashboard/student-dashboard.css";

export default async function LearnerLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const [notificationCount, pointsBalance] = await Promise.all([
    getUnreadNotificationCount(session.user.id),
    getPointsBalance(session.user.id),
  ]);

  return (
    <StudentShell locale={locale} user={{ name: session.user.name, email: session.user.email }} pointsBalance={pointsBalance} notificationCount={notificationCount} assistantEnabled={Boolean(env.OPENAI_API_KEY)}>
      <main id="main-content" tabIndex={-1}>{children}</main>
    </StudentShell>
  );
}
