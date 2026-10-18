import { NextResponse } from "next/server";
import { getPushedLiveWebinars } from "@/server/queries/live";

export async function GET() {
  try {
    const pushed = await getPushedLiveWebinars();
    return NextResponse.json(
      { ok: true, sessions: pushed },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (_error) {
    return NextResponse.json({ error: "FETCH_FAILED", sessions: [] }, { status: 500 });
  }
}
