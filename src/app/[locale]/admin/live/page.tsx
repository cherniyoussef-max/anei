import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { courses } from "@/server/db/schema";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getLiveSessionsForAdmin } from "@/server/queries/live";
import { AdminLiveManager } from "@/components/admin/AdminLiveManager";
import type { Locale } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminLivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requireAdminPermission(locale, "live.manage");

  const [initialSessions, coursesList] = await Promise.all([
    getLiveSessionsForAdmin(),
    db
      .select({
        id: courses.id,
        titleFr: courses.titleFr,
        titleAr: courses.titleAr,
      })
      .from(courses)
      .where(eq(courses.published, true)),
  ]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1rem" }}>
      <AdminLiveManager
        locale={locale as Locale}
        initialSessions={initialSessions}
        courses={coursesList}
        userRole={String(session.user.role)}
      />
    </div>
  );
}
