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

test("admin console comprehensive route and feature connectivity test", async ({ page }) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);

  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. Verify Enrollments Page
  await page.goto("/fr/admin/enrollments");
  await expect(page.getByRole("heading", { level: 1, name: "Inscriptions aux formations" })).toBeVisible();
  await expect(page.locator(".admin-kpi-grid")).toBeVisible();
  await expect(page.locator(".admin-data-table")).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_enrollments_fr_desktop.png`, fullPage: false });

  // 2. Verify Certificates Page
  await page.goto("/fr/admin/certificates");
  await expect(page.getByRole("heading", { level: 1, name: "Certificats officiels délivrés" })).toBeVisible();
  await expect(page.locator(".admin-kpi-grid")).toBeVisible();
  await expect(page.locator(".admin-data-table")).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_certificates_fr_desktop.png`, fullPage: false });

  // 3. Verify Orders Page
  await page.goto("/fr/admin/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Commandes clients" })).toBeVisible();
  await expect(page.locator(".admin-kpi-grid")).toBeVisible();
  await expect(page.locator(".admin-data-table")).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_orders_fr_desktop.png`, fullPage: false });

  // 4. Verify Payments Page
  await page.goto("/fr/admin/payments");
  await expect(page.getByRole("heading", { level: 1, name: "Transactions de paiement" })).toBeVisible();
  await expect(page.locator(".admin-kpi-grid")).toBeVisible();
  await expect(page.locator(".admin-data-table")).toBeVisible();
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_payments_fr_desktop.png`, fullPage: false });

  // 5. Verify Contacts Page (recently added to navigation)
  await page.goto("/fr/admin/contacts");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // 6. Verify News Page (recently added to navigation)
  await page.goto("/fr/admin/news");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // 7. Test Arabic RTL on all 4 new pages
  await page.goto("/ar/admin/enrollments");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/ar/admin/certificates");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/ar/admin/orders");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/ar/admin/payments");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // 8. Test User Detail Page drilldown & Audit link
  await page.goto("/fr/admin/users");
  const firstUserLink = page.locator(".admin-data-table tbody tr a").first();
  await expect(firstUserLink).toBeVisible();
  await firstUserLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".admin-tabs")).toBeVisible();

  // Switch to audit tab
  await page.locator(".admin-tabs").getByRole("link", { name: "Audit" }).click();
  await expect(page.getByRole("link", { name: "Consulter le journal d’audit" })).toBeVisible();
});
