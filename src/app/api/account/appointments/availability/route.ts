import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getSessionAssurance } from "@/server/auth/assurance";
import { getLearnerAvailability, MAX_WINDOW_DAYS } from "@/server/services/learner-appointments";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await getSessionAssurance(session.session.id))) return NextResponse.json({ error: "ASSURANCE_REQUIRED" }, { status: 403 });
  const url = new URL(request.url); const from = new Date(url.searchParams.get("from") ?? ""); const to = new Date(url.searchParams.get("to") ?? "");
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > MAX_WINDOW_DAYS * 86_400_000) return NextResponse.json({ error: "INVALID_RANGE" }, { status: 400 });
  return NextResponse.json({ slots: await getLearnerAvailability(session.user.id, from, to), timezone: "Africa/Tunis" });
}
