import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

async function assureCurrentTestSession(page: import("@playwright/test").Page) {
  const cookie = (await page.context().cookies()).find((item) => item.name.includes("session_token"));
  if (!cookie) throw new Error("Better Auth session cookie missing in E2E fixture");
  const token = decodeURIComponent(cookie.value).split(".")[0];
  const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required for authenticated E2E fixtures");
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
  } finally {
    await client.end();
  }
}

test.describe("Student Mentor Banner & Clean AI Assistant QA", () => {
  test("mentor banner has anti-ai look, zero emojis, correct buttons and drawer trigger", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Login
    await page.goto("/fr/login");
    await page.getByPlaceholder("m@exemple.com").fill("learner@anei.local");
    await page.locator('input[type="password"]').fill("DemoLearner!2026");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe("/fr/verification-channel");
    await assureCurrentTestSession(page);

    // Dashboard
    await page.goto("/fr/dashboard");
    await page.waitForLoadState("networkidle");

    // 1. Verify Banner structure
    const banner = page.getByRole("region", { name: "Support pédagogique et aide" });
    await banner.scrollIntoViewIfNeeded();
    await expect(banner).toBeVisible();

    // Verify badge text
    await expect(banner.getByText("ANEI").first()).toBeVisible();
    await expect(banner.getByText("Accompagnement pédagogique & préparation à l'évaluation finale")).toBeVisible();

    // Verify NO system emojis in banner text
    const bannerText = (await banner.textContent()) ?? "";
    expect(bannerText).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);

    // Verify action buttons
    const supportBtn = banner.getByRole("link", { name: "Contacter le support pédagogique" });
    await expect(supportBtn).toBeVisible();

    const coursesBtn = banner.getByRole("link", { name: "Consulter mes cours" });
    await expect(coursesBtn).toBeVisible();

    // Check that floating assistant button is NOT rendered on learner dashboard
    const floatingBtn = page.getByRole("button", { name: "Assistant Pédagogique ANEI" });
    await expect(floatingBtn).toHaveCount(0);

    // Assert public assistant drawer is completely removed from the DOM
    const drawer = page.locator('[data-testid="public-assistant-drawer"]');
    await expect(drawer).toHaveCount(0);

    // 3. Mobile verification
    const artifactDir = process.env.ARTIFACT_DIR || "/tmp";
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(400);
    await banner.scrollIntoViewIfNeeded();
    await banner.screenshot({ path: `${artifactDir}/student_mentor_banner_mobile.png` });
    await page.screenshot({ path: `${artifactDir}/student_dashboard_full_mobile.png`, fullPage: true });
  });
});
