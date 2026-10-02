import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getChildCareTeam } from "@/server/queries/care-notes-documents";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });

  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id: childId } = await params;
  const team = await getChildCareTeam(childId, session.user.id);

  if (!team) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, careTeam: team });
}
