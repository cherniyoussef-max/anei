import "dotenv/config";
import { chromium } from "playwright";
import path from "node:path";
import { Client } from "pg";

const ARTIFACT_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";

async function assureCurrentTestSession(page: import("playwright").Page) {
  const cookie = (await page.context().cookies()).find((item) => item.name.includes("session_token"));
  if (!cookie) throw new Error("Better Auth session cookie missing");
  const token = decodeURIComponent(cookie.value).split(".")[0];
  const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
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

async function main() {
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // Log in
    await page.goto("http://localhost:3000/fr/login", { waitUntil: "networkidle" });
    const form = page.locator(".auth-form");
    await form.getByLabel("Email").fill("learner@anei.local");
    await form.getByLabel("Mot de passe").fill("DemoLearner!2026");
    await form.getByRole("button", { name: "Accéder à mon espace" }).click();
    await page.waitForTimeout(1000);
    await assureCurrentTestSession(page);

    // French Dashboard
    console.log(`Capturing FR dashboard at ${vp.name}...`);
    await page.goto("http://localhost:3000/fr/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const frPath = path.join(ARTIFACT_DIR, `student_dashboard_fr_${vp.name}.png`);
    await page.screenshot({ path: frPath, fullPage: false });
    const frFullPath = path.join(ARTIFACT_DIR, `student_dashboard_fr_${vp.name}_full.png`);
    await page.screenshot({ path: frFullPath, fullPage: true });
    console.log(`Saved screenshots to ${frPath} and ${frFullPath}`);

    // Arabic Dashboard
    console.log(`Capturing AR dashboard at ${vp.name}...`);
    await page.goto("http://localhost:3000/ar/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const arPath = path.join(ARTIFACT_DIR, `student_dashboard_ar_${vp.name}.png`);
    await page.screenshot({ path: arPath, fullPage: false });
    const arFullPath = path.join(ARTIFACT_DIR, `student_dashboard_ar_${vp.name}_full.png`);
    await page.screenshot({ path: arFullPath, fullPage: true });
    console.log(`Saved screenshots to ${arPath} and ${arFullPath}`);

    await context.close();
  }

  await browser.close();
  console.log("All student dashboard screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
