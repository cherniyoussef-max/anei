import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAdminSession, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { saveUploadedFile } from "@/server/storage/app-storage";

const noStore = { "Cache-Control": "private, no-store" } as const;

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403, headers: noStore });
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_FORM_DATA" }, { status: 400, headers: noStore });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string" || !(file instanceof Blob)) {
    return NextResponse.json({ error: "MISSING_FILE" }, { status: 400, headers: noStore });
  }

  const category = String(formData.get("category") || "general").replace(/[^a-zA-Z0-9_-]/g, "");
  const originalFilename = "name" in file ? (file as File).name : "upload.bin";
  const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const contentType = file.type || "application/octet-stream";

  const extMatch = sanitizedFilename.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1]}` : "";
  const datePrefix = new Date().toISOString().slice(0, 10);
  const objectKey = `${category}/${datePrefix}/${crypto.randomUUID()}${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const saved = await saveUploadedFile({
    objectKey,
    category,
    filename: originalFilename,
    contentType,
    data: buffer,
  });

  return NextResponse.json(
    {
      success: true,
      objectKey: saved.objectKey,
      fileUrl: `/api/storage/files/${saved.objectKey}`,
      filename: saved.filename,
      fileSize: saved.fileSize,
      contentType: saved.contentType,
    },
    { status: 201, headers: noStore },
  );
}
