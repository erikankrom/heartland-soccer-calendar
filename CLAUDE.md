# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cloudflare Worker that scrapes team events from calendar.heartlandsoccer.net and serves them as a subscribable iCal (.ics) feed. Deployed to `heartland.ankrom.ai`.

## Commands

- `npm run dev` — local dev server via `wrangler dev`
- `npm run deploy` — deploy to Cloudflare via `wrangler deploy`
- `npm run tail` — stream live logs from deployed worker

## Architecture

Single-file Worker ([src/index.js](src/index.js)) with four routes:

| Route | Purpose |
|---|---|
| `GET /` | Landing page (enter team ID) |
| `GET /subscribe/{teamId}` | Subscribe page with calendar links + events preview |
| `GET /calendar/{teamId}` | Raw iCal feed (what calendar apps subscribe to) |
| `GET /api/team/{teamId}` | JSON API returning team name and events (consumed by subscribe page) |

**Data flow:** Fetch HTML from Heartland Soccer → extract base64-encoded iCal blobs via regex → decode and parse VEVENT fields → merge into single VCALENDAR → cache at edge for 1 hour via Cloudflare Cache API (no KV or external stores).

**Field locations:** [src/locations.csv](src/locations.csv) maps field prefixes (e.g. `OSC`, `OP`) to complex names and addresses. Imported as a text module via wrangler `[[rules]]`. Parsed at runtime and cached in-memory for 24h. Addresses are used for LOCATION and X-APPLE-STRUCTURED-LOCATION in calendar events.

**HTML rendering:** All pages are server-rendered as template literal strings (no framework). The subscribe page fetches `/api/team/{teamId}` client-side to populate team name, events list, and calendar subscription links (webcal, Google Calendar, Outlook).

**Caching:** Uses Cloudflare Cache API directly (`caches.default`). Only the `/calendar/{teamId}` route is cached (1 hour TTL). The cache key is normalized to `{origin}/calendar/{teamId}`.

## Key Constants

- `SOURCE_BASE_URL` — upstream Heartland Soccer calendar URL
- `CACHE_TTL_SECONDS` — edge cache TTL (default 3600)
- `LOCATIONS_CACHE_TTL` — in-memory locations cache TTL (default 24h)
