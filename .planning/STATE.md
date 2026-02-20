# Project State

## Current Position

**Milestone:** v1.0 Launch
**Current Phase:** Phase 1 — Field Map Links
**Current Plan:** 01-01 — complete, awaiting checkpoint verification
**Next:** checkpoint:human-verify (Task 3 in 01-01-PLAN.md)

## Accumulated Context

### Roadmap Evolution

- Phase 1 added: Add a link to a field map on both the site, and the body of the calendar event. `field_map_url` column added to `src/locations.csv`.

### Decisions

- Field map URL goes in iCal DESCRIPTION only (not in `URL:` property, which is already used for the source page).
- Subscribe page uses existing `meta` class + global `a { color: var(--accent) }` style — no extra CSS class needed for the link.
- `esc()` helper used on `loc.mapUrl` in client-side JS to prevent XSS.

### Phase 1 Progress

| Plan  | Status                | Commits                |
|-------|----------------------|-------------------------|
| 01-01 | awaiting human verify | `96fc975`, `cc1ce1b`   |
