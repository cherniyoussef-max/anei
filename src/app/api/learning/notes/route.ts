import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { lessonPersonalNotes } from "@/server/db/schema";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";

const postSchema = z.object({
  id: z.string().optional(),
  lessonId: z.string().min(1),
  timestampSeconds: z.number().int().nonnegative().default(0),
  content: z.string().min(1).max(10000),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get("lessonId");
  if (!lessonId) return NextResponse.json({ error: "MISSING_LESSON_ID" }, { status: 400 });

  const notes = await db
    .select({
      id: lessonPersonalNotes.id,
      timestampSeconds: lessonPersonalNotes.timestampSeconds,
      content: lessonPersonalNotes.content,
      createdAt: lessonPersonalNotes.createdAt,
      updatedAt: lessonPersonalNotes.updatedAt,
    })
    .from(lessonPersonalNotes)
    .where(
      and(
        eq(lessonPersonalNotes.lessonId, lessonId),
        eq(lessonPersonalNotes.userId, session.user.id)
      )
    )
    .orderBy(asc(lessonPersonalNotes.timestampSeconds), asc(lessonPersonalNotes.createdAt));

  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const rate = await consumeRateLimit(`notes:${session.user.id}`, 60, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.issues }, { status: 400 });
  }

  const { id: noteId, lessonId, timestampSeconds, content } = parsed.data;

  if (noteId) {
    // Update existing note
    const [existing] = await db
      .select({ id: lessonPersonalNotes.id })
      .from(lessonPersonalNotes)
      .where(
        and(
          eq(lessonPersonalNotes.id, noteId),
          eq(lessonPersonalNotes.userId, session.user.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const [updated] = await db
      .update(lessonPersonalNotes)
      .set({
        content,
        timestampSeconds,
        updatedAt: new Date(),
      })
      .where(eq(lessonPersonalNotes.id, noteId))
      .returning();

    return NextResponse.json({ success: true, note: updated });
  }

  // Create new note
  const newId = crypto.randomUUID();
  const [created] = await db
    .insert(lessonPersonalNotes)
    .values({
      id: newId,
      userId: session.user.id,
      lessonId,
      timestampSeconds,
      content,
    })
    .returning();

  return NextResponse.json({ success: true, note: created }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const { id: noteId } = parsed.data;
  const deleted = await db
    .delete(lessonPersonalNotes)
    .where(
      and(
        eq(lessonPersonalNotes.id, noteId),
        eq(lessonPersonalNotes.userId, session.user.id)
      )
    )
    .returning({ id: lessonPersonalNotes.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
