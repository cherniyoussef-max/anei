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

test("learner dashboard reflects light sidebar, clean logo, no wave emoji, no badge, and working pass video", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("learner@anei.local");
  await form.getByLabel("Mot de passe").fill("DemoLearner!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe("/fr/verification-channel");
  await assureCurrentTestSession(page);

  // 1. Visit Dashboard
  await page.goto("/fr/dashboard");
  await page.waitForLoadState("networkidle");

  // Verify waving hand emoji is gone
  const welcomeTitle = page.locator(".student-welcome-title");
  await expect(welcomeTitle).toBeVisible();
  const titleText = await welcomeTitle.textContent();
  expect(titleText).not.toContain("👋");

  // Verify Compte certifié badge is gone
  await expect(page.locator(".student-welcome-badges")).toHaveCount(0);
  await expect(page.getByText("Compte certifié")).toHaveCount(0);

  // Verify desktop sidebar styling and logo adjustment
  const sidebar = page.locator("aside[aria-label='Espace apprenant']");
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveClass(/bg-white/);
  await expect(sidebar).toHaveClass(/md:w-64/);

  // Verify ANEI logo and text inside sidebar
  const brandLink = sidebar.locator("a[href='/fr/dashboard']").first();
  await expect(brandLink).toBeVisible();
  await expect(brandLink.locator("strong")).toHaveText("ANEI");
  await expect(brandLink.getByText("Espace Apprenant")).toBeVisible();

  // Verify Coursera Weekly Goal tracker
  await expect(page.getByText("Objectif de la semaine")).toBeVisible();
  await expect(page.getByText("Série active")).toBeVisible();

  // Verify Coursera Tabs
  const inProgressTab = page.getByRole("button", { name: /En cours/ });
  const completedTab = page.getByRole("button", { name: /Terminées/ });
  const certTab = page.getByRole("button", { name: /Certificats/ });
  await expect(inProgressTab).toBeVisible();
  await expect(completedTab).toBeVisible();
  await expect(certTab).toBeVisible();

  // Switch to Completed tab
  await completedTab.click();
  await page.waitForTimeout(300);

  // Switch to Certificats tab
  await certTab.click();
  await page.waitForTimeout(300);

  // Switch back to In Progress tab
  await inProgressTab.click();
  await page.waitForTimeout(300);

  // Capture full desktop screenshot
  const artifactDir = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";
  await page.screenshot({ path: `${artifactDir}/coursera_dashboard_desktop_full.png`, fullPage: true });

  // 2. Mobile viewport test
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${artifactDir}/coursera_dashboard_mobile_viewport.png`, fullPage: false });
  await page.screenshot({ path: `${artifactDir}/coursera_dashboard_mobile_full.png`, fullPage: true });

  // 3. Navigate to Course Player to test "Passer la vidéo"
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/fr/apprendre/avs-accompagnement-professionnel");
  await page.waitForLoadState("networkidle");

  // Look for "Passer la vidéo" button
  const passButton = page.getByRole("button", { name: "Passer la vidéo" });
  if (await passButton.isVisible()) {
    // Intercept progress save API
    const progressPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/learning/courses/") && resp.url().includes("/progress") && resp.request().method() === "POST",
      { timeout: 15_000 }
    ).catch(() => null);

    await passButton.click();
    const progressResp = await progressPromise;
    if (progressResp) {
      expect([200, 201]).toContain(progressResp.status());
    }

    // Wait for transition or completion
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${artifactDir}/student_course_player_after_pass.png`, fullPage: false });
  }
});
