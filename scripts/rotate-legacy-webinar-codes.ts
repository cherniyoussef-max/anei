import { db } from "../src/server/db";
import { webinars, webinarRegistrations, user, notifications } from "../src/server/db/schema";
import { and, eq, gt, or } from "drizzle-orm";
import { generateAccessCode, hashAccessCode } from "../src/lib/webinars";
import { sendWebinarAccessPassMail } from "../src/server/services/mailer";

export async function rotateLegacyWebinarCodes(options?: { dryRun?: boolean }) {
  const isDryRun = options?.dryRun ?? process.argv.includes("--dry-run");

  console.log(`[rotation] Starting legacy webinar access code rotation (dry-run: ${isDryRun})...`);

  const now = new Date();

  // Find registrations for UPCOMING webinars with legacy access_code_version = 1
  const rows = await db
    .select({
      regId: webinarRegistrations.id,
      userId: webinarRegistrations.userId,
      webinarId: webinarRegistrations.webinarId,
      status: webinarRegistrations.status,
      accessCodeVersion: webinarRegistrations.accessCodeVersion,
      webinarTitleFr: webinars.titleFr,
      webinarTitleAr: webinars.titleAr,
      webinarSlug: webinars.slug,
      startsAt: webinars.startsAt,
      meetingProvider: webinars.meetingProvider,
      userName: user.name,
      userEmail: user.email,
    })
    .from(webinarRegistrations)
    .innerJoin(webinars, eq(webinarRegistrations.webinarId, webinars.id))
    .leftJoin(user, eq(webinarRegistrations.userId, user.id))
    .where(
      and(
        gt(webinars.startsAt, now),
        eq(webinarRegistrations.accessCodeVersion, 1),
        or(
          eq(webinarRegistrations.status, "ACCEPTED"),
          eq(webinarRegistrations.status, "REGISTERED"),
        ),
      ),
    );

  console.log(`[rotation] Found ${rows.length} upcoming registration(s) with legacy access code version 1.`);

  if (rows.length === 0) {
    console.log("[rotation] No legacy registrations to rotate. Database is already up to date.");
    return { rotatedCount: 0, dryRun: isDryRun };
  }

  let rotatedCount = 0;

  for (const row of rows) {
    const recipientEmail = row.userEmail;
    const recipientName = row.userName || recipientEmail || "Participant";

    if (isDryRun) {
      console.log(
        `[dry-run] Would rotate code for: ${recipientEmail ?? row.regId} | Webinar: "${row.webinarTitleFr}" (${row.webinarId})`,
      );
      rotatedCount++;
      continue;
    }

    // 1. Generate new 128-bit CSPRNG access code
    const newRawCode = generateAccessCode("MEET");
    const newHashedCode = hashAccessCode(newRawCode);

    // 2. Update registration in database to version 2 with hashed code and ACCEPTED status
    await db
      .update(webinarRegistrations)
      .set({
        accessCode: newHashedCode,
        accessCodeVersion: 2,
        status: "ACCEPTED",
      })
      .where(eq(webinarRegistrations.id, row.regId));

    const appBaseUrl = process.env.BETTER_AUTH_URL || process.env.APP_URL || "http://localhost:3000";
    const joinUrl = `${appBaseUrl}/api/webinars/${row.webinarId}/join?code=${newRawCode}`;

    // 3. Dispatch bilingual notification if member
    if (row.userId) {
      await db.insert(notifications).values({
        userId: row.userId,
        type: "webinar_access_granted",
        title: "Mise à jour sécurisée de votre code d'accès / تحديث رمز الدخول الآمن",
        body: `Votre nouveau code d'accès sécurisé pour "${row.webinarTitleFr}" est : ${newRawCode}. / رمز الدخول الجديد الخاص بك هو: ${newRawCode}`,
        href: `/fr/webinaires/${row.webinarSlug}?code=${newRawCode}`,
        read: false,
      }).catch(() => undefined);
    }

    // 4. Send official rotation email
    if (recipientEmail) {
      await sendWebinarAccessPassMail({
        name: recipientName,
        email: recipientEmail,
        webinarTitle: `${row.webinarTitleFr} / ${row.webinarTitleAr}`,
        startsAt: row.startsAt,
        meetingProvider: row.meetingProvider,
        accessCode: newRawCode,
        joinUrl,
        locale: "fr",
      }).catch((err) => {
        console.warn(`[rotation] Failed to dispatch email to ${recipientEmail}:`, err?.message || err);
      });
    }

    rotatedCount++;
    console.log(`[rotation] Successfully rotated code for ${recipientEmail ?? row.regId} -> version 2.`);
  }

  console.log(`[rotation] Completed rotation. Processed ${rotatedCount} registrations.`);
  return { rotatedCount, dryRun: isDryRun };
}

// Direct CLI execution
if (process.argv[1]?.endsWith("rotate-legacy-webinar-codes.ts") || process.argv[1]?.endsWith("rotate-legacy-webinar-codes.js")) {
  rotateLegacyWebinarCodes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[rotation] Fatal error:", err);
      process.exit(1);
    });
}
