import { test, expect } from "@playwright/test";

test.describe("ANEI Brand Logo & Animated Intro", () => {
  for (const locale of ["fr", "ar"] as const) {
    const isAr = locale === "ar";
    const expectedAlt = isAr
      ? "الأكاديمية الوطنية للتربية الدامجة"
      : "Académie Nationale de l’Éducation Inclusive";

    test(`${locale}: Header and footer display official ANEI brand logo`, async ({ page }) => {
      await page.goto(`/${locale}`);

      // Header Brand Link
      const headerBrand = page.locator(".site-brand-link");
      await expect(headerBrand).toBeVisible();

      // Check alt text on visible logo image
      const logoImg = headerBrand.locator("img:visible").first();
      await expect(logoImg).toHaveAttribute("alt", expectedAlt);

      // Footer Brand Crest
      const footerCrest = page.locator(".footer-crest");
      await footerCrest.scrollIntoViewIfNeeded();
      await expect(footerCrest).toBeVisible();
      const footerMarkImg = footerCrest.locator("img").first();
      await expect(footerMarkImg).toHaveAttribute("alt", expectedAlt);
    });

    test(`${locale}: Homepage hero animated logo renders 5 layers and plays intro`, async ({ page }) => {
      await page.goto(`/${locale}`);

      // Hero logo container
      const heroIntro = page.locator(".ah-hero-logo-intro");
      await expect(heroIntro).toBeVisible();

      // Stage element
      const stage = heroIntro.locator("div[role='img']");
      await expect(stage).toBeVisible();
      await expect(stage).toHaveAttribute("aria-label", expectedAlt);

      // Verify the 5 constituent layers are present
      const layerImages = stage.locator("img");
      await expect(layerImages).toHaveCount(5);

      // Verify each layer source
      const srcList = await layerImages.evaluateAll((imgs) =>
        imgs.map((img) => (img as HTMLImageElement).src)
      );

      expect(srcList.some((s) => s.includes("layer-shadow"))).toBe(true);
      expect(srcList.some((s) => s.includes("layer-navy"))).toBe(true);
      expect(srcList.some((s) => s.includes("layer-gold"))).toBe(true);
      expect(srcList.some((s) => s.includes("layer-arabic"))).toBe(true);
      expect(srcList.some((s) => s.includes("layer-french"))).toBe(true);

      // Verify sessionStorage flag was set
      await expect.poll(async () =>
        page.evaluate(() => sessionStorage.getItem("anei_logo_animated_played"))
      ).toBe("1");
    });
  }

  test("Reduced motion renders complete static logo immediately without animation", async ({ page }) => {
    // Emulate user preference for reduced motion
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/fr");

    const stage = page.locator(".ah-hero-logo-intro div[role='img']");
    await expect(stage).toBeVisible();

    // Verify all layers are fully visible (opacity = 1) without being clipped
    const layerImages = stage.locator("img");
    await expect(layerImages).toHaveCount(5);

    for (let i = 0; i < 5; i++) {
      const opacity = await layerImages.nth(i).evaluate((el) => {
        return window.getComputedStyle(el).opacity;
      });
      expect(Number(opacity)).toBe(1);
    }
  });

  test("Subsequent visit in same session renders static logo without re-animating", async ({ page }) => {
    // Pre-set sessionStorage flag
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("anei_logo_animated_played", "1");
      } catch {
        // ignore
      }
    });

    await page.goto("/fr");

    const stage = page.locator(".ah-hero-logo-intro div[role='img']");
    await expect(stage).toBeVisible();

    // The .animate class should not be present
    const classList = await stage.getAttribute("class");
    expect(classList).not.toContain("animate");
  });
});
