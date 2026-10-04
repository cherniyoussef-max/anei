import "dotenv/config";
import { chromium } from "playwright";
import path from "node:path";
import { db } from "@/server/db";
import { authSessionAssurance, session } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const ARTIFACT_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";

async function assureCurrentTestSession(page: import("playwright").Page) {
  const cookie = (await page.context().cookies()).find((item) =>
    item.name.includes("session_token")
  );
  if (!cookie) throw new Error("Better Auth session cookie missing");
  const raw = decodeURIComponent(cookie.value);
  const token = raw.replace(/^s:/, "").split(".")[0];
  const [sess] = await db.select().from(session).where(eq(session.token, token));
  if (!sess) throw new Error(`Session not found for token: ${token}`);

  await db
    .insert(authSessionAssurance)
    .values({
      sessionId: sess.id,
      userId: sess.userId,
      method: "EMAIL",
      verifiedAt: new Date(),
      completedAt: new Date(),
      expiresAt: sess.expiresAt,
    })
    .onConflictDoUpdate({
      target: authSessionAssurance.sessionId,
      set: { verifiedAt: new Date(), completedAt: new Date() },
    });
}

async function main() {
  console.log("Launching browser for Parent Portal E2E verification...");
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1. Log in as parent@anei.local
  console.log("Logging in as parent@anei.local...");
  await page.goto("http://localhost:3000/fr/login", { waitUntil: "networkidle" });
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("parent@anei.local");
  await page.locator("#auth-password-input").fill("DemoParent!!2026");
  await page.locator(".auth-submit-btn").click();
  await page.waitForTimeout(2000);
  await assureCurrentTestSession(page);

  // 2. Visit FR Parent Dashboard (initial state)
  console.log("Navigating to /fr/parent...");
  await page.goto("http://localhost:3000/fr/parent", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_dashboard_fr_initial.png"),
    fullPage: true,
  });
  console.log("Captured parent_dashboard_fr_initial.png");

  // 3. Open Add Child Modal
  console.log("Opening Add Child modal...");
  const addChildBtn = page.getByRole("button", { name: /Ajouter un enfant|Associer mon premier enfant/i }).first();
  await addChildBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_add_child_modal.png"),
  });
  console.log("Captured parent_add_child_modal.png");

  // 4. Fill in child details
  console.log("Filling in child registration details...");
  await page.getByPlaceholder(/Ex: Adam/i).fill("Sami");
  await page.getByPlaceholder(/Ex: Ben Salem/i).fill("Ben Salem");
  await page.locator("select").first().selectOption("MOTHER");
  await page.locator('input[type="date"]').fill("2016-05-18");
  await page.getByPlaceholder(/Ex: École Pasteur/i).fill("École Primaire Carthage");
  await page.getByPlaceholder(/Ex: CE2/i).fill("CM1 / 4ème primaire");
  await page.getByPlaceholder(/Ex: Troubles des apprentissages/i).fill("Troubles du spectre autistique léger (TSA) et dyspraxie motrice");
  await page.getByPlaceholder(/Informations utiles pour l'AVS/i).fill("Projet Personnalisé de Scolarisation actif avec adaptations visuelles et repères temporels");

  // Submit
  console.log("Submitting child form...");
  await page.getByRole("button", { name: /Créer le profil enfant/i }).click();
  await page.waitForTimeout(2500);

  // 5. Parent Dashboard with Child registered
  console.log("Verifying parent dashboard with child registered...");
  await page.goto("http://localhost:3000/fr/parent", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_dashboard_fr_with_child.png"),
    fullPage: true,
  });
  console.log("Captured parent_dashboard_fr_with_child.png");

  // 6. Arabic Parent Dashboard
  console.log("Capturing AR Parent Dashboard...");
  await page.goto("http://localhost:3000/ar/parent", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_dashboard_ar.png"),
    fullPage: true,
  });
  console.log("Captured parent_dashboard_ar.png");

  // 7. Parent Formations Page (FR)
  console.log("Capturing FR Parent Formations...");
  await page.goto("http://localhost:3000/fr/parent/formations", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_formations_fr.png"),
    fullPage: true,
  });
  console.log("Captured parent_formations_fr.png");

  // 8. Parent Formations Page (AR)
  console.log("Capturing AR Parent Formations...");
  await page.goto("http://localhost:3000/ar/parent/formations", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_formations_ar.png"),
    fullPage: true,
  });
  console.log("Captured parent_formations_ar.png");

  // 9. Parent Library Page (FR)
  console.log("Capturing FR Parent Bibliothèque...");
  await page.goto("http://localhost:3000/fr/parent/bibliotheque", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_bibliotheque_fr.png"),
    fullPage: true,
  });
  console.log("Captured parent_bibliotheque_fr.png");

  // 10. Parent Library Page (AR)
  console.log("Capturing AR Parent Bibliothèque...");
  await page.goto("http://localhost:3000/ar/parent/bibliotheque", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_bibliotheque_ar.png"),
    fullPage: true,
  });
  console.log("Captured parent_bibliotheque_ar.png");

  // 11. Parent Mes Enfants & PPS Suivi (FR)
  console.log("Capturing FR Parent Mes Enfants & Suivi...");
  await page.goto("http://localhost:3000/fr/parent/enfants", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_enfants_suivi_fr.png"),
    fullPage: true,
  });
  console.log("Captured parent_enfants_suivi_fr.png");

  // 12. Mobile verification (375px)
  console.log("Capturing Mobile Parent Dashboard (375px)...");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("http://localhost:3000/fr/parent", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_dashboard_mobile_fr.png"),
    fullPage: true,
  });
  console.log("Captured parent_dashboard_mobile_fr.png");

  await page.goto("http://localhost:3000/ar/parent", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "parent_dashboard_mobile_ar.png"),
    fullPage: true,
  });
  console.log("Captured parent_dashboard_mobile_ar.png");

  await browser.close();
  console.log("All Parent portal E2E verification screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
