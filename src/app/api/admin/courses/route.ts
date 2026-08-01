import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, courses } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).min(3).max(120),
  titleFr: z.string().trim().min(3).max(180),
  titleAr: z.string().trim().min(3).max(180),
  summaryFr: z.string().trim().min(3).max(500),
  summaryAr: z.string().trim().min(3).max(500),
  descriptionFr: z.string().trim().min(3).max(10_000),
  descriptionAr: z.string().trim().min(3).max(10_000),
  category: z.string().trim().min(2).max(80),
  trainerName: z.string().trim().min(2).max(120),
  durationMinutes: z.number().int().positive().max(100_000),
  priceMillimes: z.number().int().nonnegative().max(100_000_000),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  mode: z.enum(["online", "hybrid", "onsite"]),
  published: z.boolean().default(false),
  featured: z.boolean().default(false),
  objectives: z.object({
    fr: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
    ar: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
  }).strict(),
}).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("courses.create");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const [course] = await db.insert(courses).values(parsed.data).returning();
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "course.create", entityType: "course", entityId: course.id });
    return NextResponse.json({ course }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  }
}
