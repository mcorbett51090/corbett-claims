# Website Analytics — Corbett Claims

The site is wired for **Google Analytics 4 (GA4)** but ships **turned off**. It stays off — no
tracking script, no cookies, no data collected — until you paste a Measurement ID. Turning it on is
a one-line edit and takes about two minutes.

---

## Turn it on (≈2 minutes)

1. Go to **[analytics.google.com](https://analytics.google.com)** and sign in with the Google account
   you want to own the data.
2. If you don't already have a property: **Admin** (gear, bottom-left) → **Create property** → name it
   "Corbett Claims" → follow the prompts → when asked for a platform, choose **Web** and enter
   `https://www.corbettclaims.com`.
3. Open **Admin → Data streams → (your web stream)**. Copy the **Measurement ID** at the top right — it
   looks like **`G-XXXXXXXXXX`**.
4. Open **`analytics.js`** (in the top folder of the site) and paste that ID between the quotes on the
   activation line:

   ```js
   var GA4_MEASUREMENT_ID = "G-XXXXXXXXXX"; // ← your ID here
   ```

5. Save, commit, and push to `main`. GitHub Pages redeploys in a minute or two, and GA4 will show
   **Reports → Realtime** activity the next time the site is visited.

To turn analytics back **off**, just clear the ID (set it back to `""`) and redeploy.

---

## Where the reports live

Once it's collecting: **analytics.google.com → Reports**.

- **Realtime** — who's on the site right now.
- **Reports → Engagement → Pages and screens** — which pages get the most visits.
- **Reports → Acquisition → Traffic acquisition** — where visitors come from (Google search, direct,
  a link someone shared, etc.).

Give it 24–48 hours after activation before the non-realtime reports fill in.

---

## A note on cookies & consent

GA4 sets a first-party cookie to tell repeat visitors apart. For a US-based small business serving
US clients, running GA4 without a cookie-consent banner is the common, low-friction setup, so **no
banner is included** — this is a deliberate choice to keep the site simple, not an oversight.

If the site ever markets to visitors in the EU/UK (GDPR) or California (CPRA), the correct move is to
add a lightweight consent banner, **or** switch to a cookieless analytics tool (Cloudflare Web
Analytics or Plausible) that needs no banner at all. Either is a small change if the need arises.

---

## How it's built (for a developer)

- `analytics.js` (site root) holds the Measurement ID in **one place** and self-guards: if the ID is
  empty or malformed it `return`s immediately, so an un-activated site loads **zero** Google script and
  sets **zero** cookies.
- It's included via `<script src="/analytics.js" defer>` in the `<head>` of `index.html` and
  `404.html`. Any new page just needs that same one-line include to be covered.
- No build step, no npm dependency, no third-party account required to *ship* — only to *activate*.
