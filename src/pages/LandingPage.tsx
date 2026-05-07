import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Language } from "@/i18n/translations";
import "./LandingPage.css";

const LANGS: { code: Language; label: string }[] = [
  { code: "pt", label: "PT" },
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
];

const FAQS = [
  {
    q: "How do I find cleaning jobs near me?",
    a: "Download the Shinely app, create a free cleaner account, and browse available cleaning jobs in your area. You can filter jobs by distance (5, 10, 25, or 50 miles), job type, and price.",
  },
  {
    q: "How much can I earn as a cleaner on Shinely?",
    a: "Cleaners on Shinely keep 90% of every job payment. Most cleaners earn between $20–$40 per hour. Full-time cleaners on Shinely can earn $2,000–$4,000/month.",
  },
  {
    q: "Is Shinely free to use?",
    a: "Downloading the app and creating an account is completely free. Cleaners pay a small 10% platform fee only when they complete a paid job — no monthly fees, no subscriptions.",
  },
  {
    q: "How fast do I get paid after completing a job?",
    a: "Standard payouts arrive in your bank account within 2–5 business days, free of charge. Our instant payout option delivers funds in approximately 30 minutes for a small 1.5% fee.",
  },
  {
    q: "I don't have a car. Can I still find cleaning jobs?",
    a: "Yes! Shinely has a Helper role for cleaners without transportation. You team up with a cleaner who has a car. The cleaner earns 70% and the helper earns 30% — a great way to build income without a vehicle.",
  },
  {
    q: "Are cleaners on Shinely verified and trustworthy?",
    a: "All cleaners create verified accounts and are rated by homeowners after every job. You can see ratings, reviews, and job history before hiring anyone.",
  },
];

