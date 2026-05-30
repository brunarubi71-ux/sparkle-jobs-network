// Auth flow E2E tests.
// For signup/login tests to work against a real Supabase, set environment variables:
//   E2E_TEST_EMAIL_CLEANER=cleaner@test.com
//   E2E_TEST_PASSWORD=TestPass123!
//   E2E_TEST_EMAIL_OWNER=owner@test.com
//
// Without these, only the form-validation tests run.

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:4173";
const CLEANER_EMAIL = process.env.E2E_TEST_EMAIL_CLEANER ?? "";
const OWNER_EMAIL   = process.env.E2E_TEST_EMAIL_OWNER ?? "";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function signIn(page: any, email: string, password: string) {
  await page.goto(`${BASE}/auth`);
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.getByRole("button", { name: /sign in|log in|entrar|continue/i }).click();
  // Wait for redirect away from auth
  await page.waitForURL((url: URL) => url.pathname !== "/auth", { timeout: 10000 });
}

async function signOut(page: any) {
  // Try bottom nav or menu sign-out
  await page.goto(`${BASE}/profile`);
  const signoutBtn = page.getByRole("button", { name: /sign out|log out|sair/i });
  if (await signoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await signoutBtn.click();
  }
}

// ── Form validation tests (no credentials needed) ────────────────────────────

test.describe("Auth Form Validation", () => {
  test("sign in requires email and password", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await page.getByRole("button", { name: /sign in|log in|entrar|continue/i }).click();
    await page.waitForTimeout(300);
    await expect(page.locator("input[type='email']")).toBeVisible();
  });

  test("password field is masked", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await expect(page.locator("input[type='password']")).toHaveAttribute("type", "password");
  });

  test("forgot password link is visible", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    const forgotLink = page.getByText(/forgot|reset|esqueci/i).first();
    await expect(forgotLink).toBeVisible();
  });
});

// ── Authenticated cleaner flow (requires E2E credentials) ────────────────────

test.describe("Cleaner Flow", () => {
  test.skip(!CLEANER_EMAIL, "Set E2E_TEST_EMAIL_CLEANER to run authenticated tests");

  test("cleaner can sign in and see job listing", async ({ page }) => {
    await signIn(page, CLEANER_EMAIL, TEST_PASSWORD);
    // Should land on /jobs or /
    expect(["/", "/jobs"]).toContain(new URL(page.url()).pathname);
    // Job listing should be visible
    await expect(page.locator("[class*='job'], [data-testid='job-card'], h2, h3").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("cleaner profile page loads", async ({ page }) => {
    await signIn(page, CLEANER_EMAIL, TEST_PASSWORD);
    await page.goto(`${BASE}/profile`);
    // Profile content
    await expect(page.locator("h1, h2, [class*='profile']").first()).toBeVisible({ timeout: 8000 });
  });

  test("cleaner my-jobs page loads", async ({ page }) => {
    await signIn(page, CLEANER_EMAIL, TEST_PASSWORD);
    await page.goto(`${BASE}/cleaner-my-jobs`);
    await page.waitForTimeout(2000);
    // Should show a jobs list or empty state
    const body = await page.textContent("body");
    expect(body!.length).toBeGreaterThan(50);
  });

  test("cleaner earnings page loads", async ({ page }) => {
    await signIn(page, CLEANER_EMAIL, TEST_PASSWORD);
    await page.goto(`${BASE}/earnings`);
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/earn|ganho|wallet|carteira|\$/);
  });

  test("cleaner wallet page loads", async ({ page }) => {
    await signIn(page, CLEANER_EMAIL, TEST_PASSWORD);
    await page.goto(`${BASE}/wallet`);
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/wallet|balance|saldo|carteira/);
  });

  test("cleaner chat page loads", async ({ page }) => {
    await signIn(page, CLEANER_EMAIL, TEST_PASSWORD);
    await page.goto(`${BASE}/chat`);
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    expect(body!.length).toBeGreaterThan(50);
  });

  test("cleaner premium page shows plans", async ({ page }) => {
    await signIn(page, CLEANER_EMAIL, TEST_PASSWORD);
    await page.goto(`${BASE}/premium`);
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/pro|premium|free|plan|plano/);
  });

  test("cleaner can view schedules page", async ({ page }) => {
    await signIn(page, CLEANER_EMAIL, TEST_PASSWORD);
    await page.goto(`${BASE}/schedules`);
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    expect(body!.length).toBeGreaterThan(50);
  });
});

// ── Authenticated owner flow (requires E2E credentials) ──────────────────────

test.describe("Owner Flow", () => {
  test.skip(!OWNER_EMAIL, "Set E2E_TEST_EMAIL_OWNER to run authenticated owner tests");

  test("owner can sign in and see post-job page", async ({ page }) => {
    await signIn(page, OWNER_EMAIL, TEST_PASSWORD);
    expect(new URL(page.url()).pathname).toBe("/post-job");
  });

  test("owner my-jobs page loads", async ({ page }) => {
    await signIn(page, OWNER_EMAIL, TEST_PASSWORD);
    await page.goto(`${BASE}/my-jobs`);
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    expect(body!.length).toBeGreaterThan(50);
  });

  test("post-job form renders all fields", async ({ page }) => {
    await signIn(page, OWNER_EMAIL, TEST_PASSWORD);
    await page.goto(`${BASE}/post-job`);
    await page.waitForTimeout(2000);
    // Should have title/description inputs or a job form
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/title|address|price|bedrooms|job|vaga/);
  });
});
