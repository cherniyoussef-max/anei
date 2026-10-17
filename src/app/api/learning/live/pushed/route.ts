import { NextResponse } from "next/server";
import { getPushedLiveWebinars } from "@/server/queries/live";

export async function GET() {
  try {
    const pushed = await getPushedLiveWebinars();
    return NextResponse.json({ ok: true, sessions: pushed });
  } catch (_error) {
    return NextResponse.json({ error: "FETCH_FAILED", sessions: [] }, { status: 500 });
  }
}
