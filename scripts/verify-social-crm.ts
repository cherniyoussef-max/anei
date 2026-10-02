import { Client } from "pg";

const BASE_URL = process.env.APP_URL || "http://127.0.0.1:3000";
const DB_URL = process.env.DATABASE_URL || "postgresql://anei:anei@127.0.0.1:5432/anei";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@anei.tn";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

async function addAssurance(userId: string) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const sessionRes = await client.query(
      "SELECT id, expires_at FROM session WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId]
    );
    if (sessionRes.rows.length === 0) return null;
    const { id: sessionId, expires_at: expiresAt } = sessionRes.rows[0];
    await client.query(
      `INSERT INTO auth_session_assurance (id, session_id, user_id, method, verified_at, completed_at, expires_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'EMAIL', now(), now(), $3, now())
       ON CONFLICT (session_id) DO UPDATE SET verified_at = now(), completed_at = now(), expires_at = $3, updated_at = now()`,
      [sessionId, userId, expiresAt]
    );
    return sessionId;
  } finally {
    await client.end();
  }
}

async function run() {
  if (!ADMIN_PASSWORD) {
    console.error("ADMIN_PASSWORD environment variable must be set to run this verification script.");
    process.exit(1);
  }

  console.log("=== VERIFYING INSTAGRAM & MESSENGER CRM (FRONTEND & BACKEND) ===");

  // 1. Sign in as admin
  console.log("\n1. Signing in as admin...");
  const signInRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE_URL },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const setCookie = signInRes.headers.get("set-cookie");
  if (!setCookie) throw new Error("Sign-in failed: no cookie returned");
  const cookieHeader = setCookie.split(";")[0];
  const userJson = await signInRes.json() as { user: { id: string } };
  await addAssurance(userJson.user.id);
  const headers = { Cookie: cookieHeader, Origin: BASE_URL, "Content-Type": "application/json" };
  console.log("Admin session authenticated and assured.");

  // 2. Test French Instagram CRM page
  console.log("\n2. Testing /fr/admin/crm/instagram...");
  const igFrRes = await fetch(`${BASE_URL}/fr/admin/crm/instagram`, { headers });
  console.log(`HTTP Status: ${igFrRes.status}`);
  if (igFrRes.status !== 200) throw new Error(`Expected 200 but got ${igFrRes.status}`);
  const igFrHtml = await igFrRes.text();
  const igFrH1 = igFrHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
  console.log("Rendered French Page H1:", igFrH1 ? igFrH1[1] : "None");
  if (!igFrH1 || !igFrH1[1].includes("Instagram")) {
    throw new Error("French Instagram CRM page did not render expected H1 header!");
  }
  console.log("✓ French Instagram CRM page loads cleanly (200 OK)!");

  // 3. Test Arabic Instagram CRM page
  console.log("\n3. Testing /ar/admin/crm/instagram...");
  const igArRes = await fetch(`${BASE_URL}/ar/admin/crm/instagram`, { headers });
  console.log(`HTTP Status: ${igArRes.status}`);
  if (igArRes.status !== 200) throw new Error(`Expected 200 but got ${igArRes.status}`);
  const igArHtml = await igArRes.text();
  const igArH1 = igArHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
  console.log("Rendered Arabic Page H1:", igArH1 ? igArH1[1] : "None");
  if (!igArH1 || !igArH1[1].includes("إنستغرام")) {
    throw new Error("Arabic Instagram CRM page did not render expected H1 header!");
  }
  console.log("✓ Arabic Instagram CRM page loads cleanly (200 OK)!");

  // 4. Test French Messenger CRM page
  console.log("\n4. Testing /fr/admin/crm/messenger...");
  const fbFrRes = await fetch(`${BASE_URL}/fr/admin/crm/messenger`, { headers });
  console.log(`HTTP Status: ${fbFrRes.status}`);
  if (fbFrRes.status !== 200) throw new Error(`Expected 200 but got ${fbFrRes.status}`);
  const fbFrHtml = await fbFrRes.text();
  const fbFrH1 = fbFrHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
  console.log("Rendered French Page H1:", fbFrH1 ? fbFrH1[1] : "None");
  if (!fbFrH1 || !fbFrH1[1].includes("Messenger")) {
    throw new Error("French Messenger CRM page did not render expected H1 header!");
  }
  console.log("✓ French Messenger CRM page loads cleanly (200 OK)!");

  // 5. Test Arabic Messenger CRM page
  console.log("\n5. Testing /ar/admin/crm/messenger...");
  const fbArRes = await fetch(`${BASE_URL}/ar/admin/crm/messenger`, { headers });
  console.log(`HTTP Status: ${fbArRes.status}`);
  if (fbArRes.status !== 200) throw new Error(`Expected 200 but got ${fbArRes.status}`);
  const fbArHtml = await fbArRes.text();
  const fbArH1 = fbArHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
  console.log("Rendered Arabic Page H1:", fbArH1 ? fbArH1[1] : "None");
  if (!fbArH1 || !fbArH1[1].includes("ماسنجر")) {
    throw new Error("Arabic Messenger CRM page did not render expected H1 header!");
  }
  console.log("✓ Arabic Messenger CRM page loads cleanly (200 OK)!");

  // 6. Test Meta Status endpoint
  console.log("\n6. Testing /api/admin/crm/social/meta-status...");
  const statusRes = await fetch(`${BASE_URL}/api/admin/crm/social/meta-status`, { headers });
  console.log(`HTTP Status: ${statusRes.status}`);
  const statusJson = await statusRes.json();
  console.log("Meta Status:", statusJson);
  if (!statusJson.instagram || !statusJson.messenger) {
    throw new Error("meta-status missing instagram or messenger config");
  }
  console.log("✓ Meta status endpoint returned valid configuration!");

  // 7. Test Inbound Simulation on Instagram
  console.log("\n7. Testing simulation of inbound Instagram customer message...");
  const simRes = await fetch(`${BASE_URL}/api/admin/crm/social/simulate-inbound`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      channel: "INSTAGRAM",
      senderName: "Inès Mansouri",
      senderUsername: "ines_mansouri",
      text: "Bonjour, je souhaite des précisions sur le cursus Enseignant.",
    }),
  });
  console.log(`HTTP Status: ${simRes.status}`);
  const simJson = await simRes.json() as { ok: boolean; message: { senderId: string } };
  if (!simJson.ok) throw new Error("Simulation failed");
  const senderId = simJson.message.senderId;
  console.log("✓ Successfully simulated customer message with senderId:", senderId);

  // 8. Test Outbound reply from support
  console.log("\n8. Testing outbound support reply to Instagram customer...");
  const sendRes = await fetch(`${BASE_URL}/api/admin/crm/social/send-text`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      channel: "INSTAGRAM",
      recipientId: senderId,
      text: "Bonjour Inès ! Le cursus Enseignant comprend 8 modules certifiants.",
    }),
  });
  console.log(`HTTP Status: ${sendRes.status}`);
  const sendJson = await sendRes.json() as { ok: boolean };
  if (!sendJson.ok) throw new Error("Outbound send failed");
  console.log("✓ Successfully sent outbound reply via social messenger!");

  // 9. Verify thread messages
  console.log("\n9. Testing conversation message history...");
  const threadRes = await fetch(
    `${BASE_URL}/api/admin/crm/social/conversations/INSTAGRAM/${encodeURIComponent(senderId)}`,
    { headers }
  );
  console.log(`HTTP Status: ${threadRes.status}`);
  const threadJson = await threadRes.json() as { messages: Array<{ textPreview: string }> };
  console.log(`Thread contains ${threadJson.messages.length} messages.`);
  if (threadJson.messages.length < 2) {
    throw new Error("Expected at least 2 messages in conversation history");
  }
  console.log("✓ Both inbound customer message and outbound support reply verified in thread history!");

  console.log("\n=======================================================");
  console.log("🎉 ALL SOCIAL CRM VERIFICATIONS PASSED WITH 100% SUCCESS!");
  console.log("=======================================================");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
