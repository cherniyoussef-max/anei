import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  careConversation,
  parentStudentLink,
  personaMembership,
  specialistProfile,
  specialistStudentAssignment,
  user,
  userProfile,
} from "@/server/db/schema";
import { hasActiveParentLink } from "@/server/queries/relationships";

export type SpecialistSearchParams = {
  specialty?: string;
  governorate?: string;
  language?: string;
  consultationMode?: "IN_PERSON" | "ONLINE";
  query?: string;
  limit?: number;
  offset?: number;
};

export type SpecialistDirectoryItem = {
  userId: string;
  name: string;
  image: string | null;
  specialty: string | null;
  subSpecialties: string[] | null;
  qualification: string | null;
  experienceYears: number | null;
  practiceStructure: string | null;
  interventionDomains: string[] | null;
  governorate: string | null;
  city: string | null;
  languages: string[] | null;
  consultationModes: string[] | null;
  bioFr: string | null;
  bioAr: string | null;
  address: string | null;
};

export function calculateChildAge(
  birthDate: Date | null | undefined,
  birthYear: number | null | undefined,
): number | null {
  if (birthDate) {
    const diffMs = Date.now() - new Date(birthDate).getTime();
    if (diffMs <= 0) return 0;
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  }
  if (birthYear) {
    const currentYear = new Date().getFullYear();
    return Math.max(0, currentYear - birthYear);
  }
  return null;
}

/**
 * Public and parent directory search: ONLY active specialists appear.
 * PENDING_REVIEW, SUSPENDED, or REJECTED specialists are strictly excluded.
 */
export async function searchActiveSpecialists(
  params: SpecialistSearchParams = {},
): Promise<{ specialists: SpecialistDirectoryItem[]; total: number }> {
  const limit = Math.min(50, Math.max(1, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);

  const conditions = [
    eq(personaMembership.persona, "SPECIALIST"),
    eq(personaMembership.status, "ACTIVE"),
  ];

  if (params.specialty && params.specialty !== "ALL") {
    conditions.push(ilike(specialistProfile.specialty, `%${params.specialty}%`));
  }

  if (params.governorate && params.governorate !== "ALL") {
    conditions.push(
      or(
        ilike(specialistProfile.governorate, params.governorate),
        ilike(userProfile.governorate, params.governorate),
      )!,
    );
  }

  if (params.query?.trim()) {
    const q = `%${params.query.trim()}%`;
    conditions.push(
      or(
        ilike(user.name, q),
        ilike(specialistProfile.specialty, q),
        ilike(specialistProfile.city, q),
        ilike(specialistProfile.practiceStructure, q),
      )!,
    );
  }

  const whereClause = and(...conditions);

  const [countResult] = await db
    .select({ count: sql<number>`count(distinct ${user.id})::int` })
    .from(personaMembership)
    .innerJoin(user, eq(user.id, personaMembership.userId))
    .leftJoin(specialistProfile, eq(specialistProfile.personaMembershipId, personaMembership.id))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(whereClause);

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      image: user.image,
      specialty: specialistProfile.specialty,
      subSpecialties: specialistProfile.subSpecialties,
      qualification: specialistProfile.qualification,
      experienceYears: specialistProfile.experienceYears,
      practiceStructure: specialistProfile.practiceStructure,
      interventionDomains: specialistProfile.interventionDomains,
      governorate: sql<string | null>`coalesce(${specialistProfile.governorate}, ${userProfile.governorate})`,
      city: sql<string | null>`coalesce(${specialistProfile.city}, ${userProfile.city})`,
      languages: specialistProfile.languages,
      consultationModes: specialistProfile.consultationModes,
      bioFr: specialistProfile.bioFr,
      bioAr: specialistProfile.bioAr,
      avatarUrl: specialistProfile.avatarUrl,
      address: specialistProfile.address,
    })
    .from(personaMembership)
    .innerJoin(user, eq(user.id, personaMembership.userId))
    .leftJoin(specialistProfile, eq(specialistProfile.personaMembershipId, personaMembership.id))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(whereClause)
    .orderBy(desc(user.createdAt))
    .limit(limit)
    .offset(offset);

  let filtered = rows;
  if (params.language) {
    filtered = filtered.filter((r) =>
      r.languages ? r.languages.includes(params.language!) : true,
    );
  }
  if (params.consultationMode) {
    filtered = filtered.filter((r) =>
      r.consultationModes ? r.consultationModes.includes(params.consultationMode!) : true,
    );
  }

  const specialists: SpecialistDirectoryItem[] = filtered.map((r) => ({
    userId: r.userId,
    name: r.name ?? "Spécialiste",
    image: r.avatarUrl || r.image,
    specialty: r.specialty,
    subSpecialties: r.subSpecialties,
    qualification: r.qualification,
    experienceYears: r.experienceYears,
    practiceStructure: r.practiceStructure,
    interventionDomains: r.interventionDomains,
    governorate: r.governorate,
    city: r.city,
    languages: r.languages ?? ["fr", "ar"],
    consultationModes: r.consultationModes ?? ["IN_PERSON", "ONLINE"],
    bioFr: r.bioFr,
    bioAr: r.bioAr,
    address: r.address,
  }));

  return {
    specialists,
    total: countResult?.count ?? 0,
  };
}

