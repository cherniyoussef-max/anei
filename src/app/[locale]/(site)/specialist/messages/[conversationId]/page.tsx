import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getCareConversationsForUser } from "@/server/queries/care-messaging";
import { CareMessagingWorkspace } from "@/components/care/CareMessagingWorkspace";

export const dynamic = "force-dynamic";

export default async function SpecialistConversationPage({
  params,
}: {
  params: Promise<{ locale: string; conversationId: string }>;
}) {
  const { locale, conversationId } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requireActivePersona(locale, "SPECIALIST");
  const conversations = await getCareConversationsForUser(session.user.id);

  return (
    <div className="space-y-4">
      <CareMessagingWorkspace
        locale={locale}
        initialConversations={conversations}
        initialSelectedId={conversationId}
        role="SPECIALIST"
      />
    </div>
  );
}
