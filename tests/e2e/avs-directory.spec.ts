import { test, expect } from "@playwright/test";

test.describe("AVS Directory and Booking Platform (FR & AR)", () => {
  for (const locale of ["fr", "ar"] as const) {
    const isAr = locale === "ar";

    test(`verifies AVS directory listing, filtering, and cards [${locale}]`, async ({ page }) => {
      const response = await page.goto(`/${locale}/avs`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);

      // Verify HTML language and direction
      const html = page.locator("html");
      await expect(html).toHaveAttribute("dir", isAr ? "rtl" : "ltr");
      await expect(html).toHaveAttribute("lang", locale);

      // Search & Filter controls
      const searchInput = page.locator("#avs-search-input");
      await expect(searchInput).toBeVisible();

      const specialtySelect = page.locator("#avs-specialty-select");
      await expect(specialtySelect).toBeVisible();

      const governorateSelect = page.locator("#avs-gov-select");
      await expect(governorateSelect).toBeVisible();

      // Quick filter specialty pills
      const filterPills = page.locator(".avs-filter-pill");
      await expect(filterPills.first()).toBeVisible();

      // Verify AVS cards
      const avsCards = page.locator(".avs-card");
      const cardCount = await avsCards.count();
      expect(cardCount).toBeGreaterThan(0);

      const firstCard = avsCards.first();
      await expect(firstCard.locator(".avs-card-name")).toBeVisible();
      await expect(firstCard.locator('a[href*="/avs/"]').first()).toBeVisible();

      // Test Search filtering
      await searchInput.fill("Salma");
      await searchInput.press("Enter");
      await page.waitForLoadState("networkidle");
      const filteredCards = page.locator(".avs-card");
      await expect(filteredCards.first().locator(".avs-card-name")).toContainText("Salma");
    });

    test(`verifies AVS detailed profile page and pedagogical sections [${locale}]`, async ({ page }) => {
      const response = await page.goto(`/${locale}/avs/salma-karray`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);

      // Profile hero
      const profileName = page.locator("h1");
      await expect(profileName).toContainText("Salma");

      // Verify sticky booking widget and modality selector
      const bookingWidget = page.locator(".avs-booking-widget");
      await expect(bookingWidget).toBeVisible();
      await expect(bookingWidget.locator("button").first()).toBeVisible();
    });
  }

  test("completes end-to-end appointment booking flow from AVS directory [fr]", async ({ page }) => {
    await page.goto("/fr/avs", { waitUntil: "networkidle" });

    // Click "Consulter le profil & réserver" on the first card
    const firstCta = page.locator('.avs-card a:has-text("Consulter le profil")').first();
    await expect(firstCta).toBeVisible();
    await firstCta.click();

    // Verify navigating to profile page
    await page.waitForURL(/\/fr\/avs\/[\w-]+/);
    const bookingWidget = page.locator(".avs-booking-widget");
    await expect(bookingWidget).toBeVisible();

    // Verify modality buttons
    await expect(bookingWidget.locator('button:has-text("Sur place")')).toBeVisible();
    await expect(bookingWidget.locator('button:has-text("En ligne")')).toBeVisible();

    // Click "Prendre ce rendez-vous"
    const bookBtn = bookingWidget.locator('button:has-text("Prendre ce rendez-vous")');
    await expect(bookBtn).toBeVisible();
    await bookBtn.click();

    // Verify booking modal opened
    const modal = page.locator(".avs-booking-modal");
    await expect(modal).toBeVisible();
  });
});
