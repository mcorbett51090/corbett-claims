#!/usr/bin/env bash
# Local preview server for the Corbett Claims static site.
#
# Serves the site from your own machine so you can check your work in a browser
# WITHOUT touching the live website. Nothing here goes to the internet.
#
#   ./scripts/preview.sh          # serve on http://localhost:8000
#   ./scripts/preview.sh 3000     # serve on a different port
#
# Press Ctrl-C to stop.
set -euo pipefail

PORT="${1:-8000}"
cd "$(dirname "$0")/.."

echo "Corbett Claims — local preview"
echo "  Serving $(pwd)"
echo "  Open:  http://localhost:${PORT}"

# In a GitHub Codespace the port auto-forwards to a private URL (only you can open it):
if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
  echo "  Codespace URL:  https://${CODESPACE_NAME}-${PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
fi

echo "  (Ctrl-C to stop)"
echo

exec python3 -m http.server "${PORT}"
