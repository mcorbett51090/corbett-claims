#!/usr/bin/env bash
#
# check-vendor-drift.sh — fail if the vendored secure-upload.js has drifted from
# the raven-site-kit canonical it was copied from. Run this PRE-DEPLOY.
#
# WHY THIS EXISTS: corbett-claims ships a *copy* of raven-site-kit's
# secure-upload/client/secure-upload.js. If that copy silently drifts (a partial
# re-vendor, a one-off local edit, a syntax error), `import('/secure-upload.js')`
# can reject at runtime and every claim submission silently downgrades from the
# secure Worker upload to a mailto draft that carries NO photo bytes — real,
# operator-invisible evidence loss on a live intake form. This exact drift has
# already happened once in the kit lineage (reference-winery's copy diverged).
#
# The expected hash lives in scripts/secure-upload.sha256 and is updated ONLY
# when secure-upload.js is DELIBERATELY re-vendored from the kit.
#
# bash 3.2-safe (stock macOS): no `declare -A`, no globstar, no mapfile, no grep -P.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="$root/secure-upload.js"
expected_file="$root/scripts/secure-upload.sha256"

[ -f "$target" ] || { echo "drift-check: missing $target" >&2; exit 2; }
[ -f "$expected_file" ] || { echo "drift-check: missing $expected_file" >&2; exit 2; }

# shasum ships on macOS; sha256sum on most Linux. Prefer whichever exists.
if command -v shasum >/dev/null 2>&1; then
  actual="$(shasum -a 256 "$target" | cut -d' ' -f1)"
elif command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$target" | cut -d' ' -f1)"
else
  echo "drift-check: neither shasum nor sha256sum found" >&2; exit 2
fi

expected="$(tr -d '[:space:]' < "$expected_file")"

if [ "$actual" != "$expected" ]; then
  {
    echo "drift-check: FAIL — secure-upload.js has drifted from the kit canonical."
    echo "  actual   : $actual"
    echo "  expected : $expected"
    echo
    echo "  If this change is a DELIBERATE re-vendor from raven-site-kit, refresh the pin:"
    echo "    shasum -a 256 secure-upload.js | cut -d' ' -f1 > scripts/secure-upload.sha256"
    echo "  Otherwise, restore the file from the kit canonical before deploying."
  } >&2
  exit 1
fi

echo "drift-check: OK — secure-upload.js matches the pinned kit-canonical hash."
