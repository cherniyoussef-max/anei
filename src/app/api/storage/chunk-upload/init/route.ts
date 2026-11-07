import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { uploadedFiles } from "@/server/db/schema";
import { getAdminSession, adminMutationRateLimit } from "@/server/auth/admin";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const noStore = { "Cache-Control": "private, no-store" } as const;

const initSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSizeBytes: z.number().int().positive().max(1024 * 1024 * 1024), // up to 1 GB
  totalChunks: z.number().int().positive().max(1000),
  category: z.enum(["video", "document", "course", "avatar", "general"]).default("general"),
  durationSeconds: z.number().int().nonnegative().optional().default(0),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403, headers: noStore });
  }

  // Allow admin (for courses & lessons) or active authenticated user (for profile avatars/care documents)
  const adminSession = await getAdminSession();
  const userSession = !adminSession ? await getSession() : null;
  const activeUser = adminSession?.user ?? userSession?.user;

  if (!activeUser) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: noStore });
  }

  if (adminSession) {
    const rate = await adminMutationRateLimit(adminSession.user.id);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMITED" },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
  }

  const raw = await readLimitedJson(request).catch(() => null);
  const parsed = initSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400, headers: noStore });
  }

  const data = parsed.data;
  const [fileRecord] = await db
    .insert(uploadedFiles)
    .values({
      filename: data.filename,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      category: data.category,
      totalChunks: data.totalChunks,
      uploadedChunks: 0,
      isComplete: false,
      uploadedByUserId: activeUser.id,
      durationSeconds: data.durationSeconds || 0,
    })
    .returning();

  return NextResponse.json(
    {
      fileId: fileRecord.id,
      filename: fileRecord.filename,
      totalChunks: fileRecord.totalChunks,
      chunkSize: 2.5 * 1024 * 1024,
    },
    { status: 201, headers: noStore },
  );
}
