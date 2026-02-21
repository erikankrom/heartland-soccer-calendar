---
phase: 04-modify-field-map-link-location
plan: 01
subsystem: ui
tags: [html, cloudflare-worker, subscribe-page]

# Dependency graph
requires:
  - phase: 01-field-map-links
    provides: field map URL in locations.csv — used as href for field name anchor
provides:
  - Field name text is the clickable map link in subscribe page event rows
  - No separate "Field map" label in any event row

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - fieldAnchor computed first — wraps loc.field in <a> when mapUrl exists, plain text otherwise
    - locLabel composes fieldAnchor + em dash + esc(loc.name) — contains raw HTML (safe, all dynamic values escaped)
    - mapLink retained as '' to avoid touching the html+= concatenation line below

key-files:
  created: []
  modified:
    - src/index.js

key-decisions:
  - "mapLink kept as var mapLink = '' to minimise diff — variable already referenced in html+= line"
  - "locLabel now contains raw HTML (the anchor tag) — safe because esc() is applied to loc.mapUrl, loc.field, and loc.name"
  - "No new CSS — existing a { color: var(--accent) } global rule styles the new link automatically"

patterns-established:
  - "Field name is the map link; complex/park name is plain text after em dash — these are now the canonical rendering conventions for the subscribe page event row location"

# Metrics
duration: ~15min
completed: 2026-02-20
---

# Plan 04-01 Summary: Make Field Name the Map Link in Subscribe Page

**Field name text (e.g. "OSC 7A") is now the clickable map link in subscribe page event rows; the park/complex name is plain unlinked text after the em dash; no separate "Field map" label is rendered.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 1 (src/index.js)

## Accomplishments

- Replaced two-variable `locLabel`/`mapLink` pattern with a three-variable `fieldAnchor`/`locLabel`/`mapLink` pattern in the client-side JS inside `renderSubscribePage`
- `fieldAnchor` wraps `loc.field` in an `<a>` tag when `loc.mapUrl` exists; falls back to plain escaped text when it does not
- `locLabel` composes `fieldAnchor` with `esc(loc.name)` separated by an em dash — the value now contains raw HTML, but all dynamic values are passed through `esc()` so XSS safety is preserved
- `mapLink` set to `''` — the variable declaration is retained to avoid touching the `html +=` concatenation line below it

## Task Commits

Each task was committed atomically:

1. **Task 1: Make field name the map link in subscribe page JS** - `9355306` (feat)
2. **Task 2: checkpoint:human-verify** - approved by user; no code changes required

## Files Created/Modified

- `src/index.js` - client-side JS in `renderSubscribePage`: lines 927–928 replaced with 9-line `fieldAnchor`/`locLabel`/`mapLink` block

## Decisions Made

- **`mapLink` retained as `var mapLink = '';`:** The variable is referenced in the `html +=` concatenation line immediately below. Keeping the declaration avoids a two-line diff and makes the change more surgical.
- **`locLabel` contains raw HTML:** The value now holds an `<a>` tag rather than plain text. This is safe because every dynamic value inserted into the HTML (`loc.mapUrl`, `loc.field`, `loc.name`) is passed through the existing `esc()` helper, consistent with the XSS pattern used throughout the file.
- **No new CSS:** The existing `a { color: var(--accent) }` global rule styles the new anchor automatically. No per-element or class-level additions needed.

## Deviations from Plan

None. Implementation followed the plan's replacement code block exactly.

## Issues Encountered

None. Human verification passed on first attempt — user confirmed field name is a clickable map link, complex name is plain text, no "Field map" label appears, and jersey color line is still present.

## User Setup Required

None.

## Next Phase Readiness

- Subscribe page event rows now use the field name as the natural clickable map target
- No regressions in location display, jersey color, or XSS safety
- No blockers for subsequent phases

---
*Phase: 04-modify-field-map-link-location*
*Completed: 2026-02-20*
