/*
 * Google Analytics 4 — Corbett Claims
 * -----------------------------------
 * ONE-LINE ACTIVATION: paste your GA4 Measurement ID between the quotes below.
 *   • Get it at analytics.google.com → Admin → Data streams → (your web stream) → "G-XXXXXXXXXX".
 *   • Leaving it empty keeps analytics fully OFF: no script loads, no cookies, no network calls.
 * Full walkthrough: docs/ANALYTICS.md
 */
(function () {
  "use strict";

  var GA4_MEASUREMENT_ID = ""; // ← paste "G-XXXXXXXXXX" here to turn analytics ON

  // Dormant until a real ID is set — a plain static site should cost nothing when off.
  if (!GA4_MEASUREMENT_ID || GA4_MEASUREMENT_ID.indexOf("G-") !== 0) return;

  var s = document.createElement("script");
  s.async = true;
  s.src =
    "https://www.googletagmanager.com/gtag/js?id=" +
    encodeURIComponent(GA4_MEASUREMENT_ID);
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA4_MEASUREMENT_ID);
})();
