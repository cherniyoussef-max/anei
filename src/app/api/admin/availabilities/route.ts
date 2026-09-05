import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { createAvailabilityRules, listAdminAvailabilityRules } from "@/server/services/learner-appointments";

const schema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  specificDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  durationMinutes: z.number().int().min(15).max(240),
  type: z.enum(["ASSESSMENT", "INFO_MEETING", "FOLLOW_UP", "OTHER"]),
  sessionType: z.enum(["INDIVIDUAL", "GROUP"]),
  capacity: z.number().int().min(1).max(200),
}).strict().refine((value) => Boolean(value.specificDate) !== Boolean(value.weekdays?.length), {
  message: "Provide either specificDate or weekdays, not both.",
}).refine((value) => value.endMinute > value.startMinute, { message: "endMinute must be after startMinute" });

export async function GET() {
  const session = await getAdminSessionFor("availability.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rules = await listAdminAvailabilityRules(session.user.id);
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("availability.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  const result = await createAvailabilityRules(session.user.id, parsed.data);
  if (result.kind === "no_organization") return NextResponse.json({ error: "NO_ORGANIZATION" }, { status: 409 });
  if (result.kind === "conflict") return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
  if (result.kind !== "ok") return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  return NextResponse.json({ rules: result.rules }, { status: 201 });
}
