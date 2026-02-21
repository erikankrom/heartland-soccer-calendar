---
phase: 03-home-away-jersey-colors
plan: 01
subsystem: ui
tags: [ical, calendar, html, cloudflare-worker, subscribe-page]

# Dependency graph
requires:
  - phase: 01-field-map-links
    provides: field map URL in DESCRIPTION and subscribe page — jersey color line appended after it
provides:
  - Jersey color line ("Home — White/Light jerseys" or "Away — Dark jerseys") in every VEVENT DESCRIPTION
  - Jersey color meta line in each event row on the subscribe page
  - Home/away detection via before-vs substring check on SUMMARY field

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Home/away detection uses vsIdx substring check — find 'vs' in summary, test whether teamId appears before it — more robust than start-of-string regex
    - Jersey color pushed into descParts array in generateICal() after field map URL line
    - jerseyHtml injected into event row HTML string in inline <script> block of renderSubscribePage()

key-files:
  created: []
  modified:
    - src/index.js

key-decisions:
  - "Home/away detected by 'before vs' substring: find vsIdx, slice summary up to that point, check if teamId appears in that slice — handles leading punctuation or brackets in SUMMARY strings"
  - "jerseyColor always pushed to descParts regardless of whether field info exists — every event has an assignment"
  - "No new CSS needed — .meta class already provides correct dimmed styling (font-size .85rem, color var(--text-dim))"

patterns-established:
  - "DESCRIPTION parts: field, complex name, field map URL, jersey color — in that order"
  - "Subscribe page event row order: date | title | time | location label | field map link | jersey color"

# Metrics
duration: ~30min
completed: 2026-02-20
---

# Plan 03-01 Summary: Home/Away Jersey Colors

**Jersey color assignment ("Home — White/Light jerseys" / "Away — Dark jerseys") surfaced in iCal DESCRIPTION and subscribe page event rows, with home/away detected via before-vs substring check on the SUMMARY field**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, plus 1 bug fix post-checkpoint)
- **Files modified:** 1 (src/index.js)

## Accomplishments

- Added `jerseyColor` to every VEVENT DESCRIPTION in `generateICal()` — always the last item in `descParts`, appended after the field map URL when present
- Added `jerseyHtml` to each event row in the subscribe page inline script — renders as a gray `.meta` line after the field map link
- Fixed home/away detection: replaced start-of-string regex with a "before vs" substring check that correctly handles SUMMARY strings where the team ID is not at position zero (e.g. preceded by brackets or other characters)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add jersey color line to iCal DESCRIPTION** - `d2d5ca0` (feat)
2. **Task 2: Add jersey color meta line to subscribe page event rows** - `d7c1a6c` (feat)
3. **Task 3: checkpoint:human-verify** - approved by user; bug fix applied and committed as `59e56f9` (fix)

## Files Created/Modified

- `src/index.js` - `generateICal()` extended with `jerseyColor` in `descParts`; subscribe page inline script extended with `jerseyHtml` in event row HTML; home/away detection fixed in both locations

## Decisions Made

- **Before-vs substring check for home/away detection:** `vsIdx = summary.search(/\bvs\.?\b/i)`, then `beforeVs = summary.slice(0, vsIdx)`, then `beforeVs.includes(teamId)`. This is more robust than anchoring to the start of the string because Heartland Soccer SUMMARY strings can have leading text (team codes, brackets) before the team name.
- **jerseyColor always appended:** Every game is either home or away; there is no "unknown" state. The line is always pushed regardless of whether field location info is present.
- **No new CSS required:** The `.meta` class already provides the correct dimmed styling used by time, location, and map link lines. Jersey color fits naturally in that visual hierarchy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Post-checkpoint bug fix] Home/away detection regex failed on real data**
- **Found during:** Task 3 checkpoint — user reported jersey colors were not alternating (all showing same value)
- **Issue:** The plan specified `new RegExp('^\\s*' + teamId + '\\s*[-–]').test(summary)`. This anchored to the start of the string, but real Heartland Soccer SUMMARY fields have formats where the team ID is not the very first character.
- **Fix:** Replaced with a `vsIdx` substring approach: find the word "vs" (case-insensitive, word-boundary), slice the summary up to that index, check if `teamId` appears anywhere in that slice. Applied in both `generateICal()` (server-side JS) and the inline subscribe page script (client-side JS string, so uses `indexOf` instead of `includes`).
- **Files modified:** src/index.js
- **Verification:** User confirmed jersey colors show correctly with realistic home/away mix after fix.
- **Committed in:** `59e56f9` (fix)

---

**Total deviations:** 1 auto-fixed (post-checkpoint bug fix, not a rule violation — the original regex logic was incorrect for real data).
**Impact on plan:** Essential correctness fix. No scope creep.

## Issues Encountered

The initial home/away detection regex anchored to the start of the SUMMARY string. Real Heartland Soccer event summaries have formats that place the team ID after leading characters, causing all events to be detected as "away". The fix was identified during the human verification checkpoint and resolved before the plan was declared complete.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Jersey color information now appears in all iCal events and subscribe page previews
- Home/away detection is robust to leading characters in SUMMARY strings
- No blockers for subsequent phases

---
*Phase: 03-home-away-jersey-colors*
*Completed: 2026-02-20*
