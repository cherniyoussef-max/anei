import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  appointment,
  careAccessLog,
  careConversation,
  careDocument,
  crmContact,
  parentStudentLink,
  personaMembership,
  specialistProfile,
  specialistSessionNote,
  specialistStudentAssignment,
  user,
  userProfile,
} from "@/server/db/schema";
import { logCareAccess } from "@/server/services/care-notes-documents";
import { calculateChildAge } from "@/server/queries/care-relationships";

export type CareTeamMember = {
  assignmentId: string;
  specialist: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    specialty: string | null;
    governorate: string | null;
    city: string | null;
    consultationModes: string[] | null;
  };
  startDate: Date | null;
  conversationId: string | null;
  nextAppointment: {
    id: string;
    startAt: Date;
    status: string;
    meetingUrl: string | null;
  } | null;
};

export type SharedNoteItem = {
  id: string;
  title: string;
  content: string;
  sessionDate: Date;
  isAddendum: boolean;
  parentNoteId: string | null;
  createdAt: Date;
  specialist: {
    name: string;
    specialty: string | null;
  };
};

export type SharedDocumentItem = {
  id: string;
  fileName: string;
  title: string | null;
  mimeType: string;
  sizeBytes: number;
  documentType: string;
  createdAt: Date;
  specialist: {
    name: string;
  };
};

export type ChildCareSummary = {
  child: {
    id: string;
    name: string;
    firstName: string;
    age: number | null;
  };
  relationshipType: string;
  careTeam: CareTeamMember[];
  sharedNotes: SharedNoteItem[];
  sharedDocuments: SharedDocumentItem[];
};

/**
 * Returns the care team for a given child, verifying the caller has an active parent link.
 */
