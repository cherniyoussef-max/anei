import { chromium } from "playwright";
import path from "node:path";

const ARTIFACTS_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";
const BASE_URL = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Browser Context (1280x800)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });

  // 2. Mobile Browser Context (375x812 iPhone)
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
  });

  // --- FR DESKTOP STEP 1 ---
  const frPage = await desktopCtx.newPage();
  await frPage.goto(`${BASE_URL}/fr/register`, { waitUntil: "networkidle" });
  await frPage.waitForSelector(".auth-persona-card");
  await frPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_step1_fr_desktop.png"),
    fullPage: false,
  });
  console.log("Captured auth_register_step1_fr_desktop.png");

  // --- FR DESKTOP STEP 2 ---
  // Click on "AVS" or second persona card, then submit step 1
  const avsCard = frPage.locator('.auth-persona-card:has-text("Accompagnant")');
  if (await avsCard.count() > 0) {
    await avsCard.click();
  }
  await frPage.locator('button:has-text("Continuer vers mes identifiants")').click();
  await frPage.waitForSelector("#auth-password-input");
  // Fill sample credentials to test password meter
  await frPage.locator('input[name="name"]').fill("Claire Dupont");
  await frPage.locator('input[name="email"]').fill("claire.dupont@exemple.com");
  await frPage.locator("#auth-password-input").fill("MonMotDePasseTresSecurise2026!");
  await frPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_step2_fr_desktop.png"),
    fullPage: false,
  });
  console.log("Captured auth_register_step2_fr_desktop.png");

  // --- AR DESKTOP STEP 1 ---
  const arPage = await desktopCtx.newPage();
  await arPage.goto(`${BASE_URL}/ar/register`, { waitUntil: "networkidle" });
  await arPage.waitForSelector(".auth-persona-card");
  await arPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_step1_ar_desktop.png"),
    fullPage: false,
  });
  console.log("Captured auth_register_step1_ar_desktop.png");

  // --- AR DESKTOP STEP 2 ---
  const teacherCard = arPage.locator('.auth-persona-card:has-text("معلم")');
  if (await teacherCard.count() > 0) {
    await teacherCard.click();
  }
  await arPage.locator('button:has-text("المتابعة لإدخال البيانات")').click();
  await arPage.waitForSelector("#auth-password-input");
  await arPage.locator('input[name="name"]').fill("مريم المنصوري");
  await arPage.locator('input[name="email"]').fill("mariem.mansouri@exemple.com");
  await arPage.locator("#auth-password-input").fill("كلمة_مرور_آمنة_جدا_2026!");
  await arPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_step2_ar_desktop.png"),
    fullPage: false,
  });
  console.log("Captured auth_register_step2_ar_desktop.png");

  // --- FR MOBILE STEP 1 ---
  const frMobPage = await mobileCtx.newPage();
  await frMobPage.goto(`${BASE_URL}/fr/register`, { waitUntil: "networkidle" });
  await frMobPage.waitForSelector(".auth-persona-card");
  await frMobPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_step1_fr_mobile.png"),
    fullPage: false,
  });
  console.log("Captured auth_register_step1_fr_mobile.png");

  // --- FR MOBILE STEP 2 ---
  await frMobPage.locator('button:has-text("Continuer vers mes identifiants")').click();
  await frMobPage.waitForSelector("#auth-password-input");
  await frMobPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_step2_fr_mobile.png"),
    fullPage: false,
  });
  console.log("Captured auth_register_step2_fr_mobile.png");

  // --- AR MOBILE STEP 1 ---
  const arMobPage = await mobileCtx.newPage();
  await arMobPage.goto(`${BASE_URL}/ar/register`, { waitUntil: "networkidle" });
  await arMobPage.waitForSelector(".auth-persona-card");
  await arMobPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_step1_ar_mobile.png"),
    fullPage: false,
  });
  console.log("Captured auth_register_step1_ar_mobile.png");

  // --- AR MOBILE STEP 2 ---
  await arMobPage.locator('button:has-text("المتابعة لإدخال البيانات")').click();
  await arMobPage.waitForSelector("#auth-password-input");
  await arMobPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_register_step2_ar_mobile.png"),
    fullPage: false,
  });
  console.log("Captured auth_register_step2_ar_mobile.png");

  // --- VERIFY EMAIL FR DESKTOP ---
  const verifyFrPage = await desktopCtx.newPage();
  await verifyFrPage.goto(`${BASE_URL}/fr/verify-email?email=claire.dupont%40exemple.com`, { waitUntil: "networkidle" });
  await verifyFrPage.waitForSelector(".auth-card");
  await verifyFrPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_verify_email_fr_desktop.png"),
    fullPage: false,
  });
  console.log("Captured auth_verify_email_fr_desktop.png");

  // --- VERIFY EMAIL AR DESKTOP ---
  const verifyArPage = await desktopCtx.newPage();
  await verifyArPage.goto(`${BASE_URL}/ar/verify-email?email=mariem.mansouri%40exemple.com`, { waitUntil: "networkidle" });
  await verifyArPage.waitForSelector(".auth-card");
  await verifyArPage.screenshot({
    path: path.join(ARTIFACTS_DIR, "auth_verify_email_ar_desktop.png"),
    fullPage: false,
  });
  console.log("Captured auth_verify_email_ar_desktop.png");

  await browser.close();
  console.log("All screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
