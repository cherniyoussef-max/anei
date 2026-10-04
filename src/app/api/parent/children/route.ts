import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/server/auth/session";
import { hasActivePersona } from "@/server/queries/personas";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";
import { db } from "@/server/db";
import {
  auditLogs,
  parentStudentLink,
  personaMembership,
  user,
  userProfile,
} from "@/server/db/schema";
import { parentRelationshipTypes } from "@/modules/relationships/domain/permissions";

const schema = z.object({
  mode: z.enum(["new", "existing"]).default("new"),
  // Fields for new child
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  relationshipType: z.enum(parentRelationshipTypes).default("FATHER"),
  birthDate: z.string().optional(),
  schoolName: z.string().trim().max(120).optional(),
  educationLevel: z.string().trim().max(60).optional(),
  specialNeeds: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  // Field for linking existing child by email
  existingStudentEmail: z.string().trim().email().optional(),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const isParent = await hasActivePersona(session.user.id, "PARENT");
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role));
  if (!isParent && !isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rate = await consumeRateLimit(`parent-add-child:${session.user.id}`, 10, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    mode,
    firstName,
    lastName,
    relationshipType,
    birthDate,
    schoolName,
    educationLevel,
    specialNeeds,
    notes,
    existingStudentEmail,
  } = parsed.data;

  try {
    return await db.transaction(async (tx) => {
      let targetStudentUserId: string;
      let targetStudentName: string;

      if (mode === "existing" && existingStudentEmail) {
        // Link an existing student by email
        const [existingStudent] = await tx
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(eq(user.email, existingStudentEmail.toLowerCase()))
          .limit(1);

        if (!existingStudent) {
          return NextResponse.json(
            { error: "STUDENT_NOT_FOUND" },
            { status: 404 }
          );
        }

        if (existingStudent.id === session.user.id) {
          return NextResponse.json(
            { error: "CANNOT_LINK_SELF" },
            { status: 400 }
          );
        }

        targetStudentUserId = existingStudent.id;
        targetStudentName = existingStudent.name;

        // Ensure student has the STUDENT persona
        const studentPersona = await tx
          .select({ id: personaMembership.id })
          .from(personaMembership)
          .where(
            and(
              eq(personaMembership.userId, targetStudentUserId),
              eq(personaMembership.persona, "STUDENT")
            )
          )
          .limit(1);

        if (!studentPersona.length) {
          await tx.insert(personaMembership).values({
            userId: targetStudentUserId,
            persona: "STUDENT",
            status: "ACTIVE",
            isPrimary: false,
          });
        }
      } else {
        // Create a new child profile
        if (!firstName || !lastName) {
          return NextResponse.json(
            { error: "FIRST_NAME_AND_LAST_NAME_REQUIRED" },
            { status: 400 }
          );
        }

        const cleanFirst = firstName.trim();
        const cleanLast = lastName.trim();
        const fullName = `${cleanFirst} ${cleanLast}`;
        const randomHex = Math.random().toString(36).slice(2, 8);
        const syntheticEmail = `enfant.${cleanFirst.toLowerCase().replace(/[^a-z0-9]/g, "")}.${randomHex}@famille.anei.local`;

        const [createdChild] = await tx
          .insert(user)
          .values({
            name: fullName,
            email: syntheticEmail,
            emailVerified: true,
            role: "USER",
            profileType: "learner",
            locale: session.user.locale ?? "fr",
          })
          .returning();

        targetStudentUserId = createdChild.id;
        targetStudentName = createdChild.name;

        // Setup userProfile with educational and birth details
        let parsedDate: Date | null = null;
        let birthYear: number | null = null;
        if (birthDate) {
          const d = new Date(birthDate);
          if (!isNaN(d.getTime())) {
            parsedDate = d;
            birthYear = d.getFullYear();
          }
        }

        await tx.insert(userProfile).values({
          userId: targetStudentUserId,
          firstName: cleanFirst,
          lastName: cleanLast,
          birthDate: parsedDate,
          birthYear,
          institutionName: schoolName || null,
          educationLevel: educationLevel || null,
          preferredLocale: session.user.locale ?? "fr",
          requestedPersona: "STUDENT",
        });

        // Grant active STUDENT persona
        await tx.insert(personaMembership).values({
          userId: targetStudentUserId,
          persona: "STUDENT",
          status: "ACTIVE",
          isPrimary: true,
        });
      }

      // Create or update parentStudentLink with status ACTIVE
      const [link] = await tx
        .insert(parentStudentLink)
        .values({
          parentUserId: session.user.id,
          studentUserId: targetStudentUserId,
          relationshipType,
          status: "ACTIVE",
          createdBy: session.user.id,
        })
        .onConflictDoUpdate({
          target: [parentStudentLink.parentUserId, parentStudentLink.studentUserId],
          set: {
            relationshipType,
            status: "ACTIVE",
            updatedAt: new Date(),
          },
        })
        .returning();

      // Audit log the creation
      await tx.insert(auditLogs).values({
        actorUserId: session.user.id,
        action: "parent.child.link_created",
        entityType: "parent_student_link",
        entityId: link.id,
        metadata: {
          parentUserId: session.user.id,
          studentUserId: targetStudentUserId,
          relationshipType,
          childName: targetStudentName,
          mode,
          specialNeeds,
          notes,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          linkId: link.id,
          studentId: targetStudentUserId,
          name: targetStudentName,
        },
        { status: 201 }
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CREATE_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
