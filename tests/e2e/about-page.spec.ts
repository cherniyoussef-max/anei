import { test, expect } from "@playwright/test";

test.describe("About Page Redesign (FR & AR)", () => {
  for (const locale of ["fr", "ar"] as const) {
    const isAr = locale === "ar";

    test(`verifies about page structure, 3D assets, and accessibility [${locale}]`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      const response = await page.goto(`/${locale}/about`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);

      // Verify language and direction
      const html = page.locator("html");
      await expect(html).toHaveAttribute("dir", isAr ? "rtl" : "ltr");
      await expect(html).toHaveAttribute("lang", locale);

      // 1. Hero Section
      const h1 = page.locator("h1#about-hero-heading");
      await expect(h1).toBeVisible();
      if (isAr) {
        await expect(h1).toHaveText("التربية الدامجة، في الممارسة.");
      } else {
        await expect(h1).toHaveText("L’inclusion, en pratique.");
      }

      // Hero Editorial Care Team asset check
      const heroTeamImg = page.locator(".ah-editorial-img");
      await expect(heroTeamImg).toBeVisible();
      const heroTeamLoaded = await heroTeamImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
      expect(heroTeamLoaded).toBe(true);

      // Hero editorial caption
      const heroCaption = page.locator(".ah-editorial-caption");
      await expect(heroCaption).toBeVisible();

      // CTA buttons
      const heroFormationsBtn = page.locator(".ah-hero-actions a[href*='/formations']");
      const heroContactBtn = page.locator(".ah-hero-actions a[href*='/contact']");
      await expect(heroFormationsBtn).toBeVisible();
      await expect(heroContactBtn).toBeVisible();

      // 2. Method Section
      const methodSection = page.locator("section[aria-labelledby='about-method-heading']");
      await expect(methodSection).toBeVisible();
      const methodCards = methodSection.locator(".ah-method-card");
      await expect(methodCards).toHaveCount(3);

      // Verify steps 01, 02, 03 and track badge
      const trackBadge = methodSection.locator(".ah-method-track-badge");
      await expect(trackBadge).toBeVisible();
      await expect(methodCards.nth(0).locator(".ah-method-step")).toHaveText("01");
      await expect(methodCards.nth(1).locator(".ah-method-step")).toHaveText("02");
      await expect(methodCards.nth(2).locator(".ah-method-step")).toHaveText("03");

      // 3. Field Section with 3D Scene
      const fieldSection = page.locator("section[aria-labelledby='about-field-heading']");
      await expect(fieldSection).toBeVisible();

      const fieldImg = fieldSection.locator(".ah-field-stage img");
      await expect(fieldImg).toBeVisible();
      const fieldImgLoaded = await fieldImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
      expect(fieldImgLoaded).toBe(true);

      const fieldItems = fieldSection.locator(".ah-field-item");
      await expect(fieldItems).toHaveCount(3);

      // 4. Commitments Section
      const commitmentsSection = page.locator("section[aria-labelledby='about-commitments-heading']");
      await expect(commitmentsSection).toBeVisible();
      const commitmentCards = commitmentsSection.locator(".ah-commitment-card");
      await expect(commitmentCards).toHaveCount(4);

      // Verify steps 01, 02, 03, 04
      await expect(commitmentCards.nth(0).locator(".ah-commitment-num")).toHaveText("01");
      await expect(commitmentCards.nth(1).locator(".ah-commitment-num")).toHaveText("02");
      await expect(commitmentCards.nth(2).locator(".ah-commitment-num")).toHaveText("03");
      await expect(commitmentCards.nth(3).locator(".ah-commitment-num")).toHaveText("04");

      // 5. Call-to-action Section
      const ctaSection = page.locator("section[aria-labelledby='about-cta-heading']");
      await expect(ctaSection).toBeVisible();
      const ctaFormations = ctaSection.locator("a[href*='/formations']");
      const ctaContact = ctaSection.locator("a[href*='/contact']");
      await expect(ctaFormations).toBeVisible();
      await expect(ctaContact).toBeVisible();

      // Ensure no unexpected runtime application crashes
      const criticalErrors = consoleErrors.filter(
        (err) =>
          !err.includes("favicon") &&
          !err.includes("Hydration") &&
          !err.includes("Download the React DevTools") &&
          !err.includes("Content Security Policy"),
      );
      expect(criticalErrors).toEqual([]);
    });
  }
});
