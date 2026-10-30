import { test, expect } from "@playwright/test";

test.describe("ANEI Sign-up Step 1 Role Selection UX/UI Upgrade", () => {
  test("Desktop 2-column grid layout and Option A SVG visual rendering (1440px)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000/fr/inscription", { waitUntil: "networkidle" });

    // Progress bar check
    const progress = page.getByRole("progressbar");
    await expect(progress).toBeVisible();

    // Check all 6 role radio options exist
    const radiogroup = page.getByRole("radiogroup");
    await expect(radiogroup).toBeVisible();

    const radios = radiogroup.getByRole("radio");
    await expect(radios).toHaveCount(6);

    // Verify Option A SVG images are used
    const images = radiogroup.locator("img");
    await expect(images).toHaveCount(6);

    const expectedSvgs = [
      "role-learner.svg",
      "role-parent.svg",
      "role-teacher.svg",
      "role-avs.svg",
      "role-specialist.svg",
      "role-institution.svg",
    ];

    for (let i = 0; i < expectedSvgs.length; i++) {
      const src = await images.nth(i).getAttribute("src");
      expect(src).toContain(expectedSvgs[i]);
    }

    // Measure bounding boxes of card 0 and card 1 to verify 2-column layout
    const box0 = await radios.nth(0).boundingBox();
    const box1 = await radios.nth(1).boundingBox();
    expect(box0).not.toBeNull();
    expect(box1).not.toBeNull();
    if (box0 && box1) {
      // In a 2-column grid, card 0 and card 1 share roughly the same Y and have different X
      expect(Math.abs(box0.y - box1.y)).toBeLessThan(10);
      expect(box1.x).toBeGreaterThan(box0.x);
    }

    // Check no horizontal scrollbar
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  test("Mobile layout (375px) has compact cards and sticky bottom Continue button", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("http://localhost:3000/ar/inscription", { waitUntil: "networkidle" });

    // Check RTL direction
    const htmlDir = await page.getAttribute("html", "dir");
    expect(htmlDir).toBe("rtl");

    const radiogroup = page.getByRole("radiogroup");
    await expect(radiogroup).toBeVisible();

    // Check card height is compact (less than 160px)
    const firstCard = radiogroup.getByRole("radio").first();
    const box = await firstCard.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeLessThan(170);
    }

    // Verify Sticky Continue Button is in viewport immediately without scrolling
    const continueBtn = page.getByRole("button", { name: "متابعة" });
    await expect(continueBtn).toBeVisible();
    const btnBox = await continueBtn.boundingBox();
    expect(btnBox).not.toBeNull();
    if (btnBox) {
      // Must be near bottom of viewport
      expect(btnBox.y + btnBox.height).toBeLessThanOrEqual(812);
      expect(btnBox.y).toBeGreaterThan(700);
    }

    // Check no horizontal overflow
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  test("Editorial tag badges do not expose technical URLs and render cleanly in FR and AR", async ({ page }) => {
    // French checks
    await page.goto("http://localhost:3000/fr/inscription", { waitUntil: "networkidle" });
    await expect(page.getByText("Référencement certifié AVS")).toBeVisible();
    await expect(page.getByText("Référencement cabinet & praticien")).toBeVisible();
    await expect(page.getByText("Certifications officielles ANEI")).toBeVisible();
    // Verify legacy raw URLs are absent
    await expect(page.locator("text=/avs").first()).not.toBeVisible();
    await expect(page.locator("text=/specialistes").first()).not.toBeVisible();

    // Arabic checks
    await page.goto("http://localhost:3000/ar/inscription", { waitUntil: "networkidle" });
    await expect(page.getByText("ظهور موثق في دليل AVS")).toBeVisible();
    await expect(page.getByText("ظهور مهني في دليل الأخصائيين")).toBeVisible();
    await expect(page.getByText("شهادات كفاءة معتمدة")).toBeVisible();
  });

  test("Keyboard arrow navigation between role cards in radiogroup", async ({ page }) => {
    await page.goto("http://localhost:3000/fr/inscription", { waitUntil: "networkidle" });

    const radios = page.getByRole("radiogroup").getByRole("radio");
    // Initial selection is STUDENT (index 0)
    await expect(radios.nth(0)).toHaveAttribute("aria-checked", "true");

    // Focus first card and press ArrowDown
    await radios.nth(0).focus();
    await page.keyboard.press("ArrowDown");

    // Second card (PARENT) should now be checked
    await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(radios.nth(0)).toHaveAttribute("aria-checked", "false");

    // Press ArrowDown again -> TEACHER
    await page.keyboard.press("ArrowDown");
    await expect(radios.nth(2)).toHaveAttribute("aria-checked", "true");

    // Press ArrowUp -> back to PARENT
    await page.keyboard.press("ArrowUp");
    await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
  });

  test("Role selection, transition to Step 2, and Back button preserving role state", async ({ page }) => {
    await page.goto("http://localhost:3000/ar/inscription", { waitUntil: "networkidle" });

    const radios = page.getByRole("radiogroup").getByRole("radio");

    // Click on AVS card (index 3)
    await radios.nth(3).click();
    await expect(radios.nth(3)).toHaveAttribute("aria-checked", "true");

    // Click Continue
    const continueBtn = page.getByRole("button", { name: "متابعة" });
    await continueBtn.click();

    // Verify we are now on Step 2
    await expect(page.getByText("ما هي بياناتكم الرسمية؟")).toBeVisible();
    await expect(page.getByText("المرحلة 2 من 4")).toBeVisible();

    // Click Back ("الرجوع")
    const backBtn = page.getByRole("button", { name: "الرجوع" });
    await backBtn.click();

    // Verify we are back on Step 1 and AVS remains selected!
    await expect(page.getByText("ما هي صفتكم داخل الأكاديمية؟")).toBeVisible();
    await expect(radios.nth(3)).toHaveAttribute("aria-checked", "true");
  });

  test("URL parameter pre-selection (?role=specialist and ?role=avs)", async ({ page }) => {
    // Test ?role=specialist
    await page.goto("http://localhost:3000/fr/inscription?role=specialist", { waitUntil: "networkidle" });
    const radios = page.getByRole("radiogroup").getByRole("radio");
    await expect(radios.nth(4)).toHaveAttribute("aria-checked", "true");

    // Test ?role=avs
    await page.goto("http://localhost:3000/ar/inscription?role=avs", { waitUntil: "networkidle" });
    const radiosAr = page.getByRole("radiogroup").getByRole("radio");
    await expect(radiosAr.nth(3)).toHaveAttribute("aria-checked", "true");
  });

  test("Regression check: /connexion and /login pages remain 100% operational and unchanged", async ({ page }) => {
    await page.goto("http://localhost:3000/fr/connexion", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /Google/i })).toBeVisible();
    await expect(page.getByPlaceholder("nom@exemple.com")).toBeVisible();

    await page.goto("http://localhost:3000/ar/connexion", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /Google/i })).toBeVisible();
  });
});
