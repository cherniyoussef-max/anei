import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { courses } from "@/server/db/schema";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getLiveSessionsForAdmin } from "@/server/queries/live";
import { AdminLiveManager } from "@/components/admin/AdminLiveManager";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";
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
    <div className="space-y-6">
      <AdminLiveManager
        locale={locale as Locale}
        initialSessions={initialSessions}
        courses={coursesList}
        userRole={String(session.user.role)}
      />
      <AdminFooter locale={locale as Locale} />
    </div>
  );
}
