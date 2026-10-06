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

test.describe("Admin Enterprise Support & Enhanced Creation Workflows", () => {
  test.setTimeout(120000);

  test("Enterprise Support Console & Upgraded Creation Workflows", async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Admin Users list and Enterprise Support Console on user detail page
    await page.goto("/fr/admin/users");
    await expect(page.locator("h1")).toContainText(/Utilisateurs/i);

    const userLink = page.locator("a[href*='/admin/users/']").first();
    await expect(userLink).toBeVisible();
    await userLink.click();

    // Verify Enterprise Support Console
    const consoleHeading = page.locator(".admin-support-console h3");
    await expect(consoleHeading).toBeVisible();
    await expect(consoleHeading).toContainText(/Console Support & Contrôle Opérationnel/i);

    const navButtons = page.locator(".admin-support-console nav button");
    await expect(navButtons).toHaveCount(4);

    // Capture desktop screenshot of Support Console (Identity tab)
    await page.screenshot({
      path: `${ARTIFACT_DIR}/admin_support_console_fr_desktop.png`,
      fullPage: false,
    });

    // Switch to Formations LMS tab
    await navButtons.nth(1).click();
    await expect(page.locator(".admin-support-console")).toContainText(/Accorder l'accès à une nouvelle formation/i);

    // Switch to Certificats tab
    await navButtons.nth(2).click();
    await expect(page.locator(".admin-support-console")).toContainText(/Délivrer manuellement un certificat officiel/i);

    // Switch to Sécurité & Accès tab
    await navButtons.nth(3).click();
    await expect(page.locator(".admin-support-console")).toContainText(/Révocation de toutes les sessions/i);
    await expect(page.locator(".admin-support-console")).toContainText(/Réinitialisation de mot de passe/i);

    // Capture screenshot of Security tab
    await page.screenshot({
      path: `${ARTIFACT_DIR}/admin_support_security_fr_desktop.png`,
      fullPage: false,
    });

    // 2. Enhanced Course Creation with Auto-Slug and Presets
    await page.goto("/fr/admin/courses/editor");
    await expect(page.locator("h1")).toContainText(/Créer une formation/i);

    const courseForm = page.locator(".admin-course-form");
    await expect(courseForm).toBeVisible();

    const titleFrInput = courseForm.locator('input[name="titleFr"]');
    const slugInput = courseForm.locator('input[name="slug"]');

    await titleFrInput.fill("Prise en charge de l'autisme en milieu scolaire");
    await expect(slugInput).toHaveValue("prise-en-charge-de-lautisme-en-milieu-scolaire");

    const copyBtn = courseForm.locator('button:has-text("Dupliquer FR vers AR")');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    const titleArInput = courseForm.locator('input[name="titleAr"]');
    await expect(titleArInput).toHaveValue("Prise en charge de l'autisme en milieu scolaire");

    await page.screenshot({
      path: `${ARTIFACT_DIR}/admin_course_creation_fr_desktop.png`,
      fullPage: false,
    });

    // 3. Enhanced Webinars page with Collapsible Create Panel and Auto-Slug
    await page.goto("/fr/admin/webinars");
    await expect(page.locator("h1")).toContainText(/Gestion des webinaires/i);

    const webinarPanel = page.locator("details.admin-editor-create-panel");
    await expect(webinarPanel).toBeVisible();
    const webinarSummary = webinarPanel.locator("summary");
    await expect(webinarSummary).toContainText(/Ajouter un nouveau webinaire/i);

    await webinarSummary.click();
    const webinarForm = webinarPanel.locator("form.admin-course-form");
    await expect(webinarForm).toBeVisible();

    const webTitleFr = webinarForm.locator('input[name="titleFr"]');
    const webSlug = webinarForm.locator('input[name="slug"]');
    await webTitleFr.fill("Atelier pratique AVS et autisme 2026");
    await expect(webSlug).toHaveValue("atelier-pratique-avs-et-autisme-2026");

    await page.screenshot({
      path: `${ARTIFACT_DIR}/admin_webinar_creation_fr_desktop.png`,
      fullPage: false,
    });

    // 4. Enhanced Resources page with Collapsible Panel, Presets, and Auto-Slug
    await page.goto("/fr/admin/resources");
    await expect(page.locator("h1")).toContainText(/Gestion des ressources/i);

    const resourcePanel = page.locator("details.admin-editor-create-panel");
    await expect(resourcePanel).toBeVisible();
    const resourceSummary = resourcePanel.locator("summary");
    await expect(resourceSummary).toContainText(/Ajouter une nouvelle ressource/i);

    await resourceSummary.click();
    const resourceForm = resourcePanel.locator("form.admin-course-form");
    await expect(resourceForm).toBeVisible();

    const typePill = resourceForm.locator('button:has-text("Fiche pédagogique")');
    await expect(typePill).toBeVisible();
    await typePill.click();
    await expect(resourceForm.locator('input[name="type"]')).toHaveValue("Fiche pédagogique");

    const resTitleFr = resourceForm.locator('input[name="titleFr"]');
    const resSlug = resourceForm.locator('input[name="slug"]');
    await resTitleFr.fill("Fiche d'adaptation curriculaire pour classe inclusive");
    await expect(resSlug).toHaveValue("fiche-dadaptation-curriculaire-pour-classe-inclusive");

    await page.screenshot({
      path: `${ARTIFACT_DIR}/admin_resource_creation_fr_desktop.png`,
      fullPage: false,
    });

    // 5. Arabic RTL parity of Enterprise Support Console
    await page.goto("/ar/admin/users");
    const arUserLink = page.locator("a[href*='/admin/users/']").first();
    await arUserLink.click();

    const arConsoleHeading = page.locator(".admin-support-console h3");
    await expect(arConsoleHeading).toBeVisible();
    await expect(arConsoleHeading).toContainText(/لوحة دعم وتحكم Super Admin/i);

    await page.screenshot({
      path: `${ARTIFACT_DIR}/admin_support_console_ar_desktop.png`,
      fullPage: false,
    });
  });
});
