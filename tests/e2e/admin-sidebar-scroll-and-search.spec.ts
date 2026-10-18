import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

async function assureCurrentTestSession(page: import("@playwright/test").Page) {
  const cookie = (await page.context().cookies()).find((item) => item.name.includes("session_token"));
  if (!cookie) throw new Error("Better Auth session cookie missing in E2E fixture");
  const token = decodeURIComponent(cookie.value).split(".")[0];
  const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required for authenticated E2E fixtures");
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
  await form.locator('input[type="email"]').fill("admin@anei.local");
  await form.locator('input[type="password"]').fill("DemoAdmin!!2026");
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/auth/sign-in") && res.status() === 200, { timeout: 15000 }).catch(() => null),
    form.locator('button[type="submit"]').click(),
  ]);
  await page.waitForTimeout(500);
  await assureCurrentTestSession(page);
}

const ARTIFACT_DIR = "/home/youssef/.gemini/antigravity/brain/18b8d17c-7a26-4295-942c-b87387f373b6";

test("admin search bar styling and fixed sidebar scrolling", async ({ page }) => {
  test.setTimeout(60000);
  await loginAsAdmin(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/fr/admin/orders");
  await page.waitForLoadState("networkidle");

  // --- PART 1: Search bar tests ---
  const searchInput = page.locator(".admin-search-input");
  await expect(searchInput).toBeVisible();

  // Verify search input styles (no nested border, transparent background, proper height)
  const styles = await searchInput.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return {
      borderWidth: cs.borderWidth,
      borderStyle: cs.borderStyle,
      backgroundColor: cs.backgroundColor,
      minHeight: cs.minHeight,
      height: cs.height,
    };
  });

  expect(styles.borderWidth).toBe("0px");
  expect(styles.backgroundColor).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
  expect(parseFloat(styles.height)).toBeLessThanOrEqual(30);

  // Type in search bar to filter navigation items
  await searchInput.fill("Formations");
  await expect(page.locator('aside nav a:has-text("Formations")')).toBeVisible();
  await expect(page.locator('aside nav a:has-text("Commandes")')).not.toBeVisible();

  // Take screenshot of search in action
  const searchContainer = page.locator("aside .admin-search-input").locator("..");
  await searchContainer.screenshot({ path: `${ARTIFACT_DIR}/admin_search_bar_detail.png` });

  // Clear search using the X button
  const clearBtn = page.locator('aside button[aria-label="Effacer la recherche"]');
  await expect(clearBtn).toBeVisible();
  await clearBtn.click();
  await expect(searchInput).toHaveValue("");
  await expect(page.locator('aside nav a:has-text("Commandes")')).toBeVisible();

  // --- PART 2: Fixed Sidebar & Scrolling on Long Page ---
  const sidebar = page.locator("aside").first();
  await expect(sidebar).toBeVisible();

  // Initial position check: should be fixed at top 0, left 0
  const initialSidebarBox = await sidebar.boundingBox();
  expect(initialSidebarBox).not.toBeNull();
  expect(initialSidebarBox!.y).toBe(0);

  // Verify CSS position is fixed
  const sidebarPosition = await sidebar.evaluate((el) => window.getComputedStyle(el).position);
  expect(sidebarPosition).toBe("fixed");

  // Capture unscrolled screenshot
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_fixed_sidebar_top.png`, fullPage: false });

  // Scroll down the page by 800px
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(500);

  // Verify that the sidebar is STILL at viewport top 0
  const scrolledSidebarBox = await sidebar.boundingBox();
  expect(scrolledSidebarBox).not.toBeNull();
  expect(scrolledSidebarBox!.y).toBe(0);

  // Verify account switcher and search bar are STILL visible at top of sidebar
  await expect(page.locator('aside span:has-text("ANEI Console")')).toBeVisible();
  await expect(page.locator(".admin-search-input")).toBeVisible();

  // Verify sticky header is also visible at top of the page
  const header = page.locator("header").first();
  await expect(header).toBeVisible();
  const headerBox = await header.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.y).toBe(0);

  // Capture scrolled screenshot
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin_fixed_sidebar_scrolled.png`, fullPage: false });
});
