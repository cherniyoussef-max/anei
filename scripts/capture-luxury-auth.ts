import { chromium } from "playwright";
import path from "node:path";

const ARTIFACTS_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";
const BASE_URL = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });

  const desktopCtx = await browser.newContext({
    viewport: { width: 1360, height: 960 },
    deviceScaleFactor: 2,
  });

  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
  });

  console.log("Starting luxury visual captures...");

  // ==========================================
  // 1. LOGIN (FR & AR, Desktop & Mobile)
  // ==========================================

  // FR Login Desktop
  const frLoginDesk = await desktopCtx.newPage();
  await frLoginDesk.goto(`${BASE_URL}/fr/login`, { waitUntil: "networkidle" });
  await frLoginDesk.waitForSelector(".auth-card");
  await frLoginDesk.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_login_fr_desktop.png"),
    fullPage: false,
  });
  console.log("Captured luxury_login_fr_desktop.png");

  // FR Login Mobile
  const frLoginMob = await mobileCtx.newPage();
  await frLoginMob.goto(`${BASE_URL}/fr/login`, { waitUntil: "networkidle" });
  await frLoginMob.waitForSelector(".auth-card");
  await frLoginMob.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_login_fr_mobile.png"),
    fullPage: true,
  });
  console.log("Captured luxury_login_fr_mobile.png");

  // AR Login Desktop
  const arLoginDesk = await desktopCtx.newPage();
  await arLoginDesk.goto(`${BASE_URL}/ar/login`, { waitUntil: "networkidle" });
  await arLoginDesk.waitForSelector(".auth-card");
  await arLoginDesk.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_login_ar_desktop.png"),
    fullPage: false,
  });
  console.log("Captured luxury_login_ar_desktop.png");

  // AR Login Mobile
  const arLoginMob = await mobileCtx.newPage();
  await arLoginMob.goto(`${BASE_URL}/ar/login`, { waitUntil: "networkidle" });
  await arLoginMob.waitForSelector(".auth-card");
  await arLoginMob.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_login_ar_mobile.png"),
    fullPage: true,
  });
  console.log("Captured luxury_login_ar_mobile.png");

  // ==========================================
  // 2. REGISTER STEP 1 (Role Selection)
  // ==========================================

  // FR Register Step 1 Desktop
  const frReg1Desk = await desktopCtx.newPage();
  await frReg1Desk.goto(`${BASE_URL}/fr/register`, { waitUntil: "networkidle" });
  await frReg1Desk.waitForSelector(".auth-persona-card");
  await frReg1Desk.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_register_step1_fr_desktop.png"),
    fullPage: false,
  });
  console.log("Captured luxury_register_step1_fr_desktop.png");

  // FR Register Step 1 Mobile
  const frReg1Mob = await mobileCtx.newPage();
  await frReg1Mob.goto(`${BASE_URL}/fr/register`, { waitUntil: "networkidle" });
  await frReg1Mob.waitForSelector(".auth-persona-card");
  await frReg1Mob.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_register_step1_fr_mobile.png"),
    fullPage: true,
  });
  console.log("Captured luxury_register_step1_fr_mobile.png");

  // AR Register Step 1 Desktop
  const arReg1Desk = await desktopCtx.newPage();
  await arReg1Desk.goto(`${BASE_URL}/ar/register`, { waitUntil: "networkidle" });
  await arReg1Desk.waitForSelector(".auth-persona-card");
  await arReg1Desk.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_register_step1_ar_desktop.png"),
    fullPage: false,
  });
  console.log("Captured luxury_register_step1_ar_desktop.png");

  // AR Register Step 1 Mobile
  const arReg1Mob = await mobileCtx.newPage();
  await arReg1Mob.goto(`${BASE_URL}/ar/register`, { waitUntil: "networkidle" });
  await arReg1Mob.waitForSelector(".auth-persona-card");
  await arReg1Mob.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_register_step1_ar_mobile.png"),
    fullPage: true,
  });
  console.log("Captured luxury_register_step1_ar_mobile.png");

  // ==========================================
  // 3. REGISTER STEP 2 (Credentials & Google Sign-In)
  // ==========================================

  // FR Register Step 2 Desktop
  const frReg2Desk = await desktopCtx.newPage();
  await frReg2Desk.goto(`${BASE_URL}/fr/register`, { waitUntil: "networkidle" });
  const frAvsCard = frReg2Desk.locator('.auth-persona-card:has-text("AVS")');
  if (await frAvsCard.count() > 0) {
    await frAvsCard.click();
  }
  await frReg2Desk.locator('button:has-text("Continuer vers mes identifiants")').click();
  await frReg2Desk.waitForSelector("#auth-password-input");
  await frReg2Desk.locator('input[name="name"]').fill("Claire Dupont");
  await frReg2Desk.locator('input[name="email"]').fill("claire.dupont@exemple.com");
  await frReg2Desk.locator("#auth-password-input").fill("MonMotDePasseTresSecurise2026!");
  await frReg2Desk.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_register_step2_fr_desktop.png"),
    fullPage: false,
  });
  console.log("Captured luxury_register_step2_fr_desktop.png");

  // FR Register Step 2 Mobile
  const frReg2Mob = await mobileCtx.newPage();
  await frReg2Mob.goto(`${BASE_URL}/fr/register`, { waitUntil: "networkidle" });
  const frAvsMob = frReg2Mob.locator('.auth-persona-card:has-text("AVS")');
  if (await frAvsMob.count() > 0) {
    await frAvsMob.click();
  }
  await frReg2Mob.locator('button:has-text("Continuer vers mes identifiants")').click();
  await frReg2Mob.waitForSelector("#auth-password-input");
  await frReg2Mob.locator('input[name="name"]').fill("Claire Dupont");
  await frReg2Mob.locator('input[name="email"]').fill("claire.dupont@exemple.com");
  await frReg2Mob.locator("#auth-password-input").fill("MonMotDePasseTresSecurise2026!");
  await frReg2Mob.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_register_step2_fr_mobile.png"),
    fullPage: true,
  });
  console.log("Captured luxury_register_step2_fr_mobile.png");

  // AR Register Step 2 Desktop
  const arReg2Desk = await desktopCtx.newPage();
  await arReg2Desk.goto(`${BASE_URL}/ar/register`, { waitUntil: "networkidle" });
  const arTeacherDesk = arReg2Desk.locator('.auth-persona-card:has-text("مدرس(ة)")');
  if (await arTeacherDesk.count() > 0) {
    await arTeacherDesk.click();
  }
  await arReg2Desk.locator('button:has-text("المتابعة لإدخال البيانات")').click();
  await arReg2Desk.waitForSelector("#auth-password-input");
  await arReg2Desk.locator('input[name="name"]').fill("أحمد المنصوري");
  await arReg2Desk.locator('input[name="email"]').fill("ahmed.almansouri@exemple.com");
  await arReg2Desk.locator("#auth-password-input").fill("كلمة_مرور_آمنة_جدا_2026!");
  await arReg2Desk.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_register_step2_ar_desktop.png"),
    fullPage: false,
  });
  console.log("Captured luxury_register_step2_ar_desktop.png");

  // AR Register Step 2 Mobile
  const arReg2Mob = await mobileCtx.newPage();
  await arReg2Mob.goto(`${BASE_URL}/ar/register`, { waitUntil: "networkidle" });
  const arTeacherMob = arReg2Mob.locator('.auth-persona-card:has-text("مدرس(ة)")');
  if (await arTeacherMob.count() > 0) {
    await arTeacherMob.click();
  }
  await arReg2Mob.locator('button:has-text("المتابعة لإدخال البيانات")').click();
  await arReg2Mob.waitForSelector("#auth-password-input");
  await arReg2Mob.locator('input[name="name"]').fill("أحمد المنصوري");
  await arReg2Mob.locator('input[name="email"]').fill("ahmed.almansouri@exemple.com");
  await arReg2Mob.locator("#auth-password-input").fill("كلمة_مرور_آمنة_جدا_2026!");
  await arReg2Mob.screenshot({
    path: path.join(ARTIFACTS_DIR, "luxury_register_step2_ar_mobile.png"),
    fullPage: true,
  });
  console.log("Captured luxury_register_step2_ar_mobile.png");

  await browser.close();
  console.log("All luxury captures completed successfully!");
}

main().catch((err) => {
  console.error("Capture script failed:", err);
  process.exit(1);
});
