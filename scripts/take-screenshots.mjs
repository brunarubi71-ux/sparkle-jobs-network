// Takes store-quality screenshots of the Shinely app.
// Requires: built app + preview server running on http://localhost:4173
// Run: node scripts/take-screenshots.mjs
//
// Outputs to:
//   store-assets/screenshots/ios/    (iPhone 14 Pro size — 393×852)
//   store-assets/screenshots/android/ (Pixel 7 size — 412×915)
//   store-assets/screenshots/web/    (desktop)

import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE_URL = "http://localhost:4173";

const DEVICES = {
  ios: {
    width: 393, height: 852,
    deviceScaleFactor: 3,
    dir: path.join(ROOT, "store-assets", "screenshots", "ios"),
  },
  android: {
    width: 412, height: 915,
    deviceScaleFactor: 2.625,
    dir: path.join(ROOT, "store-assets", "screenshots", "android"),
  },
  web: {
    width: 1280, height: 800,
    deviceScaleFactor: 1,
    dir: path.join(ROOT, "store-assets", "screenshots", "web"),
  },
};

// Pages to screenshot — all are PUBLIC (no login required)
const SCREENSHOTS = [
  {
    name: "01-landing",
    url: "/",
    description: "Landing page — hero section",
    waitFor: ".hero, h1, [class*='landing'], main",
    scroll: 0,
  },
  {
    name: "02-landing-features",
    url: "/",
    description: "Landing page — features section",
    waitFor: "main",
    scroll: 700,
  },
  {
    name: "03-auth-signin",
    url: "/auth",
    description: "Sign in screen",
    waitFor: "form, input[type='email'], [data-testid='auth']",
    scroll: 0,
  },
  {
    name: "04-auth-signup",
    url: "/auth?mode=signup",
    description: "Sign up screen",
    waitFor: "form, input[type='email']",
    scroll: 0,
    action: async (page) => {
      // Click "Create Account" tab if present
      try {
        const signupTab = page.getByText(/create account|sign up|cadastrar/i).first();
        if (await signupTab.isVisible()) await signupTab.click();
      } catch {}
    },
  },
  {
    name: "05-terms",
    url: "/terms",
    description: "Terms of Service",
    waitFor: "main, article",
    scroll: 0,
  },
  {
    name: "06-privacy",
    url: "/privacy",
    description: "Privacy Policy",
    waitFor: "main, article",
    scroll: 0,
  },
];

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });

  for (const [deviceName, device] of Object.entries(DEVICES)) {
    await mkdir(device.dir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.deviceScaleFactor,
      userAgent:
        deviceName === "ios"
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          : deviceName === "android"
          ? "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
          : undefined,
    });

    const page = await context.newPage();

    for (const shot of SCREENSHOTS) {
      try {
        await page.goto(`${BASE_URL}${shot.url}`, {
          waitUntil: "networkidle",
          timeout: 15000,
        });

        // Execute optional action
        if (shot.action) await shot.action(page);

        // Scroll to position
        if (shot.scroll) {
          await page.evaluate((y) => window.scrollTo(0, y), shot.scroll);
          await page.waitForTimeout(500);
        }

        // Wait for content
        await page.waitForSelector(shot.waitFor, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(800); // Let animations settle

        const outFile = path.join(device.dir, `${shot.name}.png`);
        await page.screenshot({
          path: outFile,
          fullPage: false,
          animations: "disabled",
        });
        console.log(`✓ [${deviceName}] ${shot.name}.png`);
      } catch (err) {
        console.warn(`⚠  [${deviceName}] ${shot.name}: ${err.message}`);
      }
    }

    await context.close();
  }

  await browser.close();
  console.log("\n✅ Screenshots saved to store-assets/screenshots/");
  console.log("\n📝 Note: Authenticated screens (jobs list, chat, profile, earnings)");
  console.log("   must be captured manually. See LAUNCH_CHECKLIST.md for instructions.");
}

takeScreenshots().catch(console.error);
