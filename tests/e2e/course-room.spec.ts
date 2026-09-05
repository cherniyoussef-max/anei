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

async function removeTestPost(id: string) {
  const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) return;
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("delete from course_discussion_posts where id = $1", [id]);
  } finally {
    await client.end();
  }
}

test("enrolled learner course circuit shows first name and publishes a real question", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("learner@anei.local");
  await form.getByLabel("Mot de passe").fill("DemoLearner!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe("/fr/verification-channel");
  await assureCurrentTestSession(page);

  await page.goto("/fr/formations/fondamentaux-education-inclusive");
  const publicAccount = page.locator(".account-chip");
  await expect(publicAccount).toContainText("Amal");
  await expect(publicAccount).not.toContainText("Mansouri");

  await page.goto("/fr/apprendre/fondamentaux-education-inclusive");
  await expect(page.locator(".student-app")).toBeVisible();
  await expect(page.locator(".site-header, .v5-site-footer")).toHaveCount(0);
  const learnerProfile = page.locator('header a[href="/fr/dashboard/profil"]');
  await expect(learnerProfile).toHaveAccessibleName(/Amal/);
  await expect(learnerProfile).not.toHaveAccessibleName(/Mansouri/);
  await expect(page.getByRole("navigation", { name: "Sections de la formation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Questions et réponses" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const body = `Question de vérification ${Date.now()}`;
  const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/learning/courses/") && response.url().endsWith("/discussion"));
  await page.getByLabel("Votre question").fill(body);
  await page.getByRole("button", { name: "Publier la question" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const payload = await response.json() as { id: string };
  try {
    await expect(page.getByText(body, { exact: true })).toBeVisible();
    if (process.env.ANEI_VISUAL_QA === "1") await page.screenshot({ path: "/tmp/anei-course-room-fr-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ar/apprendre/fondamentaux-education-inclusive#questions");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الأسئلة والإجابات" })).toBeVisible();
    await expect(page.locator('header a[href="/ar/dashboard/profil"]')).toHaveAccessibleName(/Amal/);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.ANEI_VISUAL_QA === "1") await page.screenshot({ path: "/tmp/anei-course-room-ar-mobile.png", fullPage: true });
  } finally {
    await removeTestPost(payload.id);
  }
});
