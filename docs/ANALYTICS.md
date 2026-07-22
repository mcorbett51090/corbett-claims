# Website Analytics — Corbett Claims

> **This file is served publicly** (`https://www.corbettclaims.com/docs/ANALYTICS.md` returns 200, and
> the `robots.txt` disallow is advisory only). Anything untrue in here is untrue in public. It said
> "no tracking script, no cookies, no data collected" for as long as that was true; it says what
> follows now because that is what is true now.

The site is wired for **Google Analytics 4**. It ships **off** and stays off — no script, no cookies,
no data — until a Measurement ID is pasted into `analytics.js`.

**Cloudflare Web Analytics is also wired, and is deliberately NOT enabled** (owner decision,
2026-07-22). It costs nothing to leave dormant: GA4 carries every conversion on its own, because
Cloudflare Web Analytics supports no custom events at all.

---

## What GA4 is here for — and what it is NOT here for

This matters more than any setting below, because getting it wrong makes the numbers actively
misleading.

**GA4 is here for the conversion _rate_ and for channel attribution.** How many of the people who
arrive actually send a request, and which sources those people came from.

**GA4 is NOT the lead count.** The Cloudflare Worker already delivers every genuine submission to the
inbox, so the inbox is a complete and accurate ledger of leads. GA4's number will always be *lower* —
ad blockers, privacy browsers, disabled JavaScript, and visitors who leave before the page finishes
parsing all remove conversions from GA4 that the inbox still receives.

> **If the question is "how many leads did I get", the inbox is the right instrument and GA4 is the
> wrong one.** If the question is "is the SEO work producing leads, and from where", GA4 is the only
> tool here that can answer it, because it is the only one that sees the people who *didn't* convert.

### The calibration ratio — do this once, in the first month

For the first month, count the delivered claim emails and divide GA4's `generate_lead` total by that
number. Record the ratio here. Thereafter GA4 is read as attribution and trend, calibrated against a
denominator you know is complete.

    Calibration ratio (GA4 generate_lead ÷ delivered claim emails): ____ , measured ____________

Until that ratio exists, **GA4's conversion count is never quoted as a count.**

---

## Turning it on (~15 minutes, not two)

