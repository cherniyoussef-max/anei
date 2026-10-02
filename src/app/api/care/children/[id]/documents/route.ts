import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getSharedDocumentsForChild } from "@/server/queries/care-notes-documents";

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
  const docs = await getSharedDocumentsForChild(childId, session.user.id);

  if (!docs) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, documents: docs });
}
