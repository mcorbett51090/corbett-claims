/*
 * Website analytics — Corbett Claims
 * ==================================
 * One file owns the whole analytics stack. There is no build step and no second
 * <script> tag: this file is already included with `defer` in the <head> of
 * index.html and 404.html, and it is deliberately the ONLY activation surface.
 *
 * ---------------------------------------------------------------------------
 * ACTIVATION (see docs/ANALYTICS.md — do NOT treat this as a 2-minute job)
 * ---------------------------------------------------------------------------
 *   GTM_CONTAINER_ID    "GTM-XXXXXXX" — the tag manager container. Tags (incl.
 *                       the GA4 configuration tag) are managed in the GTM
 *                       console by the maintainer service account. THIS IS THE
 *                       CONFIGURED PATH.
 *   GA4_MEASUREMENT_ID  "G-XXXXXXXXXX" — the direct, no-tag-manager path.
 *                       MUTUALLY EXCLUSIVE with GTM: setting both double-counts
 *                       every pageview and every conversion, so it is refused.
 *   CWA_SITE_TOKEN      Cloudflare Web Analytics (optional; currently dormant).
 *
 * All empty  ->  fully dormant: zero network requests, zero cookies, no vendor
 * script fetched. `window.ccAnalytics` is still defined and every call is a safe
 * no-op, so activation needs NO HTML edits.
 *
 * ---------------------------------------------------------------------------
 * HOW THE PII PROTECTION SURVIVES TAG MANAGER — read this before editing
 * ---------------------------------------------------------------------------
 * Tag Manager moves tag configuration OUT of this repository and into a console.
 * That is a deliberate owner decision, and it means a tag can be added, and can
 * start sending data, without any code review. On a site whose main form carries
 * claimant names, addresses, claim numbers and free-text accident descriptions,
 * that is worth being precise about.
 *
 * The protection is therefore placed at the BOUNDARY rather than at the sender:
 *
 *   this file  ->  [schema projection]  ->  dataLayer  ->  GTM  ->  any tag
 *                        ^^^^^^^^^^
 *                  PII is dropped HERE
 *
 * Every value this site publishes is projected through a fixed schema BEFORE it
 * reaches `dataLayer`. A field that is not in the schema is not "filtered out" —
 * it never enters the dataLayer at all. So a tag added in the console later, by
 * anyone, cannot read claimant data out of the dataLayer, because it was never
 * there to read. The console controls WHICH tags fire; this file controls WHAT
 * THEY CAN SEE.
 *
 * Two things this cannot protect, which are console-side and are documented in
 * docs/ANALYTICS.md as such:
 *   1. GTM's built-in {{Page URL}} reads the browser address bar directly and
 *      bypasses the sanitiser below. The GA4 tag must be configured to use the
 *      `page_location` dataLayer variable instead. GTM is also NOT loaded on
 *      404.html for this reason (see below).
 *   2. A tag configured to read the DOM (a Form or Element Visibility trigger,
 *      or a Custom JavaScript variable) can read the form fields directly. No
 *      code in this repo can prevent that. Do not add such a tag on this site.
 */
