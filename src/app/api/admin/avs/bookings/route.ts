import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { avsBookingRequests, avsProfiles } from "@/server/db/schema";
import { getAdminSession } from "@/server/auth/admin";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const bookings = await db
    .select({
      id: avsBookingRequests.id,
      avsProfileId: avsBookingRequests.avsProfileId,
      avsName: avsProfiles.displayName,
      avsSpecialty: avsProfiles.specialtyFr,
      parentName: avsBookingRequests.parentName,
      parentEmail: avsBookingRequests.parentEmail,
      parentPhone: avsBookingRequests.parentPhone,
      childName: avsBookingRequests.childName,
      childAge: avsBookingRequests.childAge,
      schoolName: avsBookingRequests.schoolName,
      needDescription: avsBookingRequests.needDescription,
      interventionDomain: avsBookingRequests.interventionDomain,
      requestedDate: avsBookingRequests.requestedDate,
      requestedTimeSlot: avsBookingRequests.requestedTimeSlot,
      meetingType: avsBookingRequests.meetingType,
      status: avsBookingRequests.status,
      notes: avsBookingRequests.notes,
      createdAt: avsBookingRequests.createdAt,
    })
    .from(avsBookingRequests)
    .innerJoin(avsProfiles, eq(avsBookingRequests.avsProfileId, avsProfiles.id))
    .orderBy(desc(avsBookingRequests.createdAt));

  return NextResponse.json({ ok: true, bookings });
}
