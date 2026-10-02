import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  careConversation,
  careConversationParticipant,
  parentStudentLink,
  specialistStudentAssignment,
} from "@/server/db/schema";
import { dispatchCareNotification } from "@/server/services/care-notifications";
import { hasActivePersona } from "@/server/queries/personas";
import { hasActiveParentLink } from "@/server/queries/relationships";

export type CareRequestInput = {
  parentUserId: string;
  studentUserId: string;
  specialistUserId: string;
  requestMessage?: string | null;
  consentAccepted: boolean;
  consentVersion?: string;
};

export type CareRequestResult =
  | { kind: "ok"; id: string }
  | { kind: "consent_required" }
  | { kind: "self_assignment" }
  | { kind: "forbidden_student" }
  | { kind: "invalid_persona" }
  | { kind: "specialist_not_active" }
  | { kind: "already_exists" };

export type AcceptCareRequestResult =
  | { kind: "ok"; id: string; conversationId: string }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "invalid_status"; currentStatus: string };

export type DeclineCareRequestResult =
  | { kind: "ok"; id: string }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "invalid_status"; currentStatus: string };

export type EndCareRelationshipResult =
  | { kind: "ok"; id: string }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "invalid_status"; currentStatus: string };

/**
 * Parent creates a care request to an active specialist for an active linked child.
 * Validates parental link (no IDOR), active specialist persona, mandatory consent,
 * and uniqueness of pending/active assignments.
 */
export async function requestCareRelationship(input: CareRequestInput): Promise<CareRequestResult> {
  if (!input.consentAccepted) {
    return { kind: "consent_required" };
  }

  if (
    input.parentUserId === input.specialistUserId ||
    input.parentUserId === input.studentUserId ||
    input.specialistUserId === input.studentUserId
  ) {
    return { kind: "self_assignment" };
  }

  const [isParent, isStudent] = await Promise.all([
    hasActivePersona(input.parentUserId, "PARENT"),
    hasActivePersona(input.studentUserId, "STUDENT"),
  ]);

  if (!isParent || !isStudent) {
    return { kind: "invalid_persona" };
  }

  // Parent must have an active link to this student
  const isLinked = await hasActiveParentLink(input.parentUserId, input.studentUserId);
  if (!isLinked) {
    return { kind: "forbidden_student" };
  }

  // Specialist must have an ACTIVE persona
  const isSpecialistActive = await hasActivePersona(input.specialistUserId, "SPECIALIST");
  if (!isSpecialistActive) {
    return { kind: "specialist_not_active" };
  }

  // Check if a PENDING or ACTIVE assignment already exists
  const existing = await db
    .select({ id: specialistStudentAssignment.id, status: specialistStudentAssignment.status })
    .from(specialistStudentAssignment)
    .where(
      and(
        eq(specialistStudentAssignment.specialistUserId, input.specialistUserId),
        eq(specialistStudentAssignment.studentUserId, input.studentUserId),
        inArray(specialistStudentAssignment.status, ["PENDING", "ACTIVE"]),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return { kind: "already_exists" };
  }

  const sanitizedMessage = input.requestMessage ? input.requestMessage.trim().slice(0, 1000) : null;
  const now = new Date();

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(specialistStudentAssignment)
      .values({
        specialistUserId: input.specialistUserId,
        studentUserId: input.studentUserId,
        status: "PENDING",
        createdBy: input.parentUserId,
        requestedByUserId: input.parentUserId,
        requestMessage: sanitizedMessage,
        consentAcceptedAt: now,
        consentVersion: input.consentVersion || "v1.0",
        startDate: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorUserId: input.parentUserId,
      action: "care.relationship.request",
      entityType: "specialist_student_assignment",
      entityId: created.id,
      metadata: {
        specialistUserId: input.specialistUserId,
        studentUserId: input.studentUserId,
        requestedByUserId: input.parentUserId,
      },
    });

    // Notify specialist via care dispatcher (never include message content or child clinical data)
    await dispatchCareNotification({
      recipientUserId: input.specialistUserId,
      type: "CARE_REQUEST_RECEIVED",
      titleFr: "Nouvelle demande de suivi",
      titleAr: "طلب متابعة وتأهيل جديد",
      bodyFr: "Vous avez reçu une nouvelle demande d'accompagnement sur ANEI.",
      bodyAr: "لقد تلقيتم طلب متابعة ورعاية جديد على منصة ANEI.",
      href: "/specialist/demandes",
    });

    return { kind: "ok", id: created.id };
  });
}

/**
 * Specialist accepts a pending care request.
 * Transitions assignment to ACTIVE, creates careConversation, adds participants,
 * and notifies parent.
 */