(function () {
  "use strict";

  /* =========================================================================
   * 1 · Configuration — the only two lines you edit to turn analytics on
   * ========================================================================= */

  // The configured path: tags live in the Tag Manager console, managed by the
  // maintainer service account.
  var GTM_CONTAINER_ID = ""; // "GTM-XXXXXXX"

  // The direct path, kept for the case where Tag Manager is removed. Setting
  // this AND the container ID is refused rather than merged — both would load a
  // GA4 configuration, and every pageview and conversion would be counted twice.
  var GA4_MEASUREMENT_ID = ""; // "G-XXXXXXXXXX"

  // Cloudflare Web Analytics — wired, deliberately NOT enabled (owner decision,
  // 2026-07-22). Leaving this empty costs nothing: GA4 carries every conversion
  // on its own, because Cloudflare Web Analytics supports no custom events.
  //
  // !! SETTING THIS REQUIRES EDITING privacy.html IN THE SAME COMMIT !!
  // privacy.html describes what actually runs. Enabling a second measurement
  // tool without disclosing it puts the site back in the position this whole
  // phase existed to fix: a public privacy statement that is no longer true.
  // scripts/check-analytics-config.sh fails the push if these two disagree.
  var CWA_SITE_TOKEN = "";

  /* =========================================================================
   * 2 · Validators — reject LOUDLY; never silently no-op on a bad value
   * =========================================================================
   * "Not configured" (empty) and "configured but rejected" (non-empty, invalid)
   * must be distinguishable. A validator that silently ignores a rejected value
   * is itself a generator of the exact silent-green failure this file guards.
   */

  // Properties that are real, valid, and NOT this website's. Pasting one of
  // these mixes Corbett Claims traffic into a live property that belongs to a
  // different site, and GA4 history cannot be retroactively cleaned.
  //   G-WX1VSLNYS1 — southernwinecountry.com (live). Reachable from the same
  //                  maintainer login, so it is exactly the ID most likely to
  //                  be pasted here by muscle memory or clipboard.
  //
  // KEEP THIS LIST GROWING. This property is owned by the client's Google
  // account and maintained from a separate one. Every additional property that
  // maintainer login can see appears in the same GA4 property picker, and each
  // one is another valid-looking ID that could land here by mis-click. Google
  // returns a normal response for a wrong-but-valid ID, so nothing would look
  // broken — the site would just feed someone else's property, permanently.
  // Add every other property you own here, and to
  // scripts/check-analytics-config.sh, as they are created.
  var GA4_DENYLIST = ["G-WX1VSLNYS1"];

  var CWA_PLACEHOLDERS = [
    "YOUR_SITE_TOKEN",
    "$SITE_TOKEN",
    "token",
    "PASTE_TOKEN_HERE",
  ];

  // Containers belonging to other sites this maintainer manages. Same reasoning
  // as the measurement-ID denylist: one identity manages tags across several
  // properties, they all appear in the same console picker, and a valid-looking
  // container from another site would load that site's entire tag set here —
  // silently, and looking perfectly healthy. Add every other container here.
  var GTM_DENYLIST = [];

  function validGtmId(v) {
    if (!v) return null;
    if (!/^GTM-[A-Z0-9]{4,10}$/.test(v)) return "format";
    if (/^GTM-(.)\1+$/.test(v)) return "placeholder";
    if (GTM_DENYLIST.indexOf(v) !== -1) return "foreign-container";
    return true;
  }

  // Returns true (valid), null (not configured), or a string reason (rejected).
  function validGa4Id(v) {
    if (!v) return null;
    if (!/^G-[A-Z0-9]{10}$/.test(v)) return "format";
    if (/^G-([A-Z0-9])\1{9}$/.test(v)) return "placeholder"; // G-XXXXXXXXXX etc.
    if (GA4_DENYLIST.indexOf(v) !== -1) return "foreign-property";
    return true;
  }

  // Deliberately permissive. The real token format is not publicly specified,
  // and a guessed-strict regex fails in the DANGEROUS direction: a valid token
  // silently rejected means analytics is silently off.
  function validCwaToken(v) {
    if (!v) return null;
    if (v.length < 16) return "too-short";
    if (/^(.)\1+$/.test(v)) return "placeholder";
    if (CWA_PLACEHOLDERS.indexOf(v) !== -1) return "placeholder";
    return true;
  }

  function reject(label, reason) {
    if (window.console && console.error) {
      console.error(
        "[analytics] REJECTED " +
          label +
          ": " +
          reason +
          " — refusing to load the vendor script. See docs/ANALYTICS.md."
      );
    }
  }

  var gtmCheck = validGtmId(GTM_CONTAINER_ID);
  var ga4Check = validGa4Id(GA4_MEASUREMENT_ID);
  var cwaCheck = validCwaToken(CWA_SITE_TOKEN);

  if (typeof gtmCheck === "string") reject("GTM container id", gtmCheck);
  if (typeof ga4Check === "string") reject("GA4 id", ga4Check);
  if (typeof cwaCheck === "string") reject("Cloudflare site token", cwaCheck);

  var activeGtmId = gtmCheck === true ? GTM_CONTAINER_ID : null;
  var activeGa4Id = ga4Check === true ? GA4_MEASUREMENT_ID : null;
  var activeCwaToken = cwaCheck === true ? CWA_SITE_TOKEN : null;

  // Mutually exclusive, and refused loudly rather than silently merged. Running
  // the container AND a direct GA4 config means two GA4 configurations on the
  // page: every pageview and every conversion counted twice, in a property whose
  // whole purpose is a conversion RATE. A doubled rate looks plausible, which is
  // what makes it dangerous — nothing about the page would appear wrong.
  if (activeGtmId && activeGa4Id) {
    reject(
      "analytics configuration",
      "BOTH a GTM container and a direct GA4 id are set. Tag Manager already " +
        "loads the GA4 configuration tag, so this would double-count every " +
        "pageview and conversion. Clear GA4_MEASUREMENT_ID and configure GA4 " +
        "inside the container instead. Loading NEITHER."
    );
    activeGtmId = null;
    activeGa4Id = null;
  }

  /* =========================================================================
   * 3 · Owner-path guard — TF6 PUBLIC-ONLY (owner decision, 2026-07-21)
   * =========================================================================
   * Analytics must never fire on an owner/internal surface. This runtime guard
   * is the load-bearing control: with no CI, a check script nobody runs is
   * exactly as strong as a comment. Checked at pre-push, ENFORCED here.
   */
  if (/owner/i.test(location.pathname)) return;

  /* =========================================================================
   * 4 · page_location sanitiser — the PII channel no parameter allowlist sees
   * =========================================================================
   * gtag sends the full URL by default. Campaign parameters are the whole
   * reason GA4 is here, so they are preserved; everything else in the query
   * string, and the hash, are dropped.
   *
   * 404.html is the sharp edge: GitHub Pages serves it for EVERY unmatched URL,
   * so the path is whatever a visitor, a stale link or a crawler asked for. A
   * mistyped legacy link like /john-smith-total-loss-4471 would put a claimant
   * name straight into Google. On that page the value is a constant.
   */
  var IS_404 =
    !!document.body && document.body.getAttribute("data-page") === "404";

  var CAMPAIGN_KEYS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "gbraid",
    "wbraid",
    "msclkid",
  ];

  function sanitizedPageLocation() {
    try {
      if (IS_404) return location.origin + "/404";
      var u = new URL(location.href);
      var out = new URL(u.origin + u.pathname); // hash and query dropped
      CAMPAIGN_KEYS.forEach(function (k) {
        if (u.searchParams.has(k)) out.searchParams.set(k, u.searchParams.get(k));
      });
      return out.href;
    } catch (e) {
      return location.origin + "/";
    }
  }

  /* =========================================================================
   * 5 · The event schema — the ONLY thing the sender iterates
   * =========================================================================
   * The sender walks THIS object, never the caller's. An unknown parameter is
   * not "filtered out" — it is unreachable. An unknown event name drops the
   * whole event. This is a positive literal pick, and it fails CLOSED: adding a
   * field to a form does not silently add it to a beacon.
   *
   * enum values are the <option> LABEL strings, because these selects carry no
   * value attributes (index.html:623, :635, :715). A copy edit to an <option>
   * therefore drops that value from the event rather than transmitting a new
   * one — fails closed and visibly, which is the correct direction.
   */
  var EQUIPMENT_TYPES = [
    "Auto / Light truck",
    "Motorcycle",
    "RV / Motorhome / Trailer",
    "Heavy farm equipment",
    "Other",
  ];
  var ASSIGNMENT_TYPES = [
    "Damage estimate",
    "Total-loss valuation",
    "Diminished-value appraisal",
    "Other",
  ];
  var LOSS_TYPES = [
    "Collision",
    "Fire",
    "Theft",
    "Vandalism",
    "Flood / Water",
    "Hail",
    "Weather / Storm",
    "Comprehensive",
    "Total loss",
    "Other",
  ];
  var CSP_DIRECTIVES = [
    "default-src",
    "script-src",
    "script-src-elem",
    "script-src-attr",
    "style-src",
    "style-src-elem",
    "style-src-attr",
    "img-src",
    "connect-src",
    "font-src",
    "frame-src",
    "object-src",
    "media-src",
    "worker-src",
    "manifest-src",
    "base-uri",
    "form-action",
  ];

  var SCHEMA = {
    generate_lead: {
      form_name: { type: "const", value: "appraisal_request" },
      equipment_type: { type: "enum", values: EQUIPMENT_TYPES },
      assignment_type: { type: "enum", values: ASSIGNMENT_TYPES },
      loss_type: { type: "enum", values: LOSS_TYPES },
      file_count: { type: "int", min: 0, max: 99 },
      files_failed: { type: "int", min: 0, max: 99 },
    },
    upload_complete: {
      form_name: { type: "const", value: "appraisal_request" },
      file_count: { type: "int", min: 0, max: 99 },
      files_failed: { type: "int", min: 0, max: 99 },
    },
    contact_click: {
      contact_method: { type: "enum", values: ["tel", "mailto"] },
    },
    lead_fallback_mailto: {},
    lead_over_cap: {},
    csp_violation: {
      effective_directive: { type: "enum", values: CSP_DIRECTIVES },
    },
  };

  /* =========================================================================
   * 6 · Shape guard — the backstop for a correctly-added, wrongly-wired key
   * =========================================================================
   * Catches a future contributor who adds a legitimate schema entry but points
   * it at a leaky source. ANY hit drops the ENTIRE event, not just the value.
   *
   * !! DO NOT DELETE THIS AS DEAD CODE !!
   * With today's schema this guard is UNREACHABLE, and that is by design, not by
   * accident: every current type already constrains its output to a safe set —
   * `const` emits a literal, `enum` emits only an exact member, `int` emits a
   * clamped number. Nothing PII-shaped can reach the guard through them.
   *
   * A coverage report will therefore show this branch never firing. It exists
   * for the moment someone adds a freer type (a `string` param, a raw
   * pass-through) and wires it to a field that turns out to carry claimant data.
   * That is precisely when a backstop is worth having and precisely when nobody
   * remembers to add one. Removing it because it "never runs" would delete the
   * protection at the exact moment it starts to matter.
   */
  var LEAK_PATTERNS = [
    /[@]/, // email
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/, // phone
    /\b\d{5}(-\d{4})?\b/, // US ZIP
  ];

  window.__ccAnalyticsDropped = window.__ccAnalyticsDropped || 0;

  function looksLikePii(value) {
    var s = String(value);
    if (s.length > 100) return true;
    for (var i = 0; i < LEAK_PATTERNS.length; i++) {
      if (LEAK_PATTERNS[i].test(s)) return true;
    }
    return false;
  }

  function clampInt(v, min, max) {
    var n = parseInt(v, 10);
    if (!isFinite(n)) return null;
    if (n < min) n = min;
    if (n > max) n = max;
    return n;
  }

  /* =========================================================================
   * 7 · Projection + send
   * ========================================================================= */

  function project(eventName, raw) {
    var spec = SCHEMA[eventName];
    if (!spec) return null; // unknown event -> dropped whole
    var input = raw || {};
    var out = {};

    // Iterate the SCHEMA. Never `for (k in input)`.
    for (var key in spec) {
      if (!Object.prototype.hasOwnProperty.call(spec, key)) continue;
      var rule = spec[key];
      var value;

      if (rule.type === "const") {
        value = rule.value;
      } else if (rule.type === "enum") {
        var candidate = input[key];
        // Omitted, never defaulted, on a non-member.
        if (rule.values.indexOf(candidate) === -1) continue;
        value = candidate;
      } else if (rule.type === "int") {
        var n = clampInt(input[key], rule.min, rule.max);
        if (n === null) continue;
        value = n;
      } else {
        continue;
      }

      if (looksLikePii(value)) {
        window.__ccAnalyticsDropped++;
        return null; // drop the ENTIRE event
      }
      out[key] = value;
    }
    return out;
  }

  // Every key any schema can emit. Used to null out stale values before each
  // push: GTM's dataLayer variables resolve to the most RECENT value, so a key
  // set by an earlier event would otherwise still be readable during a later
  // one, and a tag would report a value that belonged to a different event.
  var ALL_SCHEMA_KEYS = (function () {
    var seen = {};
    for (var ev in SCHEMA) {
      if (!Object.prototype.hasOwnProperty.call(SCHEMA, ev)) continue;
      for (var k in SCHEMA[ev]) {
        if (Object.prototype.hasOwnProperty.call(SCHEMA[ev], k)) seen[k] = true;
      }
    }
    return Object.keys(seen);
  })();

  function track(eventName, rawParams) {
    try {
      var params = project(eventName, rawParams);
      if (params === null) {
        if (!SCHEMA[eventName]) window.__ccAnalyticsDropped++;
        return;
      }

      // Tag Manager path. `params` is already projected, so the dataLayer only
      // ever receives allowlisted values — which is the whole reason a tag
      // added later in the console cannot read claimant data out of it.
      if (activeGtmId && window.dataLayer) {
        var payload = { event: eventName };
        // Clear every schema key first, then set this event's values.
        for (var i = 0; i < ALL_SCHEMA_KEYS.length; i++) {
          payload[ALL_SCHEMA_KEYS[i]] = undefined;
        }
        for (var k in params) {
          if (Object.prototype.hasOwnProperty.call(params, k)) payload[k] = params[k];
        }
        window.dataLayer.push(payload);
        return;
      }

      // Direct path (no tag manager).
      if (!activeGa4Id || typeof window.gtag !== "function") return;
      window.gtag("event", eventName, params);
    } catch (e) {
      /* analytics must never affect the page it measures */
    }
  }

  // Always defined, even when fully dormant, so index.html calls it
  // unconditionally and activation requires zero HTML edits.
  window.ccAnalytics = {
    track: track,
    ready: function () {
      return !!(activeGtmId || activeGa4Id);
    },
  };

  /* =========================================================================
   * 8 · Loaders — both beacons at THIS execution point (~DOMContentLoaded)
   * =========================================================================
   * Deliberately NOT wrapped in window.load / requestIdleCallback. Deferring
   * past load drops the pageview for every early-abandon visit, which removes
   * non-converting sessions from the denominator and silently inflates the
   * conversion rate — the one number GA4 is here to produce.
   *
   * The two beacons share a trigger point on purpose: uncorrelated timing would
   * open a mechanical gap between the two counts that reads exactly like a data
   * anomaly worth investigating.
   */

  // ---------------------------------------------------------------------------
  // Tag Manager
  // ---------------------------------------------------------------------------
  // NOT loaded on 404.html. That page is served for every unmatched URL, so the
  // address bar holds whatever was requested — a stale link like
  // /john-smith-total-loss-4471 puts a claimant name in the URL. This file can
  // sanitise what IT sends, but it cannot stop a tag in the console from reading
  // the address bar directly via the built-in {{Page URL}} variable. The only
  // reliable control is not to run the container on that page at all. 404 traffic
  // is overwhelmingly bots anyway, so nothing of value is lost.
  if (activeGtmId && !IS_404) {
    window.dataLayer = window.dataLayer || [];

    // Consent defaults must be in the dataLayer BEFORE the container loads, or
    // the first tags fire under Google's built-in defaults instead of ours.
    window.dataLayer.push({
      "gtm.start": new Date().getTime(),
      event: "gtm.js",
    });
    function gtagDl() {
      window.dataLayer.push(arguments);
    }
    gtagDl("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
    });

    // The sanitised address, published as a dataLayer value so the GA4 tag in
    // the console can be pointed at it INSTEAD of the built-in {{Page URL}}.
    // See docs/ANALYTICS.md — this is a console-side setting and is the one part
    // of the URL protection that code here cannot enforce.
    window.dataLayer.push({ page_location: sanitizedPageLocation() });

    var t = document.createElement("script");
    t.async = true;
    t.src =
      "https://www.googletagmanager.com/gtm.js?id=" +
      encodeURIComponent(activeGtmId);
    document.head.appendChild(t);
  }

  if (activeGa4Id) {
    var g = document.createElement("script");
    g.async = true;
    g.src =
      "https://www.googletagmanager.com/gtag/js?id=" +
      encodeURIComponent(activeGa4Id);
    document.head.appendChild(g);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;

    // Consent Mode v2 defaults MUST be pushed before `config`, or the first
    // page_view is measured under gtag's built-in defaults instead of these.
    //
    // analytics_storage:'granted' is deliberate. No banner ships, so these
    // defaults are permanent — and 'denied' would send only cookieless pings,
    // which GA4 excludes from reports below a modelling threshold this site
    // will never reach. 'denied' here would mean collecting nothing usable.
    // The three advertising signals stay denied: this site does not advertise.
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
    });

    gtag("js", new Date());
    gtag("config", activeGa4Id, {
      page_location: sanitizedPageLocation(),
      anonymize_ip: true,
    });
  }

  if (activeCwaToken) {
    // Cloudflare's beacon discovers its own config via
    // `document.currentScript || document.querySelector('script[data-cf-beacon]')`,
    // so data-cf-beacon must be set BEFORE the element is appended. Exactly one
    // such element per page, ever.
    if (!document.querySelector("script[data-cf-beacon]")) {
      var c = document.createElement("script");
      c.defer = true;
      c.src = "https://static.cloudflareinsights.com/beacon.min.js";
      c.setAttribute("data-cf-beacon", JSON.stringify({ token: activeCwaToken }));
      document.head.appendChild(c);
    }
  }

  /* =========================================================================
   * 9 · Delegated listeners
   * ========================================================================= */

  // contact_click — one delegated listener, no per-anchor wiring, so anchors
  // injected at runtime (the mailto fallback injects some) are covered too.
  document.addEventListener(
    "click",
    function (ev) {
      try {
        var a = ev.target && ev.target.closest && ev.target.closest("a[href]");
        if (!a) return;
        var href = a.getAttribute("href") || "";
        var method =
          href.indexOf("tel:") === 0
            ? "tel"
            : href.indexOf("mailto:") === 0
            ? "mailto"
            : null;
        if (!method) return;
        // Only contact_method is sent. The href itself is never transmitted:
        // a mailto: href can carry a pre-filled body containing claim details.
        track("contact_click", { contact_method: method });
      } catch (e) {
        /* never interfere with the click */
      }
    },
    true
  );

  // csp_violation — ships regardless of whether a CSP is deployed. A <meta> CSP
  // has no report-uri channel and this repo has no CI, so this listener is the
  // only feedback path that exists if a policy ever blocks something. Only the
  // directive NAME is sent; blocked URIs can contain query strings.
  window.addEventListener("securitypolicyviolation", function (ev) {
    try {
      track("csp_violation", {
        effective_directive: ev.effectiveDirective || ev.violatedDirective,
      });
    } catch (e) {
      /* never let the reporter become the problem */
    }
  });
})();
