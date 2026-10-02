import { expect, test } from "@playwright/test";

test.describe("AVS Directory Redesign & Professional Interaction Tests", () => {
  test("1. Directory French layout: search bar, quick filters, and professional cards", async ({ page }) => {
    await page.goto("/fr/avs");
    await expect(page.locator("h1")).toContainText("Trouvez un AVS certifié");

    // Check search console inputs
    const searchInput = page.locator("#avs-search-input");
    await expect(searchInput).toBeVisible();
    await expect(page.locator("#avs-specialty-select")).toBeVisible();
    await expect(page.locator("#avs-gov-select")).toBeVisible();

    // Verify quick filter tags
    const filterPill = page.locator('button:has-text("Autisme (TSA)")');
    await expect(filterPill).toBeVisible();

    // Verify results count heading (without tacky pulsing dots)
    await expect(page.locator("text=accompagnant")).toBeVisible();
    await expect(page.locator("text=séquestre garanti")).toBeVisible();

    // Verify professional card structure
    const firstCard = page.locator("article.avs-card").first();
    await expect(firstCard).toBeVisible();

    // Verify identity, certified badge, and rating
    await expect(firstCard.locator(".avs-card-name")).toBeVisible();
    await expect(firstCard.locator("text=Certifié ANEI").first()).toBeVisible();
    await expect(firstCard.locator("text=ans d'expérience").first()).toBeVisible();

    // Verify appointment console on right
    await expect(firstCard.locator("text=Tarif indicatif")).toBeVisible();
    await expect(firstCard.locator("text=TND / h")).toBeVisible();
    await expect(firstCard.locator("text=Prochains créneaux")).toBeVisible();

    // Click "Prendre RDV" on the card
    const bookBtn = firstCard.locator('button:has-text("Prendre RDV")');
    await expect(bookBtn).toBeVisible();
    await bookBtn.click();

    // Verify booking modal opens
    const modal = page.locator(".avs-booking-modal");
    await expect(modal).toBeVisible();
    await expect(modal.locator("text=Connexion obligatoire pour réserver")).toBeVisible();

    // Close modal
    await modal.locator('button:has(svg)').first().click();
    await expect(modal).not.toBeVisible();
  });

  test("2. Quick slot buttons open modal with slot pre-selected", async ({ page }) => {
    await page.goto("/fr/avs");
    const firstCard = page.locator("article.avs-card").first();

    // Find first quick slot button
    const slotBtn = firstCard.locator("button.shadow-2xs").first();
    await expect(slotBtn).toBeVisible();
    await slotBtn.click();

    // Verify modal opens
    const modal = page.locator(".avs-booking-modal");
    await expect(modal).toBeVisible();
  });

  test("3. Directory Arabic layout: RTL orientation, Arabic typography and badges", async ({ page }) => {
    await page.goto("/ar/avs");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toContainText("اعثر على مرافق مدرسي معتمد");

    // Results header
    await expect(page.locator("text=مرافق(ة) مدرسي(ة)")).toBeVisible();
    await expect(page.locator("text=حجز مباشر وتنسيق مؤمن تحت الضمان")).toBeVisible();

    // Card details
    const firstCard = page.locator("article.avs-card").first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator("text=معتمد ANEI").first()).toBeVisible();
    await expect(firstCard.locator('button:has-text("حجز موعد")')).toBeVisible();
  });
});
