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

## Open questions for the owner (please confirm)

1. **Allstate credential** — your list removed the hero *badge* ("Ex-Allstate Adjuster") and the *headline* only. The Allstate history is still in the "Meet the Owners" bio and the founder's background copy. We **kept** it there (that's what your list implied). Say the word if you want it scrubbed everywhere.
2. **Remaining "Court" bits in the request form** — you removed the **"Court / expert witness"** *Assignment Type*. The form still has a **"Court / deadline date"** *Urgency* option and a court-date field that appears when it's picked. Your list didn't mention those — want them removed too for consistency?
3. **Custom domain** — social/canonical URLs and the sitemap are hardcoded to the GitHub Pages address (`mcorbett51090.github.io/corbett-claims`). If you point a custom domain (e.g. `corbettclaims.net`) at the site, those need updating.
