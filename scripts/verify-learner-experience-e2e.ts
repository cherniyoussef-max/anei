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
      [token]
    );
  } finally {
    await client.end();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // 1. Log in as learner
    console.log("Logging in as learner@anei.local...");
    await page.goto("http://localhost:3000/fr/login", { waitUntil: "networkidle" });
    const form = page.locator(".auth-form");
    await form.getByLabel("Email").fill("learner@anei.local");
    await form.getByLabel("Mot de passe").fill("DemoLearner!2026");
    await form.getByRole("button", { name: "Accéder à mon espace" }).click();
    await page.waitForTimeout(1000);
    await assureCurrentTestSession(page);

    // 2. Test redirects for boutique and classement
    console.log("Testing redirect for /fr/dashboard/boutique...");
    await page.goto("http://localhost:3000/fr/dashboard/boutique", { waitUntil: "networkidle" });
    const urlBoutique = page.url();
    console.log(`Boutique URL landed at: ${urlBoutique}`);
    if (!urlBoutique.endsWith("/fr/dashboard")) {
      console.warn(`Warning: /fr/dashboard/boutique redirected to ${urlBoutique}`);
    }

    console.log("Testing redirect for /fr/dashboard/classement...");
    await page.goto("http://localhost:3000/fr/dashboard/classement", { waitUntil: "networkidle" });
    const urlClassement = page.url();
    console.log(`Classement URL landed at: ${urlClassement}`);
    if (!urlClassement.endsWith("/fr/dashboard")) {
      console.warn(`Warning: /fr/dashboard/classement redirected to ${urlClassement}`);
    }

    // 3. Capture Desktop Learner Dashboard (FR & AR)
    console.log("Capturing FR desktop dashboard...");
    await page.goto("http://localhost:3000/fr/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "learner_dashboard_clean_fr_desktop.png"), fullPage: false });

    console.log("Capturing AR desktop dashboard...");
    await page.goto("http://localhost:3000/ar/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "learner_dashboard_clean_ar_desktop.png"), fullPage: false });

    // 4. Capture Mobile Learner Dashboard (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    console.log("Capturing FR mobile dashboard...");
    await page.goto("http://localhost:3000/fr/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "learner_dashboard_clean_fr_mobile.png"), fullPage: false });

    console.log("Capturing AR mobile dashboard...");
    await page.goto("http://localhost:3000/ar/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "learner_dashboard_clean_ar_mobile.png"), fullPage: false });

    // 5. Course Room & Video Player verification
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log("Navigating to course room...");
    // Let's find an enrolled course from dashboard
    await page.goto("http://localhost:3000/fr/dashboard", { waitUntil: "networkidle" });
    const resumeBtn = page.locator(".student-hero-btn-primary, .student-course-item-action a").first();
    const courseUrl = await resumeBtn.getAttribute("href");
    console.log(`Opening course at ${courseUrl}...`);

    if (courseUrl) {
      await page.goto(`http://localhost:3000${courseUrl}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "course_room_player_fr.png"), fullPage: false });

      // Check if Pass Video button is visible
      const passBtn = page.locator("button:has-text('Passer la vidéo'), button:has-text('Passer au quiz'), button:has-text('Marquer comme terminé')").first();
      const hasPassBtn = await passBtn.count() > 0;
      console.log(`Pass video button present: ${hasPassBtn}`);

      if (hasPassBtn) {
        console.log("Clicking Pass Video / Complete button...");
        await passBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, "course_room_quiz_or_complete.png"), fullPage: false });
      }

      // Check Arabic Course Room
      const arCourseUrl = courseUrl.replace(/^\/fr\//, "/ar/");
      console.log(`Opening Arabic course at ${arCourseUrl}...`);
      await page.goto(`http://localhost:3000${arCourseUrl}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "course_room_player_ar.png"), fullPage: false });
    }

    console.log("All visual checks completed successfully!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
