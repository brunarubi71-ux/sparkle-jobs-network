// Generates all icon sizes needed for iOS, Android, and App Stores.
// Run: node scripts/generate-icons.mjs

import sharp from "sharp";
import { mkdir, copyFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SOURCE_ICON = path.join(ROOT, "public", "pwa-512x512.png");
const RESOURCES_DIR = path.join(ROOT, "resources");

const BG_COLOR = { r: 245, g: 240, b: 255, alpha: 1 }; // #F5F0FF
const ICON_COLOR = { r: 168, g: 85, b: 247, alpha: 1 };  // #A855F7

async function ensureDir(dir) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

// ── 1. Resources folder (for @capacitor/assets) ───────────────────────────

async function generateResources() {
  await ensureDir(RESOURCES_DIR);

  // 1024×1024 icon (required by @capacitor/assets)
  await sharp(SOURCE_ICON)
    .resize(1024, 1024, { fit: "contain", background: BG_COLOR })
    .toFile(path.join(RESOURCES_DIR, "icon-only.png"));
  console.log("✓ resources/icon-only.png");

  // 2732×2732 splash screen with purple gradient background + icon
  const SPLASH_SIZE = 2732;
  const ICON_SIZE   = 600;
  const OFFSET      = Math.floor((SPLASH_SIZE - ICON_SIZE) / 2);

  const iconBuffer = await sharp(SOURCE_ICON)
    .resize(ICON_SIZE, ICON_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: SPLASH_SIZE,
      height: SPLASH_SIZE,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([{ input: iconBuffer, top: OFFSET, left: OFFSET }])
    .toFile(path.join(RESOURCES_DIR, "splash.png"));
  console.log("✓ resources/splash.png");

  // Dark-mode splash
  await sharp({
    create: {
      width: SPLASH_SIZE,
      height: SPLASH_SIZE,
      channels: 4,
      background: { r: 20, g: 10, b: 40, alpha: 1 },
    },
  })
    .composite([{ input: iconBuffer, top: OFFSET, left: OFFSET }])
    .toFile(path.join(RESOURCES_DIR, "splash-dark.png"));
  console.log("✓ resources/splash-dark.png");
}

// ── 2. Store assets: feature graphic (Play Store 1024×500) ───────────────

async function generateFeatureGraphic() {
  const OUT_DIR = path.join(ROOT, "store-assets", "android", "feature-graphic");
  await ensureDir(OUT_DIR);

  const iconBuffer = await sharp(SOURCE_ICON)
    .resize(200, 200, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: 1024, height: 500, channels: 4, background: { r: 168, g: 85, b: 247, alpha: 1 } },
  })
    .composite([{ input: iconBuffer, top: 150, left: 412 }])
    .toFile(path.join(OUT_DIR, "feature-graphic.png"));
  console.log("✓ store-assets/android/feature-graphic/feature-graphic.png");
}

// ── 3. Store assets: App Store icon 1024×1024 (no alpha, no rounded corners) ─

async function generateAppStoreIcon() {
  const OUT_DIR = path.join(ROOT, "store-assets", "ios");
  await ensureDir(OUT_DIR);

  await sharp(SOURCE_ICON)
    .resize(1024, 1024, { fit: "contain", background: BG_COLOR })
    .flatten({ background: BG_COLOR })  // App Store rejects icons with alpha
    .toFile(path.join(OUT_DIR, "AppStore-1024x1024.png"));
  console.log("✓ store-assets/ios/AppStore-1024x1024.png (App Store icon)");
}

// ── 4. Public assets: ensure all PWA icon sizes ───────────────────────────

async function generatePwaIcons() {
  const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512];
  const PUBLIC = path.join(ROOT, "public");

  for (const size of sizes) {
    const outFile = path.join(PUBLIC, `icon-${size}x${size}.png`);
    if (!existsSync(outFile)) {
      await sharp(SOURCE_ICON)
        .resize(size, size, { fit: "contain", background: BG_COLOR })
        .toFile(outFile);
    }
  }
  console.log("✓ public/icon-{sizes}.png");

  // Regenerate the main PWA icons to ensure they're correct
  const tmpBuffer192 = await sharp(SOURCE_ICON)
    .resize(192, 192, { fit: "contain", background: BG_COLOR })
    .toBuffer();
  await sharp(tmpBuffer192).toFile(path.join(PUBLIC, "pwa-192x192.png"));

  const tmpBuffer512 = await sharp(SOURCE_ICON)
    .resize(512, 512, { fit: "contain", background: BG_COLOR })
    .toBuffer();
  await sharp(tmpBuffer512).toFile(path.join(PUBLIC, "pwa-512x512.png"));

  // Apple touch icon (180×180, no alpha for iOS)
  await sharp(SOURCE_ICON)
    .resize(180, 180, { fit: "contain", background: BG_COLOR })
    .flatten({ background: BG_COLOR })
    .toFile(path.join(PUBLIC, "apple-touch-icon.png"));
  console.log("✓ public/apple-touch-icon.png");
}

(async () => {
  console.log("🎨 Generating Shinely assets…\n");
  await generateResources();
  await generateFeatureGraphic();
  await generateAppStoreIcon();
  await generatePwaIcons();
  console.log("\n✅ All assets generated!");
  console.log("\nNext: run `npx capacitor-assets generate` to create native platform icons from resources/");
})();
