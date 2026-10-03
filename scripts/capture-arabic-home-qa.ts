import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";

async function main() {
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // 1. Arabic Home - full page and key sections
    console.log(`Loading http://localhost:3000/ar at ${vp.name}...`);
    await page.goto("http://localhost:3000/ar", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    // Hero screenshot
    const heroPath = path.join(ARTIFACT_DIR, `arabic_home_hero_${vp.name}.png`);
    await page.locator(".ah-hero").screenshot({ path: heroPath });
    console.log(`Saved ${heroPath}`);

    // AVS Section screenshot
    const avsPath = path.join(ARTIFACT_DIR, `arabic_home_avs_${vp.name}.png`);
    await page.locator(".ah-section:has(#ah-avs-title)").screenshot({ path: avsPath });
    console.log(`Saved ${avsPath}`);

    // Formations Section screenshot
    const formationsPath = path.join(ARTIFACT_DIR, `arabic_home_formations_${vp.name}.png`);
    await page.locator(".ah-section:has(#ah-formations-title)").screenshot({ path: formationsPath });
    console.log(`Saved ${formationsPath}`);

    // Contact & Footer screenshot
    const footerPath = path.join(ARTIFACT_DIR, `arabic_home_footer_${vp.name}.png`);
    await page.locator(".site-footer").screenshot({ path: footerPath });
    console.log(`Saved ${footerPath}`);

    // Contact form screenshot
    const contactPath = path.join(ARTIFACT_DIR, `arabic_home_contact_${vp.name}.png`);
    await page.locator("#contact").screenshot({ path: contactPath });
    console.log(`Saved ${contactPath}`);

    await context.close();
  }

  await browser.close();
  console.log("Arabic QA screenshots captured successfully.");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