/**
 * Specialist views care requests sent to them.
 * Shows only child first name, age, and parent request message (never clinical details).
 */
export async function getSpecialistCareRequests(
  specialistUserId: string,
  status?: "PENDING" | "ACTIVE" | "DECLINED" | "ENDED",
) {
  const conditions = [eq(specialistStudentAssignment.specialistUserId, specialistUserId)];
  if (status) {
    conditions.push(eq(specialistStudentAssignment.status, status));
  }

  const rows = await db
    .select({
      id: specialistStudentAssignment.id,
      status: specialistStudentAssignment.status,
      requestMessage: specialistStudentAssignment.requestMessage,
      declineReason: specialistStudentAssignment.declineReason,
      consentAcceptedAt: specialistStudentAssignment.consentAcceptedAt,
      consentVersion: specialistStudentAssignment.consentVersion,
      startDate: specialistStudentAssignment.startDate,
      endDate: specialistStudentAssignment.endDate,
      endReason: specialistStudentAssignment.endReason,
      createdAt: specialistStudentAssignment.createdAt,
      studentId: user.id,
      studentFullName: user.name,
      studentFirstName: userProfile.firstName,
      birthDate: userProfile.birthDate,
      birthYear: userProfile.birthYear,
      parentUserId: specialistStudentAssignment.requestedByUserId,
      conversationId: careConversation.id,
      conversationStatus: careConversation.status,
    })
    .from(specialistStudentAssignment)
    .innerJoin(user, eq(user.id, specialistStudentAssignment.studentUserId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(
      careConversation,
      eq(careConversation.careRelationshipId, specialistStudentAssignment.id),
    )
    .where(and(...conditions))
    .orderBy(desc(specialistStudentAssignment.createdAt));

  // Retrieve parent names for requests
  const parentIds = Array.from(
    new Set(rows.map((r) => r.parentUserId).filter((id): id is string => Boolean(id))),
  );
  const parentsMap = new Map<string, { name: string; email: string }>();

  if (parentIds.length > 0) {
    const parentUsers = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(inArray(user.id, parentIds));
    for (const p of parentUsers) {
      parentsMap.set(p.id, { name: p.name ?? "Parent", email: p.email });
    }
  }

  return rows.map((r) => {
    const firstName =
      r.studentFirstName || (r.studentFullName ? r.studentFullName.split(" ")[0] : "Enfant");
    const age = calculateChildAge(r.birthDate, r.birthYear);
    const parentInfo = r.parentUserId ? parentsMap.get(r.parentUserId) : null;

    return {
      id: r.id,
      status: r.status,
      requestMessage: r.requestMessage,
      declineReason: r.declineReason,
      consentAcceptedAt: r.consentAcceptedAt,
      consentVersion: r.consentVersion,
      startDate: r.startDate,
      endDate: r.endDate,
      endReason: r.endReason,
      createdAt: r.createdAt,
      conversationId: r.conversationId,
      conversationStatus: r.conversationStatus,
      child: {
        id: r.studentId,
        firstName,
        age,
      },
      parent: parentInfo
        ? {
            id: r.parentUserId,
            name: parentInfo.name,
            email: parentInfo.email,
          }
        : null,
    };
  });
}

/**
 * Specialist caseload overview: active and ended care relationships.
 */
export async function getSpecialistCaseload(specialistUserId: string) {
  const allAssignments = await getSpecialistCareRequests(specialistUserId);
  const active = allAssignments.filter((a) => a.status === "ACTIVE");
  const pending = allAssignments.filter((a) => a.status === "PENDING");
  const ended = allAssignments.filter((a) => a.status === "ENDED");

  return {
    active,
    pending,
    ended,
    counts: {
      active: active.length,
      pending: pending.length,
      ended: ended.length,
      total: allAssignments.length,
    },
  };
}

/**
 * Parent views care requests and relationships for their linked children.
 * Keyed by the parent's own userId (no IDOR).
 */
export async function getParentCareRequests(parentUserId: string) {
  // Find all students linked to this parent
  const linked = await db
    .select({ studentUserId: parentStudentLink.studentUserId })
    .from(parentStudentLink)
    .where(
      and(
        eq(parentStudentLink.parentUserId, parentUserId),
        eq(parentStudentLink.status, "ACTIVE"),
      ),
    );

  const studentUserIds = linked.map((l) => l.studentUserId);

  const conditions = [
    or(
      eq(specialistStudentAssignment.requestedByUserId, parentUserId),
      studentUserIds.length > 0
        ? inArray(specialistStudentAssignment.studentUserId, studentUserIds)
        : sql`false`,
    ),
  ];

  const rows = await db
    .select({
      id: specialistStudentAssignment.id,
      status: specialistStudentAssignment.status,
      requestMessage: specialistStudentAssignment.requestMessage,
      declineReason: specialistStudentAssignment.declineReason,
      endReason: specialistStudentAssignment.endReason,
      consentAcceptedAt: specialistStudentAssignment.consentAcceptedAt,
      startDate: specialistStudentAssignment.startDate,
      endDate: specialistStudentAssignment.endDate,
      createdAt: specialistStudentAssignment.createdAt,
      studentId: user.id,
      studentFullName: user.name,
      studentFirstName: userProfile.firstName,
      birthDate: userProfile.birthDate,
      birthYear: userProfile.birthYear,
      specialistUserId: specialistStudentAssignment.specialistUserId,
      conversationId: careConversation.id,
      conversationStatus: careConversation.status,
    })
    .from(specialistStudentAssignment)
    .innerJoin(user, eq(user.id, specialistStudentAssignment.studentUserId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(
      careConversation,
      eq(careConversation.careRelationshipId, specialistStudentAssignment.id),
    )
    .where(and(...conditions))
    .orderBy(desc(specialistStudentAssignment.createdAt));

  const specialistIds = Array.from(new Set(rows.map((r) => r.specialistUserId)));
  const specialistsMap = new Map<
    string,
    { name: string; specialty: string | null; avatarUrl: string | null }
  >();

  if (specialistIds.length > 0) {
    const specs = await db
      .select({
        id: user.id,
        name: user.name,
        specialty: specialistProfile.specialty,
        avatarUrl: specialistProfile.avatarUrl,
        image: user.image,
      })
      .from(user)
      .leftJoin(personaMembership, and(eq(personaMembership.userId, user.id), eq(personaMembership.persona, "SPECIALIST")))
      .leftJoin(specialistProfile, eq(specialistProfile.personaMembershipId, personaMembership.id))
      .where(inArray(user.id, specialistIds));

    for (const s of specs) {
      specialistsMap.set(s.id, {
        name: s.name ?? "Spécialiste",
        specialty: s.specialty,
        avatarUrl: s.avatarUrl || s.image,
      });
    }
  }

  return rows.map((r) => {
    const firstName =
      r.studentFirstName || (r.studentFullName ? r.studentFullName.split(" ")[0] : "Enfant");
    const spec = specialistsMap.get(r.specialistUserId);

    return {
      id: r.id,
      status: r.status,
      requestMessage: r.requestMessage,
      declineReason: r.declineReason,
      endReason: r.endReason,
      consentAcceptedAt: r.consentAcceptedAt,
      startDate: r.startDate,
      endDate: r.endDate,
      createdAt: r.createdAt,
      conversationId: r.conversationId,
      conversationStatus: r.conversationStatus,
      child: {
        id: r.studentId,
        firstName,
      },
      specialist: {
        id: r.specialistUserId,
        name: spec?.name ?? "Spécialiste",
        specialty: spec?.specialty ?? null,
        avatarUrl: spec?.avatarUrl ?? null,
      },
    };
  });
}

/**
 * Admin overview of care relationships.
 */
export async function getAdminCareRelationships(options: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const offset = Math.max(0, options.offset ?? 0);

  const conditions = [];
  if (options.status && options.status !== "ALL") {
    conditions.push(eq(specialistStudentAssignment.status, options.status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(specialistStudentAssignment)
    .where(whereClause);

  const rows = await db
    .select({
      id: specialistStudentAssignment.id,
      status: specialistStudentAssignment.status,
      requestMessage: specialistStudentAssignment.requestMessage,
      declineReason: specialistStudentAssignment.declineReason,
      endReason: specialistStudentAssignment.endReason,
      startDate: specialistStudentAssignment.startDate,
      endDate: specialistStudentAssignment.endDate,
      createdAt: specialistStudentAssignment.createdAt,
      specialistId: specialistStudentAssignment.specialistUserId,
      studentId: specialistStudentAssignment.studentUserId,
      requestedByUserId: specialistStudentAssignment.requestedByUserId,
      conversationId: careConversation.id,
      conversationStatus: careConversation.status,
    })
    .from(specialistStudentAssignment)
    .leftJoin(
      careConversation,
      eq(careConversation.careRelationshipId, specialistStudentAssignment.id),
    )
    .where(whereClause)
    .orderBy(desc(specialistStudentAssignment.createdAt))
    .limit(limit)
    .offset(offset);

  // Hydrate user names
  const allUserIds = Array.from(
    new Set(
      rows
        .flatMap((r) => [r.specialistId, r.studentId, r.requestedByUserId])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const usersMap = new Map<string, string>();
  if (allUserIds.length > 0) {
    const users = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, allUserIds));
    for (const u of users) {
      usersMap.set(u.id, u.name ?? "Utilisateur");
    }
  }

  const relationships = rows.map((r) => ({
    id: r.id,
    status: r.status,
    requestMessage: r.requestMessage,
    declineReason: r.declineReason,
    endReason: r.endReason,
    startDate: r.startDate,
    endDate: r.endDate,
    createdAt: r.createdAt,
    conversationId: r.conversationId,
    conversationStatus: r.conversationStatus,
    specialist: {
      id: r.specialistId,
      name: usersMap.get(r.specialistId) ?? "Spécialiste",
    },
    student: {
      id: r.studentId,
      name: usersMap.get(r.studentId) ?? "Élève",
    },
    requestedBy: r.requestedByUserId
      ? {
          id: r.requestedByUserId,
          name: usersMap.get(r.requestedByUserId) ?? "Parent",
        }
      : null,
  }));

  return {
    relationships,
    total: countResult?.count ?? 0,
  };
}

/**
 * Access-controlled fetch of a single care relationship.
 */
export async function getCareRelationshipById(
  actorUserId: string,
  relationshipId: string,
  isAdmin = false,
) {
  const [assignment] = await db
    .select()
    .from(specialistStudentAssignment)
    .where(eq(specialistStudentAssignment.id, relationshipId))
    .limit(1);

  if (!assignment) return null;

  if (!isAdmin && assignment.specialistUserId !== actorUserId) {
    const isParent = await hasActiveParentLink(actorUserId, assignment.studentUserId);
    if (!isParent && assignment.requestedByUserId !== actorUserId) {
      return null;
    }
  }

  return assignment;
}
