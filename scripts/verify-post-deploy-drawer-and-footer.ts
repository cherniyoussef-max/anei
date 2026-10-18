import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";
const BASE_URL = process.env.TARGET_URL || "https://anei-six.vercel.app";

async function run() {
  console.log(`Starting verification on ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // 1. Visit French home page
  console.log("Navigating to French homepage...");
  await page.goto(`${BASE_URL}/fr`, { waitUntil: "networkidle", timeout: 45000 });

  // 2. Scroll to footer and verify white wing logo
  console.log("Checking footer logo...");
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const footerLogo = footer.locator("img").first();
  await footerLogo.waitFor({ state: "visible", timeout: 10000 });
  const footerSrc = await footerLogo.getAttribute("src");
  console.log("Footer logo src:", footerSrc);

  await footer.screenshot({
    path: path.join(ARTIFACT_DIR, "prod_footer_logo_verified.png"),
  });
  console.log("Saved prod_footer_logo_verified.png");

  // 3. Open Assistant Drawer
  console.log("Opening Assistant Drawer...");
  const triggerBtn = page.locator('[data-testid="public-assistant-trigger"]');
  await triggerBtn.waitFor({ state: "visible", timeout: 10000 });
  await triggerBtn.click();
  await page.waitForTimeout(1500);

  // Check drawer header title styling
  const drawer = page.locator('[data-testid="public-assistant-drawer"]');
  await drawer.waitFor({ state: "visible", timeout: 10000 });

  await drawer.screenshot({
    path: path.join(ARTIFACT_DIR, "prod_drawer_opened_verified.png"),
  });
  console.log("Saved prod_drawer_opened_verified.png");

  // 4. Send French query: "Bonjour, comment créer un compte ?"
  console.log("Sending French query...");
  const input = page.locator('[data-testid="public-assistant-input"]');
  await input.fill("Bonjour, comment créer un compte ?");
  const sendBtn = page.locator('[data-testid="public-assistant-send"]');
  await sendBtn.click();

  // Wait for response streaming to finish
  console.log("Waiting for assistant response...");
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="public-assistant-input"]') as HTMLInputElement;
    return el && !el.disabled;
  }, { timeout: 25000 });
  await page.waitForTimeout(1000);

  await drawer.screenshot({
    path: path.join(ARTIFACT_DIR, "prod_drawer_fr_response_verified.png"),
  });
  console.log("Saved prod_drawer_fr_response_verified.png");

  // 5. Test Arabic Page & Drawer
  console.log("Navigating to Arabic homepage...");
  await page.goto(`${BASE_URL}/ar`, { waitUntil: "networkidle", timeout: 45000 });

  const arTriggerBtn = page.locator('[data-testid="public-assistant-trigger"]');
  await arTriggerBtn.waitFor({ state: "visible", timeout: 10000 });
  await arTriggerBtn.click();
  await page.waitForTimeout(1500);

  const arDrawer = page.locator('[data-testid="public-assistant-drawer"]');
  await arDrawer.waitFor({ state: "visible", timeout: 10000 });

  await arDrawer.screenshot({
    path: path.join(ARTIFACT_DIR, "prod_drawer_ar_opened_verified.png"),
  });
  console.log("Saved prod_drawer_ar_opened_verified.png");

  // Send Arabic query
  console.log("Sending Arabic query...");
  const arInput = page.locator('[data-testid="public-assistant-input"]');
  await arInput.fill("السلام عليكم، كيف أسجل حساباً في المنصة؟");
  const arSendBtn = page.locator('[data-testid="public-assistant-send"]');
  await arSendBtn.click();

  console.log("Waiting for Arabic response...");
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="public-assistant-input"]') as HTMLInputElement;
    return el && !el.disabled;
  }, { timeout: 25000 });
  await page.waitForTimeout(1000);

  await arDrawer.screenshot({
    path: path.join(ARTIFACT_DIR, "prod_drawer_ar_response_verified.png"),
  });
  console.log("Saved prod_drawer_ar_response_verified.png");

  await browser.close();
  console.log("All verifications completed successfully!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
