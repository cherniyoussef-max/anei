import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { webinars } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { generateIcsCalendar } from "@/server/services/webinars";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [webinar] = await db
    .select()
    .from(webinars)
    .where(eq(webinars.id, id))
    .limit(1);

  if (!webinar) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const icsContent = generateIcsCalendar({
    id: webinar.id,
    title: webinar.titleFr,
    description: webinar.descriptionFr,
    startsAt: webinar.startsAt,
    durationMinutes: webinar.durationMinutes,
    meetingUrl: webinar.meetingUrl,
  });

  return new Response(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="webinaire-${webinar.slug}.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
