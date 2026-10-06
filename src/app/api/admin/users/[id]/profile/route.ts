import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { invalidateAdminUserCaches } from "@/server/cache/admin-users";
import { db } from "@/server/db";
import { auditLogs, user, userProfile } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const idSchema = z.string().uuid();
const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().email().max(150).optional(),
    emailVerified: z.boolean().optional(),
    locale: z.enum(["fr", "ar"]).optional(),
    profileType: z
      .enum(["learner", "teacher", "avs", "parent", "specialist", "institution"])
      .optional(),
    phoneNumber: z.string().trim().max(30).nullable().optional(),
    phoneVerified: z.boolean().optional(),
    governorate: z.string().trim().max(50).nullable().optional(),
    city: z.string().trim().max(50).nullable().optional(),
  })
  .strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getAdminSessionFor("users.manage");
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const id = idSchema.safeParse((await params).id);
  const parsed = profileSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!id.success || !parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const userId = id.data;
  const updates = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!target) return { kind: "not_found" as const };

    // If changing email, ensure it's not taken by another user
    if (updates.email && updates.email.toLowerCase() !== target.email.toLowerCase()) {
      const [existingEmail] = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.email, updates.email.toLowerCase()), ne(user.id, userId)))
        .limit(1);
      if (existingEmail) {
        return { kind: "email_exists" as const };
      }
    }

    // Update user record
    const userUpdatePayload: Partial<typeof user.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (updates.name !== undefined) userUpdatePayload.name = updates.name;
    if (updates.email !== undefined) userUpdatePayload.email = updates.email.toLowerCase();
    if (updates.emailVerified !== undefined) userUpdatePayload.emailVerified = updates.emailVerified;
    if (updates.locale !== undefined) userUpdatePayload.locale = updates.locale;
    if (updates.profileType !== undefined) userUpdatePayload.profileType = updates.profileType;

    const [updatedUser] = await tx
      .update(user)
      .set(userUpdatePayload)
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        locale: user.locale,
        profileType: user.profileType,
      });

    // Check user_profile record
    const [existingProfile] = await tx
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, userId))
      .limit(1);

    let phoneVerifiedAt: Date | null | undefined = undefined;
    if (updates.phoneVerified !== undefined) {
      phoneVerifiedAt = updates.phoneVerified
        ? (existingProfile?.phoneVerifiedAt ?? new Date())
        : null;
    }

    const currentName = updates.name ?? target.name;
    const nameParts = currentName.trim().split(/\s+/);
    const firstName = nameParts[0] || currentName;
    const lastName = nameParts.slice(1).join(" ") || "-";

    if (existingProfile) {
      const profileUpdates: Partial<typeof userProfile.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (updates.name !== undefined) {
        profileUpdates.firstName = firstName;
        profileUpdates.lastName = lastName;
      }
      if (updates.phoneNumber !== undefined) profileUpdates.phoneNumber = updates.phoneNumber;
      if (phoneVerifiedAt !== undefined) profileUpdates.phoneVerifiedAt = phoneVerifiedAt;
      if (updates.governorate !== undefined) profileUpdates.governorate = updates.governorate;
      if (updates.city !== undefined) profileUpdates.city = updates.city;
      if (updates.locale !== undefined) profileUpdates.preferredLocale = updates.locale;

      await tx
        .update(userProfile)
        .set(profileUpdates)
        .where(eq(userProfile.userId, userId));
    } else {
      await tx.insert(userProfile).values({
        userId,
        firstName,
        lastName,
        phoneNumber: updates.phoneNumber ?? null,
        phoneVerifiedAt: phoneVerifiedAt ?? null,
        governorate: updates.governorate ?? null,
        city: updates.city ?? null,
        preferredLocale: updates.locale ?? "fr",
      });
    }

    // Insert audit log
    await tx.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "user.profile.update",
      entityType: "user",
      entityId: userId,
      metadata: {
        changes: updates,
        updatedBy: session.user.email,
      },
    });

    return { kind: "ok" as const, user: updatedUser };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (result.kind === "email_exists") {
    return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
  }

  await invalidateAdminUserCaches(userId);

  return NextResponse.json({ ok: true, user: result.user });
}
