import { chromium } from "playwright";
import path from "path";

const ARTIFACTS_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";

async function main() {
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });

    // 1. Check French homepage
    await page.goto("http://localhost:3000/fr", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Header screenshot
    const headerFr = page.locator(".site-header");
    await headerFr.screenshot({
      path: path.join(ARTIFACTS_DIR, `header_fr_${vp.name}.png`),
    });

    // Viewport top
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, `homepage_fr_top_${vp.name}.png`),
    });

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    // Bottom screenshot
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, `homepage_fr_bottom_${vp.name}.png`),
    });

    // 2. Check Arabic homepage
    await page.goto("http://localhost:3000/ar", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Header screenshot Arabic
    const headerAr = page.locator(".site-header");
    await headerAr.screenshot({
      path: path.join(ARTIFACTS_DIR, `header_ar_${vp.name}.png`),
    });

    // Viewport top Arabic
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, `homepage_ar_top_${vp.name}.png`),
    });

    // Scroll to bottom Arabic
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, `homepage_ar_bottom_${vp.name}.png`),
    });

    // 3. Check AVS page bottom and header
    await page.goto("http://localhost:3000/fr/avs", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, `avs_page_fr_bottom_${vp.name}.png`),
    });

    // Inspect if any portal or text exists in DOM
    const portalText = await page.evaluate(() => {
      const portal = document.querySelector("nextjs-portal");
      const announcer = document.querySelector("#next-route-announcer");
      const bodyText = document.body.innerText;
      const hasRouteDynamic = bodyText.includes("RouteDynamic") || bodyText.includes("BundlerTurbopack");
      return {
        portalExists: !!portal,
        portalContent: portal?.textContent || null,
        announcerExists: !!announcer,
        hasRouteDynamic,
      };
    });
    console.log(`[${vp.name}] DOM check:`, JSON.stringify(portalText, null, 2));

    await page.close();
  }

  await browser.close();
  console.log("Screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
