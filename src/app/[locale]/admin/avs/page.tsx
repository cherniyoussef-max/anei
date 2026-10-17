import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { avsBookingRequests, avsProfiles } from "@/server/db/schema";
import { AdminAvsManager } from "@/components/admin/AdminAvsManager";

export const dynamic = "force-dynamic";

export default async function AdminAvsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireAdminPermission(locale, "overview.read");

  const [profiles, bookings] = await Promise.all([
    db.select().from(avsProfiles).orderBy(desc(avsProfiles.createdAt)),
    db
      .select({
        id: avsBookingRequests.id,
        avsProfileId: avsBookingRequests.avsProfileId,
        parentUserId: avsBookingRequests.parentUserId,
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
        amountMillimes: avsBookingRequests.amountMillimes,
        platformFeeMillimes: avsBookingRequests.platformFeeMillimes,
        avsPayoutMillimes: avsBookingRequests.avsPayoutMillimes,
        paymentStatus: avsBookingRequests.paymentStatus,
        paymentMethod: avsBookingRequests.paymentMethod,
        paymentReference: avsBookingRequests.paymentReference,
        paidAt: avsBookingRequests.paidAt,
        paymentMode: avsBookingRequests.paymentMode,
        platformCommissionPercent: avsBookingRequests.platformCommissionPercent,
        netPractitionerPayoutMillimes: avsBookingRequests.netPractitionerPayoutMillimes,
        liveSessionId: avsBookingRequests.liveSessionId,
        practitionerNotes: avsBookingRequests.practitionerNotes,
        escrowStatus: avsBookingRequests.escrowStatus,
        escrowReleasedAt: avsBookingRequests.escrowReleasedAt,
        refundedAt: avsBookingRequests.refundedAt,
        createdAt: avsBookingRequests.createdAt,
        updatedAt: avsBookingRequests.updatedAt,
        avsName: avsProfiles.displayName,
        avsSpecialty: avsProfiles.specialtyFr,
      })
      .from(avsBookingRequests)
      .innerJoin(avsProfiles, eq(avsBookingRequests.avsProfileId, avsProfiles.id))
      .orderBy(desc(avsBookingRequests.createdAt)),
  ]);

  const ar = locale === "ar";

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#a9752f]">
          {ar ? "إدارة شبكة المرافقة المدرسية" : "Réseau d'accompagnement scolaire"}
        </span>
        <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-[#082D55] sm:text-3xl">
          {ar ? "دليل ومواعيد المرافقين (AVS)" : "Annuaire & Réservations AVS"}
        </h1>
        <p className="mt-1 text-sm text-[#7a7261]">
          {ar
            ? "الإشراف على ملفات المرافقين في الدليل الوطني، ومنح شهادة اعتماد ANEI، ومتابعة حجوزات المواعيد بين الأولياء والمرافقين."
            : "Supervision des profils de l'annuaire, attribution des certifications ANEI, et suivi des demandes de rendez-vous parents-AVS."}
        </p>
      </div>

      <AdminAvsManager
        locale={locale}
        initialProfiles={profiles}
        initialBookings={bookings}
      />
    </div>
  );
}
