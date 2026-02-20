# Project State

## Current Position

**Milestone:** v1.0 Launch
**Current Phase:** Phase 2 — Homepage Value Section — IN PROGRESS
**Current Plan:** 02-01 — awaiting checkpoint (task 3 of 3)
**Next:** Human verification of landing page value section, then SUMMARY.md creation

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

### Phase 1 Progress

| Plan  | Status   | Commits                          |
|-------|----------|----------------------------------|
| 01-01 | complete | `96fc975`, `cc1ce1b`, `6642c4a`  |

### Phase 2 Progress

| Plan  | Status              | Commits                        |
|-------|---------------------|--------------------------------|
| 02-01 | awaiting checkpoint | `077d2cf`, `981244a`           |
