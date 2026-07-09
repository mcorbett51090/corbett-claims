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

### ✅ Website analytics _(wired — activate when you want it)_

- **What:** **Google Analytics 4** is wired into the site but ships **off**. No script, no cookies, and
  no data are collected until a Measurement ID is pasted in — see [`ANALYTICS.md`](ANALYTICS.md).
- **To turn it on (≈2 min):** create a free GA4 property, copy its `G-XXXXXXXXXX` ID, paste it into the
  single activation line in `analytics.js`, and push. Full steps in [`ANALYTICS.md`](ANALYTICS.md).
- **Note:** GA4 uses a cookie; no consent banner is included (fine for a US-only audience — the
  reasoning and the EU/CA alternatives are documented in `ANALYTICS.md`).

---

## 🛡️ Uptime & maintenance — keeping the site from going down

GitHub Pages is **static hosting on a global CDN (Fastly)** — there's no server that can crash, and its
real-world uptime is very high (~99.9%+). Downtime for a small site almost never comes from GitHub; it
comes from the two things below. The current setup is healthy (verified 2026-07-07): repo **public**,
HTTPS **enforced**, cert **approved**, custom domain wired.

The site is also built to avoid third-party runtime dependencies on purpose — the vehicle dropdowns use
**baked static data** (no live API), and the map/autocomplete run client-side — so an outside service
having a bad day can't take the form down.

### Do these — split by who owns what

**Domain — the site owner's responsibility (GoDaddy):**

- **⭐ Domain auto-renew ON + a valid card on file.** This is the **#1 real risk** — if
  `corbettclaims.com` lapses, the site is unreachable no matter how healthy GitHub is. Keep a current
  email on the GoDaddy account so renewal notices arrive. _(The owner manages GoDaddy, not the developer.)_
- **Don't delete the GoDaddy DNS records** that point at GitHub.

**GitHub account — the developer's responsibility:**

- **Keep the repo public.** It's public now, which is why free Pages works. Flipping it **private** stops
  Pages unless the account is on a paid GitHub plan.
- **Enable 2FA + save the recovery codes**, and keep the account email/phone recoverable. GitHub can lock
  you out if you lose your 2FA device with no recovery codes. (The site stays *up* if you're locked out —
  you just couldn't update it until you regain access.)
- **Don't delete, rename, or archive** the repo, the account, or the repo's **`CNAME`** file — any of
  those breaks the live URL.
- **Resilience (optional, recommended for a business site):** so the site never hinges on one personal
  account, either **add a second trusted admin** to the repo, or **transfer the repo to a free GitHub
  Organization** with 2+ owners. Then losing any one person's access can't strand the site.

> Note: free **public** GitHub Pages has **no billing**, so there's nothing on the GitHub side that can
> "lapse" and take the site down — the GitHub-account risks are all about *account access*, not payment.

### Optional — early warning

- **○ Free uptime monitor** (e.g. **UptimeRobot**, free tier): pings `corbettclaims.com` every ~5 minutes
  and emails/texts you if it's ever unreachable. It doesn't *prevent* downtime, but you'd hear about it
  in minutes instead of from a customer. Setup: create a free account → **Add New Monitor** → type
  **HTTPS**, URL `https://corbettclaims.com`, interval 5 min → add your email/phone as the alert contact.

### Honest bottom line

True 100% uptime doesn't exist anywhere (even the big clouds have outages). But static files + CDN +
auto-renewed HTTPS at **$0 hosting** is about as reliable and low-maintenance as it gets. Nail
**domain auto-renew** and **account security**, and the realistic risks are covered. GitHub's own rare
blips are brief and are something no host lets you avoid.

---

_Priority order: do the **⭐ Recommended** items (they drive being found); the **○ Optional** items can
wait indefinitely._
