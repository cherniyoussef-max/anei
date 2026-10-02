import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { env } from "@/server/env";
import {
  careAccessLog,
  careDocument,
  parentStudentLink,
  specialistSessionNote,
  specialistStudentAssignment,
} from "@/server/db/schema";
import { dispatchCareNotification } from "@/server/services/care-notifications";

/**
 * Sanitizes plain text content by removing all HTML tags and control characters.
 */
export function sanitizePlainText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z0-9]+;/gi, " ")
    .trim();
}

/**
 * Audit log entry for accessing a child's clinical file, notes, conversation, or documents.
 * One log entry per file/section opened.
 */
export async function logCareAccess(
  actorUserId: string,
  studentId: string,
  resourceType: "CLIENT_FILE" | "SESSION_NOTE" | "CONVERSATION" | "DOCUMENT",
  resourceId: string,
  reason?: string | null,
): Promise<void> {
  try {
    await db.insert(careAccessLog).values({
      actorUserId,
      studentId,
      resourceType,
      resourceId,
      action: "READ",
      reason: reason || null,
    });
  } catch {
    // Non-blocking for reader
  }
}

/**
 * Specialist creates a session note for a child with active care relationship.
 * Visibility: PRIVATE (specialist only) or SHARED (parent can read).
 */
export async function createSessionNote(
  specialistUserId: string,
  input: {
    assignmentId: string;
    title: string;
    content: string;
    visibility: "PRIVATE" | "SHARED";
    sessionDate: Date;
  },
): Promise<{ kind: "ok"; id: string } | { kind: "forbidden" } | { kind: "invalid_input"; message: string }> {
  const [assignment] = await db
    .select({
      id: specialistStudentAssignment.id,
      studentUserId: specialistStudentAssignment.studentUserId,
      status: specialistStudentAssignment.status,
    })
    .from(specialistStudentAssignment)
    .where(
      and(
        eq(specialistStudentAssignment.id, input.assignmentId),
        eq(specialistStudentAssignment.specialistUserId, specialistUserId),
      ),
    )
    .limit(1);

  if (!assignment || assignment.status !== "ACTIVE") {
    return { kind: "forbidden" };
  }

  const cleanTitle = sanitizePlainText(input.title);
  const cleanContent = sanitizePlainText(input.content);

  if (!cleanTitle || cleanTitle.length > 200) {
    return { kind: "invalid_input", message: "Le titre est requis (max 200 caractères)." };
  }

  if (!cleanContent || cleanContent.length > 10000) {
    return { kind: "invalid_input", message: "Le contenu est requis (max 10 000 caractères)." };
  }

  const [note] = await db
    .insert(specialistSessionNote)
    .values({
      assignmentId: assignment.id,
      specialistUserId,
      studentId: assignment.studentUserId,
      title: cleanTitle,
      content: cleanContent,
      visibility: input.visibility,
      sessionDate: input.sessionDate,
      isAddendum: false,
    })
    .returning({ id: specialistSessionNote.id });

  // If SHARED, notify linked active parents via generic notification
  if (input.visibility === "SHARED" && note) {
    try {
      const activeParents = await db
        .select({ parentUserId: parentStudentLink.parentUserId })
        .from(parentStudentLink)
        .where(
          and(
            eq(parentStudentLink.studentUserId, assignment.studentUserId),
            eq(parentStudentLink.status, "ACTIVE"),
          ),
        );

      for (const p of activeParents) {
        await dispatchCareNotification({
          recipientUserId: p.parentUserId,
          type: "CARE_NOTE_SHARED",
          titleFr: "Nouvelle observation de séance disponible",
          titleAr: "ملاحظات جلسة متابعة جديدة",
          bodyFr: "Une nouvelle observation clinique a été partagée par votre spécialiste sur ANEI.",
          bodyAr: "تمت مشاركة ملاحظات جلسة متابعة جديدة من قِبل المختص على منصة ANEI.",
          href: "/parent/enfants",
        });
      }
    } catch {
      // Non-blocking notification
    }
  }

  return { kind: "ok", id: note!.id };
}

/**
 * 24-hour Immutability Rule:
 * Shared session notes can only be updated within 24 hours of creation.
 * After 24h, updates are rejected with `immutable_after_24h` and must be created as an addendum.
 */
export async function updateSessionNote(
  specialistUserId: string,
  input: {
    noteId: string;
    title: string;
    content: string;
    visibility: "PRIVATE" | "SHARED";
  },
): Promise<
  | { kind: "ok" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "immutable_after_24h" }
  | { kind: "invalid_input"; message: string }
