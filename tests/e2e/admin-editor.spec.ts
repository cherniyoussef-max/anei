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

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("admin@anei.local");
  await form.getByLabel("Mot de passe").fill("DemoAdmin!!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/verification-channel");
  await assureCurrentTestSession(page);
}

test("course editor sections remain responsive, accessible, and RTL-safe", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await loginAsAdmin(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/fr/admin/courses");
  const editorHref = await page.locator('a[href^="/fr/admin/courses/editor/"]').first().getAttribute("href");
  expect(editorHref).toBeTruthy();
  await page.goto(editorHref!);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#admin-course-information-form")).toBeVisible();
  await expect(page.locator(".admin-assessment-builder")).toHaveCount(0);
  await page.screenshot({ path: "test-results/admin-editor-fr-desktop.png", fullPage: true });

  await page.getByRole("link", { name: /Programme/ }).click();
  await expect(page).toHaveURL(/section=programme/);
  await expect(page.locator(".admin-editor-create-panel")).toBeVisible();
  await expect(page.locator("#admin-course-information-form")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const arUrl = new URL(page.url());
  arUrl.pathname = arUrl.pathname.replace("/fr/", "/ar/");
  await page.goto(arUrl.toString());
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".mobile-menu-trigger").click();
  const drawer = page.getByRole("dialog", { name: "قائمة الإدارة" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "إغلاق" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page.locator(".mobile-menu-trigger")).toBeFocused();
  await page.screenshot({ path: "test-results/admin-editor-ar-mobile.png", fullPage: true });
  const unexpectedErrors = consoleErrors.filter((message) =>
    !message.includes("Applying inline style violates the following Content Security Policy")
    && !message.includes("A tree hydrated but some attributes of the server rendered HTML didn't match"),
  );
  expect(unexpectedErrors).toEqual([]);
});
