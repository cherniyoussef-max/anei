import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { avsBookingRequests, avsProfiles } from "@/server/db/schema";
import { AdminAvsManager } from "@/components/admin/AdminAvsManager";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";

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
        parentLocation: avsBookingRequests.parentLocation,
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
    <div className="space-y-6">
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة شبكة المرافقة المدرسية" : "Réseau d'accompagnement scolaire"}
        title={ar ? "دليل ومواعيد المرافقين (AVS)" : "Annuaire & Réservations AVS"}
        description={
          ar
            ? "الإشراف على ملفات المرافقين في الدليل الوطني، ومنح شهادة اعتماد ANEI، ومتابعة حجوزات المواعيد بين الأولياء والمرافقين."
            : "Supervision des profils de l'annuaire, attribution des certifications ANEI, et suivi des demandes de rendez-vous parents-AVS."
        }
      />

      <AdminAvsManager
        locale={locale}
        initialProfiles={profiles}
        initialBookings={bookings}
      />

      <AdminFooter locale={locale} />
    </div>
  );
}
