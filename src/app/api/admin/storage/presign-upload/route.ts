import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, adminMutationRateLimit } from "@/server/auth/admin";
import { env } from "@/server/env";
import { isTrustedMutation } from "@/server/security/origin";
import { signedUploadUrl } from "@/server/storage";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({
  category: z.enum(["resource", "course", "avatar", "certificate"]),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4", "text/vtt"]),
  contentLength: z.number().int().positive().max(500 * 1024 * 1024),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (env.STORAGE_PROVIDER !== "s3-compatible") return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  try {
    return NextResponse.json(await signedUploadUrl(parsed.data), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UPLOAD_SIGNING_FAILED";
    return NextResponse.json({ error: code }, { status: code === "UNSUPPORTED_MEDIA_TYPE" ? 415 : 400 });
  }
}
