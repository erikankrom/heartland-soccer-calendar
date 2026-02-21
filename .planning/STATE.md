# Project State

## Current Position

**Milestone:** v1.0 Launch — COMPLETE (shipped 2026-02-20)
**Current Phase:** 03-home-away-jersey-colors — COMPLETE
**Current Plan:** 03-01 — COMPLETE
**Next:** Define next milestone — run `/gsd:discuss-milestone` or `/gsd:new-milestone`

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** One-click calendar subscription for Heartland Soccer teams
**Current focus:** Planning next milestone

## Accumulated Context

### Decisions (full log in PROJECT.md)

- Field map URL goes in iCal DESCRIPTION only (not `URL:` — already used for source page)
- Subscribe page uses existing `meta` class + global `a { color: var(--accent) }` — no extra CSS needed
- `esc()` helper used on `loc.mapUrl` in client-side JS to prevent XSS
- CSS mask trick for checkmark bullets — no per-item SVG, respects accent color in light/dark
- Removed "auto-updates every hour" copy — refresh is client-controlled, not worker-controlled
- Home/away detection uses before-vs substring check: find vsIdx via `/\bvs\.?\b/i`, slice summary up to that index, test if teamId appears in slice — more robust than start-of-string regex
- Jersey color always appended to DESCRIPTION descParts — every game is home or away, no unknown state
- No new CSS for jersey color — `.meta` class already provides correct dimmed styling

### Roadmap Evolution

- Phase 3 added: Home/Away Jersey Color Assignment (show jersey colors in calendar events and subscribe page)

### v1.0 Milestone Progress

| Phase | Plan  | Status   | Key Commits                               |
|-------|-------|----------|-------------------------------------------|
| 1     | 01-01 | complete | `96fc975`, `cc1ce1b`                      |
| 2     | 02-01 | complete | `077d2cf`, `981244a`, `3365c6d`           |
| 3     | 03-01 | complete | `d2d5ca0`, `d7c1a6c`, `59e56f9`           |
