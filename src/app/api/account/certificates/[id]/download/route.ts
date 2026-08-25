import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { env } from "@/server/env";
import { getOwnedCertificateForDownload } from "@/server/queries/account";
import { signedDownloadUrl } from "@/server/storage";

const idSchema = z.string().uuid();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const certificate = await getOwnedCertificateForDownload(session.user.id, id.data);
  if (!certificate) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!certificate.fileUrl) return NextResponse.json({ error: "FILE_NOT_AVAILABLE" }, { status: 404 });

  if (env.STORAGE_PROVIDER !== "s3-compatible") {
    return NextResponse.json({ error: "FILE_NOT_AVAILABLE" }, { status: 404 });
  }

  try {
    const safeCode = certificate.code.replace(/[^a-zA-Z0-9_-]/g, "-");
    const url = await signedDownloadUrl(certificate.fileUrl, `certificat-${safeCode}.pdf`);
    return NextResponse.redirect(url, 307);
  } catch {
    return NextResponse.json({ error: "FILE_NOT_AVAILABLE" }, { status: 404 });
  }
}
