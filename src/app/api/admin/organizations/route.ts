import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { listOrganizations } from "@/server/queries/organizations";
import { createOrganization } from "@/server/services/organizations";

const schema = z
  .object({
    name: z.string().trim().min(2).max(180),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).min(2).max(120),
    ownerUserId: z.string().uuid(),
  })
  .strict();

export async function GET() {
  const session = await getAdminSessionFor("organizations.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const organizations = await listOrganizations();
  return NextResponse.json({ organizations });
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("organizations.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const org = await createOrganization(session.user.id, { name: parsed.data.name, slug: parsed.data.slug }, parsed.data.ownerUserId);
    return NextResponse.json({ organization: org }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  }
}
