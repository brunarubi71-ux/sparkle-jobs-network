
## Phase 1: Database Schema Expansion
Add new columns/tables needed:
- **profiles**: add `bio`, `experience_years`, `specialties`, `languages`, `regions`, `availability`, `transportation`, `supplies`, `company_name`, `business_type`, `years_in_business`
- **jobs**: add `date_time`, `total_amount`, `platform_fee`, `cleaner_earnings` columns; update status enum
- **New table: reviews** — reviewer_id, reviewed_id, job_id, rating (1-5), text, created_at
- **New table: portfolio_photos** — user_id, photo_url, created_at
- **New table: rewards** — user_id, badge_name, earned_at

## Phase 2: Role-Based Navigation & Dashboards
- Separate bottom nav for Cleaner vs Owner
- **Cleaner tabs**: Jobs, Schedules, Chat, Premium, Profile
- **Owner tabs**: Post Job, My Jobs, Sell Schedule, Chat, Profile
- Route guards based on role

## Phase 3: Job Owner Features
- **Post Job** form (title, type, price, beds, baths, address, city, urgency, date/time, description)
- **My Jobs** page (list with status, applicants, hire/complete/cancel actions)
- **Sell Schedule** form

## Phase 4: Enhanced Profile System
- Editable profile fields per role
- Portfolio photo gallery (using storage bucket)
- Public profile view for both roles
- Stats display (jobs completed, earnings, rating)

## Phase 5: Job Status Flow & Hiring
- Status progression: Open → Applied → Hired → In Progress → Completed → Cancelled
- Hire cleaner from applicants list
- Payment required before "In Progress"
- Commission calculation (10% platform fee)

## Phase 6: Anti-Bypass & Contact Protection
- Hide phone/email before payment
- Chat message filtering (detect phone numbers, emails, WhatsApp)
- Warning messages
- Unlock contacts after booking

## Phase 7: Ratings & Reviews
- Post-completion review flow (both parties)
- Star rating + text
- Display on profiles

## Phase 8: Rewards & Badges
- Track job completion counts
- Auto-assign badges (Rising/Top/Elite Cleaner, Verified Business)
- Display on profiles

## Phase 9: Payment/Escrow Prep
- Enable Stripe integration
- Escrow flow UI (hold → release)
- Payment breakdown display
- Earnings dashboard for cleaners

## Phase 10: Polish & Retention
- Earnings dashboard
- Job history
- Stats pages
- Premium page updates

---

**Estimated effort**: This is 8-10 implementation rounds. I recommend starting with Phases 1-3 (database + role-based nav + owner features) as the foundation, then layering on the rest.

**Should I proceed with Phase 1 (database migration) first?**
