import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getSessionAssurance } from "@/server/auth/assurance";
import { cancelLearnerAppointment } from "@/server/services/learner-appointments";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`appointment-cancel:${session.user.id}`, 20, 60);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  if (!(await getSessionAssurance(session.session.id))) return NextResponse.json({ error: "ASSURANCE_REQUIRED" }, { status: 403 });
  const id = z.string().uuid().safeParse((await params).id); if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const result = await cancelLearnerAppointment(session.user.id, id.data);
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (result.kind !== "ok") return NextResponse.json({ error: "INVALID_TRANSITION" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
