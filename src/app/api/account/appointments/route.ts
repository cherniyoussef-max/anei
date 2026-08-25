import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getSessionAssurance } from "@/server/auth/assurance";
import { bookLearnerAppointment } from "@/server/services/learner-appointments";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({ ruleId: z.string().uuid(), startAt: z.string().datetime() }).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await getSessionAssurance(session.session.id))) return NextResponse.json({ error: "ASSURANCE_REQUIRED" }, { status: 403 });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const result = await bookLearnerAppointment(session.user.id, parsed.data.ruleId, new Date(parsed.data.startAt));
  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind !== "ok") return NextResponse.json({ error: "SLOT_UNAVAILABLE" }, { status: 409 });
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
