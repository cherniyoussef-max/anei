import { test, expect } from "@playwright/test";

test.describe("Homepage Hero CTA Redesign", () => {
  for (const locale of ["fr", "ar"] as const) {
    const isAr = locale === "ar";

    test(`verifies homepage hero CTA points to account creation [${locale}]`, async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });

      const heroActions = page.locator(".ah-hero-actions");
      await expect(heroActions).toBeVisible();

      // Primary CTA: Account creation
      const primaryBtn = heroActions.locator("a.ah-btn-primary");
      await expect(primaryBtn).toBeVisible();
      await expect(primaryBtn).toHaveAttribute("href", `/${locale}/register`);

      if (isAr) {
        await expect(primaryBtn).toContainText("إنشاء حساب");
      } else {
        await expect(primaryBtn).toContainText("Créer mon compte");
      }

      // Secondary CTA: Course catalog
      const secondaryBtn = heroActions.locator("a.ah-btn-outline");
      await expect(secondaryBtn).toBeVisible();
      await expect(secondaryBtn).toHaveAttribute("href", `/${locale}/formations`);

      // Ensure "Demander une démo" is no longer present
      const demoBtn = page.locator("a:has-text('Demander une démo'), a:has-text('اطلب عرضًا تجريبيًا')");
      await expect(demoBtn).toHaveCount(0);
    });
  }
});
