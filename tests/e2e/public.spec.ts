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

for (const locale of ["en", "fr", "ar"] as const) {
  test(`${locale} public navigation is renderable`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("main")).toBeVisible();
    await page.goto(`/${locale}/formations`);
    await expect(page.getByRole("main")).toBeVisible();
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} public mobile navigation manages focus and direction`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}`);
    const menu = page.locator(".mobile-menu-button");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: locale === "ar" ? "إغلاق القائمة" : "Close menu" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(menu).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} public course details render without a route error`, async ({ page }) => {
    await page.goto(`/${locale}/formations`);
    const courseLink = page.locator(`a[href^="/${locale}/formations/"]`).first();
    await expect(courseLink).toBeVisible();
    const href = await courseLink.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Une erreur est survenue", { exact: true })).toHaveCount(0);
  });
}

test("private dashboard does not render anonymously", async ({ page }) => {
  await page.goto("/fr/dashboard");
  await expect.poll(() => new URL(page.url()).pathname).not.toBe("/fr/dashboard");
});

test("admin console is denied anonymously in both locales", async ({ page }) => {
  for (const locale of ["fr", "ar"] as const) {
    await page.goto(`/${locale}/admin`);
    await expect.poll(() => new URL(page.url()).pathname).not.toBe(`/${locale}/admin`);
  }
});

test("Arabic authentication remains RTL and mobile operable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/ar/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "مرحبًا بعودتك" })).toBeVisible();
  const form = page.locator(".auth-form");
  await expect(form.getByLabel("Email")).toBeVisible();
  await expect(form.getByLabel("كلمة المرور")).toBeVisible();
  const forgotPassword = form.getByRole("link", { name: "نسيت كلمة المرور؟" });
  await expect(forgotPassword).toBeVisible();
  const box = await forgotPassword.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
});

test("Google controls are locale-safe when the provider is configured", async ({ page }) => {
  for (const locale of ["fr", "ar"] as const) {
    await page.goto(`/${locale}/login`);
    const google = page.getByTestId("google-sign-in");
    await expect(google).toBeVisible();
    if (await google.isEnabled()) {
      await expect(google).toBeEnabled();
    } else {
      await expect(google).toBeDisabled();
      await expect(page.locator("#google-auth-availability")).toBeVisible();
    }
    await expect(google).toHaveAttribute(
      "aria-label",
      locale === "ar" ? "المتابعة باستخدام Google" : "Continuer avec Google",
    );
    await expect(page.locator(".auth-form").getByLabel("Email")).toBeVisible();
  }
});

test("Google login exposes loading and safe error fallbacks", async ({ page }) => {
  await page.goto("/fr/login");
  const google = page.getByTestId("google-sign-in");
  if (!(await google.isEnabled())) return;

  let releaseRequest: (() => void) | undefined;
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/api/auth/sign-in/social", async (route) => {
    await requestGate;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "provider internals must not be shown" }),
    });
  });

  const click = google.click();
  await expect(google).toBeDisabled();
  await expect(google.locator(".button-spinner")).toBeVisible();
  releaseRequest?.();
  await click;
  const error = page.locator(".auth-form").getByRole("alert");
  await expect(error).toContainText("La connexion Google n’a pas abouti");
  await expect(error).not.toContainText("provider internals");
  await expect(page.locator(".auth-form").getByLabel("Email")).toBeVisible();
});

test("Better Auth accepts safe locale callbacks and rejects external callbacks", async ({ page, request }) => {
  await page.goto("/fr/login");
  if (!(await page.getByTestId("google-sign-in").isEnabled())) return;
  const origin = new URL(page.url()).origin;

  for (const locale of ["fr", "ar"] as const) {
    const response = await request.post("/api/auth/sign-in/social", {
      headers: { Origin: origin, "Content-Type": "application/json" },
      data: {
        provider: "google",
        callbackURL: `/${locale}/dashboard`,
        errorCallbackURL: `/${locale}/login?error=google_auth_failed`,
        disableRedirect: true,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.url).toContain("accounts.google.com");
  }

  const malicious = await request.post("/api/auth/sign-in/social", {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: {
      provider: "google",
      callbackURL: "https://attacker.invalid/steal",
      disableRedirect: true,
    },
  });
  expect(malicious.status()).toBe(403);
});

test("security headers are present", async ({ request }) => {
  const response = await request.get("/fr");
  expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});

test("custom mutations reject a foreign Origin", async ({ request }) => {
  const response = await request.post("/api/contact", {
    headers: { Origin: "https://attacker.invalid", "Content-Type": "application/json" },
    data: { name: "Test User", email: "test@example.com", subject: "Question", message: "Message de test suffisamment long." },
  });
  expect(response.status()).toBe(403);
});

test("admin mutation is inaccessible anonymously", async ({ request }) => {
  const response = await request.post("/api/admin/courses", {
    headers: { Origin: process.env.APP_URL ?? "http://127.0.0.1:3000", "Content-Type": "application/json" },
    data: {},
  });
  expect([401, 403]).toContain(response.status());
});

test("email learner session survives navigation and cannot enter admin", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("learner@anei.local");
  await form.getByLabel("Mot de passe").fill("DemoLearner!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/verification-channel");
  await assureCurrentTestSession(page);
  await page.goto("/fr/dashboard");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/dashboard");
  await page.goto("/fr/formations");
  await page.goto("/fr/dashboard");
  await expect(page.locator(".student-app")).toBeVisible();
  for (const route of ["formations", "rendez-vous", "ressources", "certificats", "profil"]) {
    await page.goto(`/fr/dashboard/${route}`);
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/fr/dashboard/${route}`);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(`aside nav a[href="/fr/dashboard/${route}"]`)).toHaveAttribute("aria-current", "page");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/dashboard/rendez-vous");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".student-mobile-nav")).toBeVisible();
  await page.locator(".student-mobile-nav button").click();
  await expect(page.locator("#student-mobile-drawer")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/fr/admin");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/dashboard");
});

test("existing SUPER_ADMIN email session retains server-authorized admin access", async ({ page }) => {
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("admin@anei.local");
  await form.getByLabel("Mot de passe").fill("DemoAdmin!!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/verification-channel");
  await assureCurrentTestSession(page);
  await page.goto("/fr/admin");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/admin");
  await expect(page.getByRole("main")).toBeVisible();
});
