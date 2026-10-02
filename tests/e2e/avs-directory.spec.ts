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
      await expect(firstCard.locator(".avs-status-available")).toBeVisible();
      await expect(firstCard.locator(".avs-rate-pill")).toBeVisible();

      // Verify 3-day slot picker presence on card
      const slotPicker = firstCard.locator(".avs-slot-picker");
      await expect(slotPicker).toBeVisible();
      const slotButtons = firstCard.locator(".avs-slot-btn");
      expect(await slotButtons.count()).toBeGreaterThan(0);

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

      // Verify pedagogical sections
      const approachSection = page.locator(".avs-approach-section");
      await expect(approachSection).toBeVisible();

      const domainsSection = page.locator(".avs-domains-section");
      await expect(domainsSection).toBeVisible();

      // Sticky booking widget
      const bookingWidget = page.locator(".avs-booking-widget");
      await expect(bookingWidget).toBeVisible();
      const ctaBtn = bookingWidget.locator("button");
      await expect(ctaBtn.first()).toBeVisible();
    });
  }

  test("completes end-to-end appointment booking flow from AVS directory [fr]", async ({ page }) => {
    await page.goto("/fr/avs", { waitUntil: "networkidle" });

    // Click the first available slot button on the first card
    const firstSlot = page.locator(".avs-card .avs-slot-btn").first();
    await expect(firstSlot).toBeVisible();
    await firstSlot.click();

    // Verify booking modal opened
    const modal = page.locator(".avs-booking-modal");
    await expect(modal).toBeVisible();

    // Step 1: Slot and format selected, proceed to Step 2
    const nextBtn1 = page.locator("#avs-booking-next-step");
    await expect(nextBtn1).toBeVisible();
    await nextBtn1.click();

    // Step 2: Child details
    const childNameInput = page.locator("#avs-child-name");
    await expect(childNameInput).toBeVisible();
    await childNameInput.fill("Yassine Trabelsi");

    const childAgeInput = page.locator("#avs-child-age");
    await childAgeInput.fill("8");

    const needDescInput = page.locator("#avs-need-description");
    await needDescInput.fill("Besoin d'accompagnement scolaire pour TSA léger en classe de CE1.");

    const nextBtn2 = page.locator("#avs-booking-next-step");
    await nextBtn2.click();

    // Step 3: Parent contact details
    const parentNameInput = page.locator("#avs-parent-name");
    await expect(parentNameInput).toBeVisible();
    await parentNameInput.fill("Amira Trabelsi");

    const parentEmailInput = page.locator("#avs-parent-email");
    await parentEmailInput.fill("amira.trabelsi@example.com");

    const parentPhoneInput = page.locator("#avs-parent-phone");
    await parentPhoneInput.fill("+216 98 123 456");

    // Submit booking request
    const submitBtn = page.locator("#avs-booking-submit");
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Step 4: Confirmation screen
    const successScreen = page.locator(".avs-booking-success");
    await expect(successScreen).toBeVisible({ timeout: 10000 });
    await expect(successScreen.locator(".avs-booking-ref")).toBeVisible();
  });
});
