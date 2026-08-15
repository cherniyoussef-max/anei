import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor } from "@/server/auth/admin";
import { getAppointment } from "@/server/queries/admission";

const idSchema = z.string().uuid();
const orgQuerySchema = z.object({ organizationId: z.string().uuid() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const url = new URL(request.url);
  const org = orgQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!org.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const detail = await getAppointment(org.data.organizationId, id.data);
  if (!detail) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(detail);
}