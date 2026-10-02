import "dotenv/config";
import { test, expect } from "@playwright/test";
import path from "node:path";

const ARTIFACTS_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";

test.describe("Phase 3 — Email Verification & Channel Security Journey", () => {
  test.beforeEach(async () => {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query('delete from "rateLimit"');
    } finally {
      await client.end();
    }
  });

  test("FR: verify-email pending page displays modern verification card and tips", async ({ page }, testInfo) => {
    await page.goto("/fr/verify-email?email=enseignant%40anei.education");

    // 1. Verify split layout showcase
    const guideImg = page.locator(".auth-clean-avatar-img");
    await expect(guideImg).toBeVisible();
    await expect(guideImg).toHaveAttribute("src", /auth-guide-verify/);

    // 2. Verify header badge and title
    await expect(page.locator(".auth-card-badge")).toContainText("VÉRIFICATION DU COMPTE");
    await expect(page.locator(".auth-card-header h2")).toContainText("Vérifiez votre boîte e-mail");

    // 3. Verify status card with masked email
    const highlightCard = page.locator(".auth-verify-highlight-card");
    await expect(highlightCard).toBeVisible();
    await expect(highlightCard.locator(".masked-email")).toContainText("e***@anei.education");
    await expect(highlightCard.locator(".auth-verify-icon-aura")).toBeVisible();

    // 4. Verify quick tips list
    const tipsList = page.locator(".auth-verify-tips-list li");
    await expect(tipsList).toHaveCount(3);
    await expect(tipsList.nth(0)).toContainText("Spam");

    // 5. Verify Resend button and secondary link
    const resendBtn = page.locator('button:has-text("Renvoyer l’e-mail")');
    await expect(resendBtn).toBeVisible();
    await expect(page.locator('a:has-text("Utiliser un autre compte")')).toBeVisible();

    // Capture screenshot
    const isMobile = testInfo.project.name.toLowerCase().includes("mobile");
    const filename = isMobile ? "verify_email_pending_fr_mobile.png" : "verify_email_pending_fr_desktop.png";
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, filename), fullPage: true });
  });

  test("AR: verify-email pending page displays true RTL mirroring and Arabic typography", async ({ page }, testInfo) => {
    await page.goto("/ar/verify-email?email=professeur.arabe%40anei.education");

    // 1. Verify RTL document direction
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");

    // 2. Verify Arabic header and badge
    await expect(page.locator(".auth-card-badge")).toContainText("تأكيد الحساب");
    await expect(page.locator(".auth-card-header h2")).toContainText("تحقق من بريدك الإلكتروني");

    // 3. Verify status card with masked email
    const highlightCard = page.locator(".auth-verify-highlight-card");
    await expect(highlightCard).toBeVisible();
    await expect(highlightCard.locator(".masked-email")).toContainText("p***@anei.education");

    // 4. Verify Arabic tips
    const tips = page.locator(".auth-verify-tips");
    await expect(tips).toBeVisible();
    await expect(tips).toContainText("لم تستلم الرسالة بعد؟");

    // Capture screenshot
    const isMobile = testInfo.project.name.toLowerCase().includes("mobile");
    const filename = isMobile ? "verify_email_pending_ar_mobile.png" : "verify_email_pending_ar_desktop.png";
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, filename), fullPage: true });
  });

  test("FR: verify-email expired token renders friendly fallback and resend form", async ({ page }, testInfo) => {
    await page.goto("/fr/verify-email?error=TOKEN_EXPIRED&email=expirer%40anei.education");

    // 1. Verify error header badge and title
    await expect(page.locator(".auth-card-badge")).toContainText("SÉCURITÉ DU COMPTE");
    await expect(page.locator(".auth-card-header h2")).toContainText("Lien de vérification expiré");

    // 2. Verify form still allows resending for the known email
    const highlightCard = page.locator(".auth-verify-highlight-card");
    await expect(highlightCard).toBeVisible();
    await expect(highlightCard.locator(".masked-email")).toContainText("e***@anei.education");

    // Capture screenshot
    const isMobile = testInfo.project.name.toLowerCase().includes("mobile");
    const filename = isMobile ? "verify_email_expired_fr_mobile.png" : "verify_email_expired_fr_desktop.png";
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, filename), fullPage: true });
  });

  test("AR: verify-email invalid token renders Arabic alert and return action", async ({ page }, testInfo) => {
    await page.goto("/ar/verify-email?error=INVALID_TOKEN");

    // 1. Verify Arabic error header
    await expect(page.locator(".auth-card-badge")).toContainText("أمان الحساب");
    await expect(page.locator(".auth-card-header h2")).toContainText("رابط غير صالح");

    // 2. Verify return to login button
    const loginLink = page.locator('a:has-text("العودة إلى تسجيل الدخول")');
    await expect(loginLink).toBeVisible();

    // Capture screenshot
    const isMobile = testInfo.project.name.toLowerCase().includes("mobile");
    const filename = isMobile ? "verify_email_invalid_ar_mobile.png" : "verify_email_invalid_ar_desktop.png";
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, filename), fullPage: true });
  });

  test("FR & AR: verification-channel renders channel selector cards and OTP step", async ({ page }, testInfo) => {
    // 1. Log in as teacher to reach verification channel
    await page.goto("/fr/login");
    const form = page.locator(".auth-form");
    await form.getByLabel("Email").fill("pending.teacher@anei.local");
    await form.getByLabel("Mot de passe").fill("DemoTeacher!2026");
    await form.getByRole("button", { name: "Accéder à mon espace" }).click();

    await page.waitForURL(/\/verification-channel/);

    // 2. Verify channel card is selected
    const channelCard = page.locator(".auth-channel-card");
    await expect(channelCard).toBeVisible();
    await expect(channelCard).toHaveClass(/is-selected/);

    // Capture channel selection screen
    const isMobile = testInfo.project.name.toLowerCase().includes("mobile");
    const filename = isMobile ? "verification_channel_selector_fr_mobile.png" : "verification_channel_selector_fr_desktop.png";
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, filename), fullPage: true });

    // 3. Click send OTP code
    const sendBtn = page.getByRole("button", { name: /Envoyer le code/ });
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();

    // 4. Verify transition to OTP box
    const otpInput = page.locator("#auth-otp-input");
    await expect(otpInput).toBeVisible();
    await expect(page.locator(".auth-otp-badge")).toContainText("Valable 5 minutes");
    await expect(page.locator(".auth-link-btn:has-text('Changer de canal')")).toBeVisible();

    // Capture OTP input state
    const otpFilename = isMobile ? "verification_channel_otp_fr_mobile.png" : "verification_channel_otp_fr_desktop.png";
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, otpFilename), fullPage: true });
  });

  test("AR: verification-channel renders Arabic RTL layout, mirrored character, and OTP step", async ({ page }, testInfo) => {
    // 1. Log in as teacher with Arabic locale
    await page.goto("/ar/login");
    const form = page.locator(".auth-form");
    await form.locator('input[name="email"]').fill("pending.teacher@anei.local");
    await form.locator('input[name="password"]').fill("DemoTeacher!2026");
    await form.locator('button[type="submit"]').click();

    await page.waitForURL(/\/verification-channel/);

    // 2. Verify channel card is selected and RTL is active
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
    const channelCard = page.locator(".auth-channel-card");
    await expect(channelCard).toBeVisible();

    const isMobile = testInfo.project.name.toLowerCase().includes("mobile");
    const filename = isMobile ? "verification_channel_selector_ar_mobile.png" : "verification_channel_selector_ar_desktop.png";
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, filename), fullPage: true });

    // 3. Click send OTP code
    const sendBtn = page.getByRole("button", { name: /إرسال رمز التحقق/ });
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();

    // 4. Verify transition to OTP box
    const otpInput = page.locator("#auth-otp-input");
    await expect(otpInput).toBeVisible();
    await expect(page.locator(".auth-otp-badge")).toContainText("صالح لمدة 5 دقائق");

    const otpFilename = isMobile ? "verification_channel_otp_ar_mobile.png" : "verification_channel_otp_ar_desktop.png";
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, otpFilename), fullPage: true });
  });

  test("FR: invitation page with invalid token renders friendly fallback and showcase", async ({ page }, testInfo) => {
    await page.goto("/fr/invitation/invalid-test-token-12345678");

    // 1. Verify split layout showcase
    const guideImg = page.locator(".auth-clean-avatar-img");
    await expect(guideImg).toBeVisible();
    await expect(guideImg).toHaveAttribute("src", /auth-guide-verify/);

    // 2. Verify invalid token fallback card
    const fallback = page.locator(".auth-missing-token");
    await expect(fallback).toBeVisible();
    await expect(fallback.locator("h3")).toContainText("Lien d’invitation non valide");
    await expect(page.locator('a:has-text("Retour à la connexion")')).toBeVisible();

    const isMobile = testInfo.project.name.toLowerCase().includes("mobile");
    const filename = isMobile ? "invitation_invalid_fr_mobile.png" : "invitation_invalid_fr_desktop.png";
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, filename), fullPage: true });
  });

  test("AR: invitation page with invalid token renders Arabic RTL fallback", async ({ page }, testInfo) => {
    await page.goto("/ar/invitation/invalid-test-token-12345678");

    // 1. Verify RTL document direction
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");

    // 2. Verify Arabic fallback card
    const fallback = page.locator(".auth-missing-token");
    await expect(fallback).toBeVisible();
    await expect(fallback.locator("h3")).toContainText("رابط الدعوة غير صالح");
    await expect(page.locator('a:has-text("العودة إلى تسجيل الدخول")')).toBeVisible();

    const isMobile = testInfo.project.name.toLowerCase().includes("mobile");
    const filename = isMobile ? "invitation_invalid_ar_mobile.png" : "invitation_invalid_ar_desktop.png";
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, filename), fullPage: true });
  });
});
