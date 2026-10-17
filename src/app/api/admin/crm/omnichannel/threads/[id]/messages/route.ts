import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { db } from "@/server/db";
import { crmThreads, crmMessages } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getOmnichannelThreadDetail } from "@/server/services/omnichannel-crm";

const messageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  messageType: z.enum(["TEXT", "TEMPLATE", "DOCUMENT", "IMAGE"]).default("TEXT"),
}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { id } = await params;
  const thread = await db.select().from(crmThreads).where(eq(crmThreads.id, id)).limit(1).then((r) => r[0]);
  if (!thread) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const raw = await readLimitedJson(request).catch(() => null);
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const [newMsg] = await db.transaction(async (tx) => {
    const [msg] = await tx
      .insert(crmMessages)
      .values({
        threadId: id,
        direction: "OUTBOUND",
        messageType: parsed.data.messageType,
        content: parsed.data.content,
        deliveryStatus: "SENT",
        sentByAdminId: session.user.id,
        createdAt: now,
      })
      .returning();

    await tx
      .update(crmThreads)
      .set({
        lastMessageAt: now,
        lastMessagePreview: parsed.data.content.slice(0, 160),
        lastMessageDirection: "OUTBOUND",
        assignedAdminId: session.user.id,
        updatedAt: now,
      })
      .where(eq(crmThreads.id, id));

    return [msg];
  });

  const detail = await getOmnichannelThreadDetail(id);
  return NextResponse.json({ message: newMsg, thread: detail?.thread }, { status: 201 });
}
