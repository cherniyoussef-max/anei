import { NextResponse } from "next/server";
import { getFreshSession } from "@/server/auth/session";
import { getLiveSessionsForLearner } from "@/server/queries/live";

export async function GET() {
  const session = await getFreshSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const sessions = await getLiveSessionsForLearner(session.user.id);
    return NextResponse.json({ ok: true, webinars: sessions });
  } catch (_error) {
    return NextResponse.json({ error: "FETCH_FAILED" }, { status: 500 });
  }
}
