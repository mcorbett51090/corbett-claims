# Domain Cutover Runbook — point `corbettclaims.net` at GitHub Pages

**Written:** 2026-07-07 14:45 UTC
**Goal:** Move the live site from the current host (AWS/Fastly) to this repo's GitHub Pages deployment, on the custom domain `corbettclaims.net`.

> GitHub Pages IPs below were verified against GitHub's official docs on 2026-07-07:
> [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

---

## Current state (as of 2026-07-07)

| Thing | Value |
|---|---|
| DNS provider (registrar nameservers) | **GoDaddy** (`ns63/ns64.domaincontrol.com`) |
| Current apex `A` records | `3.33.130.190`, `15.197.148.33` (old AWS/Fastly host) |
| `www` | CNAME → `corbettclaims.net` (apex) |
| CAA record | none (nothing blocks GitHub's HTTPS cert) |
| Apex A record TTL | 600s (10 min — fast cutover) |
| GitHub Pages | Live at `https://mcorbett51090.github.io/corbett-claims/`, built from `main` / root, HTTPS enforced |
| Custom domain attached? | Not yet (done by merging the `CNAME` PR) |

---

## Step 1 — Change DNS at GoDaddy

GoDaddy → your domain → **Manage DNS**. Make exactly these changes.

### Apex (`@`) — replace the two old A records

| Action | Type | Name | Value |
|---|---|---|---|
| **Delete** | A | @ | `3.33.130.190` |
| **Delete** | A | @ | `15.197.148.33` |
| **Add** | A | @ | `185.199.108.153` |
| **Add** | A | @ | `185.199.109.153` |
| **Add** | A | @ | `185.199.110.153` |
| **Add** | A | @ | `185.199.111.153` |

### `www` — edit the existing CNAME

| Action | Type | Name | Value |
|---|---|---|---|
| **Edit** | CNAME | www | change from `corbettclaims.net` → `mcorbett51090.github.io` |

### Optional — IPv6 (AAAA on `@`)

`2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`

### ⚠️ Do NOT touch

- **Leave every `MX` and `TXT` record alone** — those run `assignments@corbettclaims.net` email. Repointing the web A/CNAME records does not affect email; deleting an MX/TXT would break it.
- If GoDaddy **domain Forwarding** is on for this domain, turn it **off** — it can override the A records.

---

## Step 2 — Attach the domain (after DNS is in)

1. Merge the **domain-cutover PR** (adds the `CNAME` file = `corbettclaims.net`, and makes the site's URLs host-agnostic). — PR: https://github.com/mcorbett51090/corbett-claims/pull/3
2. Repo → **Settings → Pages** should show `corbettclaims.net` verified.
3. Once the certificate finishes provisioning (minutes, occasionally up to an hour), tick **Enforce HTTPS**.

Merging before DNS is switched is harmless: the `github.io` URL just starts redirecting to `corbettclaims.net`, which still serves the old host until Step 1 completes.

---

## Verifying the cutover

- DNS propagation (from any machine): `dig +short corbettclaims.net A` should return the four `185.199.10x.153` addresses.
- Pages status via API: `gh api repos/mcorbett51090/corbett-claims/pages` → `cname` should read `corbettclaims.net`, `https_enforced: true`.
- Load `https://corbettclaims.net/` and submit the contact form — it should open a pre-filled email to `assignments@corbettclaims.net` (the mailto handoff).

---

## Rollback

If anything goes wrong, restore the two original apex A records at GoDaddy (`3.33.130.190`, `15.197.148.33`) and the `www` CNAME back to `corbettclaims.net`. Because the TTL is 600s, the old host is reachable again within ~10 minutes. (Keep a note of these originals before you change them.)
