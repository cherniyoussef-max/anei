import { NextResponse } from "next/server";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { cancelAvailabilityRule } from "@/server/services/learner-appointments";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("availability.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const { id } = await params;
  const result = await cancelAvailabilityRule(session.user.id, id);
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
