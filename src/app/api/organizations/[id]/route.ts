import { NextResponse } from "next/server";
import { z } from "zod";
import { getFreshSession } from "@/server/auth/session";
import { getOwnOrganizationMembership } from "@/server/queries/organizations";

const idSchema = z.string().uuid();

/** Self-service: returns the caller's own membership for an organization, never another user's. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getFreshSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const membership = await getOwnOrganizationMembership(session.user.id, id.data);
  if (!membership) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ membership });
}
