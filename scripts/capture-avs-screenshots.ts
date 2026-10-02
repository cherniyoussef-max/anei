import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";

async function main() {
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 375, height: 812 },
  ];

  const pages = [
    { url: "http://localhost:3000/fr/avs", filename: "avs_directory_fr" },
    { url: "http://localhost:3000/ar/avs", filename: "avs_directory_ar" },
    { url: "http://localhost:3000/fr/avs/salma-karray", filename: "avs_profile_fr" },
    { url: "http://localhost:3000/ar/avs/salma-karray", filename: "avs_profile_ar" },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    for (const p of pages) {
      console.log(`Capturing ${p.url} at ${vp.name}...`);
      await page.goto(p.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const targetPath = path.join(ARTIFACT_DIR, `${p.filename}_${vp.name}.png`);
      await page.screenshot({ path: targetPath, fullPage: false });
      console.log(`Saved screenshot to ${targetPath}`);
    }

    // Also capture booking modal open on desktop
    if (vp.name === "desktop") {
      await page.goto("http://localhost:3000/fr/avs", { waitUntil: "networkidle" });
      const firstSlot = page.locator(".avs-card .avs-slot-btn").first();
      await firstSlot.click();
      await page.waitForTimeout(500);
      const modalPath = path.join(ARTIFACT_DIR, "avs_booking_modal_fr_desktop.png");
      await page.screenshot({ path: modalPath, fullPage: false });
      console.log(`Saved screenshot to ${modalPath}`);
    }

    await context.close();
  }

  await browser.close();
  console.log("All screenshots captured successfully.");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
