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

async function loginAsLearner(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("learner@anei.local");
  await form.locator("#login-password-input").fill("DemoLearner!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe("/fr/verification-channel");
  await assureCurrentTestSession(page);
}

test.describe.serial("Inclusive Dashboard Spaces Verification", () => {
  test("Ma classe inclusive renders correctly without error boundary", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 900 });

    await loginAsLearner(page);

    await page.goto("/fr/dashboard/classe-inclusive");
    await page.waitForLoadState("networkidle");

    // Must NOT show the error card
    await expect(page.locator("text=Votre espace n'a pas pu être chargé")).not.toBeVisible();
    await expect(page.locator("text=Erreur inattendue")).not.toBeVisible();

    // Must show the Teacher Classroom Workspace Heading
    await expect(page.getByRole("heading", { name: /Ma classe inclusive/ })).toBeVisible();
  });

  test("Espace etablissement renders correctly without error boundary", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 900 });

    await loginAsLearner(page);

    await page.goto("/fr/dashboard/etablissement");
    await page.waitForLoadState("networkidle");

    // Must NOT show the error card
    await expect(page.locator("text=Votre espace n'a pas pu être chargé")).not.toBeVisible();
    await expect(page.locator("text=Erreur inattendue")).not.toBeVisible();

    // Must show the Partner Establishment Workspace
    await expect(page.locator("text=Collège Ibn Khaldoun")).toBeVisible();
  });

  test("Espace specialiste renders correctly without error boundary", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 900 });

    await loginAsLearner(page);

    await page.goto("/fr/dashboard/specialiste");
    await page.waitForLoadState("networkidle");

    // Must NOT show the error card
    await expect(page.locator("text=Votre espace n'a pas pu être chargé")).not.toBeVisible();
    await expect(page.locator("text=Erreur inattendue")).not.toBeVisible();

    // Must show the Specialist Workspace Heading
    await expect(page.getByRole("heading", { name: /Espace Spécialiste/ })).toBeVisible();
  });
});
