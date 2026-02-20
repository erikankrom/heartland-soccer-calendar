---
phase: 01-field-map-links
plan: 01
subsystem: ui
tags: [ical, calendar, cloudflare-worker, csv, html]

# Dependency graph
requires: []
provides:
  - field_map_url column parsed from src/locations.csv into location objects
  - resolveLocation() returns mapUrl (string or null) for all 6 known venue prefixes
  - iCal DESCRIPTION includes "Field map: {url}" line for known venues
  - Subscribe page event rows show clickable "Field map" anchor for known venues

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CSV column added to locations map; all downstream consumers receive new field automatically via resolveLocation()
    - Field map URL placed in iCal DESCRIPTION (not URL: property) to avoid conflicting with existing source-page URL

key-files:
  created: []
  modified:
    - src/index.js
    - src/locations.csv

key-decisions:
  - "Field map URL goes in iCal DESCRIPTION only — URL: property is already used for the Heartland Soccer source page"
  - "Subscribe page uses existing meta class + global a { color: var(--accent) } — no extra CSS needed"
  - "esc() helper applied to loc.mapUrl in client-side JS to prevent XSS"

patterns-established:
  - "Extend location object by adding a CSV column — resolveLocation() propagates it to all consumers automatically"

# Metrics
duration: ~30min
completed: 2026-02-20
---

# Plan 01-01 Summary: Field Map Links

**`field_map_url` from locations.csv surfaced in iCal DESCRIPTION and subscribe page event rows for all 6 known Heartland Soccer venues**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 1 (src/index.js)

## Accomplishments

- `parseLocationsCSV` reads new `field_map_url` fourth column and stores it as `mapUrl` in each location entry
- `resolveLocation()` propagates `mapUrl` through both return paths (known venue and unknown venue fallback)
- iCal DESCRIPTION includes `\nField map: https://...` for events at all 6 known venue prefixes
- Subscribe page event rows show a `<a href="{mapUrl}" target="_blank" rel="noopener">Field map</a>` link below the location line for known venues only; unknown venues render no link

## Task Commits

Each task was committed atomically:

1. **Task 1: Plumb field_map_url through CSV parsing, location resolution, and iCal DESCRIPTION** - `96fc975` (feat)
2. **Task 2: Add Field map link to subscribe page event rows** - `cc1ce1b` (feat)
3. **Task 3: checkpoint:human-verify** - approved by user

## Files Created/Modified

- `src/index.js` - parseLocationsCSV, resolveLocation, generateICal DESCRIPTION, and subscribe page client-side JS updated
- `src/locations.csv` - `field_map_url` column added with map URLs for OSC, OP, CMSF, SSV, HSP, MAW

## Decisions Made

- Field map URL goes in iCal DESCRIPTION only, not in the `URL:` property. The `URL:` property is already used for the Heartland Soccer source page; putting two `URL:` lines in a VEVENT is invalid.
- Subscribe page uses the existing `meta` CSS class and the global `a { color: var(--accent) }` rule — no extra class needed for the link.
- `esc()` helper (already defined in the client-side JS block) used on `loc.mapUrl` to prevent XSS.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Field map links are live in both the subscribe page and iCal feeds for all 6 known venues
- No blockers for subsequent phases

---
*Phase: 01-field-map-links*
*Completed: 2026-02-20*
