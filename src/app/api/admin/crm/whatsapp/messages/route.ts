import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor } from "@/server/auth/admin";
import { searchWhatsappMessages } from "@/server/queries/whatsapp";

const searchSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  direction: z.enum(["INBOUND", "OUTBOUND"]).optional(),
  status: z.enum(["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"]).optional(),
  sort: z.enum(["createdAt", "sentAt", "deliveredAt", "readAt", "failedAt"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = searchSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const { organizationId, direction, status, sort, sortDirection, page, pageSize, contactId } = parsed.data;
  const result = await searchWhatsappMessages(
    {
      organizationId,
      contactId,
      direction,
      status,
      page: page ?? 1,
      pageSize: pageSize ?? 25,
    },
    { column: sort ?? "createdAt", direction: sortDirection ?? "desc" },
  );
  return NextResponse.json(result);
}