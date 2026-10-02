import { chromium } from "playwright";
import path from "node:path";

const ARTIFACTS_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";
const BASE_URL = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });

  const desktopCtx = await browser.newContext({
    viewport: { width: 1360, height: 900 },
    deviceScaleFactor: 2,
  });

  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
  });

  console.log("Starting cleanup verification captures...");

  // 1. Home Page Hero (FR & AR, Desktop & Mobile)
  const frHomeDesk = await desktopCtx.newPage();
  await frHomeDesk.goto(`${BASE_URL}/fr`, { waitUntil: "networkidle" });
  await frHomeDesk.waitForSelector(".ah-hero");
  await frHomeDesk.screenshot({
    path: path.join(ARTIFACTS_DIR, "home_hero_clean_fr_desktop.png"),
    clip: { x: 0, y: 0, width: 1360, height: 850 },
  });
  console.log("Captured home_hero_clean_fr_desktop.png");

  const frHomeMob = await mobileCtx.newPage();
  await frHomeMob.goto(`${BASE_URL}/fr`, { waitUntil: "networkidle" });
  await frHomeMob.waitForSelector(".ah-hero");
  await frHomeMob.screenshot({
    path: path.join(ARTIFACTS_DIR, "home_hero_clean_fr_mobile.png"),
    clip: { x: 0, y: 0, width: 375, height: 850 },
  });
  console.log("Captured home_hero_clean_fr_mobile.png");

  const arHomeDesk = await desktopCtx.newPage();
  await arHomeDesk.goto(`${BASE_URL}/ar`, { waitUntil: "networkidle" });
  await arHomeDesk.waitForSelector(".ah-hero");
  await arHomeDesk.screenshot({
    path: path.join(ARTIFACTS_DIR, "home_hero_clean_ar_desktop.png"),
    clip: { x: 0, y: 0, width: 1360, height: 850 },
  });
  console.log("Captured home_hero_clean_ar_desktop.png");

  const arHomeMob = await mobileCtx.newPage();
  await arHomeMob.goto(`${BASE_URL}/ar`, { waitUntil: "networkidle" });
  await arHomeMob.waitForSelector(".ah-hero");
  await arHomeMob.screenshot({
    path: path.join(ARTIFACTS_DIR, "home_hero_clean_ar_mobile.png"),
    clip: { x: 0, y: 0, width: 375, height: 850 },
  });
  console.log("Captured home_hero_clean_ar_mobile.png");

  // 2. Auth Register (FR & AR, Desktop & Mobile)
  const frRegDesk = await desktopCtx.newPage();
  await frRegDesk.goto(`${BASE_URL}/fr/register`, { waitUntil: "networkidle" });
  await frRegDesk.waitForSelector(".auth-card");
  await frRegDesk.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_clean_fr_desktop.png"),
    clip: { x: 0, y: 0, width: 1360, height: 900 },
  });
  console.log("Captured auth_register_clean_fr_desktop.png");

  const arRegDesk = await desktopCtx.newPage();
  await arRegDesk.goto(`${BASE_URL}/ar/register`, { waitUntil: "networkidle" });
  await arRegDesk.waitForSelector(".auth-card");
  await arRegDesk.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_clean_ar_desktop.png"),
    clip: { x: 0, y: 0, width: 1360, height: 900 },
  });
  console.log("Captured auth_register_clean_ar_desktop.png");

  const frRegMob = await mobileCtx.newPage();
  await frRegMob.goto(`${BASE_URL}/fr/register`, { waitUntil: "networkidle" });
  await frRegMob.waitForSelector(".auth-card");
  await frRegMob.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_clean_fr_mobile.png"),
    fullPage: true,
  });
  console.log("Captured auth_register_clean_fr_mobile.png");

  // 3. About Page Field Scene (FR & AR, Desktop)
  const frAboutDesk = await desktopCtx.newPage();
  await frAboutDesk.goto(`${BASE_URL}/fr/about`, { waitUntil: "networkidle" });
  await frAboutDesk.waitForSelector(".ah-field-stage");
  const fieldElemFr = await frAboutDesk.$(".ah-field-grid");
  if (fieldElemFr) {
    await fieldElemFr.screenshot({
      path: path.join(ARTIFACTS_DIR, "about_field_clean_fr_desktop.png"),
    });
    console.log("Captured about_field_clean_fr_desktop.png");
  }

  const arAboutDesk = await desktopCtx.newPage();
  await arAboutDesk.goto(`${BASE_URL}/ar/about`, { waitUntil: "networkidle" });
  await arAboutDesk.waitForSelector(".ah-field-stage");
  const fieldElemAr = await arAboutDesk.$(".ah-field-grid");
  if (fieldElemAr) {
    await fieldElemAr.screenshot({
      path: path.join(ARTIFACTS_DIR, "about_field_clean_ar_desktop.png"),
    });
    console.log("Captured about_field_clean_ar_desktop.png");
  }

  await browser.close();
  console.log("All clean captures completed successfully!");
}

main().catch((err) => {
  console.error("Capture script error:", err);
  process.exit(1);
});
