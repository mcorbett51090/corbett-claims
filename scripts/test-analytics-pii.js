/*
 * Runs the REAL analytics.js in a stubbed DOM with a scratch measurement ID,
 * captures everything handed to gtag, and asserts that PII cannot egress.
 *
 * This is the security property the whole allowlist design exists to provide,
 * so it is tested against the shipped file rather than a reimplementation.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(process.argv[2] || path.join(__dirname, ".."), "analytics.js");
let code = fs.readFileSync(SRC, "utf8");

// Scratch ID: valid shape, not all-same-char, not on the denylist.
code = code.replace('var GA4_MEASUREMENT_ID = "";', 'var GA4_MEASUREMENT_ID = "G-TEST123456";');

const sent = [];
const appended = [];

function makeEl() {
  return {
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k] ?? null; },
  };
}

const win = {
  console,
  URL,
  dataLayer: undefined,
  addEventListener() {},
  __ccAnalyticsDropped: 0,
};
const doc = {
  head: { appendChild(el) { appended.push(el); } },
  body: { getAttribute: () => null },
  createElement: makeEl,
  querySelector: () => null,
  addEventListener() {},
};
const loc = {
  pathname: "/",
  href: "https://www.corbettclaims.com/?utm_source=google&owner_name=ZZPII#faq",
  origin: "https://www.corbettclaims.com",
};

const sandbox = {
  window: win, document: doc, location: loc, console, URL,
};
sandbox.globalThis = sandbox;

const vm = require("vm");
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// gtag is installed by analytics.js; wrap it to capture.
const realGtag = win.gtag;
win.gtag = function () {
  const a = Array.from(arguments);
  if (a[0] === "event") sent.push({ event: a[1], params: a[2] });
  if (a[0] === "config") sent.push({ event: "__config", params: a[2] });
  return realGtag && realGtag.apply(null, arguments);
};
// Replay the config that already happened, from dataLayer.
(win.dataLayer || []).forEach((entry) => {
  const a = Array.from(entry);
  if (a[0] === "config") sent.push({ event: "__config", params: a[2] });
  if (a[0] === "consent") sent.push({ event: "__consent", params: a[2] });
});

const A = win.ccAnalytics;
let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log("  \x1b[32mok\x1b[0m   " + name);
  } else {
    console.log("  \x1b[31mFAIL\x1b[0m " + name + (detail ? "  -> " + detail : ""));
    failures++;
  }
}

console.log("PII egress harness (real analytics.js, scratch ID)\n");

check("ccAnalytics is defined", !!A);
check("ready() true with a valid scratch id", A.ready() === true);

// --- consent ordering -------------------------------------------------------
const dl = (win.dataLayer || []).map((e) => Array.from(e)[0]);
check("consent pushed before config", dl.indexOf("consent") > -1 && dl.indexOf("consent") < dl.indexOf("config"),
  "dataLayer order: " + dl.join(","));
const consent = sent.find((s) => s.event === "__consent");
check("analytics_storage granted", consent && consent.params.analytics_storage === "granted");
check("all three ad signals denied", consent &&
  consent.params.ad_storage === "denied" &&
  consent.params.ad_user_data === "denied" &&
  consent.params.ad_personalization === "denied");

// --- page_location sanitiser ------------------------------------------------
const cfg = sent.find((s) => s.event === "__config");
const pl = cfg && cfg.params && cfg.params.page_location;
check("page_location keeps utm_source", !!pl && pl.includes("utm_source=google"), pl);
check("page_location drops owner_name (PII in URL)", !!pl && !pl.includes("ZZPII"), pl);
check("page_location drops the hash", !!pl && !pl.includes("#faq"), pl);

// --- the allowlist ----------------------------------------------------------
sent.length = 0;
A.track("generate_lead", {
  form_name: "ignored — const wins",
  equipment_type: "Motorcycle",
  assignment_type: "Damage estimate",
  loss_type: "Hail",
  file_count: 3,
  files_failed: 1,
  // everything below is PII or unknown and must NEVER appear on the wire
  owner_name: "Jane Doe",
  claimant: "John Smith",
  owner_address: "123 Main St, Baton Rouge LA 70802",
  message: "rear-ended at the light, airbags deployed",
  claim_number: "CC-99812",
});
const lead = sent.find((s) => s.event === "generate_lead");
check("generate_lead emitted", !!lead);
if (lead) {
  const keys = Object.keys(lead.params).sort().join(",");
  check("exactly the schema keys egress", keys === "assignment_type,equipment_type,file_count,files_failed,form_name,loss_type", keys);
  const blob = JSON.stringify(lead.params);
  check("no claimant name on the wire", !/Jane Doe|John Smith/.test(blob), blob);
  check("no address on the wire", !/Main St|70802/.test(blob), blob);
  check("no free-text message on the wire", !/airbags/.test(blob), blob);
  check("no claim number on the wire", !/CC-99812/.test(blob), blob);
  check("form_name is the const, not the caller's value", lead.params.form_name === "appraisal_request", lead.params.form_name);
}

// --- enum discipline --------------------------------------------------------
sent.length = 0;
A.track("generate_lead", { loss_type: "Made Up Value", file_count: 1 });
const bad = sent.find((s) => s.event === "generate_lead");
check("non-member enum is OMITTED, not defaulted", bad && !("loss_type" in bad.params),
  bad ? JSON.stringify(bad.params) : "no event");

// --- unknown event ----------------------------------------------------------
sent.length = 0;
const before = win.__ccAnalyticsDropped;
A.track("not_an_event", { a: 1 });
check("unknown event name produces NO call at all", sent.length === 0);
check("unknown event increments the dropped counter", win.__ccAnalyticsDropped > before);

// --- contact_click ----------------------------------------------------------
sent.length = 0;
A.track("contact_click", { contact_method: "tel", href: "tel:2256632217" });
const cc = sent.find((s) => s.event === "contact_click");
check("contact_click carries method only, never href", cc && !("href" in cc.params) && cc.params.contact_method === "tel",
  cc ? JSON.stringify(cc.params) : "no event");

// --- enum rejects before the guard is even reached --------------------------
sent.length = 0;
A.track("contact_click", { contact_method: "a@b.com" });
const ccBad = sent.find((s) => s.event === "contact_click");
check("email-shaped enum value is rejected as a non-member",
  ccBad && !("contact_method" in ccBad.params),
  ccBad ? JSON.stringify(ccBad.params) : "no event");

// --- shape guard, tested the way it is actually meant to fire ---------------
// The guard is unreachable through today's schema (const/enum/int all constrain
// their output). It exists for a FUTURE contributor who adds a freer type and
// wires it to a leaky field. Simulate exactly that: add a `string` type and a
// schema key using it, then confirm the guard drops the whole event.
{
  let future = fs.readFileSync(SRC, "utf8")
    .replace('var GA4_MEASUREMENT_ID = "";', 'var GA4_MEASUREMENT_ID = "G-TEST123456";')
    // a future contributor adds a permissive type...
    .replace(
      "      } else {\n        continue;\n      }",
      '      } else if (rule.type === "string") {\n        value = input[key];\n        if (value === undefined) continue;\n      } else {\n        continue;\n      }'
    )
    // ...and wires a new schema key to a field that turns out to carry PII
    .replace(
      "    contact_click: {",
      '    contact_click: {\n      note: { type: "string" },'
    );

  const s2 = { window: { console, URL, addEventListener() {}, __ccAnalyticsDropped: 0 },
               document: doc, location: loc, console, URL };
  s2.globalThis = s2;
  vm.createContext(s2);
  vm.runInContext(future, s2);
  const captured = [];
  s2.window.gtag = function () { const a = Array.from(arguments); if (a[0] === "event") captured.push({ event: a[1], params: a[2] }); };

  const A2 = s2.window.ccAnalytics;
  const d0 = s2.window.__ccAnalyticsDropped;

  A2.track("contact_click", { contact_method: "tel", note: "reached me at jane@example.com" });
  check("[future schema] email-shaped value drops the ENTIRE event", captured.length === 0,
    JSON.stringify(captured));
  check("[future schema] the drop is counted", s2.window.__ccAnalyticsDropped > d0);

  captured.length = 0;
  A2.track("contact_click", { contact_method: "tel", note: "called from the shop" });
  check("[future schema] clean value still passes", captured.length === 1 && captured[0].params.note === "called from the shop",
    JSON.stringify(captured));

  captured.length = 0;
  A2.track("contact_click", { contact_method: "tel", note: "call me on 225-663-2217" });
  check("[future schema] phone-shaped value drops the event", captured.length === 0, JSON.stringify(captured));

  captured.length = 0;
  A2.track("contact_click", { contact_method: "tel", note: "at 70802" });
  check("[future schema] ZIP-shaped value drops the event", captured.length === 0, JSON.stringify(captured));

  captured.length = 0;
  A2.track("contact_click", { contact_method: "tel", note: "x".repeat(101) });
  check("[future schema] over-long value drops the event", captured.length === 0, JSON.stringify(captured));
}

sent.length = 0;
A.track("generate_lead", { equipment_type: "Motorcycle", loss_type: "Hail", assignment_type: "Damage estimate", file_count: 1, files_failed: 0 });
check("clean event still passes afterwards", sent.length === 1);

// --- int clamping -----------------------------------------------------------
sent.length = 0;
A.track("upload_complete", { file_count: 99999, files_failed: -5 });
const uc = sent.find((s) => s.event === "upload_complete");
check("int values are clamped", uc && uc.params.file_count === 99 && uc.params.files_failed === 0,
  uc ? JSON.stringify(uc.params) : "no event");

console.log("\n" + (failures ? "\x1b[31m" + failures + " FAILURES\x1b[0m" : "\x1b[32mall harness checks passed\x1b[0m"));
process.exit(failures ? 1 : 0);
