import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

async function assureCurrentTestSession(page: import("@playwright/test").Page) {
  const cookie = (await page.context().cookies()).find((item) => item.name.includes("session_token"));
  if (!cookie) throw new Error("Better Auth session cookie missing in E2E fixture");
  const token = decodeURIComponent(cookie.value).split(".")[0];
  const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for test session");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `insert into auth_session_assurance
        (id, session_id, user_id, method, verified_at, completed_at, expires_at, created_at, updated_at)
       select gen_random_uuid()::text, id, user_id, 'EMAIL', now(), now(), expires_at, now(), now()
       from session where token = $1
       on conflict (session_id) do update set verified_at=now(), completed_at=now(), expires_at=excluded.expires_at, updated_at=now()`,
      [token],
    );
  } finally {
    await client.end();
  }
}

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  const form = page.locator(".auth-form");
  await form.getByLabel("Email").fill("admin@anei.local");
  await form.getByLabel("Mot de passe").fill("DemoAdmin!!2026");
  await form.getByRole("button", { name: "Accéder à mon espace" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/verification-channel");
  await assureCurrentTestSession(page);
}

test.describe.serial("Full ANEI Contact, AVS Escrow & Privacy Workflows", () => {
  test.beforeEach(async () => {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query('delete from "rateLimit"');
    } finally {
      await client.end();
    }
  });

  test("1. Contact Page: displays headquarters, transit, regional hubs and submits inquiry", async ({ page }) => {
    // Test French Contact Page
    await page.goto("/fr/contact");
    await expect(page.locator("h1")).toContainText("Parlons de vos besoins d'accompagnement");

    // Verify detailed placement: Headquarters & Transit
    await expect(page.locator("text=Centre Urbain Nord").first()).toBeVisible();
    await expect(page.locator("text=Métro Ligne 2").first()).toBeVisible();

    // Verify 3 regional hubs
    await expect(page.locator("text=Grand Tunis").first()).toBeVisible();
    await expect(page.locator("text=Pôle Régional Sahel").first()).toBeVisible();
    await expect(page.locator("text=Pôle Régional Sud").first()).toBeVisible();

    // Test Contact form submission
    const form = page.locator("form.contact-form");
    await form.locator('input[name="name"]').fill("Leila Mansouri");
    await form.locator('input[name="email"]').fill("leila.mansouri@test.tn");
    await form.locator('input[name="subject"]').fill("Demande d'accompagnement scolaire AVS");
    await form.locator('textarea[name="message"]').fill("Bonjour, je souhaite être mise en relation avec un accompagnant certifié pour mon fils de 8 ans à Ariana.");

    await form.locator('button[type="submit"]').click();

    // Verify submission feedback
    await expect(page.locator("text=Message transmis avec succès")).toBeVisible({ timeout: 10000 });

    // Test Arabic Contact Page
    await page.goto("/ar/contact");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toContainText("لنتحدث عن احتياجاتكم في التربية الدامجة");
    await expect(page.locator("text=المركز العمراني الشمالي").first()).toBeVisible();
    await expect(page.locator("text=مترو الخط 2").first()).toBeVisible();
  });

  test("2. AVS Booking Gate: unauthenticated user cannot book and sees auth modal gate", async ({ page }) => {
    await page.goto("/fr/avs/salma-karray");
    await expect(page.locator("h1")).toContainText("Salma");

    // Click booking button
    const bookBtn = page.locator('button:has-text("Prendre ce rendez-vous")').first();
    await bookBtn.click();

    // Verify Auth Gate in modal
    const modal = page.locator(".avs-booking-modal");
    await expect(modal).toBeVisible();
    await expect(modal.locator("text=Connexion obligatoire pour réserver")).toBeVisible();
    await expect(modal.locator('a[href*="/login"]')).toBeVisible();
    await expect(modal.locator('a[href*="/register"]')).toBeVisible();
  });

  test("3. Authenticated Flow: Escrow payment booking and private Parent Dashboard RDV", async ({ page }) => {
    await loginAsAdmin(page);

    // Now go to AVS profile as authenticated user
    await page.goto("/fr/avs/aymen-chaabane");
    const bookBtn = page.locator('button:has-text("Prendre ce rendez-vous")').first();
    await bookBtn.click();

    const modal = page.locator(".avs-booking-modal");
    await expect(modal).toBeVisible();

    // Step 1: Slot and format
    await expect(modal.locator("text=1. Choisissez le jour")).toBeVisible();
    const nextBtn = modal.locator('button:has-text("Suivant")');
    await nextBtn.click();

    // Step 2: Child details
    await expect(modal.locator("text=Nom et prénom de l'élève")).toBeVisible();
    await modal.locator('input[placeholder*="Ex: Rayan"]').fill("Yassine Trabelsi");
    await modal.locator("textarea").fill("Besoin d'un accompagnement personnalisé en classe de CE1 pour gestion de l'attention.");
    
    const toPaymentBtn = modal.locator('button:has-text("Passer au paiement sous séquestre")');
    await toPaymentBtn.click();

    // Step 3: Third-Party Escrow Payment
    await expect(modal.locator("text=Garantie Tiers de Confiance ANEI")).toBeVisible();
    await expect(modal.locator("text=Total à régler sous séquestre")).toBeVisible();

    // Select test escrow simulation payment
    const testPaymentBtn = modal.locator('button:has-text("Test Séquestre")');
    await testPaymentBtn.click();

    // Fill parent contact details
    await modal.locator('input[type="tel"]').fill("+216 22 334 455");
    const parentNameInput = modal.locator('div:has(> label:has-text("Parent titulaire")) input');
    if ((await parentNameInput.inputValue()) === "") {
      await parentNameInput.fill("Salma Mansouri");
    }
    const parentEmailInput = modal.locator('div:has(> label:has-text("Email de confirmation")) input');
    if ((await parentEmailInput.inputValue()) === "") {
      await parentEmailInput.fill("admin@anei.local");
    }

    const submitPaymentBtn = modal.locator('button[type="submit"]');
    await submitPaymentBtn.click();

    // Step 4: Confirmed Escrow Certificate
    await expect(modal.locator("text=Votre rendez-vous est confirmé")).toBeVisible({ timeout: 10000 });
    await expect(modal.locator("text=Réf. Séquestre :")).toBeVisible();

    // Visit Parent Dashboard: rendezvous page is deprecated and redirects to dashboard
    await page.goto("/fr/dashboard/rendez-vous");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/fr/dashboard");
  });

  test("4. Admin Console: Contacts & AVS Escrow Management", async ({ page }) => {
    await loginAsAdmin(page);

    // 1. Admin Contacts Manager
    await page.goto("/fr/admin/contacts");
    await expect(page.locator("h1")).toContainText("Messages & Demandes de Contact");
    await expect(page.locator("text=Messages reçus").first()).toBeVisible();

    // 2. Admin AVS & Escrow Manager
    await page.goto("/fr/admin/avs");
    await expect(page.locator("h1")).toContainText("Annuaire & Réservations AVS");

    // Switch to Tab 2: Bookings & Escrow
    const bookingsTab = page.locator('button:has-text("Suivi des rendez-vous & réservations")');
    await bookingsTab.click();

    // Verify 4 Escrow KPI summary cards
    await expect(page.locator("text=Réservations").first()).toBeVisible();
    await expect(page.locator("text=Fonds sous Séquestre ANEI").first()).toBeVisible();
    await expect(page.locator("text=Commissions ANEI (10%)").first()).toBeVisible();
    await expect(page.locator("text=Fonds versés aux AVS").first()).toBeVisible();

    // Verify escrow table contains escrow references and action buttons
    await expect(page.locator("text=Séquestre & Paiement").first()).toBeVisible();
    await expect(page.locator("text=Gestion Séquestre").first()).toBeVisible();
  });
});
