# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.3.0] — 2026-03-05

### Added
- Division standings auto-discovered from `subdiv_standings.cgi` via parallel subdivision scan
- Gender and age group inferred from opponent names in event summaries (majority vote + min birth year)
- Standings table on subscribe page with Team/W/L/T/Pts columns; subscribed team row highlighted
- Team numbers in standings table are clickable `/subscribe/{teamId}` scouting links
- Standings edge-cached independently (`{origin}/api/standings/{teamId}`, 1-hour TTL)
- "Find another team" nav link on subscribe page (replaces "Back")
- Landing page "What you get" section updated to list all features across v1.2 + v1.3
- Open Graph and Twitter Card meta tags on both pages for rich link previews
- OG preview image (`public/og-image.png`, 1200×630px, red background with shield)
- Server-side title includes team ID so iMessage/link previewers show useful text

### Fixed
- Future game dates showing 1 day ahead due to UTC→local timezone conversion; fixed server-side with `Intl.DateTimeFormat('sv', America/Chicago)` and client-side via existing `dtToDate()`

## [1.2.0] — 2026-03-05

### Added
- Results scraping from `team_results.cgi` — W-L-T record computed and cached (1-hour TTL)
- `/api/team/{teamId}` response enriched with `results` (record + game list) and `opponentRecords` map
- W-L-T record chip on subscribe page
- Full results table on subscribe page (date, opponent, H/A, score) — always visible
- Opponent W-L-T record chips on upcoming game rows
- iCal `DESCRIPTION` enriched with final score for past games (`Result: W/L/T X–Y`)
- iCal `DESCRIPTION` enriched with opponent record for upcoming games (`Opponent record: XW–YL–ZT`)
- Opponent IDs collected from both `results.games` AND iCal event SUMMARYs (covers future opponents not yet on results page)
- Opponent team numbers are clickable `/subscribe/{opponentId}` scouting links

## [1.1.0] — 2026-02-20

### Added
- Home/away jersey color in every iCal `DESCRIPTION` and subscribe page event row (White/Light vs. Dark)
- Cloudflare Web Analytics beacon on both HTML pages, gated on `CF_ANALYTICS_TOKEN` Worker secret

### Changed
- Field name text is now the clickable map link in subscribe page event rows (previously a separate "Field map" link)

## [1.0.0] — 2026-02-20

### Added
- iCal feed per team ID merging all game events (`/calendar/{teamId}`)
- Subscribe page with Apple Calendar, Google Calendar, Outlook, and webcal copy links (`/subscribe/{teamId}`)
- Landing page with value section explaining benefits to first-time visitors (`/`)
- JSON API returning team name and events (`/api/team/{teamId}`)
- Enhanced venue names (full complex names instead of raw field codes)
- Address-based `LOCATION` and `X-APPLE-STRUCTURED-LOCATION` for native Maps integration
- Field map URL in iCal `DESCRIPTION` and subscribe page event rows
- `src/locations.csv` mapping field prefixes to complex names, addresses, and map URLs
- 1-hour edge caching via Cloudflare Cache API

[unreleased]: https://github.com/erikankrom/heartland-soccer-calendar/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/erikankrom/heartland-soccer-calendar/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/erikankrom/heartland-soccer-calendar/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/erikankrom/heartland-soccer-calendar/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/erikankrom/heartland-soccer-calendar/releases/tag/v1.0.0
