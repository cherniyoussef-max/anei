import { test, expect } from "@playwright/test";

test.describe("Homepage Hero Navigation & Actions", () => {
  for (const locale of ["fr", "ar"] as const) {

    test(`verifies homepage hero search and quick access links [${locale}]`, async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });

      const heroSearchBar = page.locator(".hero-search-bar");
      await expect(heroSearchBar).toBeVisible();
      await expect(heroSearchBar).toHaveAttribute("action", `/${locale}/formations`);

      const searchInput = heroSearchBar.locator("input[type='search']");
      await expect(searchInput).toBeVisible();

      // Quick-access grid
      const quickAccess = page.locator(".quick-access-root");
      await expect(quickAccess).toBeVisible();
      await expect(quickAccess.locator(`a[href="/${locale}/formations"]`)).toBeVisible();
      await expect(quickAccess.locator(`a[href="/${locale}/bibliotheque"]`)).toBeVisible();
      await expect(quickAccess.locator(`a[href="/${locale}/avs"]`)).toBeVisible();
      await expect(quickAccess.locator(`a[href="/${locale}/webinaires"]`)).toBeVisible();

      // Ensure deprecated demo CTA is not present
      const demoBtn = page.locator("a:has-text('Demander une démo'), a:has-text('اطلب عرضًا تجريبيًا')");
      await expect(demoBtn).toHaveCount(0);
    });
  }
});
