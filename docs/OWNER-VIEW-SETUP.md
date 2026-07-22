# Owner view + analytics — setup

The site has a private **Owner Area** modeled on the chateaudelesigny "secret door" pattern.

## How to open it

Click the **©** symbol at the very bottom of the site (in the footer, before "2026 Corbett
Claims…"). It looks like ordinary copyright text, but it's a discreet link to
[`/owner.html`](../owner.html) — a private hub that links out to your Google analytics dashboard.

There's no password. The real lock is on the Google side: the dashboard opens in Google and
requires **Google sign-in**, and only accounts you approve can see the numbers. The `owner.html`
page itself holds **no data** — it's just a launcher — so it's safe that the URL is reachable.
It's also marked `noindex` and disallowed in `robots.txt`, so it stays out of search results.

## What's already done (in the code)

- The footer © is now the secret-door link (`index.html`).
- `owner.html` exists, styled to match the site, with an **Analytics Dashboard** card.
- `robots.txt` excludes `/owner.html` from crawlers.

## What you need to do (in your Google account)

Everything below is **free**. You'll need a Google account, then you set up Google Analytics
(required — it collects the data), and optionally Looker Studio (a nicer-looking dashboard).

Google occasionally renames buttons, so a label may read slightly differently than written here —
the flow is the same.

### 0. A Google account (skip if you already have one)

If the owners already use Gmail, YouTube, or any Google service, that login works — go to step 1.

Otherwise, create one once:

1. Go to <https://accounts.google.com/signup>.
2. Fill in a name, pick a username, set a password, finish the prompts.
3. **Write down the email + password** — this is the account that will "own" the analytics, and
   the only one that can see the dashboard.

Use this **same** Google account for every step below.

### 1. Turn on Google Analytics — required

This is what actually counts your visitors. Until it's on, the site collects nothing (no cookies,
no tracking) and the dashboard has no data.

1. Go to <https://analytics.google.com/> and sign in with your Google account.
2. First time here? Click **Start measuring** (or the **Admin** gear at the bottom-left →
   **Create → Account**).
   - **Account name:** `Corbett Claims` → **Next**. Leave the data-sharing checkboxes at their
     defaults.
3. **Create a property** (a property = one website's data):
   - **Property name:** `Corbett Claims Website`
   - **Reporting time zone:** United States → **Central Time** (Louisiana)
   - **Currency:** US Dollar → **Next**
   - Answer the industry/size questions however you like (they don't affect anything) → **Next**,
     accept the terms.
4. **Set up a data stream:** choose **Web** → and enter:
   - **Website URL:** `https://www.corbettclaims.com`
   - **Stream name:** `Corbett Claims` → **Create stream**.
5. On the stream page you'll see a **Measurement ID** in the top-right — it looks like
   **`G-XXXXXXXXXX`**. Click it to copy.
6. Open [`analytics.js`](../analytics.js) and paste it between the quotes:
   ```js
   var GA4_MEASUREMENT_ID = "G-XXXXXXXXXX"; // ← your ID here
   ```
7. Save, commit, and push (or send the ID to whoever maintains the site and they'll paste it).
   Analytics is now live.
8. **Check it worked — and check it worked _for this site_.**

   Google returns a normal, successful response for a Measurement ID that is wrong, so a typo — or
   pasting the ID of another property you own — produces a page that looks completely healthy while
   collecting nothing, or while quietly filling up somebody else's property. That is not recoverable
   afterwards: analytics history cannot be un-mixed. So do both of these, not just the second:

   1. **Compare the ID character by character** against the one on the Data-stream page from step 5.
      Not "it looks right" — actually compare it.
   2. Open <https://www.corbettclaims.com> in another tab, then in Analytics go to
      **Reports → Realtime**, and **set the Hostname filter to `www.corbettclaims.com`**
      (*Add comparison / filter → Hostname*). You should see 1 active user — you.

   The hostname filter is the whole point of this step. An unfiltered Realtime view will cheerfully
   show you traffic from a *different* website and look exactly like success.

   Data can take ~24h to reach the main reports; Realtime is instant.

9. **Four one-time settings**, all free, all worth doing now:
   - **Admin → Data retention → 14 months** (the default is 2 months, which is shorter than a season).
   - **Leave Google Signals OFF.** It adds advertising-flavoured data collection this site has no use
     for, and it makes requests that can look like a site fault.
   - **Define an internal-traffic filter for your own IP** (*Admin → Data streams → Configure tag
     settings → Define internal traffic*). At this site's traffic level your own visits are a
     material share of the sample.
   - Expect the 404 page to look busy. It is served for every mistyped and stale URL on the domain
     and is heavily crawled by bots; that traffic is not people.

Full analytics notes, including the cookieless / EU-privacy alternatives, are in
[`ANALYTICS.md`](ANALYTICS.md).

### 2. (Optional) A prettier dashboard with Looker Studio

Google Analytics' own screens (what the Owner Area card opens by default) are enough to see visits
and traffic sources. Looker Studio just gives you a cleaner, single-page report you design once.
It's **free** — the standard tier is $0; you do **not** need "Looker Studio Pro."

1. Go to <https://lookerstudio.google.com/> and sign in with the **same** Google account.
2. If prompted, complete the one-time account setup (country + accept terms).
3. Click **Create → Report** (or **Blank Report**).
4. A **"Add data to report"** panel opens. Choose the **Google Analytics** connector.
   - Click **Authorize** if asked, then pick: your **account** (`Corbett Claims`) → your
     **property** (`Corbett Claims Website`) → **Add**.
5. Looker drops in a starter chart. Build out the page however you like — a few good ones:
   - **Add a chart → Scorecard** for **Total users**, another for **Sessions**.
   - **Add a chart → Time series** to see visits over time.
   - **Add a chart → Table** with dimension **Session source / medium** to see where visitors come
     from.
6. Rename the report (top-left, "Untitled Report") to `Corbett Claims — Analytics`.
7. Click **Share** (top-right):
   - Keep it **private** — add only the owners' email addresses under "Add people," **or** leave it
     restricted to just you. **Do not** set it to "Anyone with the link" / public.
8. Get the link: **Share → Copy report link** (or just copy the URL from your browser's address
   bar while viewing the report).
9. Open [`owner.html`](../owner.html), find the **Analytics Dashboard** card, and replace
   `https://analytics.google.com/` in its `href="…"` with your Looker report URL. Save, commit,
   push. Now the © → Owner Area → **Analytics Dashboard** opens your custom report.

## Design notes

- **Why link out instead of an on-site dashboard:** this is a static GitHub Pages site with no
  server-side login. Baking the numbers into a page would put them in public HTML. Linking to
  Google's dashboard keeps the data behind Google's real sign-in, at no cost. (chateaudelesigny
  can host an on-site dashboard because it runs on Cloudflare Pages with Cloudflare Access in
  front — infrastructure this site doesn't use.)
- **Optional future upgrade:** if you ever want the on-site "baked charts" look like
  chateaudelesigny's, we'd add a small monthly job that pulls GA4 totals via the GA4 Data API into
  a committed JSON file the page renders. Not needed for the link-out setup above.
