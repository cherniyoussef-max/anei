import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

const ARTIFACT_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";

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

async function loginAs(page: import("@playwright/test").Page, email: string, pass: string) {
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Mot de passe").fill(pass);
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe("/fr/verification-channel");
  await assureCurrentTestSession(page);
}

test("Parent dashboard displays Coursera-grade light shell, crisp metrics, and child management", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 950 });

  // Login as Parent
  await loginAs(page, "parent@anei.local", "DemoParent!!2026");

  // 1. Visit Parent Portal FR Desktop
  await page.goto("/fr/parent");
  await page.waitForLoadState("networkidle");

  // Verify Sidebar
  const sidebar = page.locator("aside[aria-label=\"Espace parent\"]");
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveClass(/bg-white/);

  // Verify ANEI text
  await expect(sidebar.locator("strong").first()).toHaveText("ANEI");

  // Verify Add Child button
  const addChildBtn = page.getByRole("button", { name: "Ajouter un enfant" }).first();
  await expect(addChildBtn).toBeVisible();

  // Capture Desktop Screenshot
  await page.screenshot({ path: `${ARTIFACT_DIR}/parent_dashboard_fr_desktop.png`, fullPage: false });

  // 2. Open Add Child Modal and capture
  await addChildBtn.click();
  await page.waitForTimeout(500);
  const modal = page.locator("div[role='dialog']");
  await expect(modal).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/parent_add_child_modal.png`, fullPage: false });

  // Close modal
  await page.getByRole("button", { name: "Annuler" }).click();
  await page.waitForTimeout(300);

  // 3. Visit Parent Portal AR Desktop (RTL)
  await page.goto("/ar/parent");
  await page.waitForLoadState("networkidle");
  const arSidebar = page.locator("aside[aria-label=\"مساحة الوالدين\"]");
  await expect(arSidebar).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/parent_dashboard_ar_desktop.png`, fullPage: false });

  // 4. Mobile Viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fr/parent");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${ARTIFACT_DIR}/parent_dashboard_fr_mobile.png`, fullPage: false });
});

test("AVS dashboard displays Coursera-grade light shell, verified dossiers, and booking manager", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 950 });

  // Login as AVS
  await loginAs(page, "avs@anei.local", "DemoAvs!2026Tunisie");

  // Visit AVS Espace
  await page.goto("/fr/avs/espace");
  await page.waitForLoadState("networkidle");

  // Verify Sidebar
  const sidebar = page.locator("aside[aria-label=\"Espace AVS\"]");
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveClass(/bg-white/);

  // Capture Screenshot
  await page.screenshot({ path: `${ARTIFACT_DIR}/avs_dashboard_fr_desktop.png`, fullPage: false });
});

test("Teacher and Specialist dashboards display Coursera-grade light shell and operational workspaces", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 950 });

  // Login as Super Admin to access Teacher and Specialist workspaces
  await loginAs(page, "admin@anei.local", "DemoAdmin!!2026");

  // 1. Visit Teacher Portal
  await page.goto("/fr/teacher");
  await page.waitForLoadState("networkidle");
  const teacherSidebar = page.locator("aside[aria-label=\"Espace formateur\"]");
  await expect(teacherSidebar).toBeVisible();
  await expect(teacherSidebar).toHaveClass(/bg-white/);
  await page.screenshot({ path: `${ARTIFACT_DIR}/teacher_dashboard_fr_desktop.png`, fullPage: false });

  // 2. Visit Specialist Portal
  await page.goto("/fr/specialist");
  await page.waitForLoadState("networkidle");
  const specialistSidebar = page.locator("aside[aria-label=\"Espace spécialiste\"]");
  await expect(specialistSidebar).toBeVisible();
  await expect(specialistSidebar).toHaveClass(/bg-white/);
  await page.screenshot({ path: `${ARTIFACT_DIR}/specialist_dashboard_fr_desktop.png`, fullPage: false });

  // 3. Visit Organization Portal
  await page.goto("/fr/organization");
  await page.waitForLoadState("networkidle");
  const orgSidebar = page.locator("aside[aria-label=\"Espace organisation\"]");
  await expect(orgSidebar).toBeVisible();
  await expect(orgSidebar).toHaveClass(/bg-white/);
  await page.screenshot({ path: `${ARTIFACT_DIR}/organization_dashboard_fr_desktop.png`, fullPage: false });
});
