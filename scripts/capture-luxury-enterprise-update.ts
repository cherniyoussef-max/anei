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

  const _mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
  });

  console.log("Starting enterprise visual verification captures...");

  // 1. Auth Showcase - Register FR Desktop & Mobile
  const frRegDesk = await desktopCtx.newPage();
  await frRegDesk.goto(`${BASE_URL}/fr/register`, { waitUntil: "networkidle" });
  await frRegDesk.waitForSelector(".auth-showcase-accreditation");
  const showcaseElemFr = await frRegDesk.$(".auth-simple-showcase");
  if (showcaseElemFr) {
    await showcaseElemFr.screenshot({
      path: path.join(ARTIFACTS_DIR, "enterprise_auth_showcase_fr.png"),
    });
    console.log("Captured enterprise_auth_showcase_fr.png");
  }

  // Auth Showcase - Register AR Desktop
  const arRegDesk = await desktopCtx.newPage();
  await arRegDesk.goto(`${BASE_URL}/ar/register`, { waitUntil: "networkidle" });
  await arRegDesk.waitForSelector(".auth-showcase-accreditation");
  const showcaseElemAr = await arRegDesk.$(".auth-simple-showcase");
  if (showcaseElemAr) {
    await showcaseElemAr.screenshot({
      path: path.join(ARTIFACTS_DIR, "enterprise_auth_showcase_ar.png"),
    });
    console.log("Captured enterprise_auth_showcase_ar.png");
  }

  // 2. About Page - Method Section (FR & AR)
  const frAboutDesk = await desktopCtx.newPage();
  await frAboutDesk.goto(`${BASE_URL}/fr/about`, { waitUntil: "networkidle" });
  await frAboutDesk.waitForSelector(".ah-method-track-badge");
  const methodElemFr = await frAboutDesk.$("section[aria-labelledby='about-method-heading']");
  if (methodElemFr) {
    await methodElemFr.screenshot({
      path: path.join(ARTIFACTS_DIR, "enterprise_about_method_fr.png"),
    });
    console.log("Captured enterprise_about_method_fr.png");
  }

  const arAboutDesk = await desktopCtx.newPage();
  await arAboutDesk.goto(`${BASE_URL}/ar/about`, { waitUntil: "networkidle" });
  await arAboutDesk.waitForSelector(".ah-method-track-badge");
  const methodElemAr = await arAboutDesk.$("section[aria-labelledby='about-method-heading']");
  if (methodElemAr) {
    await methodElemAr.screenshot({
      path: path.join(ARTIFACTS_DIR, "enterprise_about_method_ar.png"),
    });
    console.log("Captured enterprise_about_method_ar.png");
  }

  // 3. About Page - Commitments Section (FR & AR)
  await frAboutDesk.waitForSelector(".ah-commitments-charter");
  const commitElemFr = await frAboutDesk.$("section[aria-labelledby='about-commitments-heading']");
  if (commitElemFr) {
    await commitElemFr.screenshot({
      path: path.join(ARTIFACTS_DIR, "enterprise_about_commitments_fr.png"),
    });
    console.log("Captured enterprise_about_commitments_fr.png");
  }

  await arAboutDesk.waitForSelector(".ah-commitments-charter");
  const commitElemAr = await arAboutDesk.$("section[aria-labelledby='about-commitments-heading']");
  if (commitElemAr) {
    await commitElemAr.screenshot({
      path: path.join(ARTIFACTS_DIR, "enterprise_about_commitments_ar.png"),
    });
    console.log("Captured enterprise_about_commitments_ar.png");
  }

  await browser.close();
  console.log("All enterprise captures finished successfully!");
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