> {
  const [note] = await db
    .select()
    .from(specialistSessionNote)
    .where(
      and(
        eq(specialistSessionNote.id, input.noteId),
        eq(specialistSessionNote.specialistUserId, specialistUserId),
      ),
    )
    .limit(1);

  if (!note) return { kind: "not_found" };
  if (note.isAddendum) return { kind: "invalid_input", message: "Les addendums ne sont pas modifiables." };

  // Check 24-hour immutability window for shared notes
  if (note.visibility === "SHARED") {
    const ageMs = Date.now() - new Date(note.createdAt).getTime();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    if (ageMs > twentyFourHoursMs) {
      return { kind: "immutable_after_24h" };
    }
  }

  const cleanTitle = sanitizePlainText(input.title);
  const cleanContent = sanitizePlainText(input.content);

  if (!cleanTitle || cleanTitle.length > 200) {
    return { kind: "invalid_input", message: "Le titre est requis (max 200 caractères)." };
  }

  if (!cleanContent || cleanContent.length > 10000) {
    return { kind: "invalid_input", message: "Le contenu est requis (max 10 000 caractères)." };
  }

  await db
    .update(specialistSessionNote)
    .set({
      title: cleanTitle,
      content: cleanContent,
      visibility: input.visibility,
      updatedAt: new Date(),
    })
    .where(eq(specialistSessionNote.id, input.noteId));

  return { kind: "ok" };
}

/**
 * Specialist creates an addendum to an existing session note (especially after 24h immutability).
 */
export async function createNoteAddendum(
  specialistUserId: string,
  input: {
    parentNoteId: string;
    content: string;
  },
): Promise<{ kind: "ok"; id: string } | { kind: "forbidden" } | { kind: "not_found" } | { kind: "invalid_input"; message: string }> {
  const [parentNote] = await db
    .select()
    .from(specialistSessionNote)
    .where(
      and(
        eq(specialistSessionNote.id, input.parentNoteId),
        eq(specialistSessionNote.specialistUserId, specialistUserId),
      ),
    )
    .limit(1);

  if (!parentNote) return { kind: "not_found" };

  const cleanContent = sanitizePlainText(input.content);
  if (!cleanContent || cleanContent.length > 10000) {
    return { kind: "invalid_input", message: "Le contenu de l'addendum est requis (max 10 000 caractères)." };
  }

  const [addendum] = await db
    .insert(specialistSessionNote)
    .values({
      assignmentId: parentNote.assignmentId,
      specialistUserId,
      studentId: parentNote.studentId,
      title: "Addendum",
      content: cleanContent,
      visibility: parentNote.visibility,
      sessionDate: parentNote.sessionDate,
      isAddendum: true,
      parentNoteId: parentNote.id,
    })
    .returning({ id: specialistSessionNote.id });

  // If parent note was SHARED, notify parent
  if (parentNote.visibility === "SHARED") {
    try {
      const activeParents = await db
        .select({ parentUserId: parentStudentLink.parentUserId })
        .from(parentStudentLink)
        .where(
          and(
            eq(parentStudentLink.studentUserId, parentNote.studentId),
            eq(parentStudentLink.status, "ACTIVE"),
          ),
        );

      for (const p of activeParents) {
        await dispatchCareNotification({
          recipientUserId: p.parentUserId,
          type: "CARE_NOTE_ADDENDUM",
          titleFr: "Complément d'observation partagé",
          titleAr: "إضافة ملحق لملاحظات الجلسة",
          bodyFr: "Un addendum a été ajouté à une observation de séance sur ANEI.",
          bodyAr: "تمت إضافة ملحق توضيحي لملاحظات الجلسة من قِبل المختص.",
          href: "/parent/enfants",
        });
      }
    } catch {
      // Non-blocking
    }
  }

  return { kind: "ok", id: addendum!.id };
}

/**
 * Registers an uploaded care document or report.
 */
