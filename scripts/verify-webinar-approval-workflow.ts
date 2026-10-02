import { Client } from "pg";
import crypto from "crypto";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://anei:anei@127.0.0.1:5432/anei";

async function runVerification() {
  console.log("=== STARTING FULL END-TO-END WEBINAR WORKFLOW VERIFICATION ===");
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const testId = crypto.randomUUID();
  const webinarSlug = `verify-approval-${testId.slice(0, 8)}`;
  const startsAt = new Date(Date.now() + 86400 * 1000 * 5); // 5 days in future

  // Seed test webinar with custom form fields and require_approval = true
  const formFields = [
    { id: "phone", label: "Numéro WhatsApp / Téléphone", type: "phone", required: true },
    { id: "role", label: "Votre profession / rôle", type: "select", required: true, options: ["Enseignant", "AVS", "Parent"] },
    { id: "organization", label: "Établissement ou association", type: "text", required: false },
    { id: "expectations", label: "Vos attentes pour cet atelier", type: "textarea", required: false },
  ];

  console.log("[1/6] Seeding test webinar with custom form fields and require_approval=true...");
  await client.query(
    `INSERT INTO "webinars" (
      id, slug, title_fr, title_ar, description_fr, description_ar,
      trainer_name, starts_at, duration_minutes, meeting_provider,
      meeting_url, max_participants, published, require_approval, form_fields
    ) VALUES ($1, $2, 'Atelier Pratique Inclusion TSA', 'ورشة تطبيقية للدمج المدرسي',
              'Formation pratique pour enseignants et AVS.', 'تدريب تطبيقي للمعلمين والمرافقين.',
              'Dr. Mariem Ben Salem', $3, 90, 'google_meet',
              'https://meet.google.com/xyz-qwer-tyu', 50, true, true, $4::jsonb)`,
    [testId, webinarSlug, startsAt.toISOString(), JSON.stringify(formFields)],
  );

  // Seed test user
  const userId = crypto.randomUUID();
  const userEmail = `participant-${testId.slice(0, 8)}@example.test`;
  await client.query(
    `INSERT INTO "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     VALUES ($1, 'Sami Trabelsi', $2, true, 'USER', 'teacher', now(), now())`,
    [userId, userEmail],
  );

  try {
    // 1. Mandatory Account Check: HTTP request without session
    console.log("[2/6] Verifying mandatory account check on /api/webinars/register...");
    const unauthRes = await fetch("http://127.0.0.1:3000/api/webinars/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:3000",
      },
      body: JSON.stringify({
        webinarId: testId,
        answers: { phone: "+21620123456", role: "Enseignant" },
      }),
    });
    const unauthData = await unauthRes.json();
    if (unauthRes.status !== 401 || unauthData.message !== "ACCOUNT_REQUIRED") {
      throw new Error(`Expected 401 ACCOUNT_REQUIRED, got status ${unauthRes.status}: ${JSON.stringify(unauthData)}`);
    }
    console.log("  ✓ Unauthenticated access correctly rejected with 401 ACCOUNT_REQUIRED.");

    // 2. Service-level registration with custom form answers
    console.log("[3/6] Registering user with custom form answers (pending approval)...");
    const { registerWebinarParticipant, approveWebinarRegistration, getWebinarRegistrationsAdmin, trackWebinarJoin } =
      await import("../src/server/services/webinars");

    const regResult = await registerWebinarParticipant({
      webinarId: testId,
      userId,
      answers: {
        phone: "+21620123456",
        role: "Enseignant",
        organization: "École Pilote Ariana",
        expectations: "Apprendre à concevoir des supports visuels adaptés.",
      },
      locale: "fr",
    });

    if (!regResult.ok || regResult.status !== "PENDING_APPROVAL") {
      throw new Error(`Expected registration PENDING_APPROVAL, got: ${JSON.stringify(regResult)}`);
    }
    if (regResult.accessCode !== null) {
      throw new Error(`Expected accessCode to be null when pending, got: ${regResult.accessCode}`);
    }
    console.log("  ✓ Registration created in PENDING_APPROVAL state, accessCode is null.");

    // 3. Admin query: verify custom answers and participant details
    console.log("[4/6] Admin review: retrieving participant list and custom form answers...");
    const adminRows = await getWebinarRegistrationsAdmin(testId);
    if (adminRows.length !== 1) {
      throw new Error(`Expected 1 admin registration row, found ${adminRows.length}`);
    }
    const adminRow = adminRows[0];
    if (adminRow.answers?.organization !== "École Pilote Ariana" || adminRow.answers?.role !== "Enseignant") {
      throw new Error(`Custom answers mismatch in admin view: ${JSON.stringify(adminRow.answers)}`);
    }
    console.log("  ✓ Admin correctly sees participant answers:", JSON.stringify(adminRow.answers));

    // 4. Admin approval: generate code, create in-app notification, dispatch email
    console.log("[5/6] Admin approval: approving registration and delivering one-time pass...");
    const approvalResult = await approveWebinarRegistration({
      registrationId: regResult.registrationId!,
      actorAdminId: "admin-actor-uuid",
      locale: "fr",
    });

    if (!approvalResult.ok || !approvalResult.accessCode?.startsWith("MEET-")) {
      throw new Error(`Approval failed or invalid code: ${JSON.stringify(approvalResult)}`);
    }
    console.log(`  ✓ Registration APPROVED. Generated one-time code: ${approvalResult.accessCode}`);

    // Verify in-platform notification created
    const notifRes = await client.query(
      `SELECT id, type, title, body, href FROM "notifications" WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (notifRes.rows.length === 0 || !notifRes.rows[0].body.includes(approvalResult.accessCode)) {
      throw new Error(`In-platform notification missing or code not included: ${JSON.stringify(notifRes.rows)}`);
    }
    console.log("  ✓ In-platform notification created in user's inbox:", notifRes.rows[0].body);

    // 5. Attendance tracking with one-time code
    console.log("[6/6] Joining webinar via unique access code...");
    const joinResult = await trackWebinarJoin({
      webinarId: testId,
      accessCode: approvalResult.accessCode,
    });

    if (!joinResult.ok || joinResult.meetingUrl !== "https://meet.google.com/xyz-qwer-tyu") {
      throw new Error(`Join failed or wrong meeting URL: ${JSON.stringify(joinResult)}`);
    }

    const attendedRow = await client.query(
      `SELECT status, joined_at FROM "webinar_registrations" WHERE id = $1`,
      [regResult.registrationId],
    );
    if (attendedRow.rows[0].status !== "ATTENDED" || !attendedRow.rows[0].joined_at) {
      throw new Error(`Attendance not tracked properly: ${JSON.stringify(attendedRow.rows[0])}`);
    }
    console.log("  ✓ Participant successfully joined Google Meet. Attendance timestamp recorded:", attendedRow.rows[0].joined_at);

    // Verify public pages response
    console.log("Verifying HTTP pages (FR and AR)...");
    const frRes = await fetch(`http://127.0.0.1:3000/fr/webinaires/${webinarSlug}`);
    if (frRes.status !== 200) throw new Error(`FR webinar page failed: status ${frRes.status}`);
    const arRes = await fetch(`http://127.0.0.1:3000/ar/webinaires/${webinarSlug}`);
    if (arRes.status !== 200) throw new Error(`AR webinar page failed: status ${arRes.status}`);
    console.log("  ✓ Public detail pages returned 200 in both French and Arabic.");

    console.log("\n=======================================================");
    console.log("🎉 ALL WEBINAR WORKFLOW VERIFICATION CHECKS PASSED 100%!");
    console.log("=======================================================");
  } finally {
    // Cleanup
    await client.query(`DELETE FROM "notifications" WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM "webinar_registrations" WHERE webinar_id = $1`, [testId]);
    await client.query(`DELETE FROM "webinars" WHERE id = $1`, [testId]);
    await client.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
    await client.end();
  }
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
