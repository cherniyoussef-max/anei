import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import path from "node:path";

const SCREENSHOT_DIR = "/home/youssef/.gemini/antigravity/brain/5d213403-e7a7-4dbf-a122-47378099408e/learning-upgrade-screenshots";

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

async function clearLoginRateLimits() {
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: process.env.REDIS_URL || "redis://127.0.0.1:6379" });
    await client.connect();
    const keys = await client.keys("*login*");
    if (keys.length) await client.del(keys);
    await client.quit();
  } catch {
    // Non-blocking fallback
  }
}

async function loginAsLearner(page: import("@playwright/test").Page) {
  await clearLoginRateLimits();
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("learner@anei.local");
  await form.locator("#login-password-input").fill("DemoLearner!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe("/fr/verification-channel");
  await assureCurrentTestSession(page);
}

test.describe.serial("Learning Experience Upgrade - Phase 3 Verification", () => {
  test.beforeAll(async () => {
    await clearLoginRateLimits();
  });
  test("Learner Dashboard SM-2 Daily Review and Cognitive Architecture (FR & AR)", async ({ page }) => {
    test.setTimeout(90_000);

    // 1. Desktop FR
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsLearner(page);

    await page.goto("/fr/dashboard");
    await page.waitForLoadState("networkidle");

    // Existing features intact (Additive check)
    await expect(page.locator("aside[aria-label='Espace apprenant']")).toBeVisible();
    await expect(page.getByText("Progression générale")).toBeVisible();
    await expect(page.getByText("Formations actives")).toBeVisible();
    await expect(page.getByText("Leçons validées")).toBeVisible();
    await expect(page.getByText("Certifications obtenues")).toBeVisible();

    // SM-2 Daily Review Banner verification
    const dailyReviewBanner = page.locator(".daily-review-banner");
    await expect(dailyReviewBanner).toBeVisible();
    await expect(page.getByText("Ancrage mémoriel quotidien (SM-2)")).toBeVisible();
    
    // Screenshot Desktop FR
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dashboard-fr-desktop.png"),
      fullPage: true,
    });

    // Check Daily Review Modal interaction
    const startReviewBtn = page.getByRole("button", { name: /Démarrer la session/ });
    if (await startReviewBtn.isVisible()) {
      await startReviewBtn.click();
      const modal = page.locator("div[role='dialog']");
      await expect(modal).toBeVisible();

      // Card front is shown
      await expect(modal.getByText("Notion clé")).toBeVisible();

      // Reveal answer
      const revealBtn = modal.getByRole("button", { name: /Révéler la réponse/ });
      await revealBtn.click();

      // SM-2 rating buttons appear
      await expect(modal.getByRole("button", { name: /Bien/ })).toBeVisible();
      await expect(modal.getByRole("button", { name: /Facile/ })).toBeVisible();
      await expect(modal.getByRole("button", { name: /Difficile/ })).toBeVisible();
      await expect(modal.getByRole("button", { name: /À revoir/ })).toBeVisible();

      // Click "Bien"
      await modal.getByRole("button", { name: /Bien/ }).click();
      await page.waitForTimeout(400);

      // Close modal
      const closeBtn = modal.getByRole("button", { name: "Fermer", exact: true });
      await closeBtn.click();
      await expect(modal).not.toBeVisible();
    }

    // 2. Mobile Viewport FR (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dashboard-fr-mobile.png"),
      fullPage: true,
    });

    // 3. Desktop AR (RTL)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ar/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("التثبيت الذهني اليومي (SM-2)")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dashboard-ar-desktop.png"),
      fullPage: true,
    });

    // 4. Mobile Viewport AR (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dashboard-ar-mobile.png"),
      fullPage: true,
    });
  });

  test("Lesson Page Pedagogical Upgrades - Video, Takeaways, Notes, Practice, Quiz (FR & AR)", async ({ page }) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsLearner(page);

    // 1. Visit TSA Lesson in French
    await page.goto("/fr/apprendre/trouble-spectre-autisme-accompagnement-scolaire");
    await page.waitForLoadState("networkidle");

    // Video Player & Chapters Check
    const video = page.locator("video");
    await expect(video).toBeVisible();

    const chaptersBtn = page.getByRole("button", { name: /Chapitres/ });
    if (await chaptersBtn.isVisible()) {
      await chaptersBtn.click();
      await expect(page.getByRole("button", { name: /2\. La Triade Historique/ })).toBeVisible();
      await chaptersBtn.click(); // close menu
    }

    // Pedagogical Navigation Bar
    const nav = page.getByRole("navigation", { name: "Sections de la formation" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "L'essentiel" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Transcription" })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Mes notes/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Mise en pratique" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Vérification des acquis" })).toBeVisible();

    // Section 1: Takeaways ("L'essentiel")
    const takeawaysSection = page.locator("#takeaways");
    await expect(takeawaysSection).toBeVisible();
    await expect(takeawaysSection.getByRole("heading", { name: "Révolution Dyadique (DSM-5-TR)" })).toBeVisible();
    await expect(takeawaysSection.getByRole("button", { name: /Fiche [Mm]émo/ })).toBeVisible();

    // Section 2: Transcript
    const transcriptSection = page.locator("#transcript");
    await expect(transcriptSection).toBeVisible();
    const searchInput = transcriptSection.getByPlaceholder("Rechercher dans la transcription...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("dyade");
    await page.waitForTimeout(300);
    await expect(transcriptSection.getByText(/dyade/i).first()).toBeVisible();
    await searchInput.clear();

    // Section 3: Notes Drawer
    const notesSection = page.locator("#notes");
    await expect(notesSection).toBeVisible();
    const noteInput = notesSection.locator("textarea");
    const uniqueNote = `Observation E2E ${Date.now()} : adapter les consignes visuelles pour l'élève.`;
    await noteInput.fill(uniqueNote);
    const saveNotePromise = page.waitForResponse((res) => res.request().method() === "POST" && res.url().includes("/api/learning/notes"));
    await notesSection.getByRole("button", { name: /Ajouter la note/ }).click();
    const noteRes = await saveNotePromise;
    expect(noteRes.status()).toBe(201);
    await expect(notesSection.getByText(uniqueNote)).toBeVisible();

    // Section 4: Classroom Practice Action
    const practiceSection = page.locator("#practice");
    await expect(practiceSection).toBeVisible();
    await expect(practiceSection.getByText("Audit sensoriel bienveillant de votre classe")).toBeVisible();
    const practiceCheckbox = practiceSection.locator("input[type='checkbox']");
    if (!(await practiceCheckbox.isChecked())) {
      await practiceCheckbox.check();
    }
    const practiceReflection = practiceSection.locator("textarea");
    await practiceReflection.fill("Réalisé avec succès : réduction du bruit lumineux près du tableau.");
    const savePracticePromise = page.waitForResponse((res) => res.request().method() === "POST" && res.url().includes("/api/learning/practice"));
    await practiceSection.getByRole("button", { name: /Valider mon retour/ }).click();
    const practiceRes = await savePracticePromise;
    expect(practiceRes.status()).toBe(200);

    // Section 5: Formative Quiz
    const quizSection = page.locator("#validation-quiz");
    await expect(quizSection).toBeVisible();
    await expect(quizSection.getByText(/Quel est le changement conceptuel majeur introduit par le DSM-5/)).toBeVisible();
    
    // Select an answer for each question to satisfy allAnswered requirement
    const questionBoxes = quizSection.locator("form > div.rounded-xl");
    const qCount = await questionBoxes.count();
    for (let i = 0; i < qCount; i++) {
      await questionBoxes.nth(i).locator("label").first().click();
    }

    // Submit Quiz
    const submitQuizPromise = page.waitForResponse((res) => res.request().method() === "POST" && res.url().includes("/api/learning/quiz-attempt"));
    await quizSection.getByRole("button", { name: /Valider mes réponses/ }).click();
    const quizRes = await submitQuizPromise;
    expect(quizRes.status()).toBe(200);
    const quizResult = await quizRes.json();
    expect(quizResult.scorePercentage).toBeGreaterThanOrEqual(0);

    // Screenshot Desktop FR
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "lesson-fr-desktop.png"),
      fullPage: true,
    });

    // Mobile Viewport FR
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "lesson-fr-mobile.png"),
      fullPage: true,
    });

    // 2. Arabic Course Room Check (RTL)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ar/apprendre/trouble-spectre-autisme-accompagnement-scolaire");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const arNav = page.getByRole("navigation", { name: "أقسام الدورة" });
    await expect(arNav).toBeVisible();
    await expect(arNav.getByRole("link", { name: "النقاط الأساسية" })).toBeVisible();
    await expect(arNav.getByRole("link", { name: "التفريغ النصي" })).toBeVisible();
    await expect(arNav.getByRole("link", { name: /ملاحظاتي/ })).toBeVisible();
    await expect(arNav.getByRole("link", { name: "التطبيق الصفي" })).toBeVisible();
    await expect(arNav.getByRole("link", { name: "اختبار التثبيت" })).toBeVisible();

    await expect(page.locator("#takeaways").getByText("النقاط الأساسية والمفاهيم المحورية")).toBeVisible();
    await expect(page.locator("#transcript").getByText("التفريغ النصي المتزامن")).toBeVisible();
    await expect(page.locator("#notes").getByText("ملاحظاتي الشخصية والتطبيقية")).toBeVisible();
    await expect(page.locator("#practice").getByText("مهمة التطبيق الميداني في القسم")).toBeVisible();
    await expect(page.locator("#validation-quiz").getByText("اختبار التثبيت والتحقق من الفهم")).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "lesson-ar-desktop.png"),
      fullPage: true,
    });

    // Mobile Viewport AR (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "lesson-ar-mobile.png"),
      fullPage: true,
    });
  });
});
