# Development & Release Workflow — Corbett Claims

**The one rule: `main` is the live website.** GitHub Pages publishes the `main`
branch automatically, so anything merged into `main` goes public within about a
minute. Keep unfinished work off `main` and the live site never moves until you
choose to publish.

## Branches

| Branch | Purpose |
|--------|---------|
| **`main`** | **Production.** Serves `corbettclaims.net` (once the domain is cut over). Only finished, reviewed work lands here. |
| **`staging`** | The integration + preview branch. All changes land here first and are previewed before being promoted. |
| feature branches *(optional)* | For a bigger change, branch off `staging` (e.g. `git checkout -b add-photos staging`), then merge back into `staging`. |

## Day-to-day: make a change safely

1. **Start from staging**
   ```bash
   git checkout staging
   git pull
   ```
2. **Make your edits.**
3. **Preview locally — this is the check that keeps the live site untouched:**
   ```bash
   ./scripts/preview.sh          # then open http://localhost:8000
   ```
   Or in VS Code: right-click `index.html` → **Open with Live Server**.
   You're looking at the files on your own machine — nothing here touches the
   internet, so the live site is completely undisturbed.
4. **Commit to staging**
   ```bash
   git add -A
   git commit -m "Describe the change"
   git push
   ```
   Repeat 2–4 until you're happy. **The live site still has not changed.**

## Publish: promote `staging` → `main`

When staging is ready to go live:

1. Open a Pull Request from `staging` into `main`
   (GitHub → **Pull requests** → **New** → base `main`, compare `staging`).
2. Review the diff — it's the exact list of what will change on the live site.
3. **Merge it.** GitHub Pages redeploys `main` within ~1 minute and the change is live.

That merge is the **only** moment the public site changes. Everything before it is private.

## Before you push

A `pre-push` hook runs these if it is installed (`.git/hooks/pre-push`). They are **convenience
checks, not controls** — this repo has no CI, so a script nobody runs is exactly as strong as a
comment. The real protections live in the code itself.

```sh
./scripts/check-vendor-drift.sh        # secure-upload.js still matches its pinned hash
./scripts/check-analytics-config.sh    # analytics + privacy-policy safety checks
node scripts/test-analytics-pii.js     # 27 assertions that no PII can reach an analytics request
```

**A note on how long "live" takes.** GitHub Pages redeploys `main` in about a minute, but production
is served with `cache-control: max-age=600` and there is no way to purge it. Real time-to-safe after a
bad push is therefore **~11 minutes**, not ~1. Plan rollbacks accordingly — and prefer a forward fix
to a revert when the broken state is the safer of the two.

> ⚠️ **If production ever moves to Cloudflare Pages, delete `_headers` FIRST.**
> That file exists only to keep the Cloudflare *preview* out of search results, and it carries
> `X-Robots-Tag: noindex, nofollow` for the whole site. GitHub Pages ignores it entirely, which is the
> only reason it is safe today. Cloudflare Pages would honour it and **deindex the live site** — for a
> business whose entire strategy document is `getting-found-on-google.txt`.

## Why not preview on the github.io URL?

Once the custom domain (`corbettclaims.net`) is attached, GitHub Pages **redirects**
`mcorbett51090.github.io/corbett-claims/` to the custom domain — so github.io is no
longer a safe preview surface (you'd be looking at production). That's why previewing
is done **locally** with `./scripts/preview.sh`.

## Reminder: the safe domain-cutover order

When (re)attaching the custom domain, do it in this order to avoid the "redirects into
the old host" gap:

1. Point DNS at GitHub Pages **first** (the four `185.199.10x.153` A records — see
   [`domain-cutover-runbook.md`](domain-cutover-runbook.md)).
2. Confirm it resolves.
3. **Then** add the `CNAME` file + enforce HTTPS.

## Optional: a hosted staging URL

Local preview covers day-to-day work. If you ever want a preview **link you can send**
to someone (e.g. for the owner to review before launch), the clean way is a **separate
repo** (e.g. `corbett-claims-staging`) published to Pages with **no custom domain** — it
lives permanently at `mcorbett51090.github.io/corbett-claims-staging/`, always
previewable, and never touches `corbettclaims.net`.
