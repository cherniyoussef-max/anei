import "dotenv/config";
import { test, expect } from "@playwright/test";

test.describe.serial("Phase 4 & 5 — Account Creation Journey Redesign", () => {
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
  test("FR: Step 1 displays 6 persona cards with 3D figurines and transitions to Step 2", async ({ page }) => {
    await page.goto("/fr/register");

    // 1. Verify 3D Welcome guide and showcase
    const guideImg = page.locator('.auth-clean-avatar-img');
    await expect(guideImg).toBeVisible();
    await expect(guideImg).toHaveAttribute("src", /auth-guide-welcome/);

    // 2. Verify all 6 persona cards are rendered
    const personaCards = page.locator(".auth-persona-card");
    await expect(personaCards).toHaveCount(6);

    // 3. Verify persona cards contain 3D figurine thumbnails
    const avatarThumbnails = page.locator(".auth-persona-avatar-img");
    await expect(avatarThumbnails).toHaveCount(6);

    // 4. Select AVS persona card
    const avsCard = page.locator('.auth-persona-card:has-text("AVS")');
    await avsCard.click();
    await expect(avsCard).toHaveClass(/is-selected/);

    // 5. Click Continue to Step 2
    const continueBtn = page.locator('button:has-text("Continuer vers mes identifiants")');
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // 6. Verify Step 2 rendered with Selected Persona Pill
    const selectedPill = page.locator(".auth-selected-pill");
    await expect(selectedPill).toBeVisible();
    await expect(selectedPill).toContainText("AVS");

    // 7. Verify 15-char password meter and criteria checks
    const passwordInput = page.locator("#auth-password-input");
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill("court");
    await expect(page.locator(".meter-bar.is-short")).toBeVisible();

    await passwordInput.fill("MonSuperMotDePasse2026!");
    await expect(page.locator(".meter-bar.is-complete")).toBeVisible();
    const metRules = page.locator(".rule-item.is-met");
    await expect(metRules).toHaveCount(2);

    // 8. Back button returns to Step 1
    const backBtn = page.locator('button:has-text("Modifier mon rôle")');
    await backBtn.click();
    await expect(page.locator(".auth-persona-card")).toHaveCount(6);
  });

  test("AR: Step 1 displays RTL mirrored cards and transitions to Step 2 with Arabic labels", async ({ page }) => {
    await page.goto("/ar/register");

    // 1. Verify RTL document direction
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");

    // 2. Verify 6 persona cards in Arabic
    const personaCards = page.locator(".auth-persona-card");
    await expect(personaCards).toHaveCount(6);
    await expect(page.locator('.auth-persona-card:has-text("طالب / متعلم")')).toBeVisible();
    await expect(page.locator('.auth-persona-card:has-text("مدرس(ة)")')).toBeVisible();
    await expect(page.locator('.auth-persona-card:has-text("مرافق حياة مدرسية")')).toBeVisible();

    // 3. Continue to Step 2
    const continueBtn = page.locator('button:has-text("المتابعة لإدخال البيانات")');
    await continueBtn.click();

    // 4. Verify Arabic Step 2 pill and password rules
    const selectedPill = page.locator(".auth-selected-pill");
    await expect(selectedPill).toBeVisible();
    const passwordInput = page.locator("#auth-password-input");
    await passwordInput.fill("كلمة_مرور_آمنة_جدا_2026!");
    await expect(page.locator(".meter-bar.is-complete")).toBeVisible();
  });

  test("Verify Email Page displays AuthShowcase with stage=verify", async ({ page }) => {
    await page.goto("/fr/verify-email?email=test%40exemple.com");

    // Verify showcase with verify guide image
    const guideImg = page.locator('.auth-clean-avatar-img');
    await expect(guideImg).toBeVisible();
    await expect(guideImg).toHaveAttribute("src", /auth-guide-verify/);

    // Verify pending form with masked email
    const formSuccess = page.locator(".form-success");
    await expect(formSuccess).toBeVisible();
    await expect(formSuccess).toContainText("t***@exemple.com");
  });

  test("Phase 5: Verification Channel renders 3D verify guide and interactive channel card", async ({ page }) => {
    await page.goto("/fr/login");
    const form = page.locator(".auth-form");
    await form.getByLabel("Email").fill("pending.teacher@anei.local");
    await form.getByLabel("Mot de passe").fill("DemoTeacher!2026");
    await form.getByRole("button", { name: "Accéder à mon espace" }).click();

    await page.waitForURL(/\/verification-channel/);
    const guideImg = page.locator(".auth-clean-avatar-img");
    await expect(guideImg).toBeVisible();
    await expect(guideImg).toHaveAttribute("src", /auth-guide-verify/);

    const channelCard = page.locator(".auth-channel-card");
    await expect(channelCard).toBeVisible();
    await expect(channelCard).toHaveClass(/is-selected/);
    await expect(page.getByRole("button", { name: /Envoyer le code/ })).toBeVisible();
  });

  test("Phase 5: Pending Review displays teacher persona figurine, 4-step timeline, and waiting links", async ({ page }) => {
    // 1. Login
    await page.goto("/fr/login");
    const form = page.locator(".auth-form");
    await form.getByLabel("Email").fill("pending.teacher@anei.local");
    await form.getByLabel("Mot de passe").fill("DemoTeacher!2026");
    await form.getByRole("button", { name: "Accéder à mon espace" }).click();
    await page.waitForURL(/\/verification-channel/);

    // 2. Assure session
    const cookie = (await page.context().cookies()).find((item) => item.name.includes("session_token"));
    expect(cookie).toBeTruthy();
    const token = decodeURIComponent(cookie!.value).split(".")[0];
    const { Client } = await import("pg");
    const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL });
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
    } finally {
      await client.end();
    }

    // 3. Visit pending-review
    await page.goto("/fr/pending-review");
    await expect(page.locator(".pending-review-card")).toBeVisible();
    await expect(page.locator(".pending-status-badge")).toContainText("Examen académique en cours");
    await expect(page.locator(".pending-timeline .timeline-step")).toHaveCount(4);
    await expect(page.locator(".pending-waiting-card")).toBeVisible();
    await expect(page.locator('a[href*="/formations"]')).toBeVisible();
  });
});
