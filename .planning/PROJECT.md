# Project: Heartland Soccer Team Calendars

## What This Is

A Cloudflare Worker that scrapes Heartland Soccer team pages and serves them as subscribable iCal feeds. Users enter their team ID and get subscription links for Apple Calendar, Google Calendar, Outlook, or any webcal-compatible app. Events include enhanced venue names, addresses for native Maps integration, and clickable field map links.

## Core Value

One-click calendar subscription for Heartland Soccer teams — instead of manually adding each game, users subscribe once and their calendar stays current.

## Requirements

### Validated

- ✓ iCal feed per team ID, merging all game events — v1.0
- ✓ Subscribe page with Apple Calendar, Google Calendar, Outlook, and webcal copy links — v1.0
- ✓ Enhanced venue names (full complex names instead of raw field codes) — v1.0
- ✓ Address-based LOCATION and X-APPLE-STRUCTURED-LOCATION for native Maps integration — v1.0
- ✓ Field map URL in iCal DESCRIPTION and subscribe page event rows — v1.0
- ✓ Landing page with value section explaining benefits to first-time visitors — v1.0
- ✓ Home/away jersey color shown in iCal DESCRIPTION and subscribe page event rows — v1.1
- ✓ Field name text is the clickable map link in subscribe page event rows — v1.1
- ✓ Cloudflare Web Analytics beacon injected via CF_ANALYTICS_TOKEN env var (privacy-first, no cookies) — v1.1
- ✓ W-L-T record displayed on subscribe page — v1.2
- ✓ Full results table on subscribe page (date, opponent, H/A, score) — v1.2
- ✓ Opponent W-L-T chip on upcoming game rows in subscribe page — v1.2
- ✓ iCal DESCRIPTION enriched with final score for past games — v1.2
- ✓ iCal DESCRIPTION enriched with opponent record for future games — v1.2
- ✓ Opponent team numbers are clickable scouting links to /subscribe/{opponentId} — v1.2

### Active

- [ ] Standings lookup — see team's current league record (standings page has no team-ID-based URL; deferred)
- [ ] Game video feed integration — links to match recordings when available

### Out of Scope

- User accounts / auth — no login, all public team data
- Push notifications — calendar subscription pull model only; no server-side push
- Mobile native app — Cloudflare Worker + webcal subscription covers all platforms

## Context

Shipped v1.2 with 1,355 lines JS (single-file Worker, src/index.js) + 7-line CSV locations map (src/locations.csv). Deployed to heartland.ankrom.ai via Cloudflare Workers. No database or KV — iCal data and results data fetched from upstream on demand, edge-cached for 1 hour each. Analytics via Cloudflare Analytics Engine (server-side) and Cloudflare Web Analytics beacon (client-side page views). Results scraped from `team_results.cgi`; opponent records fetched in parallel with per-entry error handling.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Field map URL in iCal DESCRIPTION, not URL: property | RFC 5545 only allows one URL: per VEVENT; already used for source page | ✓ Good |
| Subscribe page uses existing `meta` class + global `a { color: var(--accent) }` | No extra CSS needed for map link or jersey color | ✓ Good |
| `esc()` helper on `loc.mapUrl` in client JS | XSS prevention on user-visible external URL | ✓ Good |
| CSS mask for checkmark bullets | Single CSS rule, no per-item SVG, inherits accent color in light/dark | ✓ Good |
| Removed "auto-updates every hour" landing page copy | Refresh interval is controlled by calendar client, not worker | ✓ Good |
| Single-file Worker architecture | Cloudflare Workers constraint; no build step, fast deploys | ✓ Good |
| Home/away detection via before-vs substring check | More robust than start-of-string regex — Heartland SUMMARY strings have leading brackets/codes | ✓ Good |
| Field name as map link; `locLabel` contains raw HTML | Minimal diff by retaining `mapLink = ''`; safe because all dynamic values go through `esc()` | ✓ Good |
| `env` passed as whole object into render functions | Consistent Worker pattern; `env?.CF_ANALYTICS_TOKEN ?? null` handles absent env gracefully | ✓ Good |
| Analytics beacon uses `defer` attribute | Never blocks page render | ✓ Good |
| Results cache key `{origin}/api/results/{teamId}` | Namespace only (not a real route) — avoids collision with real routes | ✓ Good |
| Opponent records fetched in parallel via Promise.all | Per-entry `.catch(() => null)` means one failing opponent doesn't break the response | ✓ Good |
| Opponent ID collection from both results.games AND iCal events | results.games only covers past opponents; future opponents live only in the calendar until they appear on results | ✓ Good |
| iCal DESCRIPTION enriched in generateICal (not a separate route) | Keeps enrichment co-located with calendar generation; no extra endpoint | ✓ Good |
| SUMMARY home/away split via vsIdx + beforeVs.includes(teamId) | More robust than position-based approach — team number is reliable in Heartland SUMMARY strings | ✓ Good |

## Constraints

- Must run in Cloudflare Workers runtime (no Node.js APIs)
- No persistent storage (KV not used; edge cache only)
- Upstream Heartland Soccer pages scraped via regex — fragile if site structure changes
- All HTML server-rendered as template literals (no framework, no build step)

---
*Last updated: 2026-03-05 after v1.2 milestone*
