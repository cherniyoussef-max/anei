import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor } from "@/server/auth/admin";
import { getInvitation, getInvitationEvents } from "@/server/queries/invitations";

const schema = z.object({
  organizationId: z.string().uuid(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const url = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const invitation = await getInvitation(parsed.data.organizationId, id);
  if (!invitation) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const events = await getInvitationEvents(id);
  return NextResponse.json({ invitation, events });
}