import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";

const pagesToCapture = [
  { name: "formations_catalog", url: "http://localhost:3000/ar/formations" },
  { name: "formation_detail", url: "http://localhost:3000/ar/formations/fondamentaux-education-inclusive" },
  { name: "webinaires_catalog", url: "http://localhost:3000/ar/webinaires" },
  { name: "webinaire_detail", url: "http://localhost:3000/ar/webinaires/cooperer-familles" },
  { name: "avs_directory", url: "http://localhost:3000/ar/avs" },
  { name: "avs_detail", url: "http://localhost:3000/ar/avs/rim-ben-amor" },
  { name: "contact_page", url: "http://localhost:3000/ar/contact" },
  { name: "actualites_catalog", url: "http://localhost:3000/ar/actualites" },
  { name: "actualite_detail", url: "http://localhost:3000/ar/actualites/actualite-1" },
  { name: "about_page", url: "http://localhost:3000/ar/about" },
  { name: "bibliotheque_page", url: "http://localhost:3000/ar/bibliotheque" },
  { name: "login_page", url: "http://localhost:3000/ar/login" },
];

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

    for (const item of pagesToCapture) {
      console.log(`Capturing ${item.name} (${vp.name})...`);
      await page.goto(item.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const filePath = path.join(ARTIFACT_DIR, `arabic_${item.name}_${vp.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`Saved ${filePath}`);
    }

    await context.close();
  }

  await browser.close();
  console.log("All Arabic pages QA screenshots captured successfully.");
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
