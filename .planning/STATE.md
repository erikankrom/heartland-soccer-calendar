# Project State

## Current Position

**Milestone:** v1.0 Launch
**Current Phase:** Phase 2 — Homepage Value Section — COMPLETE
**Current Plan:** 02-01 — complete
**Next:** Phase 3 (TBD — run /gsd:plan-phase 3 to define)

## Accumulated Context

### Roadmap Evolution

- Phase 1 added: Add a link to a field map on both the site, and the body of the calendar event. `field_map_url` column added to `src/locations.csv`.
- Phase 2 added: Homepage value section — "why this is useful" copy + planned updates list.

### Decisions

- Field map URL goes in iCal DESCRIPTION only (not in `URL:` property, which is already used for the source page).
- Subscribe page uses existing `meta` class + global `a { color: var(--accent) }` style — no extra CSS class needed for the link.
- `esc()` helper used on `loc.mapUrl` in client-side JS to prevent XSS.
- Value section uses CSS mask trick for checkmark bullets (avoids per-item SVG elements, respects accent color variable in both light/dark mode).
- Planned updates section uses empty circle via border on `::before` pseudo-element, styled with `--border` and `--text-dim` for a visually distinct "not yet done" look.
- "Calendar auto-updates every hour" bullet removed from value section — refresh interval is client-controlled, not worker-controlled.
- Venue name example updated to "GARMIN Olathe Soccer Complex" / "OSC 7A" for accuracy.

### Phase 1 Progress

| Plan  | Status   | Commits                          |
|-------|----------|----------------------------------|
| 01-01 | complete | `96fc975`, `cc1ce1b`, `6642c4a`  |

### Phase 2 Progress

| Plan  | Status   | Commits                                     |
|-------|----------|---------------------------------------------|
| 02-01 | complete | `077d2cf`, `981244a`, `f10da0c`, `3365c6d`  |
