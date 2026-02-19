# Heartland Soccer iCal Calendar Merger

A Cloudflare Worker that scrapes your team's events from [calendar.heartlandsoccer.net](https://calendar.heartlandsoccer.net) and serves them as a single subscribable iCal (.ics) feed. Calendar apps on your phone and desktop will auto-refresh to pick up schedule changes.

## Features

- **Single feed** — all games merged into one subscribable calendar
- **1-hour edge caching** — fast responses, gentle on the source site
- **Works everywhere** — Apple Calendar, Google Calendar, Outlook, any iCal client
- **Any team** — just change the team ID in the URL

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)

### Install & Deploy

```bash
cd heartland-soccer-calendar
npm install

# Test locally
npx wrangler dev

# Deploy to Cloudflare
npx wrangler deploy
```

After deploying, Wrangler will print your worker URL, something like:

```text
https://heartland-soccer-calendar.<your-subdomain>.workers.dev
```

### Subscribe URL

Use this URL in your calendar app:

```text
https://heartland-soccer-calendar.<your-subdomain>.workers.dev/calendar/8174
```

Replace `8174` with any Heartland Soccer team ID. You can find the team ID in the URL when you view a team's events on the Heartland Soccer website.

## How to Subscribe

### Apple Calendar (iPhone/Mac)

1. Go to **Settings → Calendar → Accounts → Add Account → Other**
2. Tap **Add Subscribed Calendar**
3. Paste the subscribe URL
4. Tap **Subscribe**

### Google Calendar

1. Open [Google Calendar](https://calendar.google.com)
2. Click the **+** next to "Other calendars" → **From URL**
3. Paste the subscribe URL
4. Click **Add calendar**

### Outlook (Desktop/Web)

1. Go to **Calendar → Add calendar → Subscribe from web**
2. Paste the subscribe URL
3. Click **Import**

## How It Works

1. When a request comes in, the worker checks the Cloudflare edge cache
2. If cached (< 1 hour old), it returns immediately
3. If not cached, it fetches the team events page from Heartland Soccer
4. It extracts the base64-encoded iCal data from each event's "Add to iCalendar" link
5. It merges all events into a single `VCALENDAR` with proper timezone info
6. The response is cached at the edge for 1 hour, then returned

## Configuration

Edit `src/index.js` to change:

| Constant            | Default | Description                                |
| ------------------- | ------- | ------------------------------------------ |
| `CACHE_TTL_SECONDS` | `3600`  | How long to cache (seconds). 3600 = 1 hour |

## License

MIT
