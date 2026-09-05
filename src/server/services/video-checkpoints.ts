import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { enrollments, lessons, videoCheckpoint, videoCheckpointResponse } from "@/server/db/schema";

export type CheckpointOption = { id: string; textFr: string; textAr: string };

export async function getLessonCheckpoints(lessonId: string) {
  return db.select().from(videoCheckpoint).where(eq(videoCheckpoint.lessonId, lessonId)).orderBy(asc(videoCheckpoint.triggerSeconds), asc(videoCheckpoint.position));
}

export type LearnerCheckpoint = {
  id: string; triggerSeconds: number; kind: "REFLECTION" | "QUIZ"; promptFr: string; promptAr: string;
  options: CheckpointOption[] | null; answered: boolean; correct: boolean | null; selectedOptionId: string | null;
};

/** Never exposes correctOptionId to the client — the response endpoint grades server-side. */
export async function getCheckpointsForLearner(lessonId: string, enrollmentId: string): Promise<LearnerCheckpoint[]> {
  const rows = await db
    .select({ checkpoint: videoCheckpoint, response: videoCheckpointResponse })
    .from(videoCheckpoint)
    .leftJoin(videoCheckpointResponse, and(eq(videoCheckpointResponse.checkpointId, videoCheckpoint.id), eq(videoCheckpointResponse.enrollmentId, enrollmentId)))
    .where(eq(videoCheckpoint.lessonId, lessonId))
    .orderBy(asc(videoCheckpoint.triggerSeconds), asc(videoCheckpoint.position));
  return rows.map(({ checkpoint, response }) => ({
    id: checkpoint.id,
    triggerSeconds: checkpoint.triggerSeconds,
    kind: checkpoint.kind as "REFLECTION" | "QUIZ",
    promptFr: checkpoint.promptFr,
    promptAr: checkpoint.promptAr,
    options: checkpoint.options ?? null,
    answered: Boolean(response),
    correct: response?.correct ?? null,
    selectedOptionId: response?.selectedOptionId ?? null,
  }));
}

export type CreateCheckpointInput = {
  triggerSeconds: number;
  kind: "REFLECTION" | "QUIZ";
  promptFr: string;
  promptAr: string;
  options?: CheckpointOption[];
  correctOptionId?: string;
  position?: number;
};

export async function createCheckpoint(lessonId: string, input: CreateCheckpointInput) {
  const [row] = await db.insert(videoCheckpoint).values({
    lessonId,
    triggerSeconds: input.triggerSeconds,
    kind: input.kind,
    promptFr: input.promptFr,
    promptAr: input.promptAr,
    options: input.kind === "QUIZ" ? input.options ?? [] : null,
    correctOptionId: input.kind === "QUIZ" ? input.correctOptionId ?? null : null,
    position: input.position ?? 0,
  }).returning();
  return row;
}

export async function deleteCheckpoint(id: string) {
  const result = await db.delete(videoCheckpoint).where(eq(videoCheckpoint.id, id)).returning({ id: videoCheckpoint.id });
  return result.length > 0;
}

export type RecordResponseInput = { responseText?: string; selectedOptionId?: string };

export async function recordCheckpointResponse(userId: string, checkpointId: string, input: RecordResponseInput) {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ checkpoint: videoCheckpoint, enrollmentId: enrollments.id })
      .from(videoCheckpoint)
      .innerJoin(lessons, eq(lessons.id, videoCheckpoint.lessonId))
      .innerJoin(enrollments, and(eq(enrollments.courseId, lessons.courseId), eq(enrollments.userId, userId), eq(enrollments.status, "active")))
      .where(eq(videoCheckpoint.id, checkpointId))
      .limit(1);
    if (!owned) return { kind: "forbidden" as const };

    const correct = owned.checkpoint.kind === "QUIZ" && input.selectedOptionId
      ? input.selectedOptionId === owned.checkpoint.correctOptionId
      : null;

    await tx.insert(videoCheckpointResponse).values({
      enrollmentId: owned.enrollmentId,
      checkpointId,
      responseText: input.responseText ?? null,
      selectedOptionId: input.selectedOptionId ?? null,
      correct,
    }).onConflictDoUpdate({
      target: [videoCheckpointResponse.enrollmentId, videoCheckpointResponse.checkpointId],
      set: { responseText: input.responseText ?? null, selectedOptionId: input.selectedOptionId ?? null, correct },
    });

    return { kind: "ok" as const, correct };
  });
}