export async function acceptCareRelationship(
  specialistUserId: string,
  relationshipId: string,
): Promise<AcceptCareRequestResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(specialistStudentAssignment)
      .where(eq(specialistStudentAssignment.id, relationshipId))
      .limit(1);

    if (!existing) return { kind: "not_found" };
    if (existing.specialistUserId !== specialistUserId) return { kind: "forbidden" };
    if (existing.status !== "PENDING") {
      return { kind: "invalid_status", currentStatus: existing.status };
    }

    const isSpecialistActive = await hasActivePersona(specialistUserId, "SPECIALIST");
    if (!isSpecialistActive) return { kind: "forbidden" };

    const now = new Date();

    await tx
      .update(specialistStudentAssignment)
      .set({
        status: "ACTIVE",
        startDate: now,
        updatedAt: now,
      })
      .where(eq(specialistStudentAssignment.id, relationshipId));

    // Find or create conversation
    let [conversation] = await tx
      .select()
      .from(careConversation)
      .where(eq(careConversation.careRelationshipId, relationshipId))
      .limit(1);

    if (!conversation) {
      const [newConv] = await tx
        .insert(careConversation)
        .values({
          specialistUserId: existing.specialistUserId,
          studentUserId: existing.studentUserId,
          careRelationshipId: relationshipId,
          status: "OPEN",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      conversation = newConv;

      // Add specialist participant
      await tx
        .insert(careConversationParticipant)
        .values({
          conversationId: conversation.id,
          userId: existing.specialistUserId,
          role: "SPECIALIST",
          createdAt: now,
        })
        .onConflictDoNothing();

      // Find all active linked parents for this child
      const linkedParents = await tx
        .select({ parentUserId: parentStudentLink.parentUserId })
        .from(parentStudentLink)
        .where(
          and(
            eq(parentStudentLink.studentUserId, existing.studentUserId),
            eq(parentStudentLink.status, "ACTIVE"),
          ),
        );

      const parentUserIds = new Set<string>();
      if (existing.requestedByUserId) parentUserIds.add(existing.requestedByUserId);
      for (const p of linkedParents) parentUserIds.add(p.parentUserId);

      for (const parentId of parentUserIds) {
        await tx
          .insert(careConversationParticipant)
          .values({
            conversationId: conversation.id,
            userId: parentId,
            role: "PARENT",
            createdAt: now,
          })
          .onConflictDoNothing();
      }
    }

    await tx.insert(auditLogs).values({
      actorUserId: specialistUserId,
      action: "care.relationship.accept",
      entityType: "specialist_student_assignment",
      entityId: relationshipId,
    });

    if (existing.requestedByUserId) {
      await dispatchCareNotification({
        recipientUserId: existing.requestedByUserId,
        type: "CARE_REQUEST_ACCEPTED",
        titleFr: "Demande de suivi acceptée",
        titleAr: "تم قبول طلب المتابعة",
        bodyFr: "Votre demande de suivi a été acceptée par le spécialiste sur ANEI.",
        bodyAr: "تم قبول طلبكم للمتابعة والتأهيل من قِبل المختص على منصة ANEI.",
        href: "/parent/specialistes",
      });
    }

    return { kind: "ok", id: relationshipId, conversationId: conversation.id };
  });
}

/**
 * Specialist declines a pending care request.
 * Sets status to DECLINED with optional declineReason and notifies parent.
 */
export async function declineCareRelationship(
  specialistUserId: string,
  relationshipId: string,
  declineReason?: string | null,
): Promise<DeclineCareRequestResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(specialistStudentAssignment)
      .where(eq(specialistStudentAssignment.id, relationshipId))
      .limit(1);

    if (!existing) return { kind: "not_found" };
    if (existing.specialistUserId !== specialistUserId) return { kind: "forbidden" };
    if (existing.status !== "PENDING") {
      return { kind: "invalid_status", currentStatus: existing.status };
    }

    const now = new Date();
    const sanitizedReason = declineReason ? declineReason.trim().slice(0, 500) : null;

    await tx
      .update(specialistStudentAssignment)
      .set({
        status: "DECLINED",
        declineReason: sanitizedReason,
        endDate: now,
        updatedAt: now,
      })
      .where(eq(specialistStudentAssignment.id, relationshipId));

    await tx.insert(auditLogs).values({
      actorUserId: specialistUserId,
      action: "care.relationship.decline",
      entityType: "specialist_student_assignment",
      entityId: relationshipId,
      metadata: { reason: sanitizedReason },
    });

    if (existing.requestedByUserId) {
      await dispatchCareNotification({
        recipientUserId: existing.requestedByUserId,
        type: "CARE_REQUEST_DECLINED",
        titleFr: "Demande de suivi non retenue",
        titleAr: "اعتذار عن قبول طلب المتابعة",
        bodyFr: "Le spécialiste n'a pas pu donner suite à votre demande de prise en charge.",
        bodyAr: "اعتذر المختص عن قبول طلب المتابعة في الوقت الحالي.",
        href: "/parent/specialistes",
      });
    }

    return { kind: "ok", id: relationshipId };
  });
}

