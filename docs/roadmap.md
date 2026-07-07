# Corbett Claims — Website Roadmap

_Last updated 2026-07-07. Internal planning doc (excluded from search engines via `robots.txt`).
It tracks what's shipped, what's recommended next, and optional nice-to-haves._

---

## ✅ Shipped — live on corbettclaims.com

- Static site on **GitHub Pages**, custom domain **corbettclaims.com** with **HTTPS enforced**.
- Contact form via a **mailto handoff** (no third-party backend) with a two-stage
  **"request sent — we'll reply within one business day"** confirmation.
- **Keyless address autocomplete** — the **US Census geocoder** (exact house-number addresses)
  plus **Photon / OpenStreetMap** (street hints). No API key, no billing, works today.
- **"Use my current location"** GPS button with a coordinate readout (so a visitor can spot a
  VPN skew), a **Clear** button, and an inline **map preview**.
- **Service-area map** (Leaflet / OpenStreetMap) showing the 9 states served.
- Looping **tree-lined road** hero video (blurred + scrimmed) with a poster frame.
- SEO foundations: LocalBusiness structured data, `sitemap.xml`, `robots.txt`
  (with `/docs/` disallowed + AI-crawler allows), and host-agnostic canonical/OG tags.

---

## ⭐ Recommended next — the growth levers (not optional)

These are how customers actually **find** the site. Full detail in [`seo-action-plan.md`](seo-action-plan.md).

1. **Google Search Console** — verify a Domain property, submit the sitemap, and "Request Indexing"
   on the homepage. Wins ranking #1 for **"Corbett Claims"** within days.
2. **Google Business Profile** — the single biggest local-search lever. Needs the owner decision on a
   real (hidden) address + a short video verification. See the SEO plan.
3. **Google reviews** — ask every satisfied client. A top-3 local ranking + conversion signal.
4. **301-redirect `corbettclaims.net`'s _website_ → `corbettclaims.com`** so the two domains don't
   compete. Change only `.net`'s A/CNAME (website) records — **never its email/MX records**.

---

## ○ Optional enhancements — nice-to-have, only if you want them

None of these are needed; the site is fully functional without them. Each lists the trade-off so the
choice is informed.

### ○ Google Places autocomplete _(OPTIONAL — replaces the keyless geocoder)_

- **What:** swap the keyless Census + Photon autocomplete for **Google Places**.
- **Gain:** marginally broader coverage (brand-new addresses, businesses/POIs) and Google's
  session-based type-ahead UX.
- **Cost:** a Google Cloud account with **billing enabled** (a card on file), an API key restricted to
  the domain, and ongoing per-use billing. A low-traffic form stays within Google's recurring free
  monthly credit — but it's a real billing account to set up and watch.
- **Verdict: OPTIONAL.** The current keyless autocomplete already returns exact house-number addresses
  across the U.S. at **zero cost and zero setup**. Only pursue this if you hit a specific address the
  free geocoders miss.
- _This replaces the old `google-places-setup.md`, which has been removed. If you ever do want the key,
  the one-time setup is ~15 min: create a Cloud project, enable billing + the Places API + Maps
  JavaScript API, make a domain-restricted key, and wire it back into the location field._

### ○ Real form-backend confirmation _(OPTIONAL)_

- **What:** replace the mailto handoff with a form service (Web3Forms / Formspree / a serverless function).
- **Gain:** a true **"delivered ✓"** receipt, no dependency on the visitor's email app, plus optional
  spam filtering and file uploads.
- **Cost:** introduces a **third-party service** (against the original "no third party" preference) and
  a free-tier signup.
- **Verdict: OPTIONAL.** The mailto flow works and keeps everything in-house. Revisit only if you want a
  guaranteed delivery receipt.

### ○ Actual LSU hero footage _(OPTIONAL / opportunistic)_

- **What:** if the owner obtains a **licensed LSU-campus drone clip**, it's a one-file drop-in swap for
  the current tree-lined-road hero.
- **Verdict: OPTIONAL.** Genuine LSU footage isn't on free-stock libraries (and would be a trademark
  risk); the current clip is the closest trademark-safe fit.

### ○ Privacy-friendly analytics _(OPTIONAL)_

- **What:** add lightweight analytics (Plausible, Cloudflare Web Analytics, or GA4) to see traffic and
  which pages convert.
- **Verdict: OPTIONAL.** Useful once traffic grows; skip until then.

---

_Priority order: do the **⭐ Recommended** items (they drive being found); the **○ Optional** items can
wait indefinitely._
