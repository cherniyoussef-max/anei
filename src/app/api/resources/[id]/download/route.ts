import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { env } from "@/server/env";
import { getPurchasedResourceForDownload } from "@/server/queries/account";
import { signedDownloadUrl } from "@/server/storage";
import { z } from "zod";

const idSchema = z.string().uuid();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rawId = (await params).id;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const entityId = id.data;

  // Authorization is performed before any storage location is revealed.
  const resource = await getPurchasedResourceForDownload(session.user.id, entityId);

  if (!resource) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  if (env.STORAGE_PROVIDER === "s3-compatible") {
    if (!resource.downloadUrl) return NextResponse.json({ error: "FILE_NOT_AVAILABLE" }, { status: 404 });
    try {
      const filename = `${resource.slug}.${resource.type.toLowerCase().includes("pdf") ? "pdf" : "bin"}`;
      const url = await signedDownloadUrl(resource.downloadUrl, filename);
      return NextResponse.redirect(url, 307);
    } catch {
      return NextResponse.json({ error: "FILE_NOT_AVAILABLE" }, { status: 404 });
    }
  }

  // Development-only deterministic resource so the entitlement flow can be
  // exercised without requiring external object storage credentials.
  const body = `# ${resource.titleFr}\n\nRessource de démonstration ANEI\n\n${resource.descriptionFr}\n\nPublic : ${resource.audienceFr}\n`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${resource.slug}.md"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
