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

const ARTIFACT_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";

test("admin console and marketing analytics redesign test", async ({ page, request }) => {
  test.setTimeout(90000);
  await loginAsAdmin(page);

  // 1. Admin Overview - Desktop (1440x900)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/fr/admin");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".admin-kpi-grid")).toBeVisible();
  await expect(page.locator(".admin-dashboard-grid")).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_overview_fr_desktop.png`, fullPage: false });

  // 2. Admin Overview - Mobile (375x812)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/fr/admin");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_overview_fr_mobile.png`, fullPage: false });

  // 3. Admin Marketing & Audience - Desktop (1440x900)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/fr/admin/marketing");
  await expect(page.getByRole("heading", { level: 1, name: "Marketing & Analyse d'Audience" })).toBeVisible();
  await expect(page.locator(".admin-kpi-grid")).toBeVisible();
  await expect(page.locator("#audience-directory")).toBeVisible();
  await expect(page.locator(".admin-data-table")).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_marketing_fr_desktop.png`, fullPage: true });

  // 4. Admin Marketing & Audience - Mobile (375x812)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/fr/admin/marketing");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_marketing_fr_mobile.png`, fullPage: false });

  // 5. Admin Marketing & Audience - Arabic RTL Desktop (1440x900)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ar/admin/marketing");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_marketing_ar_desktop.png`, fullPage: false });

  // 6. Test Marketing CSV Export endpoint
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const exportRes = await request.get("/api/admin/marketing/export", {
    headers: { Cookie: cookieHeader },
  });
  expect(exportRes.status()).toBe(200);
  expect(exportRes.headers()["content-type"]).toContain("text/csv");
  const text = await exportRes.text();
  expect(text.length).toBeGreaterThan(100);
  expect(text).toContain("ID");
  expect(text).toContain("Téléphone");
  expect(text).toContain("Gouvernorat");
});