/**
 * Specialist, linked parent, or admin ends an active care relationship.
 * Transitions assignment to ENDED, sets conversation to READ_ONLY, and audits.
 */
export async function endCareRelationship(
  actorUserId: string,
  relationshipId: string,
  endReason?: string | null,
  isAdmin = false,
): Promise<EndCareRelationshipResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(specialistStudentAssignment)
      .where(eq(specialistStudentAssignment.id, relationshipId))
      .limit(1);

    if (!existing) return { kind: "not_found" };
    if (existing.status !== "ACTIVE") {
      return { kind: "invalid_status", currentStatus: existing.status };
    }

    let isAuthorized = false;
    let callerRole: "SPECIALIST" | "PARENT" | "ADMIN" = "ADMIN";

    if (isAdmin) {
      isAuthorized = true;
      callerRole = "ADMIN";
    } else if (existing.specialistUserId === actorUserId) {
      isAuthorized = true;
      callerRole = "SPECIALIST";
    } else {
      const isParent = await hasActiveParentLink(actorUserId, existing.studentUserId);
      if (isParent) {
        isAuthorized = true;
        callerRole = "PARENT";
      }
    }

    if (!isAuthorized) return { kind: "forbidden" };

    const now = new Date();
    const sanitizedReason = endReason ? endReason.trim().slice(0, 500) : null;

    await tx
      .update(specialistStudentAssignment)
      .set({
        status: "ENDED",
        endedByUserId: actorUserId,
        endReason: sanitizedReason,
        endDate: now,
        updatedAt: now,
      })
      .where(eq(specialistStudentAssignment.id, relationshipId));

    // Freeze conversation to READ_ONLY
    await tx
      .update(careConversation)
      .set({
        status: "READ_ONLY",
        updatedAt: now,
      })
      .where(eq(careConversation.careRelationshipId, relationshipId));

    await tx.insert(auditLogs).values({
      actorUserId,
      action: "care.relationship.end",
      entityType: "specialist_student_assignment",
      entityId: relationshipId,
      metadata: { callerRole, reason: sanitizedReason },
    });

    if (callerRole === "SPECIALIST") {
      if (existing.requestedByUserId) {
        await dispatchCareNotification({
          recipientUserId: existing.requestedByUserId,
          type: "CARE_RELATIONSHIP_ENDED",
          titleFr: "Suivi terminé",
          titleAr: "انتهاء مسار المتابعة",
          bodyFr: "Le suivi avec votre spécialiste a pris fin sur ANEI.",
          bodyAr: "انتهت فترة المتابعة والتأهيل مع المختص على منصة ANEI.",
          href: "/parent/specialistes",
        });
      }
    } else if (callerRole === "PARENT") {
      await dispatchCareNotification({
        recipientUserId: existing.specialistUserId,
        type: "CARE_RELATIONSHIP_ENDED",
        titleFr: "Suivi terminé",
        titleAr: "انتهاء مسار المتابعة",
        bodyFr: "Un parent a mis fin à une relation de suivi.",
        bodyAr: "قام الولي بإنهاء مسار المتابعة الحالي.",
        href: "/specialist/patients",
      });
    } else {
      await dispatchCareNotification({
        recipientUserId: existing.specialistUserId,
        type: "CARE_RELATIONSHIP_ENDED",
        titleFr: "Suivi terminé par l'administration",
        titleAr: "إغلاق المتابعة من الإدارة",
        bodyFr: "Une relation de suivi a été clôturée par l'administration.",
        bodyAr: "تم إنهاء مسار المتابعة من قِبل إدارة الأكاديمية.",
        href: "/specialist/patients",
      });
      if (existing.requestedByUserId) {
        await dispatchCareNotification({
          recipientUserId: existing.requestedByUserId,
          type: "CARE_RELATIONSHIP_ENDED",
          titleFr: "Suivi terminé par l'administration",
          titleAr: "إغلاق المتابعة من الإدارة",
          bodyFr: "Une relation de suivi a été clôturée par l'administration.",
          bodyAr: "تم إنهاء مسار المتابعة من قِبل إدارة الأكاديمية.",
          href: "/parent/specialistes",
        });
      }
    }

    return { kind: "ok", id: relationshipId };
  });
}