export async function getChildCareTeam(
  studentId: string,
  parentUserId: string,
): Promise<CareTeamMember[] | null> {
  const [link] = await db
    .select({ id: parentStudentLink.id })
    .from(parentStudentLink)
    .where(
      and(
        eq(parentStudentLink.parentUserId, parentUserId),
        eq(parentStudentLink.studentUserId, studentId),
        eq(parentStudentLink.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!link) return null;

  const assignments = await db
    .select({
      assignment: specialistStudentAssignment,
      specialistUser: user,
      profile: specialistProfile,
    })
    .from(specialistStudentAssignment)
    .innerJoin(user, eq(specialistStudentAssignment.specialistUserId, user.id))
    .leftJoin(
      personaMembership,
      and(
        eq(personaMembership.userId, user.id),
        eq(personaMembership.persona, "SPECIALIST"),
      ),
    )
    .leftJoin(
      specialistProfile,
      eq(specialistProfile.personaMembershipId, personaMembership.id),
    )
    .where(
      and(
        eq(specialistStudentAssignment.studentUserId, studentId),
        eq(specialistStudentAssignment.status, "ACTIVE"),
      ),
    );

  const team: CareTeamMember[] = [];

  for (const row of assignments) {
    // Find conversation
    const [conv] = await db
      .select({ id: careConversation.id })
      .from(careConversation)
      .where(eq(careConversation.careRelationshipId, row.assignment.id))
      .limit(1);

    // Find next upcoming appointment with this specialist
    const [nextAppt] = await db
      .select({
        id: appointment.id,
        startAt: appointment.startAt,
        status: appointment.status,
        meetingUrl: appointment.meetingUrl,
      })
      .from(appointment)
      .innerJoin(crmContact, eq(appointment.contactId, crmContact.id))
      .where(
        and(
          eq(crmContact.linkedUserId, studentId),
          eq(appointment.assignedToUserId, row.specialistUser.id),
          gte(appointment.startAt, new Date()),
          inArray(appointment.status, ["SCHEDULED", "CONFIRMED"]),
        ),
      )
      .orderBy(asc(appointment.startAt))
      .limit(1);

    team.push({
      assignmentId: row.assignment.id,
      specialist: {
        userId: row.specialistUser.id,
        name: row.specialistUser.name,
        avatarUrl: row.specialistUser.image,
        specialty: row.profile?.specialty ?? null,
        governorate: row.profile?.governorate ?? null,
        city: row.profile?.city ?? null,
        consultationModes: row.profile?.consultationModes ?? null,
      },
      startDate: row.assignment.startDate,
      conversationId: conv?.id ?? null,
      nextAppointment: nextAppt ?? null,
    });
  }

  return team;
}

/**
 * Retrieves all SHARED session notes for a child, visible to their active parents.
 * Automatically records one access log entry.
 */
export async function getSharedNotesForChild(
  studentId: string,
  parentUserId: string,
): Promise<SharedNoteItem[] | null> {
  const [link] = await db
    .select({ id: parentStudentLink.id })
    .from(parentStudentLink)
    .where(
      and(
        eq(parentStudentLink.parentUserId, parentUserId),
        eq(parentStudentLink.studentUserId, studentId),
        eq(parentStudentLink.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!link) return null;

  const notes = await db
    .select({
      note: specialistSessionNote,
      specialist: {
        name: user.name,
      },
      profile: {
        specialty: specialistProfile.specialty,
      },
    })
    .from(specialistSessionNote)
    .innerJoin(user, eq(specialistSessionNote.specialistUserId, user.id))
    .leftJoin(
      personaMembership,
      and(
        eq(personaMembership.userId, user.id),
        eq(personaMembership.persona, "SPECIALIST"),
      ),
    )
    .leftJoin(
      specialistProfile,
      eq(specialistProfile.personaMembershipId, personaMembership.id),
    )
    .where(
      and(
        eq(specialistSessionNote.studentId, studentId),
        eq(specialistSessionNote.visibility, "SHARED"),
      ),
    )
    .orderBy(desc(specialistSessionNote.sessionDate), desc(specialistSessionNote.createdAt));

  // Log access
  await logCareAccess(parentUserId, studentId, "SESSION_NOTE", studentId);

  return notes.map((r) => ({
    id: r.note.id,
    title: r.note.title,
    content: r.note.content,
    sessionDate: r.note.sessionDate,
    isAddendum: r.note.isAddendum,
    parentNoteId: r.note.parentNoteId,
    createdAt: r.note.createdAt,
    specialist: {
      name: r.specialist.name,
      specialty: r.profile?.specialty ?? null,
    },
  }));
}

/**
 * Retrieves all SHARED documents/reports for a child, visible to their active parents.
 * Automatically records one access log entry.
 */
export async function getSharedDocumentsForChild(
  studentId: string,
  parentUserId: string,
): Promise<SharedDocumentItem[] | null> {
  const [link] = await db
    .select({ id: parentStudentLink.id })
    .from(parentStudentLink)
    .where(
      and(
        eq(parentStudentLink.parentUserId, parentUserId),
        eq(parentStudentLink.studentUserId, studentId),
        eq(parentStudentLink.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!link) return null;

  const docs = await db
    .select({
      doc: careDocument,
      specialist: {
        name: user.name,
      },
    })
    .from(careDocument)
    .innerJoin(user, eq(careDocument.uploadedByUserId, user.id))
    .where(
      and(
        eq(careDocument.studentId, studentId),
        eq(careDocument.visibility, "SHARED"),
      ),
    )
    .orderBy(desc(careDocument.createdAt));

  // Log access
  await logCareAccess(parentUserId, studentId, "DOCUMENT", studentId);

  return docs.map((r) => ({
    id: r.doc.id,
    fileName: r.doc.fileName,
    title: r.doc.title,
    mimeType: r.doc.mimeType,
    sizeBytes: r.doc.sizeBytes,
    documentType: r.doc.documentType,
    createdAt: r.doc.createdAt,
    specialist: {
      name: r.specialist.name,
    },
  }));
}

/**
 * Retrieves complete child care dossier for all children linked to an active parent.
 */
export async function getParentAllChildrenCareSummary(
  parentUserId: string,
): Promise<ChildCareSummary[]> {
  const links = await db
    .select({
      link: parentStudentLink,
      student: user,
      profile: userProfile,
    })
    .from(parentStudentLink)
    .innerJoin(user, eq(parentStudentLink.studentUserId, user.id))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(
      and(
        eq(parentStudentLink.parentUserId, parentUserId),
        eq(parentStudentLink.status, "ACTIVE"),
      ),
    );

  const summaries: ChildCareSummary[] = [];

  for (const { link, student, profile } of links) {
    const [team, notes, documents] = await Promise.all([
      getChildCareTeam(student.id, parentUserId),
      getSharedNotesForChild(student.id, parentUserId),
      getSharedDocumentsForChild(student.id, parentUserId),
    ]);

    summaries.push({
      child: {
        id: student.id,
        name: student.name,
        firstName: profile?.firstName || student.name.split(" ")[0] || student.name,
        age: calculateChildAge(profile?.birthDate, profile?.birthYear),
      },
      relationshipType: link.relationshipType,
      careTeam: team || [],
      sharedNotes: notes || [],
      sharedDocuments: documents || [],
    });
  }

  return summaries;
}

export type CareAccessLogItem = {
  id: string;
  actorUserId: string;
  actorName: string;
  studentId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  createdAt: Date;
};

export async function getAdminCareAccessLogs(limit = 100): Promise<CareAccessLogItem[]> {
  const rows = await db
    .select({
      id: careAccessLog.id,
      actorUserId: careAccessLog.actorUserId,
      actorName: user.name,
      studentId: careAccessLog.studentId,
      resourceType: careAccessLog.resourceType,
      resourceId: careAccessLog.resourceId,
      action: careAccessLog.action,
      createdAt: careAccessLog.createdAt,
    })
    .from(careAccessLog)
    .innerJoin(user, eq(careAccessLog.actorUserId, user.id))
    .orderBy(desc(careAccessLog.createdAt))
    .limit(limit);

  return rows;
}