1. Go to **[analytics.google.com](https://analytics.google.com)** and sign in with the Google account
   that should own the data.
2. **Admin → Create property** → name it "Corbett Claims" → platform **Web** → Website URL
   `https://www.corbettclaims.com`.
3. Open **Admin → Data streams → (the web stream)** and copy the **Measurement ID** (`G-XXXXXXXXXX`).
4. Paste it into the activation line in **`analytics.js`**:

   ```js
   var GA4_MEASUREMENT_ID = "G-XXXXXXXXXX";
   ```

5. **Verify it before you trust it** — see the next section. This is the step people skip.
6. Commit and push. GitHub Pages redeploys in a minute or two, but the CDN caches for ten
   (`cache-control: max-age=600`), so allow **~11 minutes** before concluding anything from what you
   see in a browser.

To turn analytics **off**, clear the ID back to `""` and push. That stops all future collection; it
does not delete data already in the property.

### Verify it — "the script loaded" proves nothing

`googletagmanager.com` returns **HTTP 200 for a completely bogus Measurement ID**. A typo therefore
produces a page that looks perfectly healthy in every way while collecting nothing at all — or, worse,
collecting into a property that is not this website's.

So the acceptance test is **not** "the script loaded" and **not** "no console errors". It is:

- The ID in `analytics.js` matches the Data-stream ID **character for character**, and
- **GA4 → Reports → Realtime, filtered to Hostname = `www.corbettclaims.com`**, shows your own visit.

The hostname filter is the part that catches the dangerous mistake. A Realtime view that names no
property will happily show you traffic from a *different* site and look like success.

`analytics.js` refuses, loudly in the console, to load anything if the ID is malformed, is a
placeholder shape, or is a known other property of ours.

---

## Cookies, consent, and the choice not to show a banner

GA4 sets a first-party cookie (`_ga`, plus one beginning `_ga_`) to tell a returning visitor from a new
one. It sets one **because `analytics_storage` defaults to `granted`** here, which is a deliberate
choice explained below.

**No cookie-consent banner is shown.** For a US business serving US clients this is the common,
low-friction posture, and it remains a deliberate decision rather than an oversight.

**Consent Mode v2 is wired anyway**, with these permanent defaults:

| Signal | Default | Why |
|---|---|---|
| `analytics_storage` | `granted` | see below |
| `ad_storage` | `denied` | this site does not advertise |
| `ad_user_data` | `denied` | " |
| `ad_personalization` | `denied` | " |

Consent Mode v2's obligations are **EEA-scoped**, so wiring it here is **future-proofing, not
compliance**. Having it in place means a banner can be added later without a rewrite.

### Why `granted` and not `denied`

Setting `analytics_storage: 'denied'` sounds strictly more private, and it is tempting. Its real
effect at this site's traffic level is that **you collect nothing usable**: denied-mode sends only
cookieless pings, and Google excludes those from reports unless the property clears a behavioural
modelling threshold (on the order of a thousand consented users a day, for a week) that this site will
never approach. The events would be sent and then discarded.

Because no banner ships, no consent update ever fires, so **these defaults are permanent** — there is
no later moment at which `denied` would be upgraded. The one-word change is:

```js
analytics_storage: "denied",   // privacy-maximal; collects nothing usable at this traffic level
```

That is an honest option. It is just not a free one, and the cost is "the analytics stop working",
not "the analytics get a bit fuzzier".

---

## Google Tag Manager — and the four rules that come with it

Tags are managed in a **Google Tag Manager** container by the maintainer service account, rather than
being written into this repository. The site loads the container; the container decides what fires.

That is a real trade, and it is worth being plain about both halves. It buys the ability to add or
change a tag without a code deploy. It costs the guarantee that everything running on this site went
through code review — **the console is a deployment surface**, and a tag added there starts sending
data on the next page load.

On a site whose main form carries claimant names, addresses, claim numbers and free-text accident
descriptions, that matters more than it would on a brochure site. So the protection was moved rather
than dropped:

```
this site  ->  [schema allowlist]  ->  dataLayer  ->  GTM  ->  any tag
                    ^^^^^^^^^^^^^
                 PII is dropped here
```

Everything this site publishes is filtered through a fixed list of permitted values **before** it
reaches the dataLayer. A tag added in the console later cannot read a claimant's name out of the
dataLayer, because the name was never put there. **The console controls which tags fire; the site
controls what they can see.**

### Four rules. The first two are console settings that code here cannot enforce.

**1. Point the GA4 tag at the `page_location` dataLayer variable, not `{{Page URL}}`.**
`{{Page URL}}` reads the browser address bar directly and bypasses the sanitiser. The site publishes
a cleaned address into the dataLayer as `page_location`; create a Data Layer Variable for it and set
it as the `page_location` field on the GA4 configuration tag. Without this, campaign attribution
still works, but the URL protection does not.

**2. Never add a tag, trigger, or variable that reads the form.** Specifically: no Form Submission
triggers on the appraisal form, no Element Visibility triggers on its fields, and no Custom JavaScript
variable that queries the DOM. Any of those can read claimant data directly, and **no code in this
repository can stop it.** The conversion events you need are already published to the dataLayer —
`generate_lead`, `upload_complete`, `contact_click` — and they are already safe. Use those.

**3. One container, this site only.** The container ID lives in `analytics.js` and is validated. A
container belonging to another site would load that site's entire tag set here, silently, looking
perfectly healthy. Add every other container you manage to `GTM_DENYLIST` in `analytics.js`.

**4. Do not also set `GA4_MEASUREMENT_ID`.** The container already loads the GA4 configuration. Both
together means two GA4 configurations on the page and every pageview and conversion counted twice — a
doubled conversion *rate* looks entirely plausible, which is what makes it dangerous. `analytics.js`
refuses to load either one if both are set, and says why.

### What the site publishes to the dataLayer

| dataLayer `event` | Fires when | Values published alongside it |
|---|---|---|
| `generate_lead` | a request is delivered | `form_name`, `equipment_type`, `assignment_type`, `loss_type`, `file_count`, `files_failed` |
| `upload_complete` | files were delivered | `form_name`, `file_count`, `files_failed` |
| `contact_click` | a phone or email link is clicked | `contact_method` |
| `lead_fallback_mailto` | the secure path failed *(diagnostic)* | — |
| `lead_over_cap` | the size cap was hit *(diagnostic)* | — |
| `csp_violation` | a content-security-policy blocked something | `effective_directive` |

Build GA4 Event tags on Custom Event triggers matching those names. Every value above is already
allowlisted; nothing else is available, by design.

**Tag Manager is not loaded on `404.html`.** That page is served for every mistyped and stale URL on
the domain, so the address bar can contain anything — including a name, from an old emailed link. The
sanitiser covers what the *site* sends, but not what a console tag reads from the address bar, so the
container simply does not run there. 404 traffic is overwhelmingly bots; nothing of value is lost.

## What is and is not sent

Events are built from a fixed schema. The code walks **the schema**, never the object handed to it, so
a value that is not in the schema is not "filtered out" — it is unreachable.

| Event | Parameters |
|---|---|
| `page_view` | page address, stripped to origin + path + campaign parameters only |
| `generate_lead` | `form_name`, `equipment_type`, `assignment_type`, `loss_type`, `file_count`, `files_failed` |
| `upload_complete` | `form_name`, `file_count`, `files_failed` |
| `contact_click` | `contact_method` (`tel` or `mailto`) |
| `lead_fallback_mailto` | *(none — diagnostic)* |
| `lead_over_cap` | *(none — diagnostic)* |
| `csp_violation` | `effective_directive` |

**Never sent:** any name, address, claim number, date of loss, phone number, email address, the
free-text message, or any filename.

Three details worth knowing:

- **The allowlist fails closed.** The three enums are matched against the exact `<option>` labels. If
  someone edits an option's wording without updating the schema, that value stops appearing in GA4
  rather than leaking something unexpected — you see a visible gap, which is the correct direction to
  fail in.
- **`files_failed` counts failure _entries_**, which is one per failed file plus at most one aggregate
  entry for a batch that expired before sending. It is a diagnostic, not a precise file tally.
- **`file_count` is the DELIVERED count**, taken from the server's response — not the number of files
  the visitor selected. Those genuinely differ when an upload partially fails.

### The two diagnostic events are the early-warning system

`lead_fallback_mailto` fires whenever a submission falls back to opening the visitor's email app: the
secure upload being switched off, a bot-check failure, a Worker outage, a failed script load, or a
stalled upload. In every one of those cases **you still receive the lead by email, while analytics
records no conversion.**

If that number is non-zero and rising, the secure intake is degrading — and without it, "a quiet week"
and "the intake has been broken all week and every lead arrived with no photos" look identical.

---

## Known limits, stated rather than discovered later

**Ad blockers block both tools.** Google Analytics is blocked by common blocklists — and so is
Cloudflare Web Analytics, which appears on the same lists. Neither is an "ad-block-resistant" fallback
for the other, and their failures are correlated rather than independent. This is the main reason GA4's
conversion count runs below the inbox's.

**Visits that leave before the page finishes parsing are never counted.** Both beacons start at the
point the page's deferred scripts run. This is a floor common to all client-side analytics on this
site and is not expected to move the reported rate meaningfully. It is deliberately *not* fixed by
delaying the beacons further — deferring them to the `load` event would drop *more* early visits, and
because those visitors essentially never convert, it would remove them from the denominator and
silently inflate the conversion rate.

**No Content-Security-Policy — accepted, in writing, on purpose.** Adding an analytics beacon adds a
new place the browser is allowed to send data to, and the usual control for that is a
Content-Security-Policy. This site ships none, and this change deliberately did not add one.

The reason is that a policy could not be safely tested. On GitHub Pages a policy can only be
delivered in a `<meta>` tag, which cannot be run in report-only mode — so there is no way to observe
what a policy *would* have blocked before it starts blocking it for real. The only staging channel
available was a Cloudflare Pages copy of the site, which is out of scope for now. A policy pushed
straight to production without that rehearsal risks blocking the claim-delivery worker or the file
uploads, and the failure would be silent for the visitor and invisible to us.

Weighed honestly: the site has never had a policy, so shipping without one is not a regression — it
is the status quo plus two well-known vendor origins. A policy that breaks the claim form is a
materially worse outcome than no policy at all, because the form is the entire point of the site.

**This is an accepted risk, not an oversight, and it has a review trigger.** Revisit when any of
these becomes true: the Cloudflare preview copy is available again for a report-only rehearsal;
continuous integration exists in this repo to keep a policy from going stale; or another third-party
script is added. The `csp_violation` reporting listener already ships in `analytics.js`, so the
feedback channel is in place the day a policy is introduced.

**No subresource integrity on the analytics scripts.** SRI pins a hash to an exact file, and both
vendors serve versionless URLs that are updated in place, so a pinned hash would break the moment the
vendor shipped an update — a hard network failure, not a graceful one. Contrast Leaflet, which *is*
version-pinned (`leaflet@1.9.4`) and therefore *is* SRI-hashed on this site: that is what makes this
exemption a considered limit rather than a convenient one. The same posture already applies to
Cloudflare's versionless bot-check script. The compensating controls are the origin restrictions in
the content-security policy and `scripts/check-vendor-drift.sh`.

---

## For a developer

- **`analytics.js`** owns everything: both IDs, their validators, the owner-page guard, the consent
  defaults, the page-address sanitiser, both loaders, the schema allowlist, the shape guard, the
  public `window.ccAnalytics` API, and the click / policy-violation listeners.
- It is included with `defer` in the `<head>` of `index.html`, `404.html` and `privacy.html`. Any new
  page needs that one line, and nothing else.
- **`owner.html` deliberately has no analytics** and must not gain any — enforced at runtime by a path
  guard in `analytics.js`, and checked at pre-push.
- **`404.html` reports a constant page address.** It is served for every unmatched URL, so its real
  path is whatever was requested — a stale link like `/john-smith-total-loss-4471` would otherwise put
  a name into Google.
- Run before pushing: `scripts/check-vendor-drift.sh`, `scripts/check-analytics-config.sh`, and
  `node scripts/test-analytics-pii.js` (27 assertions that PII cannot escape). A `pre-push` hook runs
  all three if installed. **They are convenience checks, not controls** — this repo has no CI, so a
  script nobody runs is exactly as strong as a comment. The real controls are in `analytics.js`.
- **Enabling Cloudflare Web Analytics requires editing `privacy.html` in the same commit.** The check
  script fails the push if a token is set and the policy does not describe it.

Full setup walkthrough, including the account steps: [`OWNER-VIEW-SETUP.md`](OWNER-VIEW-SETUP.md).
