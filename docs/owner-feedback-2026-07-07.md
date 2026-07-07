# Owner Feedback — Corbett Claims Website

**Date/time:** 2026-07-07 14:45 UTC
**Source:** Owner (relayed by Matt)
**Status:** 🟡 Logged — not yet applied. Owner is satisfied with the site as-is; these are "if it's an easy fix" refinements.

Verbatim intro from the owner:

> "Matt, I'm satisfied with it how it is. But if it's an easy fix, can you rearrange the order of the states in all sections throughout the website. Put Georgia after Alabama, before Florida."

Each item is a checkbox; none are done yet.

---

## State ordering — Georgia after Alabama, before Florida (everywhere)

Target order wherever the anchor states are listed: **Louisiana, Texas, Mississippi, Alabama, Georgia, Florida, Ohio, Illinois, Nevada.**

- [ ] **Main page, bottom** — reorder the states so Georgia comes after Alabama, before Florida.
- [ ] **Service Area** section — same reorder.
- [ ] **Assignment/equipment drop-down list** (the states list in the request area) — same reorder.
- [ ] **FAQ → "What areas do you cover?"** — same reorder.
- [ ] **Below the map** — the list of states there: move Georgia to after Alabama. (The map itself is fine — no map change.)

> Note for whoever applies this: also update the JSON-LD `areaServed` array in `index.html` and `data.json` so the structured data matches the visible order (currently Georgia is listed last).

## Sentence below the map

- [ ] Change the sentence below the map to read exactly:
      **"Headquartered in Baton Rouge. Assignments accepted from Texas to Florida and up to Ohio, Illinois and Nevada."**
      (i.e., **delete "and Georgia"** from that sentence.)

## Request an Appraisal form (bottom of page)

- [ ] **Phone Number** field — delete the helper comment beneath it that reads *"We'll only call about your assignment."*
- [ ] **Urgency** — delete the Urgency dropdown **and** the field/box directly below it.

---

## Open question for the applier

The "delete 'and Georgia'" from the below-map sentence is slightly in tension with adding Georgia to the *list* below the map — confirm the intent is: **keep Georgia in the state list, but drop the words "and Georgia" from the prose sentence.** (That's how it reads, but worth a glance when applying.)
