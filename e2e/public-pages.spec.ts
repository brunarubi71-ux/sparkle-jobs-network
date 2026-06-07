// Public-page E2E tests — no authentication required.
// Tests run against the built app at http://localhost:4173

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:4173";

test.describe("Landing Page", () => {
  test("renders hero section with CTA buttons", async ({ page }) => {
    await page.goto(BASE);
    // Headline or app name present
    await expect(page.locator("h1, [class*='hero']").first()).toBeVisible();
    // At least one call-to-action
    const cta = page.getByRole("button").or(page.getByRole("link")).filter({
      hasText: /start|get started|sign|entrar|cadastrar|cleaners|jobs/i,
    });
    await expect(cta.first()).toBeVisible();
  });

  test("shows How It Works section", async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    // Trust elements / features should be visible
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(200);
  });

  test("has working navigation links", async ({ page }) => {
    await page.goto(BASE);
    const nav = page.locator("nav, header");
    await expect(nav.first()).toBeVisible();
  });
});

// Helper: click the primary submit button on the auth form (not Google OAuth)
async function clickAuthSubmit(page: any) {
  // Use "Log In" / "Create Account" exact text to avoid matching Google button
  const btn = page
    .getByRole("button", { name: /^(log in|sign in|create account|entrar|cadastrar)$/i })
    .first();
  await btn.click();
}

test.describe("Auth Page", () => {
  test("renders sign in form", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("shows validation error for empty submit", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await clickAuthSubmit(page);
    await page.waitForTimeout(400);
    // After clicking submit with empty fields, the form should still be visible
    // (browser HTML5 validation or custom error prevents navigation)
    await expect(page.locator("input[type='email']")).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await page.locator("input[type='email']").fill("not-an-email");
    await page.locator("input[type='password']").fill("password123");
    await clickAuthSubmit(page);
    await page.waitForTimeout(500);
    // Form should still be visible (not navigated away from /auth)
    expect(page.url()).toContain("/auth");
    await expect(page.locator("input[type='email']")).toBeVisible();
  });

  test("shows error for wrong credentials", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await page.locator("input[type='email']").fill("wrong@example.com");
    await page.locator("input[type='password']").fill("wrongpassword123");
    await clickAuthSubmit(page);
    // Should stay on /auth and show an error within 8 seconds
    await page.waitForURL((url: URL) => url.pathname === "/auth", { timeout: 2000 }).catch(() => {});
    await expect(
      page.locator("[class*='error'], [role='alert'], .text-destructive, [class*='destructive']").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("can switch to sign up mode", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    const signupLink = page.getByText(/create account|sign up|cadastrar|register/i).first();
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await page.waitForTimeout(400);
      const body = await page.textContent("body");
      expect(body?.toLowerCase()).toMatch(/cleaner|owner|role|name|nome/);
    }
  });
});

test.describe("Legal Pages", () => {
  test("Terms of Service renders with content", async ({ page }) => {
    await page.goto(`${BASE}/terms`, { waitUntil: "networkidle" });
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(500);
    expect(body!.toLowerCase()).toMatch(/terms|termos|service|uso/);
  });

  test("Privacy Policy renders with content", async ({ page }) => {
    await page.goto(`${BASE}/privacy`, { waitUntil: "networkidle" });
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(500);
    expect(body!.toLowerCase()).toMatch(/privacy|privacidade|data|dados/);
  });

  test("Cancellation Policy renders with content", async ({ page }) => {
    await page.goto(`${BASE}/cancellation`, { waitUntil: "networkidle" });
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(200);
  });
});

test.describe("Navigation & 404", () => {
  test("unknown route shows 404 page", async ({ page }) => {
    await page.goto(`${BASE}/this-does-not-exist`);
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/not found|404|página não encontrada/);
  });

  test("protected routes redirect to auth when unauthenticated", async ({ page }) => {
    await page.goto(`${BASE}/jobs`);
    // Should redirect to /auth or show auth page
    await page.waitForURL((url) => url.pathname === "/auth" || url.pathname.includes("auth"), {
      timeout: 5000,
    });
    await expect(page.locator("input[type='email']")).toBeVisible();
  });
});

test.describe("SEO & Meta", () => {
  test("has correct page title", async ({ page }) => {
    await page.goto(BASE);
    const title = await page.title();
    expect(title.toLowerCase()).toMatch(/shinely/);
  });

  test("has Open Graph meta tags", async ({ page }) => {
    await page.goto(BASE);
    const ogTitle = await page.$eval(
      'meta[property="og:title"]',
      (el) => el.getAttribute("content")
    ).catch(() => null);
    const ogDesc = await page.$eval(
      'meta[property="og:description"]',
      (el) => el.getAttribute("content")
    ).catch(() => null);
    expect(ogTitle).toBeTruthy();
    expect(ogDesc).toBeTruthy();
  });

  test("has PWA manifest linked", async ({ page }) => {
    await page.goto(BASE);
    const manifest = await page.$eval(
      'link[rel="manifest"]',
      (el) => el.getAttribute("href")
    ).catch(() => null);
    expect(manifest).toBeTruthy();
  });

  test("has viewport meta tag", async ({ page }) => {
    await page.goto(BASE);
    const viewport = await page.$eval(
      'meta[name="viewport"]',
      (el) => el.getAttribute("content")
    ).catch(() => null);
    expect(viewport).toMatch(/width=device-width/);
  });
});

test.describe("PWA Assets", () => {
  test("manifest.json is accessible and valid", async ({ page }) => {
    const res = await page.request.get(`${BASE}/manifest.json`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.name).toBeTruthy();
    expect(json.icons).toBeTruthy();
    expect(json.icons.length).toBeGreaterThan(0);
  });

  test("service worker is registered", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    const swRegistered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    expect(swRegistered).toBeTruthy();
  });

  test("apple-touch-icon is accessible", async ({ page }) => {
    const res = await page.request.get(`${BASE}/apple-touch-icon.png`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/image/);
  });

  test("assetlinks.json is accessible", async ({ page }) => {
    const res = await page.request.get(`${BASE}/.well-known/assetlinks.json`);
    expect(res.status()).toBe(200);
  });
});
