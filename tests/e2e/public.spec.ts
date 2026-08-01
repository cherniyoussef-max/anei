import { expect, test } from "@playwright/test";

for (const locale of ["fr", "ar"] as const) {
  test(`${locale} public navigation is renderable`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("main")).toBeVisible();
    await page.goto(`/${locale}/formations`);
    await expect(page.getByRole("main")).toBeVisible();
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
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("learner@anei.local");
  await form.getByLabel("Mot de passe").fill("DemoLearner!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/dashboard");
  await page.goto("/fr/formations");
  await page.goto("/fr/dashboard");
  await expect(page.getByText("learner@anei.local")).toBeVisible();
  await page.goto("/fr/admin");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/dashboard");
});

test("existing SUPER_ADMIN email session retains server-authorized admin access", async ({ page }) => {
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("admin@anei.local");
  await form.getByLabel("Mot de passe").fill("DemoAdmin!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/dashboard");
  await page.goto("/fr/admin");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/admin");
  await expect(page.getByRole("main")).toBeVisible();
});
