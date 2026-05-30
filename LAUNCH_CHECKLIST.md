# Shinely — Launch Checklist

## 1. Supabase (Backend)

### Apply Migrations
```bash
supabase db push
# Or: paste each migration file manually in Supabase Dashboard → SQL Editor
```
**Migrations to apply:**
- `20260529000001_disputes_fix_and_email_triggers.sql`
- `20260529000002_push_tokens_and_push_triggers.sql`

### Edge Function Secrets
Set these in **Supabase Dashboard → Settings → Edge Functions → Secrets**:

| Secret Name | Value | Required |
|-------------|-------|----------|
| `RESEND_API_KEY` | Your Resend API key | ✅ Emails |
| `FROM_EMAIL` | `noreply@yourdomain.com` | ✅ Emails |
| `APP_URL` | `https://yourdomain.com` | ✅ Emails & links |
| `FIREBASE_PROJECT_ID` | From Firebase console | Push notifications |
| `FIREBASE_SERVICE_ACCOUNT` | JSON string from Firebase service account key | Push notifications |

### Supabase Vault (for DB trigger emails)
Add to **Supabase Dashboard → Vault → New Secret**:
- Name: `service_role`
- Value: Your Supabase service role key (from Settings → API)

### Verify Email Templates
Enable email confirmations in **Supabase Dashboard → Authentication → Email Templates**

---

## 2. Resend (Email)
1. Create account at resend.com
2. Add and verify your domain (e.g., `shinely.app`)
3. Set DNS records as instructed by Resend
4. Copy API key → paste into Supabase secrets as `RESEND_API_KEY`

---

## 3. Firebase (Push Notifications)
1. Create project at console.firebase.google.com
2. Enable Cloud Messaging
3. Download `google-services.json` → place in `android/app/`
4. Go to Project Settings → Service Accounts → Generate new private key
5. Copy the JSON content → stringify it → add to Supabase secrets as `FIREBASE_SERVICE_ACCOUNT`
6. Copy Project ID → add to Supabase secrets as `FIREBASE_PROJECT_ID`

### iOS APNs Setup
1. In Xcode → Signing & Capabilities → add "Push Notifications" capability
2. In Firebase Console → Project Settings → Apple apps → upload APNs key (.p8)

---

## 4. Android Build

### Prerequisites
- Android Studio installed
- Java 17+
- Signing keystore created

```bash
# 1. Build and sync
npm run cap:android

# 2. In Android Studio:
#    Build → Generate Signed Bundle/APK → Android App Bundle
#    Use your keystore

# 3. Get SHA-256 fingerprint for App Links
keytool -list -v -keystore your-keystore.jks -alias your-key-alias

# 4. Update public/.well-known/assetlinks.json with the fingerprint
```

### Play Store Submission
- [ ] App Bundle (.aab) generated and signed
- [ ] `store-assets/screenshots/android/` screenshots ready (add authenticated screens)
- [ ] `store-assets/android/feature-graphic/feature-graphic.png` ready ✅ (auto-generated)
- [ ] `store-assets/android/listings/` copy ready ✅
- [ ] Content rating questionnaire filled
- [ ] Privacy policy URL set (your deployed domain + /privacy)
- [ ] Target SDK 34 (already set)

---

## 5. iOS Build

### Prerequisites
- Mac with Xcode 15+
- Apple Developer account ($99/year)
- App ID registered at developer.apple.com

```bash
# 1. Build and sync
npm run cap:ios

# 2. In Xcode:
#    Set Team in Signing & Capabilities
#    Archive → Distribute to App Store
```

### App Store Submission
- [ ] App archived and uploaded via Xcode
- [ ] `store-assets/ios/AppStore-1024x1024.png` App Store icon ✅ (auto-generated)
- [ ] `store-assets/screenshots/ios/` screenshots ready (add authenticated screens)
- [ ] `store-assets/ios/listings/` copy ready ✅
- [ ] Privacy policy URL set
- [ ] App Review information completed
- [ ] Age rating: 4+ or 12+ (based on content)

### iOS Universal Links
1. Get your Apple Team ID from developer.apple.com
2. Update `public/.well-known/apple-app-site-association`:
   - Replace `REPLACE_WITH_YOUR_TEAM_ID` with your Team ID (e.g., `A1B2C3D4E5`)
3. Deploy to production — the file must be at `https://yourdomain.com/.well-known/apple-app-site-association`
4. In Xcode → Signing & Capabilities → Associated Domains → add `applinks:yourdomain.com`

---

## 6. Screenshots (authenticated screens — manual)

Take these screenshots while logged in as each user type.
Save to `store-assets/screenshots/ios/` and `store-assets/screenshots/android/`.

### As Cleaner:
- [ ] `07-jobs-list.png` — job listing with map
- [ ] `08-job-detail.png` — individual job page
- [ ] `09-my-jobs.png` — cleaner's active jobs
- [ ] `10-earnings.png` — earnings dashboard
- [ ] `11-profile.png` — profile page with badges
- [ ] `12-premium.png` — subscription plans

### As Owner:
- [ ] `13-post-job.png` — job creation form
- [ ] `14-my-jobs-owner.png` — jobs posted + applicants

---

## 7. Production Deploy (Web)

```bash
# Build for production
npm run build

# The dist/ folder is ready for any static host (Vercel, Netlify, Cloudflare Pages)
# Make sure environment variables are set in your host:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_PUBLISHABLE_KEY
#   VITE_PAYMENTS_CLIENT_TOKEN (use pk_live_ key)
```

---

## 8. Final Verification Checklist

### Security
- [ ] Stripe is in **live mode** (`pk_live_...` key in .env.production) ✅
- [ ] Supabase RLS enabled on all tables ✅
- [ ] `android:allowBackup="false"` in AndroidManifest ✅
- [ ] Debug flags disabled in capacitor.config.ts ✅
- [ ] `console.log` stripped in production builds ✅

### Functionality
- [ ] Sign up → welcome email received
- [ ] Post job → owner charged
- [ ] Apply to job → owner email notification received
- [ ] Owner hires cleaner → cleaner email notification received
- [ ] Stripe Connect payout works
- [ ] Dispute resolution (all 3 buttons) works
- [ ] Identity verification upload and approval works

### Performance
- [ ] Lighthouse score > 90 on mobile ✅ (PWA + service worker)
- [ ] First load < 3 seconds ✅ (bundle optimized)

### Compliance
- [ ] Terms of Service URL live and accessible
- [ ] Privacy Policy URL live and accessible
- [ ] Cancellation Policy URL live and accessible

---

## 9. Run Tests

```bash
# Unit tests
npm test

# E2E tests (public pages — no credentials needed)
npx vite preview &
npx playwright test e2e/public-pages.spec.ts

# E2E tests (authenticated flows)
E2E_TEST_EMAIL_CLEANER=cleaner@test.com \
E2E_TEST_EMAIL_OWNER=owner@test.com \
E2E_TEST_PASSWORD=YourTestPass123! \
npx playwright test e2e/auth-flow.spec.ts
```

---

## 10. Launch Day

1. Apply all Supabase migrations
2. Set all Supabase Edge Function secrets
3. Deploy web app to production
4. Upload Android AAB to Play Store (internal test → production)
5. Upload iOS build to App Store Connect (TestFlight → production)
6. Monitor Supabase logs for errors
7. Monitor Stripe dashboard for payments
8. Have admin account ready to approve first identity verifications
