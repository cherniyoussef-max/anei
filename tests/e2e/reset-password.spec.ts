import "dotenv/config";
import { test, expect } from "@playwright/test";
import path from "node:path";

const ARTIFACTS_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";
const MOCK_TOKEN = "mock-reset-authorization-token-for-test-purposes-1234567890";

test.describe.serial("Password Reset Flow - Phase 2", () => {
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

  test("FR: Missing token shows friendly recovery fallback state", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-chromium";
    await page.goto("/fr/reset-password");

    const missingNotice = page.locator(".auth-missing-token");
    await expect(missingNotice).toBeVisible();
    await expect(missingNotice).toContainText("Autorisation de réinitialisation manquante");

    const requestBtn = page.locator('a:has-text("Demander un code de sécurité")');
    await expect(requestBtn).toBeVisible();
    await expect(requestBtn).toHaveAttribute("href", "/fr/forgot-password");

    if (!isMobile) {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "reset_password_missing_token_fr_desktop.png"), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "reset_password_missing_token_fr_mobile.png"), fullPage: true });
    }
  });

  test("AR: Missing token shows Arabic RTL fallback state", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-chromium";
    await page.goto("/ar/reset-password");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");

    const missingNotice = page.locator(".auth-missing-token");
    await expect(missingNotice).toBeVisible();
    await expect(missingNotice).toContainText("إذن إعادة التعيين غير متوفر أو منتهٍ");

    const requestBtn = page.locator('a:has-text("طلب رمز أمان جديد")');
    await expect(requestBtn).toBeVisible();
    await expect(requestBtn).toHaveAttribute("href", "/ar/forgot-password");

    if (!isMobile) {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "reset_password_missing_token_ar_desktop.png"), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "reset_password_missing_token_ar_mobile.png"), fullPage: true });
    }
  });

  test("FR: Reset Password form with live 15-char strength meter and match indicator", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-chromium";
    await page.goto(`/fr/reset-password?token=${MOCK_TOKEN}`);

    // 1. Verify split layout & 3D Guide Character
    if (!isMobile) {
      const showcase = page.locator(".auth-simple-showcase");
      await expect(showcase).toBeVisible();
      const guideImg = page.locator(".auth-clean-avatar-img");
      await expect(guideImg).toBeVisible();
      await expect(guideImg).toHaveAttribute("src", /auth-guide-welcome/);
    }

    // 2. Verify Card Header & Eyebrow Badge
    const cardBadge = page.locator(".auth-card-badge");
    await expect(cardBadge).toContainText("NOUVEAU MOT DE PASSE");
    const title = page.locator(".auth-card-header h2");
    await expect(title).toContainText("Définissez un mot de passe robuste");

    // 3. Test password strength meter progression
    const passwordInput = page.locator("#reset-password-input");
    const confirmInput = page.locator("#reset-confirm-input");
    const submitBtn = page.locator('button[type="submit"]');

    // Short password (< 8 chars)
    await passwordInput.fill("court");
    await expect(page.locator(".meter-bar.is-short")).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Medium password (8 - 14 chars)
    await passwordInput.fill("SecretTest123");
    await expect(page.locator(".meter-bar.is-medium")).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Strong password (>= 15 chars)
    const strongPassword = "MonNouveauMotDePasse2026!";
    await passwordInput.fill(strongPassword);
    await expect(page.locator(".meter-bar.is-complete")).toBeVisible();
    await expect(page.locator(".rule-item.is-met")).toHaveCount(2);

    // 4. Test match indicator
    await confirmInput.fill("MismatchedPassword123!");
    await expect(page.locator(".match-error")).toBeVisible();
    await expect(page.locator(".match-error")).toContainText("Les mots de passe ne correspondent pas");
    await expect(submitBtn).toBeDisabled();

    await confirmInput.fill(strongPassword);
    await expect(page.locator(".match-success")).toBeVisible();
    await expect(page.locator(".match-success")).toContainText("Les mots de passe correspondent");
    await expect(submitBtn).toBeEnabled();

    // Capture form in strong & matching state
    if (!isMobile) {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "reset_password_form_fr_desktop.png"), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "reset_password_form_fr_mobile.png"), fullPage: true });
    }
  });

  test("AR: Arabic RTL layout, mirrored character, strength meter and Arabic rules", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-chromium";
    await page.goto(`/ar/reset-password?token=${MOCK_TOKEN}`);

    // 1. Verify RTL layout
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");

    // 2. Verify Arabic Badge & Title
    const cardBadge = page.locator(".auth-card-badge");
    await expect(cardBadge).toContainText("كلمة مرور جديدة");
    const title = page.locator(".auth-card-header h2");
    await expect(title).toContainText("تعيين كلمة مرور قوية");

    // 3. Fill strong matching password
    const strongPassword = "MonNouveauMotDePasse2026!";
    const passwordInput = page.locator("#reset-password-input");
    const confirmInput = page.locator("#reset-confirm-input");
    const submitBtn = page.locator('button[type="submit"]');

    await passwordInput.fill(strongPassword);
    await expect(page.locator(".meter-bar.is-complete")).toBeVisible();
    await expect(page.locator(".meter-success")).toContainText("طول ممتاز (15+ حرفًا)");

    await confirmInput.fill(strongPassword);
    await expect(page.locator(".match-success")).toContainText("كلمتا المرور متطابقتان");
    await expect(submitBtn).toBeEnabled();

    // Capture Arabic form in strong & matching state
    if (!isMobile) {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "reset_password_form_ar_desktop.png"), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "reset_password_form_ar_mobile.png"), fullPage: true });
    }
  });

  test("FR: Successful password reset submission renders celebratory confirmation view", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-chromium";
    const crypto = await import("node:crypto");
    const { Client } = await import("pg");

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(`anei:auth-reset:v1:${token}`).digest("hex");
    const challengeId = crypto.randomUUID();
    const authzId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60_000);

    const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL });
    await client.connect();
    const testUserId = crypto.randomUUID();
    const testEmail = `reset-${testUserId}@example.test`;
    try {
      await client.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at) values ($1, 'Reset Test', $2, true, $3, $3)`,
        [testUserId, testEmail, now]
      );
      await client.query(
        `insert into "auth_verification_challenge" (
          id, user_id, purpose, channel, destination, destination_masked, code_hash,
          status, attempt_count, max_attempts, resend_available_at, expires_at, created_at, updated_at
        ) values ($1, $2, 'PASSWORD_RESET', 'EMAIL', $3, 'r***@example.test', 'dummy',
          'ACTIVE', 0, 3, $4, $5, $4, $4)`,
        [challengeId, testUserId, testEmail, now, expiresAt]
      );
      await client.query(
        `insert into "auth_reset_authorization" (
          id, user_id, challenge_id, token_hash, status, expires_at, created_at, updated_at
        ) values ($1, $2, $3, $4, 'ACTIVE', $5, $6, $6)`,
        [authzId, testUserId, challengeId, tokenHash, expiresAt, now]
      );
    } finally {
      await client.end();
    }

    // Set authorization in sessionStorage and visit page
    await page.goto("/fr/reset-password");
    await page.evaluate((tok) => {
      sessionStorage.setItem("anei_reset_authorization", tok);
    }, token);
    await page.reload();

    const passwordInput = page.locator("#reset-password-input");
    const confirmInput = page.locator("#reset-confirm-input");
    const submitBtn = page.locator('button[type="submit"]');

    const newPassword = "MonToutNouveauMotDePasse2026!";
    await passwordInput.fill(newPassword);
    await confirmInput.fill(newPassword);
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify celebratory success state
    const successCard = page.locator(".auth-success-state");
    await expect(successCard).toBeVisible();
    await expect(successCard).toContainText("Mot de passe mis à jour !");

    const connectBtn = page.locator('.auth-success-state button:has-text("Se connecter maintenant")');
    await expect(connectBtn).toBeVisible();

    // Capture success state screenshot
    if (!isMobile) {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "reset_password_success_fr_desktop.png"), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "reset_password_success_fr_mobile.png"), fullPage: true });
    }

    // Click connect and verify navigation to login
    await connectBtn.click();
    await page.waitForURL(/\/fr\/login\?reset=1/);
    await expect(page).toHaveURL(/\/fr\/login\?reset=1/);
  });
});
