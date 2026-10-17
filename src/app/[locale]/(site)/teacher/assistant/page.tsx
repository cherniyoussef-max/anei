import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { TeacherAssistantWorkspace } from "@/components/ai/TeacherAssistantWorkspace";

export const dynamic = "force-dynamic";

export default async function TeacherAssistantPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requireActivePersona(locale, "TEACHER");

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
      <TeacherAssistantWorkspace
        locale={locale as "fr" | "ar"}
        userName={session.user.name}
      />
    </div>
  );
}
