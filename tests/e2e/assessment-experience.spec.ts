import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

const fixture = {
  courseId: "",
  draftAssessmentId: randomUUID(),
  publishedAssessmentId: randomUUID(),
};

function databaseUrl() {
  const value = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!value) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");
  return value;
}

async function assureCurrentTestSession(page: Page) {
  const cookie = (await page.context().cookies()).find((item) => item.name.includes("session_token"));
  if (!cookie) throw new Error("Better Auth session cookie missing in E2E fixture");
  const token = decodeURIComponent(cookie.value).split(".")[0];
  const client = new Client({ connectionString: databaseUrl() });
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

async function login(page: Page, role: "admin" | "learner") {
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill(role === "admin" ? "admin@anei.local" : "learner@anei.local");
  await form.getByLabel("Mot de passe").fill(role === "admin" ? "DemoAdmin!!2026" : "DemoLearner!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe("/fr/verification-channel");
  await assureCurrentTestSession(page);
}

test.describe.serial("assessment experience", () => {
  test.beforeAll(async () => {
    const client = new Client({ connectionString: databaseUrl() });
    await client.connect();
    try {
      const course = await client.query<{ id: string }>("select id from courses where slug = $1 limit 1", ["fondamentaux-education-inclusive"]);
      if (!course.rows[0]) throw new Error("Seeded course not found");
      fixture.courseId = course.rows[0].id;
      await client.query(
        `insert into learning_assessment
          (id, course_id, title_fr, title_ar, instructions_fr, instructions_ar, time_limit_seconds, passing_score, max_attempts, published, created_at, updated_at)
         values
          ($1, $3, 'Quiz de pratique inclusive', 'اختبار الممارسات الدامجة', 'Choisissez la réponse la plus juste.', 'اختر الإجابة الأكثر دقة.', 900, 70, 3, false, now(), now() + interval '1 second'),
          ($2, $3, 'Évaluation finale — Inclusion', 'التقييم النهائي — الدمج', 'Répondez aux trois questions avant de valider.', 'أجب عن الأسئلة الثلاثة قبل التأكيد.', 900, 70, 3, true, now(), now())`,
        [fixture.draftAssessmentId, fixture.publishedAssessmentId, fixture.courseId],
      );
      for (let index = 1; index <= 3; index += 1) {
        const questionId = randomUUID();
        await client.query(
          `insert into learning_question
            (id, assessment_id, prompt_fr, prompt_ar, type, position, points, created_at, updated_at)
           values ($1, $2, $3, $4, 'SINGLE_CHOICE', $5, 1, now(), now())`,
          [questionId, fixture.publishedAssessmentId, `Quelle pratique soutient l’inclusion ? — ${index}`, `ما الممارسة التي تدعم الدمج؟ — ${index}`, index],
        );
        await client.query(
          `insert into learning_question_option (id, question_id, text_fr, text_ar, position, is_correct) values
            ($1, $4, 'Adapter les supports aux besoins', 'تكييف الوسائل مع الاحتياجات', 1, true),
            ($2, $4, 'Utiliser une méthode unique', 'استخدام طريقة واحدة', 2, false),
            ($3, $4, 'Écarter la collaboration', 'استبعاد التعاون', 3, false)`,
          [randomUUID(), randomUUID(), randomUUID(), questionId],
        );
      }
    } finally {
      await client.end();
    }
  });

  test.afterAll(async () => {
    const client = new Client({ connectionString: databaseUrl() });
    await client.connect();
    try {
      await client.query("delete from learning_assessment where id = any($1::text[])", [[fixture.draftAssessmentId, fixture.publishedAssessmentId]]);
    } finally {
      await client.end();
    }
  });

  test("admin builder is responsive, bilingual, and starts single choice with three answers", async ({ page }) => {
    await login(page, "admin");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/fr/admin/courses/editor/${fixture.courseId}?section=evaluation`);
    await expect(page.locator(".admin-assessment-builder")).toBeVisible();
    await expect(page.getByText("Quiz de pratique inclusive", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Ajouter une question" }).click();
    await expect(page.locator(".assessment-answer-row")).toHaveCount(3);
    await expect(page.locator(".assessment-answer-row input[type=radio]")).toHaveCount(3);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "/tmp/anei-assessment-admin-fr-desktop.png", fullPage: true });
    await page.locator(".assessment-picker select").selectOption(fixture.publishedAssessmentId);
    const lockedQuestion = page.locator(".assessment-question-summary").first();
    await expect(lockedQuestion).toBeEnabled();
    await lockedQuestion.click();
    await expect(page.locator(".assessment-question-audit")).toBeVisible();
    await expect(page.locator(".assessment-question-audit .is-correct")).toHaveCount(1);
    await page.screenshot({ path: "/tmp/anei-assessment-admin-fr-locked.png", fullPage: true });

    for (const width of [375, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 375, height: 844 });
    await page.goto(`/ar/admin/courses/editor/${fixture.courseId}?section=evaluation`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("اختبار الممارسات الدامجة", { exact: true }).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "/tmp/anei-assessment-admin-ar-mobile.png", fullPage: true });
  });

  test("learner completes one focused question at a time with accessible navigation", async ({ page }) => {
    await login(page, "learner");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/fr/apprendre/fondamentaux-education-inclusive/quiz/${fixture.publishedAssessmentId}`);
    await expect(page.locator(".assessment-player-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quelle pratique soutient l’inclusion ? — 1" })).toBeVisible();
    await expect(page.locator(".assessment-current-question h2")).toHaveCount(1);
    await expect(page.locator(".assessment-choice")).toHaveCount(3);
    await page.locator(".assessment-choice").first().click();
    await expect(page.locator(".assessment-choice").first()).toHaveClass(/is-selected/);
    await page.screenshot({ path: "/tmp/anei-assessment-learner-fr-desktop.png", fullPage: true });

    for (let question = 1; question < 3; question += 1) {
      await page.getByRole("button", { name: "Suivant" }).click();
      await page.locator(".assessment-choice").first().click();
    }
    await page.getByRole("button", { name: "Terminer l’évaluation" }).click();
    const dialog = page.getByRole("dialog", { name: "Soumettre votre évaluation ?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Soumettre l’évaluation" }).click();
    await expect(page.locator(".assessment-result")).toBeVisible();
    await expect(page.getByRole("heading", { name: "100%" })).toBeVisible();
    await page.screenshot({ path: "/tmp/anei-assessment-learner-fr-result.png", fullPage: true });

    await page.getByRole("button", { name: "Réessayer l’évaluation" }).click();
    for (let question = 0; question < 3; question += 1) {
      await page.locator(".assessment-choice").first().click();
      if (question < 2) await page.getByRole("button", { name: "Suivant" }).click();
    }
    await page.getByRole("button", { name: "Terminer l’évaluation" }).click();
    await page.getByRole("dialog", { name: "Soumettre votre évaluation ?" }).getByRole("button", { name: "Soumettre l’évaluation" }).click();
    await expect(page.locator('.assessment-attempt-table [role="row"]')).toHaveCount(3);
    await expect(page.getByText("Meilleur score : 100%", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 375, height: 844 });
    await page.goto(`/ar/apprendre/fondamentaux-education-inclusive/quiz/${fixture.publishedAssessmentId}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "ما الممارسة التي تدعم الدمج؟ — 1" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator(".assessment-player-footer").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy({ top: 160, behavior: "instant" }));
    const footerBox = await page.locator(".assessment-player-footer").boundingBox();
    const mobileNavBox = await page.locator(".student-mobile-nav").boundingBox();
    expect(footerBox).toBeTruthy();
    expect(mobileNavBox).toBeTruthy();
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(mobileNavBox!.y);
    await page.screenshot({ path: "/tmp/anei-assessment-learner-ar-mobile.png" });
  });

  test("admin results expose exact server analytics without responsive overflow", async ({ page }) => {
    await login(page, "admin");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/fr/admin/assessments");
    await expect(page.getByRole("heading", { name: "Évaluations & résultats" })).toBeVisible();
    await expect(page.getByText("Évaluation finale — Inclusion", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Amal Mansouri", { exact: true })).toBeVisible();
    await page.screenshot({ path: "/tmp/anei-assessment-results-fr-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 375, height: 844 });
    await page.goto("/ar/admin/assessments");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "/tmp/anei-assessment-results-ar-mobile.png", fullPage: true });
  });
});
