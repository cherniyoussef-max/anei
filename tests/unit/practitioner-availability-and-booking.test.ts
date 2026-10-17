import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// Availability Schema under test
const availabilitySchema = z.object({
  availabilityStatusLabel: z.enum([
    "IMMEDIATE_FULL_TIME",
    "WEEKDAYS",
    "WEEKENDS_AND_EVENINGS",
    "UNAVAILABLE",
  ]).default("IMMEDIATE_FULL_TIME"),
  acceptedModalities: z.enum(["BOTH", "IN_PERSON_ONLY", "ONLINE_ONLY"]).default("BOTH"),
  availableLocationsText: z.string().max(500).default(""),
  weeklySchedule: z.record(
    z.string(),
    z.object({
      enabled: z.boolean(),
      slots: z.array(z.string().trim().regex(/^\d{1,2}:\d{2}$/)).max(24),
    })
  ),
  contactPhone: z.string().max(30).optional().nullable(),
  whatsappPhone: z.string().max(30).optional().nullable(),
});

// Booking Action Schema
const actionSchema = z.object({
  action: z.enum(["CONFIRM", "DECLINE", "COMPLETE"]),
  practitionerNotes: z.string().max(2000).optional(),
});

test("Availability schema validates standard practitioner schedule", () => {
  const valid = availabilitySchema.safeParse({
    availabilityStatusLabel: "IMMEDIATE_FULL_TIME",
    acceptedModalities: "BOTH",
    availableLocationsText: "Grand Tunis, Ariana, La Marsa",
    weeklySchedule: {
      "1": { enabled: true, slots: ["09:00", "10:30", "14:00", "15:30"] },
      "2": { enabled: true, slots: ["09:00", "10:30"] },
      "0": { enabled: false, slots: [] },
    },
    contactPhone: "+216 20 123 456",
  });

  assert.equal(valid.success, true);
});

test("Availability schema rejects invalid time slot formats", () => {
  const invalid = availabilitySchema.safeParse({
    availabilityStatusLabel: "WEEKDAYS",
    acceptedModalities: "IN_PERSON_ONLY",
    weeklySchedule: {
      "1": { enabled: true, slots: ["9am", "invalid-time"] },
    },
  });

  assert.equal(invalid.success, false);
});

test("Availability schema rejects invalid modalities or unknown status", () => {
  const invalidModality = availabilitySchema.safeParse({
    acceptedModalities: "TELEPATHY",
    weeklySchedule: {},
  });
  assert.equal(invalidModality.success, false);

  const invalidStatus = availabilitySchema.safeParse({
    availabilityStatusLabel: "ALWAYS_FREE_24_7",
    weeklySchedule: {},
  });
  assert.equal(invalidStatus.success, false);
});

test("Booking action schema validates CONFIRM, DECLINE, and COMPLETE with notes", () => {
  const confirmAction = actionSchema.safeParse({
    action: "CONFIRM",
  });
  assert.equal(confirmAction.success, true);

  const declineAction = actionSchema.safeParse({
    action: "DECLINE",
    practitionerNotes: "Créneau complet en raison d'une urgence cabinet.",
  });
  assert.equal(declineAction.success, true);

  const completeAction = actionSchema.safeParse({
    action: "COMPLETE",
  });
  assert.equal(completeAction.success, true);
});

test("Booking action schema rejects unauthorized action strings", () => {
  const badAction = actionSchema.safeParse({
    action: "DELETE_FOREVER",
  });
  assert.equal(badAction.success, false);
});

