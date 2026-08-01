import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { purchases, resources } from "@/server/db/schema";
import { env } from "@/server/env";
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
  const [row] = await db
    .select({ resource: resources })
    .from(purchases)
    .innerJoin(resources, eq(purchases.resourceId, resources.id))
    .where(and(eq(purchases.userId, session.user.id), eq(resources.id, entityId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  if (env.STORAGE_PROVIDER === "s3-compatible") {
    if (!row.resource.downloadUrl) return NextResponse.json({ error: "FILE_NOT_AVAILABLE" }, { status: 404 });
    try {
      const filename = `${row.resource.slug}.${row.resource.type.toLowerCase().includes("pdf") ? "pdf" : "bin"}`;
      const url = await signedDownloadUrl(row.resource.downloadUrl, filename);
      return NextResponse.redirect(url, 307);
    } catch {
      return NextResponse.json({ error: "FILE_NOT_AVAILABLE" }, { status: 404 });
    }
  }

  // Development-only deterministic resource so the entitlement flow can be
  // exercised without requiring external object storage credentials.
  const body = `# ${row.resource.titleFr}\n\nRessource de démonstration ANEI\n\n${row.resource.descriptionFr}\n\nPublic : ${row.resource.audienceFr}\n`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${row.resource.slug}.md"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
