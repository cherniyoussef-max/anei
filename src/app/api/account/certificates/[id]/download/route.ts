import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { env } from "@/server/env";
import { getOwnedCertificateForDownload } from "@/server/queries/account";
import { signedDownloadUrl } from "@/server/storage";
import { generateCertificatePdf } from "@/server/services/pdf-certificate";

const idSchema = z.string().uuid();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const certificate = await getOwnedCertificateForDownload(session.user.id, id.data);
  if (!certificate) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const safeCode = certificate.code.replace(/[^a-zA-Z0-9_-]/g, "-");

  // If already uploaded to S3 storage, redirect to signed URL
  if (certificate.fileUrl && env.STORAGE_PROVIDER === "s3-compatible") {
    try {
      const url = await signedDownloadUrl(certificate.fileUrl, `certificat-${safeCode}.pdf`);
      return NextResponse.redirect(url, 307);
    } catch {
      // Fallback to dynamic generation below
    }
  }

  // Dynamic high-resolution vector PDF generation on the fly
  try {
    const pdfBuffer = generateCertificatePdf({
      studentName: session.user.name,
      courseTitle: certificate.courseTitleFr,
      courseCategory: certificate.courseCategory ?? "Formation Professionnelle Inclusive",
      certificateCode: certificate.code,
      issuedAt: certificate.issuedAt ? new Date(certificate.issuedAt) : new Date(),
      verificationUrl: `https://platform.anei.tn/fr/certificats/${certificate.code}`,
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificat-anei-${safeCode}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "PDF_GENERATION_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
