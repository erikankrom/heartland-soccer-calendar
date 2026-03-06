# Project Milestones: Heartland Soccer Team Calendars

## v1.2 Game Intelligence (Shipped: 2026-03-05)

**Delivered:** W-L-T record, full results table, and opponent context on the subscribe page; iCal events enriched with final scores (past) and opponent records (upcoming); opponent links for scouting.

**Phases completed:** 6–7 (2 plans total; Phase 7 shipped without formal plan)

**Key accomplishments:**

- Results scraping from `team_results.cgi` with W-L-T record computation and 1-hour edge cache
- `/api/team/{teamId}` enriched with `results` (record + game list) and `opponentRecords` map
- Subscribe page: team record chip, always-visible results table with scores and opponent IDs, opponent record chips on all upcoming game rows
- iCal DESCRIPTION enriched: past VEVENTs get `Result: W/L/T X–Y`; future VEVENTs get `Opponent record: XW–YL–ZT`
- Opponent ID collection from both `results.games` AND iCal event SUMMARYs (future opponents)
- Opponent team numbers are clickable `/subscribe/{opponentId}` links for scouting

**Stats:**

- 1 file modified (src/index.js)
- 1,355 lines JS (up from 986)
- 2 phases, 2 plans, 5 tasks + Phase 7 bonus commit
- 2 days from start to ship (2026-03-04 → 2026-03-05)

**Git range:** `441b793` → `2d38d37`

**What's next:** Game video feed integration, standings lookup

---

## v1.1 Enhancements (Shipped: 2026-02-20)

**Delivered:** Home/away jersey colors in iCal events and subscribe page, field name made the clickable map link, and Cloudflare Web Analytics beacon added to both HTML pages.

**Phases completed:** 3–5 (3 plans total)

**Key accomplishments:**

- Jersey color ("Home — White/Light jerseys" / "Away — Dark jerseys") added to every iCal VEVENT DESCRIPTION and subscribe page event row
- Home/away detection via before-vs substring check — robust to leading brackets/codes in Heartland Soccer SUMMARY strings
- Field name text (e.g. "OSC 7A") is now the clickable map link in subscribe page event rows; park/complex name is unlinked plain text
- Cloudflare Web Analytics beacon injected into `<head>` of both HTML pages, gated on `CF_ANALYTICS_TOKEN` Worker secret
- Privacy-first analytics (no cookies, no third-party tracking) — graceful no-op when token is absent

**Stats:**

- 1 file modified (src/index.js)
- 986 lines JS (up from 968)
- 3 phases, 3 plans, 6 tasks
- 1 day from start to ship (2026-02-20)

**Git range:** `d2d5ca0` → `afbcd43`

**What's next:** Standings lookup, matchup preview, game video feed integration

---

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
