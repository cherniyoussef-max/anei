import "dotenv/config";
import { chromium } from "playwright";
import path from "node:path";
import { Client } from "pg";

const ARTIFACTS_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";
const BASE_URL = "http://localhost:3000";

async function assureCurrentTestSession(page: import("playwright").Page) {
  const cookie = (await page.context().cookies()).find((item) => item.name.includes("session_token"));
  if (!cookie) throw new Error("Better Auth session cookie missing");
  const token = decodeURIComponent(cookie.value).split(".")[0];
  const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/anei_production";
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `insert into auth_session_assurance
        (id, session_id, user_id, method, verified_at, completed_at, expires_at, created_at, updated_at)
       select gen_random_uuid()::text, id, user_id, 'EMAIL', now(), now(), expires_at, now(), now()
       from session where token = $1
       on conflict (session_id) do update set verified_at=now(), completed_at=now(), expires_at=excluded.expires_at, updated_at=now()`,
      [token],
    );
    console.log("Session assured in database for token:", token);
  } finally {
    await client.end();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // 1. DESKTOP RUNNER
  console.log("=== DESKTOP CAPTURES ===");
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const deskPage = await desktopCtx.newPage();

  // Login as pending teacher
  console.log("Logging in via /fr/login...");
  await deskPage.goto(`${BASE_URL}/fr/login`, { waitUntil: "networkidle" });
  const form = deskPage.locator(".auth-form");
  await form.getByLabel("Email").fill("pending.teacher@anei.local");
  await form.getByLabel("Mot de passe").fill("DemoTeacher!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();

  // Wait for redirect to verification-channel
  await deskPage.waitForURL(/\/verification-channel/);
  await deskPage.waitForSelector(".auth-channel-card");
  console.log("Reached /fr/verification-channel on desktop");

  // Capture Verification Channel FR Desktop
  await deskPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_verification_channel_fr_desktop.png"),
    fullPage: false,
  });
  console.log("Captured auth_verification_channel_fr_desktop.png");

  // Click Send OTP to capture the OTP input view
  const sendBtn = deskPage.getByRole("button", { name: /Envoyer le code/ });
  if (await sendBtn.isVisible()) {
    await sendBtn.click();
    await deskPage.waitForSelector(".auth-otp-input", { timeout: 10000 }).catch(() => null);
    if (await deskPage.locator(".auth-otp-input").isVisible()) {
      await deskPage.screenshot({
        path: path.join(ARTIFACTS_DIR, "auth_verification_otp_fr_desktop.png"),
        fullPage: false,
      });
      console.log("Captured auth_verification_otp_fr_desktop.png");
    }
  }

  // Switch to AR Verification Channel
  await deskPage.goto(`${BASE_URL}/ar/verification-channel`, { waitUntil: "networkidle" });
  await deskPage.waitForSelector(".auth-channel-card");
  await deskPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_verification_channel_ar_desktop.png"),
    fullPage: false,
  });
  console.log("Captured auth_verification_channel_ar_desktop.png");

  // Click Send OTP in AR
  const arSendBtn = deskPage.getByRole("button", { name: /إرسال رمز التحقق/ });
  if (await arSendBtn.isVisible()) {
    await arSendBtn.click();
    await deskPage.waitForSelector(".auth-otp-input", { timeout: 10000 }).catch(() => null);
    if (await deskPage.locator(".auth-otp-input").isVisible()) {
      await deskPage.screenshot({
        path: path.join(ARTIFACTS_DIR, "auth_verification_otp_ar_desktop.png"),
        fullPage: false,
      });
      console.log("Captured auth_verification_otp_ar_desktop.png");
    }
  }

  // Now assure session so we can access pending-review
  await assureCurrentTestSession(deskPage);

  // Navigate to FR Pending Review
  console.log("Navigating to /fr/pending-review...");
  await deskPage.goto(`${BASE_URL}/fr/pending-review`, { waitUntil: "networkidle" });
  await deskPage.waitForSelector(".pending-review-card");
  await deskPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_pending_review_fr_desktop.png"),
    fullPage: true,
  });
  console.log("Captured auth_pending_review_fr_desktop.png (fullPage)");

  // Navigate to AR Pending Review
  console.log("Navigating to /ar/pending-review...");
  await deskPage.goto(`${BASE_URL}/ar/pending-review`, { waitUntil: "networkidle" });
  await deskPage.waitForSelector(".pending-review-card");
  await deskPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_pending_review_ar_desktop.png"),
    fullPage: true,
  });
  console.log("Captured auth_pending_review_ar_desktop.png (fullPage)");

  await desktopCtx.close();

  // 2. MOBILE RUNNER
  console.log("=== MOBILE CAPTURES ===");
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobPage = await mobileCtx.newPage();

  // Login as pending teacher
  await mobPage.goto(`${BASE_URL}/fr/login`, { waitUntil: "networkidle" });
  const mobForm = mobPage.locator(".auth-form");
  await mobForm.getByLabel("Email").fill("pending.teacher@anei.local");
  await mobForm.getByLabel("Mot de passe").fill("DemoTeacher!2026");
  await mobForm.getByRole("button", { name: "Accéder à mon espace" }).click();

  await mobPage.waitForURL(/\/verification-channel/);
  await mobPage.waitForSelector(".auth-channel-card");
  console.log("Reached /fr/verification-channel on mobile");

  // Capture Verification Channel FR Mobile
  await mobPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_verification_channel_fr_mobile.png"),
    fullPage: false,
  });
  console.log("Captured auth_verification_channel_fr_mobile.png");

  // Switch to AR Verification Channel
  await mobPage.goto(`${BASE_URL}/ar/verification-channel`, { waitUntil: "networkidle" });
  await mobPage.waitForSelector(".auth-channel-card");
  await mobPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_verification_channel_ar_mobile.png"),
    fullPage: false,
  });
  console.log("Captured auth_verification_channel_ar_mobile.png");

  // Assure session for pending-review access
  await assureCurrentTestSession(mobPage);

  // Navigate to FR Pending Review Mobile
  await mobPage.goto(`${BASE_URL}/fr/pending-review`, { waitUntil: "networkidle" });
  await mobPage.waitForSelector(".pending-review-card");
  await mobPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_pending_review_fr_mobile.png"),
    fullPage: true,
  });
  console.log("Captured auth_pending_review_fr_mobile.png (fullPage)");

  // Navigate to AR Pending Review Mobile
  await mobPage.goto(`${BASE_URL}/ar/pending-review`, { waitUntil: "networkidle" });
  await mobPage.waitForSelector(".pending-review-card");
  await mobPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_pending_review_ar_mobile.png"),
    fullPage: true,
  });
  console.log("Captured auth_pending_review_ar_mobile.png (fullPage)");

  await mobileCtx.close();

  await browser.close();
  console.log("All 8 Phase 5 screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Error in capture-phase5:", err);
  process.exit(1);
});
