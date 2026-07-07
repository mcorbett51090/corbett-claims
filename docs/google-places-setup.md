# Google Places Autocomplete — API key setup

The contact form's **Vehicle / Equipment Location** field uses Google Places
autocomplete for address type-ahead. That needs a Google Maps API key. This is a
one-time, ~15-minute setup.

> **The form works without the key.** Until a valid key is in place, address
> type-ahead is simply skipped — the plain text input, browser autofill, and the
> **"Use my current location"** (GPS) button all keep working. So there's no rush,
> and a bad key never breaks the form.

## Steps

1. **Google Cloud Console** → https://console.cloud.google.com → create (or pick) a project.
2. **Enable billing** on the project (Billing → link a card). Google requires a billing
   account for Maps, but low volume stays within the recurring free monthly credit —
   see cost note below.
3. **Enable two APIs** (APIs & Services → Library, search + Enable each):
   - **Places API**  *(the address type-ahead widget uses this; if you also see "Places API (New)", enabling both is fine)*
   - **Maps JavaScript API**
4. **Create the key:** APIs & Services → Credentials → **Create credentials → API key**.
5. **Restrict the key** (click the key to edit) — important so it can't be abused if someone
   copies it out of the page source:
   - **Application restrictions → Websites** (HTTP referrers). Add:
     - `https://corbettclaims.net/*`
     - `https://www.corbettclaims.net/*`
     - `https://mcorbett51090.github.io/*`  *(for testing on the Pages URL before the domain cutover)*
   - **API restrictions → Restrict key** → select **Places API** and **Maps JavaScript API** only (plus **Places API (New)** if you enabled it).
   - Save.
6. **Paste the key into the site:** in `index.html`, find `PASTE_YOUR_GOOGLE_MAPS_API_KEY`
   (in the Google Maps `<script async …>` tag near the bottom) and replace it with your key.
   Commit + push.

## Cost note

- Autocomplete is billed per session (keystrokes + the resulting place selection = one session).
- Google applies a recurring **free monthly credit** to Maps Platform that comfortably covers a
  low-traffic local business form. To be safe: **Billing → Budgets & alerts → create a budget**
  (e.g. alert at $5/month) so you're notified long before any charge.
- The HTTP-referrer restriction above prevents other sites from running up your quota with your key.

## Testing after you add the key

Autocomplete and geolocation both require **HTTPS** (GitHub Pages provides it — they won't work
from a `file://` open of the page). On the live site:

1. Start typing an address in the Location field → you should see Google's suggestion dropdown;
   pick one and it fills the field.
2. On a **phone**, tap **Use my current location** → approve the browser prompt → the field fills
   with your coordinates, and the emailed request includes a tappable Google Maps link.
3. Submit the form → the email body's `Location:` line should show the address or coordinates
   (plus a `(map: …)` link when GPS or a suggestion was used).

If suggestions don't appear, open the browser console: a `Places API` / `InvalidKeyMapError` /
`RefererNotAllowed` message points at which of steps 3–5 to revisit.