export async function registerCareDocument(
  specialistUserId: string,
  input: {
    assignmentId: string;
    fileName: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    title?: string | null;
    documentType: "SESSION_REPORT" | "ASSESSMENT" | "RESOURCE" | "CHAT_ATTACHMENT";
    visibility: "PRIVATE" | "SHARED";
  },
): Promise<{ kind: "ok"; id: string } | { kind: "forbidden" } | { kind: "invalid_input"; message: string }> {
  const [assignment] = await db
    .select({
      id: specialistStudentAssignment.id,
      studentUserId: specialistStudentAssignment.studentUserId,
      status: specialistStudentAssignment.status,
    })
    .from(specialistStudentAssignment)
    .where(
      and(
        eq(specialistStudentAssignment.id, input.assignmentId),
        eq(specialistStudentAssignment.specialistUserId, specialistUserId),
      ),
    )
    .limit(1);

  if (!assignment || assignment.status !== "ACTIVE") {
    return { kind: "forbidden" };
  }

  const allowedMimeTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  if (!allowedMimeTypes.has(input.mimeType)) {
    return { kind: "invalid_input", message: "Type de document non supporté. Formats acceptés : PDF, JPEG, PNG, WEBP." };
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > 25 * 1024 * 1024) {
    return { kind: "invalid_input", message: "La taille du fichier doit être inférieure à 25 Mo." };
  }

  const cleanTitle = input.title ? sanitizePlainText(input.title).slice(0, 200) : null;
  const cleanFileName = sanitizePlainText(input.fileName).slice(0, 200) || "document.pdf";

  const [doc] = await db
    .insert(careDocument)
    .values({
      assignmentId: assignment.id,
      studentId: assignment.studentUserId,
      uploadedByUserId: specialistUserId,
      fileName: cleanFileName,
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      title: cleanTitle,
      documentType: input.documentType,
      visibility: input.visibility,
    })
    .returning({ id: careDocument.id });

  if (input.visibility === "SHARED") {
    try {
      const activeParents = await db
        .select({ parentUserId: parentStudentLink.parentUserId })
        .from(parentStudentLink)
        .where(
          and(
            eq(parentStudentLink.studentUserId, assignment.studentUserId),
            eq(parentStudentLink.status, "ACTIVE"),
          ),
        );

      for (const p of activeParents) {
        await dispatchCareNotification({
          recipientUserId: p.parentUserId,
          type: "CARE_DOCUMENT_SHARED",
          titleFr: "Nouveau document partagé",
          titleAr: "تقرير أو وثيقة تأهيلية جديدة",
          bodyFr: "Un document ou compte-rendu a été partagé par votre spécialiste sur ANEI.",
          bodyAr: "تمت مشاركة وثيقة إكلينيكية أو تقرير تأهيلي جديد من قِبل المختص على منصة ANEI.",
          href: "/parent/enfants",
        });
      }
    } catch {
      // Non-blocking
    }
  }

  return { kind: "ok", id: doc!.id };
}

/**
 * Generates an entitlement-checked, short-lived presigned download URL for a care document.
 * Enforces Zero IDOR: only authorized specialists or linked parents can download.
 * Writes an audit access log entry.
 */
export async function getPresignedCareDocumentDownload(
  userId: string,
  documentId: string,
): Promise<
  | { kind: "ok"; downloadUrl: string; fileName: string }
  | { kind: "not_found" }
  | { kind: "forbidden" }
> {
  const [doc] = await db
    .select()
    .from(careDocument)
    .where(eq(careDocument.id, documentId))
    .limit(1);

  if (!doc) return { kind: "not_found" };

  // Authorization check
  let authorized = false;

  if (doc.uploadedByUserId === userId) {
    authorized = true;
  } else {
    // Check if caller is active specialist for this child
    const [spec] = await db
      .select({ id: specialistStudentAssignment.id })
      .from(specialistStudentAssignment)
      .where(
        and(
          eq(specialistStudentAssignment.specialistUserId, userId),
          eq(specialistStudentAssignment.studentUserId, doc.studentId),
          eq(specialistStudentAssignment.status, "ACTIVE"),
        ),
      )
      .limit(1);

    if (spec) {
      authorized = true;
    } else {
      // Check if caller is active parent for this child and document is SHARED
      const [parent] = await db
        .select({ id: parentStudentLink.id })
        .from(parentStudentLink)
        .where(
          and(
            eq(parentStudentLink.parentUserId, userId),
            eq(parentStudentLink.studentUserId, doc.studentId),
            eq(parentStudentLink.status, "ACTIVE"),
          ),
        )
        .limit(1);

      if (parent && doc.visibility === "SHARED") {
        authorized = true;
      }
    }
  }

  if (!authorized) {
    return { kind: "forbidden" };
  }

  let downloadUrl: string;
  if (env.STORAGE_PROVIDER === "s3-compatible") {
    const { signedDownloadUrl } = await import("@/server/storage");
    downloadUrl = await signedDownloadUrl(doc.objectKey, doc.fileName);
  } else {
    downloadUrl = `https://storage.local.anei/download?key=${encodeURIComponent(doc.objectKey)}&filename=${encodeURIComponent(doc.fileName)}`;
  }

  // Write audit access log
  await logCareAccess(userId, doc.studentId, "DOCUMENT", doc.id);

  return {
    kind: "ok",
    downloadUrl,
    fileName: doc.fileName,
  };
}
