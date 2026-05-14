# Shinely — App Store & Play Store Preparation

## What's already done (this branch)

| Task | Status |
|------|--------|
| Capacitor v8 installed | ✅ |
| `capacitor.config.ts` — bundle ID `com.shinely.app` | ✅ |
| `android/` native project scaffolded | ✅ |
| `ios/` native project scaffolded | ✅ |
| Android permissions (location, vibrate, notifications) | ✅ |
| iOS `Info.plist` — permission descriptions | ✅ |
| iOS `PrivacyInfo.xcprivacy` (required iOS 17+) | ✅ |
| Store listing copy (pt-BR + en-US) | ✅ |
| Icon & screenshot size guide | ✅ |

---

## Build workflow

```
npm run build           # Build the React web app
npx cap sync            # Copy dist/ into ios/ and android/ native projects
npx cap open android    # Open Android Studio
npx cap open ios        # Open Xcode (macOS only)
```

Or use the combined scripts:
```
npm run cap:android     # build + sync + open Android Studio
npm run cap:ios         # build + sync + open Xcode
```

---

## Android — Play Store Steps

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or later
- Java 17+

### 1. Generate icons & splash screen
```bash
# Place 1024×1024 icon at resources/icon-only.png
# Place 2732×2732 splash at resources/splash.png
npm install -D @capacitor/assets
npx capacitor-assets generate --android
```

### 2. Open in Android Studio
```bash
npm run cap:android
```

### 3. Configure signing
In Android Studio → **Build > Generate Signed Bundle / APK**:
- Select **Android App Bundle** (`.aab`) — required by Play Store
- Create or import your keystore (keep it safe, you can never change it)
- Build type: **Release**

### 4. Set version
Edit `android/app/build.gradle`:
```groovy
android {
    defaultConfig {
        versionCode 1       // increment by 1 for every upload
        versionName "1.0.0" // human-readable version
    }
}
```

### 5. Upload to Play Console
- Go to play.google.com/console
- Create app → Internal testing → Upload the `.aab`
- Fill in store listing (copy from `store-assets/android/listings/`)
- Set content rating, pricing (free), and countries
- Submit for review (usually < 24 hours for first release)

---

## iOS — App Store Steps

### Prerequisites
- macOS 14+ (Sonoma or later)
- Xcode 16+
- Apple Developer account ($99/year)

### 1. Generate icons & splash screen
```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --ios
```

### 2. Open in Xcode
```bash
npm run cap:ios
```

### 3. Configure signing
In Xcode → **Signing & Capabilities** tab:
- Team: select your Apple Developer team
- Bundle Identifier: `com.shinely.app`
- Enable **Automatically manage signing**

### 4. Set version & build number
In Xcode → target → **General**:
- Version: `1.0.0`
- Build: `1` (increment for every TestFlight/App Store upload)

### 5. Archive & upload
1. Select **Any iOS Device (arm64)** as the run destination
2. **Product > Archive**
3. **Distribute App > App Store Connect > Upload**
4. In App Store Connect:
   - Fill in store listing (copy from `store-assets/ios/listings/`)
   - Upload screenshots
   - Set privacy policy URL
   - Submit for review (usually 24–48 hours)

---

## Key IDs & config

| Field | Value |
|-------|-------|
| Bundle ID / App ID | `com.shinely.app` |
| App name | Shinely |
| Version | 1.0.0 |
| Theme color | `#A855F7` (purple) |
| Background color | `#F5F0FF` |

---

## Privacy policy (required by both stores)

You must provide a URL to a privacy policy. Host it at e.g.:
`https://shinelyapp.lovable.app/legal/privacy`

The policy must mention:
- Location data collection
- Payment processing via Stripe
- Account data (name, email, phone)
- Data retention and deletion (account deletion is already implemented ✅)
