import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { avsBookingRequests, avsProfiles } from "@/server/db/schema";
import {
  PractitionerDashboardClient,
  type PractitionerBookingItem,
} from "@/components/practitioner/PractitionerDashboardClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "لوحة تحكم الممارس والأخصائي | ANEI" : "Espace Praticien & Consultations | ANEI",
    description: ar
      ? "إدارة مواعيد الاستشارات الحضورية والجلسات المرئية ومتابعة الأتعاب."
      : "Gestion des rendez-vous en cabinet et téléconsultations ANEI.",
  };
}

export default async function PractitionerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    redirect(`/${locale}/connexion?callbackUrl=/${locale}/dashboard/praticien`);
  }

  // Look up practitioner profile linked to this user (or if admin, allow fallback to first profile for review)
  let [profile] = await db
    .select()
    .from(avsProfiles)
    .where(eq(avsProfiles.userId, session.user.id))
    .limit(1);

  if (!profile) {
    if (["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role))) {
      // Admin demo fallback
      const [firstProfile] = await db.select().from(avsProfiles).limit(1);
      if (firstProfile) profile = firstProfile;
    }
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-4" dir={ar ? "rtl" : "ltr"}>
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center font-bold text-xl">
          !
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {ar ? "لم يتم العثور على ملف مهني معتمد" : "Aucun profil praticien agréé associé"}
        </h1>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          {ar
            ? "هذا الفضاء مخصص للأخصائيين والمرافقين المعتمدين في الدليل الوطني بعد استكمال مسار التكوين والمصادقة."
            : "Cet espace est réservé aux praticiens et AVS agréés après validation de leur parcours de formation."}
        </p>
      </div>
    );
  }

  const rawBookings = await db
    .select({
      id: avsBookingRequests.id,
      parentName: avsBookingRequests.parentName,
      parentPhone: avsBookingRequests.parentPhone,
      parentEmail: avsBookingRequests.parentEmail,
      childName: avsBookingRequests.childName,
      childAge: avsBookingRequests.childAge,
      needDescription: avsBookingRequests.needDescription,
      requestedDate: avsBookingRequests.requestedDate,
      requestedTimeSlot: avsBookingRequests.requestedTimeSlot,
      meetingType: avsBookingRequests.meetingType,
      paymentMode: avsBookingRequests.paymentMode,
      platformCommissionPercent: avsBookingRequests.platformCommissionPercent,
      amountMillimes: avsBookingRequests.amountMillimes,
      netPractitionerPayoutMillimes: avsBookingRequests.netPractitionerPayoutMillimes,
      status: avsBookingRequests.status,
      escrowStatus: avsBookingRequests.escrowStatus,
      liveSessionId: avsBookingRequests.liveSessionId,
      createdAt: avsBookingRequests.createdAt,
    })
    .from(avsBookingRequests)
    .where(eq(avsBookingRequests.avsProfileId, profile.id))
    .orderBy(desc(avsBookingRequests.requestedDate));

  const initialBookings: PractitionerBookingItem[] = rawBookings.map((b) => ({
    id: b.id,
    parentName: b.parentName,
    parentPhone: b.parentPhone,
    parentEmail: b.parentEmail,
    childName: b.childName,
    childAge: b.childAge,
    needDescription: b.needDescription,
    requestedDate: b.requestedDate,
    requestedTimeSlot: b.requestedTimeSlot,
    meetingType: b.meetingType,
    paymentMode: b.paymentMode,
    platformCommissionPercent: b.platformCommissionPercent,
    amountMillimes: b.amountMillimes,
    netPractitionerPayoutMillimes: b.netPractitionerPayoutMillimes,
    status: b.status,
    escrowStatus: b.escrowStatus,
    liveSessionId: b.liveSessionId,
    createdAt: b.createdAt,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <PractitionerDashboardClient
        locale={locale}
        profile={{
          id: profile.id,
          displayName: profile.displayName,
          directoryType: profile.directoryType,
          category: profile.category,
          cityFr: profile.cityFr,
          cityAr: profile.cityAr,
          governorateFr: profile.governorateFr,
          governorateAr: profile.governorateAr,
          contactPhone: profile.contactPhone,
          whatsappPhone: profile.whatsappPhone,
          showPhonePublicly: profile.showPhonePublicly,
          inPersonPriceMillimes: profile.inPersonPriceMillimes,
          onlineVisioPriceMillimes: profile.onlineVisioPriceMillimes,
          consultationDurationMinutes: profile.consultationDurationMinutes,
          workplaceName: profile.workplaceName,
          workplaceAddress: profile.workplaceAddress,
          bioFr: profile.bioFr,
          bioAr: profile.bioAr,
        }}
        initialBookings={initialBookings}
      />
    </div>
  );
}
