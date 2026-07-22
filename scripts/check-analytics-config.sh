#!/usr/bin/env bash
# Analytics configuration + safety checks.
#
# Wire to a pre-push hook. This is a CONVENIENCE check, not a control: this repo
# has no CI, so a script nobody runs is exactly as strong as a comment. The
# load-bearing controls are in analytics.js itself (the runtime owner-path guard,
# the schema projection, the shape guard). Say "checked at pre-push, enforced at
# runtime" — never "structural" — about anything enforced only here.
#
# WHY EVERY CHECK STRIPS COMMENTS FIRST
# -------------------------------------
# The plan's original definition-of-done asserted these facts with plain greps
# (e.g. `grep -c 'requestIdleCallback' analytics.js` -> 0). That is wrong, and it
# broke three times during the build: analytics.js is REQUIRED to carry comments
# explaining why the load-gate was removed and why the caller's object must never
# be iterated, so a literal grep matches the documentation and reports a defect
# that does not exist. Worse, the same class of test reported "present" on a tree
# where a real attribute had been deleted.
#
# The first version of THIS script got it half right: it stripped comments for
# "structural" checks but asserted string facts (the denylist entry, the 404
# marker) against the raw file, on the reasoning that prose matches were harmless
# there. That reasoning was wrong, and mutation testing caught it — deleting the
# denylist entry and deleting the data-page marker each left an explanatory
# comment containing the same string, so both checks passed on a broken tree.
#
# EVERY check below runs against comment-stripped source, JS and HTML alike, and
# every one has been observed failing on a deliberately mutated tree. If you add
# a check, add its mutant too — an unfalsified check is decoration.
set -uo pipefail

cd "$(dirname "$0")/.."
fail=0
pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=1; }

# node is REQUIRED. Stripping comments correctly needs a real pass over the file,
# and a raw-source check here is actively misleading rather than merely weaker,
# so refusing to run beats reporting a pass that means nothing.
command -v node >/dev/null 2>&1 || {
  echo "node not found — refusing to run: a raw-source check would report a"
  echo "misleading pass (see this script's header)."
  exit 2
}

strip_js() {
  node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");
    process.stdout.write(s.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,""))' "$1"
}
strip_html() {
  node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");
    process.stdout.write(s.replace(/<!--[\s\S]*?-->/g,""))' "$1"
}

JS_ANALYTICS="$(strip_js analytics.js)"
H_INDEX="$(strip_html index.html)"
H_404="$(strip_html 404.html)"
H_OWNER="$(strip_html owner.html)"

echo "analytics config checks"
echo

# ---------------------------------------------------------------------------
# 1 · Structural facts about analytics.js
# ---------------------------------------------------------------------------

# The sender must iterate the SCHEMA, never the caller's object. This is the
# one-line proof that an unknown parameter is unreachable rather than filtered.
if grep -qE 'for *\(var key in spec\)' <<<"$JS_ANALYTICS"; then
  pass "sender iterates the schema"
else
  bad "sender no longer iterates the schema — the allowlist may be bypassable"
fi

if grep -qE 'for *\([^)]*in +(raw|input|rawParams)\)|Object\.assign|\.\.\.raw|Object\.(keys|entries)\((raw|input)\)' <<<"$JS_ANALYTICS"; then
  bad "analytics.js iterates or spreads the CALLER's object — allowlist fails OPEN"
else
  pass "caller's object is never iterated or spread"
fi

# G4b: both beacons load at top-level execution. A load/idle wrapper drops the
# pageview for early-abandon visits and silently inflates the conversion rate.
if grep -qE "requestIdleCallback|addEventListener\(['\"]load['\"]" <<<"$JS_ANALYTICS"; then
  bad "a load/idle gate is back in analytics.js — conversion rate will be inflated"
else
  pass "no load/idle gate (beacons fire at ~DOMContentLoaded)"
fi

# Consent defaults must be pushed before config, or the first page_view is
# measured under gtag's built-in defaults instead of ours.
cdef=$(grep -n 'consent", "default"\|consent'"'"', '"'"'default'"'"'' <<<"$JS_ANALYTICS" | head -1 | cut -d: -f1)
ccfg=$(grep -n 'gtag("config"\|gtag('"'"'config'"'"'' <<<"$JS_ANALYTICS" | head -1 | cut -d: -f1)
if [ -n "$cdef" ] && [ -n "$ccfg" ] && [ "$cdef" -lt "$ccfg" ]; then
  pass "consent defaults precede config"
else
  bad "consent default does not precede gtag config (default=$cdef config=$ccfg)"
fi

# The shape guard is the backstop for a correctly-added, wrongly-wired key.
# Assert it is INVOKED, not merely defined: a mutant that replaced the call with
# `if (false)` while leaving `function looksLikePii` in place passed the earlier
# presence-only version of this check.
if grep -qE 'if *\(looksLikePii\(' <<<"$JS_ANALYTICS"; then
  pass "shape guard is invoked on every emitted value"
else
  bad "shape guard no longer invoked — a schema key wired to a leaky source would egress"
fi

# ---------------------------------------------------------------------------
# 2 · RT-3 — the foreign-property denylist
# ---------------------------------------------------------------------------
# G-WX1VSLNYS1 is southernwinecountry.com: live, same Google account, and it
# passes every format validator, every PII test, every cookie test, and a GA4
# Realtime check that does not name a property. It must be refused by name.
if grep -qE 'GA4_DENYLIST *=.*G-WX1VSLNYS1' <<<"$JS_ANALYTICS"; then
  pass "foreign-property denylist is armed"
