# Project Milestones: Heartland Soccer Team Calendars

## v1.0 Launch (Shipped: 2026-02-20)

**Delivered:** Field map links in iCal events and the subscribe page, plus a landing page value section explaining the tool's benefits to first-time visitors.

**Phases completed:** 1–2 (2 plans total)

**Key accomplishments:**

- `field_map_url` column added to `src/locations.csv` for all 6 known venue prefixes (OSC, OP, CMSF, SSV, HSP, MAW)
- iCal `DESCRIPTION` now includes "Field map: {url}" for all known venues so events contain direct links to field maps
- Subscribe page event rows show a clickable "Field map" anchor for known venues
- Landing page "Why use this?" section with 4 feature bullets (CSS mask checkmarks, light/dark mode compatible)
- Landing page "Planned updates" section with 3 upcoming features (empty-circle bullets, dimmed text)
- Copy accuracy: removed misleading "auto-updates every hour" claim; calendar refresh is client-controlled

**Stats:**

- 2 files modified (src/index.js, src/locations.csv)
- 968 lines JS, 7 lines CSV
- 2 phases, 2 plans, 5 tasks
- 1 day from start to ship (2026-02-20)

**Git range:** `96fc975` → `3365c6d`

**What's next:** Standings lookup, matchup preview, game video feed integration

---
