import { chromium } from "playwright";
import path from "node:path";

const ARTIFACTS_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";
const BASE_URL = "http://localhost:3000";

async function run() {
  console.log("Starting Inclusive Spaces Browser Verification...");
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Context
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktopContext.newPage();

  // Route 1: Teacher Space (French)
  console.log("Testing Teacher Space /fr/espace-enseignant...");
  await page.goto(`${BASE_URL}/fr/espace-enseignant`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_teacher_overview_fr.png"), fullPage: false });

  // Switch to "Adapter un test" tab
  console.log("Clicking Test Adapter tab...");
  const adapterTab = page.locator("button:has-text('Adapter un test')").first();
  if (await adapterTab.isVisible()) {
    await adapterTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_teacher_test_adapter_fr.png"), fullPage: false });
  }

  // Switch to "Palette & Couleurs" tab
  console.log("Clicking Color Palette tab...");
  const paletteTab = page.locator("button:has-text('Palette & Couleurs')").first();
  if (await paletteTab.isVisible()) {
    await paletteTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_teacher_palette_fr.png"), fullPage: false });
  }

  // Switch to "Que faire en classe" tab
  console.log("Clicking Tips tab...");
  const tipsTab = page.locator("button:has-text('Que faire en classe')").first();
  if (await tipsTab.isVisible()) {
    await tipsTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_teacher_tips_fr.png"), fullPage: false });
  }

  // Route 2: Establishment Space (French)
  console.log("Testing Establishment Space /fr/espace-etablissement...");
  await page.goto(`${BASE_URL}/fr/espace-etablissement`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_establishment_overview_fr.png"), fullPage: false });

  // Switch to "Auto-évaluation" tab
  console.log("Clicking Self-eval tab...");
  const evalTab = page.locator("button:has-text('Auto-évaluation')").first();
  if (await evalTab.isVisible()) {
    await evalTab.click();
    await page.waitForTimeout(500);

    // Select options on first couple questions
    const selects = page.locator("select");
    const count = await selects.count();
    if (count > 0) {
      await selects.nth(0).selectOption("2");
      if (count > 1) await selects.nth(1).selectOption("1");
      if (count > 2) await selects.nth(2).selectOption("2");
      if (count > 3) await selects.nth(3).selectOption("2");
      await page.waitForTimeout(300);
      const calcBtn = page.locator("button:has-text('Calculer le score')").first();
      if (await calcBtn.isVisible()) {
        await calcBtn.click();
        await page.waitForTimeout(500);
      }
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_establishment_self_eval_fr.png"), fullPage: false });
  }

  // Switch to "Demander un service" tab
  console.log("Clicking Service Request tab...");
  const reqTab = page.locator("button:has-text('Demander un service')").nth(1); // second button is in tab list
  if (await reqTab.isVisible()) {
    await reqTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_establishment_request_service_fr.png"), fullPage: false });
  }

  // Route 3: Specialist Space (French)
  console.log("Testing Specialist Space /fr/espace-specialiste...");
  await page.goto(`${BASE_URL}/fr/espace-specialiste`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_specialist_inbox_fr.png"), fullPage: false });

  // Switch to "Conseils à publier" tab
  console.log("Clicking Specialist Tips tab...");
  const specTipsTab = page.locator("button:has-text('Conseils à publier')").first();
  if (await specTipsTab.isVisible()) {
    await specTipsTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_specialist_tips_fr.png"), fullPage: false });
  }

  // Switch to "Demandes reçues" tab
  console.log("Clicking Specialist Requests tab...");
  const specReqTab = page.locator("button:has-text('Demandes reçues')").first();
  if (await specReqTab.isVisible()) {
    await specReqTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_specialist_requests_fr.png"), fullPage: false });
  }

  // Route 4: Teacher Space Arabic (RTL)
  console.log("Testing Teacher Space /ar/espace-enseignant...");
  await page.goto(`${BASE_URL}/ar/espace-enseignant`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_teacher_ar_rtl.png"), fullPage: false });

  // Route 5: Establishment Space Arabic (RTL)
  console.log("Testing Establishment Space /ar/espace-etablissement...");
  await page.goto(`${BASE_URL}/ar/espace-etablissement`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_establishment_ar_rtl.png"), fullPage: false });

  // Mobile viewport check (375x812)
  console.log("Testing Mobile Viewport...");
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/fr/espace-enseignant`, { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_teacher_mobile_375px.png"), fullPage: false });

  await mobilePage.goto(`${BASE_URL}/fr/espace-etablissement`, { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_establishment_mobile_375px.png"), fullPage: false });

  await mobilePage.goto(`${BASE_URL}/fr/espace-specialiste`, { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, "inclusive_specialist_mobile_375px.png"), fullPage: false });

  await browser.close();
  console.log("All screenshots captured successfully!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
