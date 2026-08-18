import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { appointment } from "@/server/db/schema";
import { authenticateInternalAutomation, requireAutomationScope, json } from "@/server/automation/internal-auth";
import { AUTOMATION_APPOINTMENTS_READ } from "@/server/mcp/scopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ appointmentId: z.string() }).strict();

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateInternalAutomation(request);
  if (!auth.ok) return auth.response;

  const forbidden = await requireAutomationScope(auth.actor, AUTOMATION_APPOINTMENTS_READ, request);
  if (forbidden) return forbidden;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "Invalid request" });

  const [row] = await db
    .select({
      id: appointment.id,
      status: appointment.status,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      assignedToUserId: appointment.assignedToUserId,
      contactId: appointment.contactId,
      note: appointment.note,
    })
    .from(appointment)
    .where(
      and(
        eq(appointment.id, parsed.data.appointmentId),
        auth.actor.organizationId ? eq(appointment.organizationId, auth.actor.organizationId) : undefined,
      ),
    )
    .limit(1);

  if (!row) return json(404, { error: "Appointment not found" });

  return json(200, {
    appointmentId: row.id,
    status: row.status,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    assignedToUserId: row.assignedToUserId,
    contactId: row.contactId,
    note: row.note ?? null,
  });
}