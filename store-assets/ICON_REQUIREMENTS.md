# Shinely — Required Icon & Splash Screen Sizes

## Recommended Tool: @capacitor/assets

Run this once on a Mac (or any machine) to auto-generate all sizes:

```bash
npm install -D @capacitor/assets
# Place your source files (1024x1024 PNG, no transparency):
#   resources/icon-only.png
#   resources/icon-foreground.png  (Android adaptive icon foreground)
#   resources/icon-background.png  (Android adaptive icon background, solid colour ok)
#   resources/splash.png           (2732x2732 PNG)
#   resources/splash-dark.png      (optional, for dark mode)

npx capacitor-assets generate
```

---

## iOS — App Store Connect Requirements

| Usage              | Size (px)    | File format |
|--------------------|--------------|-------------|
| App Store listing  | 1024×1024    | PNG, no alpha |
| iPhone app icon    | 60×60 @2x = 120×120 | PNG |
| iPhone app icon    | 60×60 @3x = 180×180 | PNG |
| iPad app icon      | 76×76 @2x = 152×152 | PNG |
| iPad Pro app icon  | 83.5×83.5 @2x = 167×167 | PNG |
| Settings           | 29×29 @2x = 58×58 | PNG |
| Settings           | 29×29 @3x = 87×87 | PNG |
| Spotlight          | 40×40 @2x = 80×80 | PNG |
| Spotlight          | 40×40 @3x = 120×120 | PNG |

All iOS icons: **no transparency, no rounded corners** (iOS adds them automatically).

### iOS Splash Screen (LaunchScreen)
Capacitor uses a LaunchScreen storyboard. Recommended source: **2732×2732 PNG**
centered design with at least 500px safe margin on all sides.

---

## Android — Play Store Requirements

| Usage                        | Size (px)   |
|------------------------------|-------------|
| Play Store listing icon       | 512×512     |
| Feature graphic (banner)      | 1024×500    |
| Adaptive icon — foreground    | 108×108 dp (432×432 @ 4x) |
| Adaptive icon — background    | 108×108 dp (432×432 @ 4x) |
| Launcher hdpi                 | 72×72       |
| Launcher xhdpi                | 96×96       |
| Launcher xxhdpi               | 144×144     |
| Launcher xxxhdpi              | 192×192     |

Android icons: foreground should be centered within a **66dp safe zone** (264px @ 4x).

---

## Screenshots

### iOS (required at least 3 per device family)
- iPhone 6.9" (1320×2868 @3x) — iPhone 16 Pro Max
- iPhone 6.5" (1242×2688 @3x) — iPhone 11 Pro Max
- iPad 13" (2064×2752 @2x) — iPad Pro 13"

### Android (required at least 2)
- Phone: 1080×1920 minimum
- Tablet: 1200×1920 minimum (optional but recommended)

Screenshots should show real UI: job listing, map view, booking flow, profile.