else
  bad "G-WX1VSLNYS1 missing from the analytics.js denylist (RT-3)"
fi

if grep -qE 'GA4_MEASUREMENT_ID *= *"G-WX1VSLNYS1"' <<<"$JS_ANALYTICS"; then
  bad "GA4_MEASUREMENT_ID is the SWC property — data would land in the wrong property"
else
  pass "GA4_MEASUREMENT_ID is not a known foreign property"
fi

# ---------------------------------------------------------------------------
# 2b · The privacy policy must describe what actually runs
# ---------------------------------------------------------------------------
# Google Analytics' terms require a posted policy disclosing GA use, the cookie,
# and a link to Google's "how we use information" page. Beyond the terms, the
# policy is only worth having if it is TRUE — so enabling a second measurement
# tool without disclosing it is exactly the failure this phase existed to fix.
H_PRIVACY="$(strip_html privacy.html 2>/dev/null || true)"

if [ -f privacy.html ]; then
  pass "privacy.html exists"
  if grep -qi 'policies\.google\.com/technologies/partner-sites' <<<"$H_PRIVACY"; then
    pass "privacy.html links Google's data-use page (GA ToS requirement)"
  else
    bad "privacy.html is missing the required Google data-use link"
  fi
  if grep -qi '_ga' <<<"$H_PRIVACY"; then
    pass "privacy.html discloses the cookie by name"
  else
    bad "privacy.html does not disclose the _ga cookie"
  fi
  # The spam defence must never be described publicly — and this check runs
  # against the RAW file, deliberately, unlike every other check here.
  #
  # HTML comments are SERVED. They are in the source of every page a visitor can
  # view. So for a disclosure question the comment text is part of the public
  # surface, and stripping it before checking would hide exactly the leak worth
  # catching. (This is not hypothetical: the first draft of privacy.html carried
  # a comment reading "do not name the spam honeypot here", which named it, in
  # public, and passed the comment-stripped check.)
  #
  # Comment-stripping is right for "does the code do X"; raw is right for
  # "does the public see X".
  if grep -qiE 'honeypot|botcheck' privacy.html; then
    bad "privacy.html names the spam defence — HTML comments are public too"
  else
    pass "privacy.html does not name the spam defence (raw source checked)"
  fi
else
  bad "privacy.html is missing — GA4 must not be activated without it"
fi

# Discoverability: a policy nothing links to is posted to nobody.
grep -q 'privacy' sitemap.xml && pass "privacy.html is in sitemap.xml" \
  || bad "privacy.html missing from sitemap.xml"
grep -q 'href="/privacy' <<<"$H_INDEX" && pass "index.html links the privacy policy" \
  || bad "index.html has no privacy link"
grep -q 'href="/privacy' <<<"$H_404" && pass "404.html links the privacy policy" \
  || bad "404.html has no privacy link"

# The coupling: a live CWA token obliges a policy that describes Cloudflare.
cwa_set=$(grep -cE 'var CWA_SITE_TOKEN *= *"[^"]+"' <<<"$JS_ANALYTICS" || true)
if [ "$cwa_set" != "0" ]; then
  if grep -qi 'cloudflare web analytics' <<<"$H_PRIVACY"; then
    pass "CWA is enabled and privacy.html describes it"
  else
    bad "CWA_SITE_TOKEN is set but privacy.html does not disclose Cloudflare Web Analytics"
  fi
else
  if grep -qi 'cloudflare web analytics' <<<"$H_PRIVACY"; then
    bad "privacy.html claims Cloudflare Web Analytics is in use, but no token is set (over-disclosure)"
  else
    pass "CWA dormant, and privacy.html correctly does not claim it"
  fi
fi

# ---------------------------------------------------------------------------
# 3 · TF6 PUBLIC-ONLY — owner surfaces carry no analytics
# ---------------------------------------------------------------------------
if grep -qE 'analytics\.js|cloudflareinsights|googletagmanager' <<<"$H_OWNER"; then
  bad "owner.html references analytics — violates the TF6 PUBLIC-ONLY decision"
else
  pass "owner.html carries no analytics"
fi

# ---------------------------------------------------------------------------
# 4 · P1 — the form cannot produce a PII-bearing native GET
# ---------------------------------------------------------------------------
if [ "$(grep -cE '<form[^>]*method="post"' <<<"$H_INDEX")" = "1" ]; then
  pass "claim form carries method=\"post\""
else
  bad "claim form lost method=\"post\" — a native submit would put PII in the URL"
fi

if grep -qE '<form[^>]*action=' <<<"$H_INDEX"; then
  bad "claim form gained an action attribute — CSP form-action must be widened to match"
else
  pass "claim form has no action attribute"
fi

# ---------------------------------------------------------------------------
# 5 · 404 page — the URL PII channel no parameter allowlist can see
# ---------------------------------------------------------------------------
if grep -qE '<body[^>]*data-page="404"' <<<"$H_404"; then
  pass "404.html carries the data-page marker (constant page_location)"
else
  bad "404.html lost data-page=\"404\" — the requested path would reach GA4 page_location"
fi

if grep -qE '<meta[^>]*name="referrer"' <<<"$H_404"; then
  pass "404.html sets a referrer policy"
else
  bad "404.html lost its referrer policy — the requested path leaks in Referer headers"
fi

echo
if [ "$fail" = "0" ]; then
  echo "all analytics checks passed"
else
  echo "analytics checks FAILED"
fi
exit "$fail"
