# Project State

## Current Position

**Milestone:** v1.2 Game Intelligence — ARCHIVED
**Status:** All milestones complete through v1.2. Ready to plan v1.3.

Last activity: 2026-03-05 — v1.2 milestone archived

See: .planning/PROJECT.md (updated 2026-03-05 after v1.2 milestone)

**Core value:** One-click calendar subscription for Heartland Soccer teams
**Current focus:** Planning next milestone (v1.3)

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

### 06-01 Decisions

- Results cache key: `{origin}/api/results/{teamId}` — namespace only, not a real route
- `handleTeamAPI` now accepts `(teamId, origin, ctx)` — router passes `url.origin` and `ctx`
- Opponent records fetched in parallel via `Promise.all` after extracting unique opponent IDs; failures return null and are omitted from `opponentRecords` map
- `/api/team/{teamId}` response now includes `results: { record, games }` and `opponentRecords: { [id]: record }`

### 06-02 Decisions

- Opponent ID collection scans both `results.games` AND iCal events server-side — future opponents are only in the calendar until they appear on the results page
- Home/away opponent extraction from SUMMARY: `beforeVs` has home team number, `afterVs` has away; pick the correct side based on `isHome`
- Results table always visible (no toggle) — compact enough, simpler UX
- Subscribe page layout: team identity block (name, record, source) above divider; Team Calendar block (heading, subtitle, subscribe, events) below
- Grey chip (`var(--bg)`, `border-radius: 6px`) used for record value and opponent record annotation — consistent visual language
- `.planning/TODOS.md` created; first item: clickable opponent links to `/subscribe/{opponentId}`
