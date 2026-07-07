# Owner Feedback — Corbett Claims Website

**Date:** 2026-07-06
**Source:** Owner (relayed by Matt)
**Status:** ✅ All items applied 2026-07-06, then run through the web-design 9-gate `gold-standard-website-pipeline` (retrofit: G5–G9). Verdict: 🟢 Go (with post-deploy conditions). See "Open questions" at the bottom.

Each item is a checkbox; all are complete.

---

## Front page (hero)

- [x] Replace headline **"An appraiser who knows…"** with **"A complete auto appraisal service"**

## Page 1 — "Why Us"

- [x] Delete the **"Why Us"** heading at the top of the page
- [x] In the **Based in Baton Rouge** section, **add Georgia** to the list of states
- [x] Change **Anchor states from 8 to 9** (reflecting Georgia being added)
- [x] Delete **"English/Spanish Speaking"**
- [x] Delete **"Ex-Allstate adjuster"**

## Page 2 — "How It Works"

- [x] #1 — Delete **"Location, equipment, urgency"**
- [x] #2 — Change **3–5 days → 2–3 days**
- [x] #3 — Replace **"high resolution photos"** with **"photos included"**
- [x] #4 — Delete item **#4** altogether

## Page 3 — "Why Choose Us"

- [x] Delete the entire **"Why Choose Us"** section/page

## Page 4 — "What We Appraise"

- [x] No changes — all OK

## Page 5 — Team

- [x] Change **"Meet the Team" → "Meet the Owners"**

## Page 6 — Service Area

- [x] **Add Georgia** to the service area

## Page 7 — Testimonials

- [x] Delete **"What Customers Say"**
- [x] Delete **"Share Your Experience"**

## Page 8 — Frequently Asked Questions

- [x] "How fast…" — change **3–5 days → 2–3 days**
- [x] Delete the **last line about court-deadline work** altogether
- [x] "What areas do you cover" — **add Georgia**
- [x] Delete **"How experienced is [the] appraiser"**
- [x] "What are your hours" — change **9–6 → 8am–5pm**
- [x] Delete **"Do you speak Spanish"**
- [x] "What forms of payment do you accept?" — set to **Check, Venmo, PayPal, Cash App, Apple Cash, Zelle** (delete Mastercard, Discover, etc.)

## Page 9 — Request an Appraisal

Under **Assignment Type:**

- [x] Delete **"Pre-purchase Inspection"**
- [x] Delete **"Court/Expert"**

---

## Checklist fixes applied on top of the owner edits (9-gate pipeline)

- Added `robots.txt` (with explicit AI-crawler allow-list), `sitemap.xml`, and a branded `404.html` (were missing).
- Grafted **Georgia's real polygon** into the service map (`service-states.geojson`), not just the text — the map now highlights 9 states.
- Made social-share URLs (`og:image`, `og:url`, `twitter:image`, `canonical`) **absolute** so link previews render for scrapers that don't run JS.
- Added **`FAQPage` structured data** mirroring the 7 visible FAQs (rich-result eligibility / AEO).
- **A11y:** darkened form-field borders to meet 3:1 non-text contrast; added `scroll-padding-top` so the sticky nav can't hide anchor targets; underlined contact-card links; kept the decorative map's Leaflet controls out of the keyboard tab order.
- Added a **print stylesheet**.
- Propagated all changes into the JSON-LD structured data + `data.json` (hours, payment, languages, 9 states).

## Open questions — resolved 2026-07-07

1. **Allstate credential** — ✅ **Scrubbed everywhere** (hero lede, "Meet the Owners" bio, og/twitter descriptions, JSON-LD, `data.json` description/founderBackground/differentiators). No Allstate reference remains.
   - ⚠️ **One thing to eyeball:** the trust-bar stat still reads **"37+ Years of Appraisal Experience."** That 37 = 12 Allstate adjuster years + 25 independent. With Allstate removed, you may want to reword this to **"25+"** or reframe it. Left as-is because it's an owner-set marketing number that wasn't in the change list — your call.
2. **Court in the request form** — ✅ **Removed.** Dropped the "Court / deadline date" *Urgency* option, the conditional court-date field, and its JavaScript. The form no longer references court/litigation anywhere.
3. **Custom domain** — ⚠️ **Not switched — would have broken the live site.** `corbettclaims.net` currently resolves to AWS/Fastly IPs (`15.197.148.33 / 3.33.130.190`) and serves a live site there — it is **not** on GitHub Pages. Pointing this repo's Pages deployment at that domain (via a `CNAME` file) would conflict with the existing host. **To move this site to `corbettclaims.net` later:** (a) repoint the domain's DNS to GitHub Pages (`185.199.108–111.153`), (b) add a `CNAME` file containing `corbettclaims.net`, (c) update the ~6 absolute URLs + `sitemap.xml`/`robots.txt` from the github.io address to `https://corbettclaims.net/`. That's a DNS-side decision, not a repo edit — flagging for when you're ready.
