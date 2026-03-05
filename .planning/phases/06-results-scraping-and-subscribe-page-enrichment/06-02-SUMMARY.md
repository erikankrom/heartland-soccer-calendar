---
phase: 06-results-scraping-and-subscribe-page-enrichment
plan: 02
subsystem: ui
tags: [cloudflare-worker, javascript, html, css, ical, scraping]

# Dependency graph
requires:
  - phase: 06-01
    provides: results backend — /api/team/{teamId} returns results and opponentRecords

provides:
  - Subscribe page game intelligence UI: record chip, always-visible results table, opponent record chips on upcoming games
  - Server-side opponent ID collection expanded to include iCal events (not just results.games)
  - Restructured subscribe page layout: identity block / divider / calendar block
  - Landing page planned-updates cleaned up (shipped items removed)
  - .planning/TODOS.md created with clickable opponent links todo

affects: [07-game-video-feed, any future subscribe page work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Client-side date-based past/upcoming split using DTSTART normalized to YYYY-MM-DD
    - Home/away opponent ID extraction from iCal SUMMARY using beforeVs/afterVs split
    - Server-side opponent ID collection from both results.games and iCal events (union)
    - Grey var(--bg) inline chip for record value and opponent record annotation

key-files:
  created:
    - .planning/TODOS.md
    - .planning/phases/06-results-scraping-and-subscribe-page-enrichment/06-02-SUMMARY.md
  modified:
    - src/index.js

key-decisions:
  - "Opponent ID collection: scan both results.games AND iCal events server-side — results.games only covers past opponents, iCal events are needed to find future opponents not yet on the results page"
  - "Opponent record chip on upcoming games uses beforeVs/afterVs home/away split from SUMMARY, not date-based lookup — SUMMARY format '8174 Team vs 8175 Opponent' has team number reliably after/before vs"
  - "Results table always visible (no toggle) — simpler UX, table is compact enough"
  - "Subscribe page layout: team identity block (name, record, source) above divider; Team Calendar block (heading, subtitle, subscribe, events) below"
  - "Record value styled as grey var(--bg) chip; opponent record annotation same chip style without 'Opp:' prefix"

patterns-established:
  - "Grey inline chip: background: var(--bg); border-radius: 6px; padding: .1rem .4rem — used for record value and opp-record"
  - "SUMMARY home/away split: vsIdx = s.search(/\\bvs\\.?\\b/i); beforeVs/afterVs; isHome = beforeVs.includes(teamId)"
  - "Past vs upcoming split: dtToISO(dtstart) → YYYY-MM-DD string compared to today midnight"

# Metrics
duration: ~3h (iterative with visual feedback)
completed: 2026-03-05
---

# Phase 06-02: Subscribe Page Enrichment Summary

**Game intelligence UI on subscribe page: W-L-T record chip, always-visible results table with scored games, and opponent record chips on all upcoming game rows (home and away).**

## Performance

- **Duration:** ~3h (iterative with visual checkpoint feedback)
- **Started:** 2026-03-05
- **Completed:** 2026-03-05
- **Tasks:** 2 plan tasks + visual checkpoint (passed via Playwright)
- **Files modified:** 1 (src/index.js), 1 created (.planning/TODOS.md)

## Accomplishments

- W-L-T record displayed as a grey inline chip directly below the team name, always visible
- Always-visible results table (Date, Opponent with #ID, H/A, Result) for all scored games
- Upcoming game rows annotated with opponent W-L-T chip (e.g. "3W–1L–0T") for both home and away games
- Server-side fix: opponent ID collection now scans iCal events in addition to results.games, so future opponents not yet on the results page are included
- Restructured subscribe page layout into two clear blocks separated by a divider
- Landing page "Planned updates" cleaned up — removed shipped items (standings, matchup preview)

## Task Commits

1. **Task 1+2: Game intelligence UI** - `12c3efb` (feat)
2. **fix: Record badge below team name** - `25a2881` (fix)
3. **fix: Upcoming-only events list** - `c73c4ce` (fix)
4. **fix: Record badge above games-found subtitle** - `b998eeb` (fix)
5. **feat: Opponent team number in results table** - `8865fc2` (feat)
6. **docs: TODOS.md — clickable opponent links** - `73932ed` (docs)
7. **fix: Opponent record SUMMARY regex (home only)** - `3930e11` (fix)
8. **fix: Opponent record SUMMARY regex (correct)** - `092421a` (fix)
9. **feat: Layout restructure** - `3d480b5` (feat)
10. **fix: Record as plain text** - `f8a8bb3` (fix)
11. **fix: Record value grey chip** - `789332f` (fix)
12. **feat: Always-visible results table** - `aa92e1f` (feat)
13. **fix: Away-game opponent ID** - `b2f5e8d` (fix)
14. **fix: Server-side opponent IDs from iCal events** - `262de26` (fix)
15. **fix: Remove "Opp:" prefix, chip styling** - `a2e5a38` (fix)

## Files Created/Modified

- `/Users/erikankrom/dev/heartland-soccer-calendar/src/index.js` — subscribe page HTML skeleton restructured; CSS for record-row, record-value, opp-record chips, section-heading, results-table; client JS for record, results table, event annotations; server-side handleTeamAPI expanded opponent ID collection
- `/Users/erikankrom/dev/heartland-soccer-calendar/.planning/TODOS.md` — new file, clickable opponent links todo

## Decisions Made

- Opponent ID collection must scan iCal events server-side, not just results.games — future opponents are only in the calendar, not the results page yet.
- Home/away opponent extraction from SUMMARY: `beforeVs` contains home team number, `afterVs` contains away team number. When team is home, opponent is in `afterVs`; when away, opponent is in `beforeVs`. Simple `(\d+)` match on the correct side.
- Results table always visible — no toggle. Compact enough that collapsing added UX complexity without benefit.
- Layout split: team identity (name, record, source) above divider; calendar subscription block below. Mirrors the two distinct user needs on the page.
- Grey chip (`var(--bg)`, `border-radius: 6px`) used for both the record value and opponent record annotation — consistent visual language without using colored badges.

## Deviations from Plan

### Auto-fixed Issues

**1. Iterative layout refinements (multiple positioning passes)**
- **Found during:** Visual checkpoint feedback
- **Issue:** Record badge position, pill vs plain text, divider placement, toggle vs always-visible table — each required a separate pass based on user feedback
- **Fix:** Each feedback round addressed as a targeted commit
- **Impact:** 10 fix commits beyond the 2 plan task commits; all within scope of the plan's objective

**2. Server-side opponent ID gap**
- **Found during:** Visual verification (opponent records not populating)
- **Issue:** `opponentRecords` built only from `results.games` — future opponents not yet on results page were missing
- **Fix:** Added iCal event SUMMARY scan to `handleTeamAPI` to union both ID sources
- **Committed in:** `262de26`

---

**Total deviations:** 2 categories (layout iteration, server-side gap)
**Impact on plan:** All fixes necessary for the feature to work correctly. No scope creep.

## Issues Encountered

- Opponent record lookup went through three iterations: date-based lookup (wrong — dates don't match iCal format reliably), SUMMARY regex home-only (broke for away games), SUMMARY regex home+away split (correct). Root cause was the SUMMARY format not being known upfront.
- Server-side opponent ID collection was incomplete — required adding iCal event scan after visual verification confirmed client-side logic was correct but data was absent.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 6 complete. Both plans (06-01 backend, 06-02 UI) shipped and verified.
- Phase 7 (game video feed integration) can proceed — it is the remaining planned update listed on the landing page.
- TODOS.md has one queued item: clickable opponent team number links for scouting (`/subscribe/{opponentId}`).

---
*Phase: 06-results-scraping-and-subscribe-page-enrichment*
*Completed: 2026-03-05*
