# Heartland Soccer Team Calendars

A Cloudflare Worker that scrapes your team's events from [calendar.heartlandsoccer.net](https://calendar.heartlandsoccer.net) and serves them as a single subscribable iCal (.ics) feed. The subscribe page shows team records, standings, and opponent context. Calendar apps auto-refresh to pick up schedule changes.

Live at **[heartland.ankrom.ai](https://heartland.ankrom.ai)**

## Features

- **Single feed** — all games merged into one subscribable calendar
- **W-L-T record** and full results table with scores from every played game
- **Division standings** — auto-discovered; your team's row is highlighted
- **Opponent records** on upcoming game rows so you know what you're walking into
- **Clickable opponent links** — tap any opponent number to scout their schedule
- **iCal enrichment** — past events show final score; upcoming events show opponent record
- **Home/away jersey color** reminder in every calendar event (White/Light vs. Dark)
- **Enhanced venue names** — human-readable field names with addresses for native Maps integration
- **Field map links** in calendar events and on the subscribe page
- **1-hour edge caching** — fast responses, gentle on the source site
- **Works everywhere** — Apple Calendar, Google Calendar, Outlook, any iCal client
- **Privacy-first analytics** via Cloudflare Web Analytics (no cookies)

## Routes

| Route | Purpose |
|---|---|
| `GET /` | Landing page — enter a team ID to get started |
| `GET /subscribe/{teamId}` | Subscribe page with calendar links, record, standings, and game list |
| `GET /calendar/{teamId}` | Raw iCal feed (what calendar apps subscribe to) |
| `GET /api/team/{teamId}` | JSON API — team name, events, results, standings, opponent records |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)

### Install & Deploy

```bash
npm install

# Test locally
npm run dev

# Deploy to Cloudflare
npm run deploy
```

After deploying, Wrangler will print your worker URL:

```
https://heartland-soccer-calendar.<your-subdomain>.workers.dev
```

### Optional: Cloudflare Web Analytics

Set the `CF_ANALYTICS_TOKEN` secret in your Worker to enable the analytics beacon on both HTML pages:

```bash
npx wrangler secret put CF_ANALYTICS_TOKEN
```

## How to Subscribe

### Apple Calendar (iPhone/Mac)

1. Go to **Settings → Calendar → Accounts → Add Account → Other**
2. Tap **Add Subscribed Calendar**
3. Paste the calendar URL (`/calendar/{teamId}`)
4. Tap **Subscribe**

Or open the subscribe page and tap **Add to Apple Calendar** — it launches the `webcal://` link directly.

### Google Calendar

1. Open [Google Calendar](https://calendar.google.com)
2. Click **+** next to "Other calendars" → **From URL**
3. Paste the calendar URL
4. Click **Add calendar**

### Outlook (Desktop/Web)

1. Go to **Calendar → Add calendar → Subscribe from web**
2. Paste the calendar URL
3. Click **Import**

## How It Works

1. Request hits the Cloudflare edge — cache checked first (1-hour TTL)
2. On miss: fetches the team events page from Heartland Soccer, extracts base64-encoded iCal blobs per event, merges into a single `VCALENDAR`
3. Results and standings fetched in parallel from `team_results.cgi` and `subdiv_standings.cgi`, each cached independently for 1 hour
4. Standings are auto-discovered: gender and age group are inferred from opponent names in event summaries, then subdivisions 1–15 are scanned in parallel
5. iCal `DESCRIPTION` fields are enriched with final scores (past games) and opponent records (upcoming games)
6. All data served from a single Cloudflare Worker with no database or KV — edge cache only

## Architecture

Single-file Worker (`src/index.js`, ~1,500 lines) + `src/locations.csv` (field prefix → complex name + address).

**Caching:** Three independent Cache API namespaces, all 1-hour TTL:
- `{origin}/calendar/{teamId}` — iCal feed
- `{origin}/api/results/{teamId}` — results + record
- `{origin}/api/standings/{teamId}` — division standings

**Field locations:** `src/locations.csv` maps field prefixes (e.g. `OSC`, `OP`) to complex names and addresses. Parsed at runtime, cached in-memory for 24 hours.

## Configuration

| Constant | Default | Description |
|---|---|---|
| `CACHE_TTL_SECONDS` | `3600` | iCal feed cache TTL (seconds) |
| `LOCATIONS_CACHE_TTL` | `86400` | In-memory locations cache TTL (seconds) |

## License

MIT
