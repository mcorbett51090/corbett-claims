# Corbett Claims — SEO Action Plan

_Produced 2026-07-07 via a research-grounded, two-panel + critic + red-team review (FORGE, standard depth). Goal: be found **immediately for the business name now**, and climb for **service+city searches over the following months.**_

> **Read this first.** Statistics in SEO are mostly vendor estimates, not numbers Google publishes — treat percentages here as *directional*. The load-bearing facts (what follows Google's own documentation) are cited. And the honest headline: **nothing here can work until the site is actually live on `corbettclaims.net`** (today it's a GoDaddy parking page). The cutover is prerequisite #0.

---

## Bottom line — if you only do 5 things

In priority order. These are ~80% of the result:

1. **Finish the DNS cutover** so `corbettclaims.net` serves the real site (+ enforce HTTPS). *Nothing ranks until this is done.*
2. **Create/claim & verify a Google Business Profile (GBP).** This is the single biggest lever for a local business being found — bigger than everything on the website combined. (Needs an owner decision — see below.)
3. **Verify the site in Google Search Console, submit the sitemap, and "Request Indexing"** on the homepage — *after* cutover. This gets you ranking #1 for "Corbett Claims" within days.
4. **301-redirect `corbettclaims.com` → `corbettclaims.net`** so the two domains don't compete (leave email/MX untouched).
5. **Start asking every satisfied client for a Google review** — reviews are a top-3 local ranking + conversion signal.

Everything else in this document is refinement on top of these five.

---

## ⚠️ The one decision only the owner can make (do this first)

