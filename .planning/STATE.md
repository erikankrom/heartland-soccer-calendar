# Project State

## Current Position

**Milestone:** v1.2 Game Intelligence — IN PROGRESS
**Current Phase:** 06-results-scraping-and-subscribe-page-enrichment — Not started
**Current Plan:** Not started
**Status:** Ready to plan

Progress: ░░░░░░░░░░ 0%

Last activity: 2026-03-04 — Milestone v1.2 created

See: .planning/PROJECT.md (updated 2026-02-20 after v1.1 milestone)

**Core value:** One-click calendar subscription for Heartland Soccer teams
**Current focus:** Phase 6 — results scraping and subscribe page enrichment

## Accumulated Context

### Decisions (full log in PROJECT.md)

All key decisions from v1.0 and v1.1 are captured in PROJECT.md Key Decisions table.

### Roadmap Evolution

- Phase 3 added: Home/Away Jersey Color Assignment
- Phase 4 added: Modify Field Map Link Location
- Phase 5 added: Add CloudFlare Website Analytics tracking script to website
- All phases 1–5 complete; v1.0 (phases 1–2) and v1.1 (phases 3–5) archived
- Milestone v1.2 created: Game Intelligence, 2 phases (Phase 6–7)

### Milestone Progress

| Milestone | Phases | Status      | Archived                               |
|-----------|--------|-------------|----------------------------------------|
| v1.0      | 1–2    | complete    | milestones/v1.0-launch.md              |
| v1.1      | 3–5    | complete    | milestones/v1.1-enhancements.md        |
| v1.2      | 6–7    | in progress | —                                      |

### v1.2 Key Context

- Results data source: `https://heartlandsoccer.net/reports/cgi-jrb/team_results.cgi?team_number={teamId}`
- `team_number` = `teamId` (same identifier used throughout the app)
- Results page HTML returns a table: Game #, Date, Field, Time, Home (name+number), Home score, Visitor (name+number), Visitor score
- Past games have scores; future games have empty score cells
- Opponent team number is embedded in the team name column (e.g. "8175 PSC 15/16G Purple") — parse leading number for opponent lookup
- League standings page exists but has no team-ID-based URL — deferred to a future phase
- Cache results at edge (existing Cache API pattern, 1-hour TTL)
