import { expect, test } from "@playwright/test";

test.describe("AVS Directory & Profile Workflow Tests", () => {
  test("1. Directory French layout: search bar, clean editorial cards without slot/rate box, profile navigation", async ({ page }) => {
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

    // Verify results count heading
    await expect(page.locator("h2:has-text('accompagnant')")).toBeVisible();

    // Verify professional card structure
    const firstCard = page.locator("article.avs-card").first();
    await expect(firstCard).toBeVisible();

    // Verify identity, certified badge, and rating
    await expect(firstCard.locator(".avs-card-name")).toBeVisible();
    await expect(firstCard.locator("text=Certifié ANEI").first()).toBeVisible();
    await expect(firstCard.locator("text=ans d'expérience").first()).toBeVisible();

    // Verify that the right-hand slot/rate box is removed from directory card
    await expect(firstCard.locator("text=Prochains créneaux")).not.toBeVisible();

    // Primary CTA: "Consulter le profil & réserver"
    const viewProfileBtn = firstCard.locator('a:has-text("Consulter le profil & réserver")');
    await expect(viewProfileBtn).toBeVisible();
    await viewProfileBtn.click();

    // Assert navigation to profile detail page
    await page.waitForURL(/\/fr\/avs\/[\w-]+/);
    await expect(page.locator("h1")).toBeVisible();

    // Assert that the hero header does NOT have the "Tarif indicatif" box
    const heroHeader = page.locator("header");
    await expect(heroHeader.locator("text=Tarif indicatif")).not.toBeVisible();

    // Assert booking widget has modality selector: "Sur place (Présentiel)" and "En ligne (Visioconférence)"
    const bookingWidget = page.locator(".avs-booking-widget");
    await expect(bookingWidget).toBeVisible();
    const inPersonBtn = bookingWidget.locator('button:has-text("Sur place (Présentiel)")');
    const onlineBtn = bookingWidget.locator('button:has-text("En ligne (Visioconférence)")');
    await expect(inPersonBtn).toBeVisible();
    await expect(onlineBtn).toBeVisible();

    // Switch to online modality
    await onlineBtn.click();
    await expect(bookingWidget.getByText("En ligne", { exact: true })).toBeVisible();

    // Click "Prendre ce rendez-vous"
    const bookCta = bookingWidget.locator('button:has-text("Prendre ce rendez-vous")');
    await expect(bookCta).toBeVisible();
    await bookCta.click();

    // Verify booking modal opens with authentication prompt
    const modal = page.locator(".avs-booking-modal");
    await expect(modal).toBeVisible();
    await expect(modal.locator("text=Connexion obligatoire pour réserver")).toBeVisible();

    // Close modal
    await modal.locator('button:has(svg)').first().click();
    await expect(modal).not.toBeVisible();
  });

  test("2. Directory Arabic layout: RTL orientation, Arabic typography, profile navigation and modality", async ({ page }) => {
    await page.goto("/ar/avs");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toContainText("اعثر على مرافق مدرسي معتمد");

    // Results header
    await expect(page.locator("text=مرافق(ة) مدرسي(ة)")).toBeVisible();

    // Card details
    const firstCard = page.locator("article.avs-card").first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator("text=معتمد ANEI").first()).toBeVisible();

    // Primary CTA in Arabic: "عرض الملف وحجز موعد"
    const viewProfileBtn = firstCard.locator('a:has-text("عرض الملف وحجز موعد")');
    await expect(viewProfileBtn).toBeVisible();
    await viewProfileBtn.click();

    // Assert navigation to Arabic profile page
    await page.waitForURL(/\/ar\/avs\/[\w-]+/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // Verify Arabic modality selector in booking widget
    const bookingWidget = page.locator(".avs-booking-widget");
    await expect(bookingWidget).toBeVisible();
    await expect(bookingWidget.locator('button:has-text("على عين المكان")')).toBeVisible();
    await expect(bookingWidget.locator('button:has-text("عن بعد (فيديو)")')).toBeVisible();
  });
});
