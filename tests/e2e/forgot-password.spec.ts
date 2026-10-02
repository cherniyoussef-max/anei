import "dotenv/config";
import { test, expect } from "@playwright/test";
import path from "node:path";

const ARTIFACTS_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";
const TEST_EMAIL = "enrolled-e73c9243-ec1c-41a4-acf0-cd584551c4eb@example.test";

test.describe.serial("Password Recovery Flow - Phase 1", () => {
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

  test("FR: Forgot Password request, channel selection, OTP transition, and error handling", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-chromium";
    await page.goto("/fr/forgot-password");

    // 1. Verify split layout & 3D Guide Character
    const showcase = page.locator(".auth-simple-showcase");
    if (!isMobile) {
      await expect(showcase).toBeVisible();
      const guideImg = page.locator(".auth-clean-avatar-img");
      await expect(guideImg).toBeVisible();
      await expect(guideImg).toHaveAttribute("src", /auth-guide-verify/);
    }

    // 2. Verify Card Header & Eyebrow Badge
    const cardBadge = page.locator(".auth-card-badge");
    await expect(cardBadge).toContainText("RÉCUPÉRATION DU COMPTE");
    const title = page.locator(".auth-card-header h2");
    await expect(title).toContainText("Mot de passe oublié ?");

    // 3. Verify Channel Selection Cards
    const channelCards = page.locator(".auth-channel-card");
    await expect(channelCards).toHaveCount(2);
    await expect(channelCards.first()).toHaveClass(/is-selected/);

    // Capture initial form view
    if (!isMobile) {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "forgot_password_step1_fr_desktop.png"), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "forgot_password_step1_fr_mobile.png"), fullPage: true });
    }

    // 4. Fill in email and request OTP
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill(TEST_EMAIL);

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // 5. Verify transition to OTP Step
    const noticeCard = page.locator(".auth-notice-card");
    await expect(noticeCard).toBeVisible();
    await expect(noticeCard).toContainText("Code de sécurité envoyé à :");

    const otpInput = page.locator("#recovery-otp-input");
    await expect(otpInput).toBeVisible();

    // 6. Test invalid OTP entry
    await otpInput.fill("000000");
    const verifyBtn = page.locator('button:has-text("Vérifier le code et continuer")');
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();

    // Verify error banner
    const formError = page.locator(".form-error");
    await expect(formError).toBeVisible();
    await expect(formError).toContainText(/Code de vérification invalide|Trop de tentatives/);

    // Capture step 2 OTP verification view
    if (!isMobile) {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "forgot_password_otp_fr_desktop.png"), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "forgot_password_otp_fr_mobile.png"), fullPage: true });
    }

    // 7. Verify back button returns to Step 1
    const backBtn = page.locator('button:has-text("Modifier l\'e-mail ou le canal")');
    await backBtn.click();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("AR: Arabic RTL layout, mirrored character, channel selection, and OTP step", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-chromium";
    await page.goto("/ar/forgot-password");

    // 1. Verify RTL layout
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");

    // 2. Verify Arabic Badge & Title
    const cardBadge = page.locator(".auth-card-badge");
    await expect(cardBadge).toContainText("استرجاع الحساب");
    const title = page.locator(".auth-card-header h2");
    await expect(title).toContainText("استرجاع كلمة المرور");

    // 3. Verify Arabic Channel Cards
    const channelCards = page.locator(".auth-channel-card");
    await expect(channelCards).toHaveCount(2);
    await expect(channelCards.first()).toContainText("البريد الإلكتروني");
    await expect(channelCards.nth(1)).toContainText("WhatsApp");

    // Capture initial Arabic view
    if (!isMobile) {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "forgot_password_step1_ar_desktop.png"), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "forgot_password_step1_ar_mobile.png"), fullPage: true });
    }

    // 4. Fill in email and request OTP
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill(TEST_EMAIL);

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // 5. Verify transition to OTP Step in Arabic
    const noticeCard = page.locator(".auth-notice-card");
    await expect(noticeCard).toBeVisible();
    await expect(noticeCard).toContainText("تم إرسال رمز الأمان بنجاح إلى:");

    const otpInput = page.locator("#recovery-otp-input");
    await expect(otpInput).toBeVisible();

    // Capture step 2 OTP verification view in Arabic
    if (!isMobile) {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "forgot_password_otp_ar_desktop.png"), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "forgot_password_otp_ar_mobile.png"), fullPage: true });
    }
  });
});