const PHONE_JOBS = [
  {
    title: "Residential Deep Clean",
    address: "2.3 mi · 1420 Brickell Ave",
    price: "$180",
    badge: "Urgent",
    badgeColor: "#ef4444",
    badgeBg: "#fef2f2",
  },
  {
    title: "Move-out Cleaning",
    address: "4.1 mi · 850 Ocean Dr",
    price: "$220",
    badge: "New",
    badgeColor: "#16a34a",
    badgeBg: "#dcfce7",
  },
  {
    title: "Weekly House Cleaning",
    address: "1.8 mi · 333 NE 24th St",
    price: "$260",
    badge: "Recurring",
    badgeColor: "#2563eb",
    badgeBg: "#dbeafe",
  },
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"cleaners" | "owners">("cleaners");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { language, setLanguage } = useLanguage();

  return (
    <div className="lp">
      {/* NAV */}
      <nav className="lp-nav">
        <a href="/" className="lp-nav-logo">
          ✦ Shinely
        </a>
        <ul className="lp-nav-links">
          <li>
            <a href="#how-it-works">How It Works</a>
          </li>
          <li>
            <a href="#features">Features</a>
          </li>
          <li>
            <a href="#cleaners">For Cleaners</a>
          </li>
          <li>
            <a href="#faq">FAQ</a>
          </li>
        </ul>
        <div className="lp-nav-right">
          <div className="lp-lang-switcher">
            {LANGS.map((l, i) => (
              <span key={l.code}>
                <button
                  className={`lp-lang-btn${language === l.code ? " active" : ""}`}
                  onClick={() => setLanguage(l.code)}
                >
                  {l.label}
                </button>
                {i < LANGS.length - 1 && <span className="lp-lang-sep">|</span>}
              </span>
            ))}
          </div>
          <Link to="/auth" className="lp-nav-cta">
            Get the App
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div>
            <div className="lp-hero-badge">
              <span>✦</span> The #1 Cleaning Jobs Marketplace
            </div>
            <h1 className="lp-h1">
              Find <em>Cleaning Jobs</em>
              <br />
              Near You — Get Paid Fast
            </h1>
            <p className="lp-hero-sub">
              Shinely connects professional cleaners with homeowners who need help. Browse jobs, apply in seconds, and
              get paid securely through the app.
            </p>
            <div className="lp-hero-btns">
              <Link to="/auth" className="lp-btn-primary">
                Find Jobs Near Me
              </Link>
              <a href="#how-it-works" className="lp-btn-secondary">
                See How It Works
              </a>
            </div>
            <div className="lp-hero-stats">
              <div>
                <div className="lp-stat-num">10K+</div>
                <div className="lp-stat-label">Active Cleaners</div>
              </div>
              <div>
                <div className="lp-stat-num">$40/hr</div>
                <div className="lp-stat-label">Avg. Hourly Rate</div>
              </div>
              <div>
                <div className="lp-stat-num">4.9★</div>
                <div className="lp-stat-label">App Rating</div>
              </div>
            </div>
          </div>

          <div className="lp-hero-visual">
            <div className="lp-phone-wrap">
              <div className="lp-phone-screen">
                {/* Phone Header */}
                <div className="lp-phone-header">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="lp-phone-header-title">✦ Shinely</div>
                      <div className="lp-phone-header-main">📍 Miami, FL</div>
                    </div>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "rgba(255,255,255,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, color: "white"
                    }}>👤</div>
                  </div>
                </div>

                {/* Search / Filter bar */}
                <div style={{
                  padding: "8px 12px",
                  background: "white",
                  borderBottom: "1px solid #e5e7eb",
                }}>
                  <div style={{
                    background: "#f3f4f6", borderRadius: 8, padding: "5px 10px",
                    fontSize: 9, color: "#9ca3af", marginBottom: 6,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    🔍 Search cleaning jobs...
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["5mi", "10mi", "25mi"].map((d, i) => (
                      <span key={d} style={{
                        fontSize: 8, fontWeight: 700,
                        padding: "2px 8px", borderRadius: 100,
                        background: i === 1 ? "#7c3aed" : "#f5f0ff",
                        color: i === 1 ? "white" : "#7c3aed",
                      }}>{d}</span>
                    ))}
                  </div>
                </div>

                {/* Job Cards */}
                <div className="lp-phone-jobs">
                  {PHONE_JOBS.map((job) => (
                    <div key={job.title} className="lp-phone-job" style={{ position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div className="lp-phone-job-title">{job.title}</div>
                        <span style={{
                          fontSize: 7, fontWeight: 700,
                          padding: "1px 6px", borderRadius: 100,
                          background: job.badgeBg, color: job.badgeColor,
                          flexShrink: 0,
                        }}>{job.badge}</span>
                      </div>
                      <div className="lp-phone-job-info">📍 {job.address}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <div className="lp-phone-job-price">{job.price}</div>
                        <span style={{
                          fontSize: 7, fontWeight: 700, color: "white",
                          background: "#7c3aed", padding: "2px 8px",
                          borderRadius: 6, cursor: "default",
                        }}>Apply</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Nav */}
                <div style={{
                  marginTop: "auto",
                  borderTop: "1px solid #e5e7eb",
                  background: "white",
                  display: "flex",
                  justifyContent: "space-around",
                  padding: "6px 0 8px",
                }}>
                  {[
                    { icon: "🔍", label: "Jobs", active: true },
                    { icon: "📋", label: "My Jobs", active: false },
                    { icon: "💬", label: "Chat", active: false },
                    { icon: "👤", label: "Profile", active: false },
                  ].map((nav) => (
                    <div key={nav.label} style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                      fontSize: 12, lineHeight: 1,
                    }}>
                      <span>{nav.icon}</span>
                      <span style={{
                        fontSize: 7, fontWeight: nav.active ? 700 : 500,
                        color: nav.active ? "#7c3aed" : "#9ca3af",
                      }}>{nav.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="lp-trust">
        <p>Trusted by cleaners and homeowners across the US</p>
        <div className="lp-trust-logos">
          {["MIAMI", "ORLANDO", "TAMPA", "ATLANTA", "DALLAS", "HOUSTON"].map((city) => (
            <span key={city} className="lp-trust-logo">
              {city}
            </span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="lp-section" id="how-it-works" style={{ background: "white" }}>
        <div className="lp-container">
          <div className="lp-tag">How It Works</div>
          <h2 className="lp-h2">Start Earning in 3 Simple Steps</h2>
          <p className="lp-section-sub">
            Whether you're a cleaner looking for jobs or a homeowner needing help, Shinely makes it effortless.
          </p>

          <div className="lp-tabs">
            <button
              className={`lp-tab${activeTab === "cleaners" ? " active" : ""}`}
              onClick={() => setActiveTab("cleaners")}
            >
              For Cleaners
            </button>
            <button
              className={`lp-tab${activeTab === "owners" ? " active" : ""}`}
              onClick={() => setActiveTab("owners")}
            >
              For Homeowners
            </button>
          </div>

          {activeTab === "cleaners" ? (
            <div className="lp-steps">
              {[
                {
                  icon: "📱",
                  num: "Step 01",
                  title: "Create Your Free Profile",
                  desc: "Sign up in minutes. Add your experience, service area, and availability. No fees to join.",
                },
                {
                  icon: "🔍",
                  num: "Step 02",
                  title: "Browse & Apply to Jobs",
                  desc: "See cleaning jobs near you filtered by distance, price, and job type. Apply with one tap.",
                },
                {
                  icon: "💰",
                  num: "Step 03",
                  title: "Complete & Get Paid Fast",
                  desc: "Finish the job, confirm completion in the app, and receive payment — instantly or in 2-5 days.",
                },
              ].map((s) => (
                <div key={s.num} className="lp-step">
                  <div className="lp-step-icon">{s.icon}</div>
                  <div className="lp-step-num">{s.num}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="lp-steps">
              {[
                {
                  icon: "📝",
                  num: "Step 01",
                  title: "Post Your Cleaning Job",
                  desc: "Describe your home, set your budget, and post the job. Takes under 2 minutes.",
                },
                {
                  icon: "👥",
                  num: "Step 02",
                  title: "Review & Hire a Cleaner",
                  desc: "Receive applications from verified cleaners near you. Check ratings and hire the best fit.",
                },
                {
                  icon: "✅",
                  num: "Step 03",
                  title: "Enjoy a Spotless Home",
                  desc: "Your cleaner arrives, does the job, and you confirm through the app. Secure payment, no cash needed.",
                },
              ].map((s) => (
                <div key={s.num} className="lp-step">
                  <div className="lp-step-icon">{s.icon}</div>
                  <div className="lp-step-num">{s.num}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-section lp-features-bg" id="features">
        <div className="lp-container">
          <div className="lp-tag">Features</div>
          <h2 className="lp-h2">Everything You Need to Succeed</h2>
          <p className="lp-section-sub">
            Shinely is built with cleaners in mind — from finding jobs to getting paid, we've got you covered.
          </p>
          <div className="lp-features-grid">
            {[
              {
                icon: "📍",
                title: "Jobs Near You",
                desc: "Filter cleaning jobs by distance — 5, 10, 25, or 50 miles from your location. Never waste time on far commutes.",
              },
              {
                icon: "⚡",
                title: "Instant Payouts",
                desc: "Get paid in ~30 minutes with our instant payout option. Standard payouts arrive in 2-5 days, free of charge.",
              },
              {
                icon: "🛡️",
                title: "Secure Payments",
                desc: "All payments are handled through the app. No cash, no awkward conversations, no risk of non-payment.",
              },
              {
                icon: "👥",
                title: "Team Up with Helpers",
                desc: "Bigger jobs? Invite a helper to work with you. Helpers earn 30% and cleaners earn 70% — fair for everyone.",
              },
              {
                icon: "⭐",
                title: "Build Your Reputation",
                desc: "Every completed job earns you ratings and badges. The better your reputation, the more jobs you attract.",
              },
              {
                icon: "💬",
                title: "In-App Messaging",
                desc: "Chat directly with homeowners before and during the job. No need to share your personal phone number.",
              },
            ].map((f) => (
              <div key={f.title} className="lp-feature-card">
                <span className="lp-feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="lp-section" id="cleaners" style={{ background: "white" }}>
        <div className="lp-container">
          <div className="lp-tag">Who Is Shinely For?</div>
          <h2 className="lp-h2">Built for Cleaners and Homeowners</h2>
          <p className="lp-section-sub">Two sides of the same marketplace — both get exactly what they need.</p>
          <div className="lp-audience-grid">
            <div className="lp-audience-card cleaner">
              <h3>For Cleaners & Helpers</h3>
              <p className="sub">Start earning more, on your schedule.</p>
              <ul className="lp-audience-list">
                {[
                  "Browse cleaning jobs near you anytime",
                  "Keep 90% of every payment",
                  "Instant or standard payouts to your bank",
                  "No car? Join as a helper and team up",
                  "Build reviews and grow your clientele",
                ].map((item) => (
                  <li key={item}>
                    <span>✓</span> {item}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="lp-audience-btn">
                Find Jobs Near Me →
              </Link>
            </div>
            <div className="lp-audience-card owner">
              <h3>For Homeowners</h3>
              <p className="sub">Hire a trusted cleaner in minutes.</p>
              <ul className="lp-audience-list">
                {[
                  "Post a job in under 2 minutes",
                  "Receive applications from local cleaners fast",
                  "See ratings and reviews before hiring",
                  "Pay securely through the app — no cash",
                  "Reschedule or cancel with ease",
                ].map((item) => (
                  <li key={item}>
                    <span>✓</span> {item}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="lp-audience-btn">
                Post a Cleaning Job →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="lp-section lp-testimonials-bg">
        <div className="lp-container">
          <div className="lp-tag">Reviews</div>
          <h2 className="lp-h2">Loved by Cleaners Across the US</h2>
          <p className="lp-section-sub">Here's what cleaners and homeowners say about Shinely.</p>
          <div className="lp-testimonials-grid">
            {[
              {
                initial: "A",
                name: "Ana S.",
                location: "Professional Cleaner — Miami, FL",
                text: "I found 3 cleaning jobs in my first week. The instant payout feature is a game changer — I get paid the same day!",
              },
              {
                initial: "M",
                name: "Michael R.",
                location: "Homeowner — Orlando, FL",
                text: "Finally an app that makes it easy to hire a reliable cleaner. Posted the job, got 4 applications in an hour.",
              },
              {
                initial: "C",
                name: "Carla M.",
                location: "Cleaning Helper — Tampa, FL",
                text: "As a helper without a car, I was worried I couldn't find work. Shinely paired me with a cleaner and now I work every weekend.",
              },
            ].map((t) => (
              <div key={t.name} className="lp-testimonial">
                <div className="lp-stars">★★★★★</div>
                <p>"{t.text}"</p>
                <div className="lp-testimonial-author">
                  <div className="lp-avatar">{t.initial}</div>
                  <div className="lp-author-info">
                    <strong>{t.name}</strong>
                    <span>{t.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section" id="faq" style={{ background: "white" }}>
        <div className="lp-container">
          <div className="lp-tag">FAQ</div>
          <h2 className="lp-h2">Frequently Asked Questions</h2>
          <p className="lp-section-sub">
            Everything you need to know about finding cleaning jobs or hiring cleaners with Shinely.
          </p>
          <div className="lp-faq-list">
            {FAQS.map((faq, i) => (
              <div key={i} className={`lp-faq-item${openFaq === i ? " open" : ""}`}>
                <button className="lp-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {faq.q}
                  <span className="lp-faq-icon">+</span>
                </button>
                <div className="lp-faq-a">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DOWNLOAD CTA */}
      <section className="lp-download" id="download">
        <div className="lp-tag">Download Free</div>
        <h2 className="lp-h2">Start Finding Cleaning Jobs Today</h2>
        <p className="lp-download-sub">
          Join thousands of cleaners already earning great income with Shinely. Free to download, free to join.
        </p>
        <div className="lp-app-badges">
          <Link to="/auth" className="lp-app-badge">
            <span className="lp-badge-icon">🍎</span>
            <div>
              <span className="lp-badge-sub">Download on the</span>
              <strong>App Store</strong>
            </div>
          </Link>
          <Link to="/auth" className="lp-app-badge">
            <span className="lp-badge-icon">▶</span>
            <div>
              <span className="lp-badge-sub">Get it on</span>
              <strong>Google Play</strong>
            </div>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div>
            <div className="lp-footer-name">✦ Shinely</div>
            <p className="lp-footer-desc">
              The marketplace connecting professional cleaners with homeowners. Find jobs near you or hire a trusted
              cleaner today.
            </p>
          </div>
          <div>
            <h4>For Cleaners</h4>
            <ul className="lp-footer-links">
              <li>
                <a href="#how-it-works">How It Works</a>
              </li>
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <Link to="/auth">Get Started</Link>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>For Homeowners</h4>
            <ul className="lp-footer-links">
              <li>
                <a href="#how-it-works">Post a Job</a>
              </li>
              <li>
                <a href="#cleaners">Hire a Cleaner</a>
              </li>
              <li>
                <Link to="/auth">Sign Up Free</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul className="lp-footer-links">
              <li>
                <Link to="/terms">Terms of Service</Link>
              </li>
              <li>
                <Link to="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/cancellation">Cancellation</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 Shinely. All rights reserved.</span>
          <span>Cleaning jobs marketplace — USA</span>
        </div>
      </footer>
    </div>
  );
}