**A Google Business Profile cannot use a PO Box — even hidden.** Google requires a *real, verifiable physical location* (Ronnie/Annie's home or office), which is then hidden from public view for a service-area business. And as of **July 3, 2026**, verification now usually requires a **live-recorded video walkthrough** of that location showing business proof (equipment, branded vehicle, business cards, files) — not the storefront. [Google: business address rules](https://support.google.com/business/answer/3038177?hl=en-GB) · [Google: video verification](https://support.google.com/business/answer/14271705?hl=en)

**So the owner needs to decide:** *Are you willing to (a) use a real home/office address as the hidden GBP location, and (b) do a short on-camera walkthrough of it to verify?*

- **Yes →** GBP is on the table; it becomes Phase 1's centerpiece.
- **No →** GBP (and the Google Maps "map pack") isn't possible, and there's **no compliant workaround** — a PO Box will get the profile suspended. You'd still win branded search via site indexing + Bing/Apple listings, but you'd forfeit the map pack. Worth understanding the trade before deciding.

There is **no way around this** — it's the gate on your biggest lever, so settle it early.

---

## Honest timeline expectations

| Goal | Realistic timeline | Why |
|---|---|---|
| Rank **#1 for "Corbett Claims"** (branded) | **Days–2 weeks after indexing** | Branded queries have ~zero competition; once indexed + GBP exists, you win your own name fast. |
| Appear in the **map pack** for "auto appraiser Baton Rouge" | **Weeks–months** | Driven by GBP maturity, reviews, proximity. |
| Rank organically for **competitive service+city** terms | **Months** | Requires content depth + reviews + citations building trust over time. Indexing ≠ ranking. |

Source for indexing≠ranking + "submission is a hint, not a guarantee": [Google Search Central](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

---

## Phase 0 — Prerequisites (this week; blockers)

Do these in order. **Do not request indexing or submit the sitemap while the parking page still answers** — Google would cache the wrong content.

| # | Action | Owner | Effort |
|---|---|---|---|
| 0.1 | **Pick the canonical host: apex `corbettclaims.net`** (recommended for a one-word brand). The `www` version 301s to it automatically once both DNS records exist. | You | S |
| 0.2 | **DNS cutover at GoDaddy → GitHub Pages** (the 4 A records + `www` CNAME; re-add the repo `CNAME` file). See `domain-cutover-runbook.md`. | You (GoDaddy) | M |
| 0.3 | **Enforce HTTPS** in the repo's Pages settings once DNS validates (cert auto-issues, can take up to 24h). | Me/You | S |
| 0.4 | **Verify a Search Console *Domain* property** (DNS TXT record — covers http/https + www in one). | You + me | S |
| 0.5 | **Owner GBP decision** (the box above) + freeze ONE business name — `Corbett Claims` (brand) — and identify the real backend address. A keyword-stuffed GBP name is the #1 suspension trigger. | Owner | S |

---

## Phase 1 — Branded fast wins (after cutover; days → ~3 weeks)

**Site side (indexing & duplicate defense):**

| # | Action | Effort | Notes |
|---|---|---|---|
| 1.1 | **Make `rel=canonical` an absolute `https://corbettclaims.net/`** (currently relative). Removes ambiguity now that `.com` + github.io exist. | S | Code change (small PR). |
| 1.2 | **301 `corbettclaims.com` → `corbettclaims.net`** (whole domain, at Webador/its DNS). **Only touch A/CNAME/forwarding — never MX** (M365 email stays put). | S–M | Biggest duplicate-content fix. |
| 1.3 | **Point sitemap.xml + robots.txt `Sitemap:` at the absolute `https://corbettclaims.net/…`, submit the sitemap in GSC, and "Request Indexing" the homepage.** | S | This is what wins branded search fast. |
| 1.4 | **github.io** needs no work — Pages auto-301s it to the custom domain once attached. Don't add a manual noindex. | — | Confirmed [GitHub docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site). |
| 1.5 | **Leaflet map:** lazy-load/defer it so it never blocks page load. Then stop — the page is otherwise fast. | S | Core Web Vitals is a minor tie-breaker, not a big lever. |

**Google Business Profile (if owner said yes) — the centerpiece:**

| # | Action | Effort |
|---|---|---|
| 1.6 | Create (or claim) the profile with the frozen name, real hidden address, correct primary category (confirm in Google's live picker at setup), and a **realistic service area (~2-hour drive of Baton Rouge only — NOT all 9 states)**. Complete 100%: hours (8–5 M–F), phone, website, services, description, photos. | M |
| 1.7 | Pass **video verification** (stage the shot: street sign near the address, then equipment/branded vehicle/business cards). | S |
| 1.8 | Claim the free **Tier-1 listings**: Apple Business Connect, Bing Places, Yelp, Facebook, Foursquare — with **byte-identical NAP** to the site. | S |
| 1.9 | **Launch the review ask** (see Reviews below). | S, ongoing |

> **Why only ~2 hours of service area, not 9 states?** Google's guidance caps a legitimate service-area to roughly a 2-hour drive; a Baton Rouge 2-person firm claiming to serve Illinois in GBP is a suspension flag. The 9-state reach is carried by the **website + content + citations**, not the GBP service-area field. [Google](https://support.google.com/business/answer/9157481?hl=en) · [Sterling Sky](https://www.sterlingsky.ca/the-google-business-profile-2-hour-rule-is-a-myth-why-your-google-verification-is-actually-failing/)

---

## Phase 2 — Discovery search (months; ongoing)

Branded search is won by Phase 0–1. Ranking for "diminished value appraisal Louisiana" etc. needs **content you don't have yet** — a single page can't rank for many distinct intents.

| # | Action | Effort | Impact |
|---|---|---|---|
| 2.1 | Break the one page into **genuine per-service pages** (Damage Estimates / Total-Loss Valuations / Diminished-Value Appraisals) — each with unique copy, its own title/description/canonical, and a `Service` schema node. | L | High (raises the discovery ceiling) |
| 2.2 | Add a **small, bounded** set of high-intent geo/vehicle pages **with real, original content** (e.g. "Diminished Value Appraisal in Baton Rouge", "Heavy Equipment Appraiser Louisiana"). | L | Medium |
| 2.3 | **Reviews velocity** — bake the ask into the report-delivery workflow (link/QR in the closing email, invoice, report cover). | S setup | High, compounding |
| 2.4 | **Niche citations** (adjuster/appraiser associations, expert-witness/vendor directories attorneys use, LA licensing listings) + the **BBB** (B2B trust for insurer/attorney clients). Quality over volume. | M | Medium |
| 2.5 | **Data aggregators** (Data Axle, Neustar Localeze) to propagate one clean NAP to the long tail — better ROI than hand-claiming dozens. | M | Medium |
| 2.6 | **Local links/mentions** — Baton Rouge business-journal mention on the 25-year milestone, Chamber of Commerce, adjuster-association listing. | M | Medium, slow |
| 2.7 | **Measurement loop** — monthly GSC Performance + GBP Insights; fix indexing issues; quarterly GBP compliance self-audit (name/category/address/service-area drift). | S recurring | Compounding |

> **🚫 Do NOT build a programmatic "9 states × 3 services" matrix of near-identical pages.** Swapping a state name into boilerplate is textbook *doorway abuse* and is penalized harder after the 2024–2025 spam updates. Grow pages only where you have genuinely different things to say. [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies)

---

## Critical path (what blocks what)

```
0.1 canonical host ─► 0.2 DNS cutover ─► 0.3 HTTPS ─► 0.4 GSC Domain property
                              │                              │
   0.5 owner GBP decision ────┤                              ▼
                              │              1.1 abs. canonical · 1.2 .com→.net 301 · 1.3 sitemap+index
   (if yes) ─► 1.6 create GBP ─► 1.7 verify ─► 1.8 Tier-1 listings ─► 1.9 reviews
                              │
                              └────────────► 2.x content + citations + reviews (weeks→months)
```

---

## Risk register (most→least severe)

| Risk | Severity | Mitigation |
|---|---|---|
| **GBP suspension** (PO-box address, keyword-stuffed name, 9-state service-area sprawl, duplicate listings, rapid simultaneous edits, incentivized/gated/farmed reviews). Catastrophic for a single-location firm with no backup listing. | 🔴 High | Follow every GBP rule in this plan exactly; real hidden address; frozen brand name; 2-hr service area; stage edits over weeks; reviews 100% policy-compliant. |
| **Owner declines the home address / on-camera verify** → blocks the #1 lever. | 🔴 High | Decide early (box above). Fallback: site indexing + Bing/Apple wins branded search; map pack forfeited. |
| **SEO actions run before cutover** → Google caches the parking page. | 🟠 Med | Strict sequencing — Phase 1 only after 0.2–0.3 are live. |
| **`.com` 301 accidentally breaks M365 email** | 🟠 Med | Change only A/CNAME/forwarding; never the MX records. |
| **Plan overwhelms a 2-person shop → nothing happens** | 🟠 Med | Use the "5 things" list; treat Phase 2 as optional/slow. |
| **B2B clients (adjusters/attorneys) won't leave public reviews** | 🟡 Low | Lead review asks with private owners; treat pro reviews as bonus. |

---

## Myths & waste to skip (money/time savers)

- **FAQPage schema as an SEO tactic** — Google **deprecated FAQ rich results (~May 2026)**. Your existing FAQ schema is fine to keep (still helps users + possibly AI answers) but **don't invest in it for search features**; put schema effort into `LocalBusiness`/`Review` instead. [Search Engine Land](https://searchengineland.com/google-to-no-longer-support-faq-rich-results-476957)
- **IndexNow for Google** — Google doesn't support it (Bing/Yandex only). One GSC sitemap submission is the whole job. [Google community](https://support.google.com/webmasters/thread/278807782/indexnow-implementation?hl=en)
- **"Submit to 100 directories" / 300-listing packages** — citations are now a minor factor and volume packages often *introduce* NAP errors. Do the Tier-1 + aggregators, then stop.
- **Chasing a perfect Core Web Vitals score** on an already-fast static page — it's a tie-breaker, not a big lever, and has no map-pack-specific weight. Fix the Leaflet blocker, done.
- **Faking reviews or `aggregateRating` schema** — spam violation + suspension risk. Only mark up **real** reviews.
- **Trying to rank the GBP in far-state map packs** (Houston, Cleveland) — impossible; the map pack is proximity-weighted. That reach comes from content + citations, not GBP tuning.
- **Meta keywords tag, keyword density, exact-match-domain magic, "LSI keywords"** — myths.

---

## Already done well — leave alone

Your on-page baseline is strong: good `<title>`, meta description, canonical (just make it absolute), Open Graph + Twitter cards, `ProfessionalService` JSON-LD with NAP/hours/area/services, `sitemap.xml`, `robots.txt`, semantic HTML, mobile-responsive, HTTPS via Pages. **The gap is domain/indexing plumbing + off-site (GBP/reviews/citations), not on-page markup.**

---

## Coordination note (schema ↔ GBP)

The site's NAP and `ProfessionalService`/`LocalBusiness` schema must be **byte-identical** to the GBP and every citation (same name, same phone, same public PO-Box address string). When the GBP + social profiles exist, add their URLs to the schema `sameAs`. Keep the *public* address as the PO Box everywhere; the real street address lives only in the GBP backend (hidden).

---

## Sources (load-bearing)

Google Business Profile: [local ranking factors](https://support.google.com/business/answer/7091?hl=en) · [verification](https://support.google.com/business/answer/7107242?hl=en) · [address rules](https://support.google.com/business/answer/3038177?hl=en-GB) · [service areas](https://support.google.com/business/answer/9157481?hl=en) · [video verification](https://support.google.com/business/answer/14271705?hl=en) — Google Search Central: [LocalBusiness schema](https://developers.google.com/search/docs/appearance/structured-data/local-business) · [sitemaps (hint-not-guarantee)](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) · [consolidate duplicates](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [spam/doorway policies](https://developers.google.com/search/docs/essentials/spam-policies) — [GitHub Pages custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) — FAQ deprecation: [Search Engine Land](https://searchengineland.com/google-to-no-longer-support-faq-rich-results-476957) — IndexNow: [Google community](https://support.google.com/webmasters/thread/278807782/indexnow-implementation?hl=en) — 2-hour rule: [Sterling Sky](https://www.sterlingsky.ca/the-google-business-profile-2-hour-rule-is-a-myth-why-your-google-verification-is-actually-failing/).