test("Collision logic correctly identifies conflicting slot reservations", () => {
  interface ExistingBooking {
    avsProfileId: string;
    requestedDate: string;
    requestedTimeSlot: string;
    status: string;
  }

  const existingBookings: ExistingBooking[] = [
    {
      avsProfileId: "prof-ortho-1",
      requestedDate: "2026-10-20",
      requestedTimeSlot: "10:30",
      status: "AWAITING_PRACTITIONER_CONFIRMATION",
    },
    {
      avsProfileId: "prof-ortho-1",
      requestedDate: "2026-10-20",
      requestedTimeSlot: "14:00",
      status: "DECLINED", // previously declined - slot is released!
    },
    {
      avsProfileId: "prof-ortho-1",
      requestedDate: "2026-10-21",
      requestedTimeSlot: "09:00",
      status: "CONFIRMED",
    },
  ];

  function isSlotConflicting(profileId: string, date: string, slot: string): boolean {
    const blockingStatuses = ["AWAITING_PRACTITIONER_CONFIRMATION", "PENDING", "CONFIRMED"];
    return existingBookings.some(
      (b) =>
        b.avsProfileId === profileId &&
        b.requestedDate === date &&
        b.requestedTimeSlot === slot &&
        blockingStatuses.includes(b.status)
    );
  }

  // 1. Conflicting slot (in pending confirmation)
  assert.equal(isSlotConflicting("prof-ortho-1", "2026-10-20", "10:30"), true);

  // 2. Conflicting slot (already confirmed)
  assert.equal(isSlotConflicting("prof-ortho-1", "2026-10-21", "09:00"), true);

  // 3. Free slot (was declined, slot is open again)
  assert.equal(isSlotConflicting("prof-ortho-1", "2026-10-20", "14:00"), false);

  // 4. Free slot (different practitioner)
  assert.equal(isSlotConflicting("prof-ortho-2", "2026-10-20", "10:30"), false);
});

test("Pricing & commission calculations: 0% presentiel vs 15% visio", () => {
  function computeBookingFinancials(params: {
    directoryType: "AVS" | "SPECIALIST";
    meetingType: "IN_PERSON" | "ONLINE" | "ONLINE_VISIO";
    inPersonPriceMillimes: number;
    onlinePriceMillimes: number;
  }) {
    const isOnline = params.meetingType === "ONLINE" || params.meetingType === "ONLINE_VISIO";
    const isSpecialist = params.directoryType === "SPECIALIST";

    if (!isOnline) {
      // 0% platform fee for in-person cabinet
      return {
        paymentMode: "PAY_ON_SITE",
        platformCommissionPercent: 0,
        platformFeeMillimes: 0,
        totalAmountMillimes: params.inPersonPriceMillimes,
        practitionerPayoutMillimes: params.inPersonPriceMillimes,
        escrowStatus: "NOT_APPLICABLE",
      };
    }

    // Online visio: 15% for specialists, 10% for AVS
    const commissionPercent = isSpecialist ? 15 : 10;
    const baseRate = params.onlinePriceMillimes;
    const platformFee = Math.round(baseRate * (commissionPercent / 100));
    return {
      paymentMode: "PLATFORM_ESCROW",
      platformCommissionPercent: commissionPercent,
      platformFeeMillimes: platformFee,
      totalAmountMillimes: baseRate + platformFee,
      practitionerPayoutMillimes: baseRate,
      escrowStatus: "HELD_IN_ESCROW",
    };
  }

  // Case 1: Specialist in cabinet (45 DT)
  const specialistCabinet = computeBookingFinancials({
    directoryType: "SPECIALIST",
    meetingType: "IN_PERSON",
    inPersonPriceMillimes: 45000,
    onlinePriceMillimes: 40000,
  });
  assert.equal(specialistCabinet.paymentMode, "PAY_ON_SITE");
  assert.equal(specialistCabinet.platformCommissionPercent, 0);
  assert.equal(specialistCabinet.platformFeeMillimes, 0);
  assert.equal(specialistCabinet.practitionerPayoutMillimes, 45000);
  assert.equal(specialistCabinet.escrowStatus, "NOT_APPLICABLE");

  // Case 2: Specialist in Visio (40 DT + 15% commission = 46 DT total)
  const specialistVisio = computeBookingFinancials({
    directoryType: "SPECIALIST",
    meetingType: "ONLINE_VISIO",
    inPersonPriceMillimes: 45000,
    onlinePriceMillimes: 40000,
  });
  assert.equal(specialistVisio.paymentMode, "PLATFORM_ESCROW");
  assert.equal(specialistVisio.platformCommissionPercent, 15);
  assert.equal(specialistVisio.platformFeeMillimes, 6000);
  assert.equal(specialistVisio.totalAmountMillimes, 46000);
  assert.equal(specialistVisio.practitionerPayoutMillimes, 40000);
  assert.equal(specialistVisio.escrowStatus, "HELD_IN_ESCROW");
});
