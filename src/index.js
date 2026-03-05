/**
 * Heartland Soccer iCal Calendar Merger
 *
 * Cloudflare Worker that scrapes the Heartland Soccer team events page,
 * extracts all individual game events, and serves them as a single
 * subscribable iCal (.ics) calendar feed with 1-hour caching.
 *
 * Routes:
 *   GET /                    → Landing page UI
 *   GET /subscribe/{teamId}  → Subscription links page (with team name + events preview)
 *   GET /calendar/{teamId}   → Raw iCal feed (for calendar app subscriptions)
 *   GET /api/team/{teamId}   → JSON team info (used by subscribe page)
 */

import locationsCSV from './locations.csv';

const SOURCE_BASE_URL = 'https://calendar.heartlandsoccer.net/team/events';
const CACHE_TTL_SECONDS = 3600; // 1 hour

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- iCal feed endpoint ---
    const calendarMatch = path.match(/^\/calendar\/(\d+)\/?$/);
    if (calendarMatch) {
      return handleCalendarFeed(calendarMatch[1], url, ctx, request, env);
    }

    // --- Team info JSON API ---
    const apiMatch = path.match(/^\/api\/team\/(\d+)\/?$/);
    if (apiMatch) {
      return handleTeamAPI(apiMatch[1], url.origin, ctx);
    }

    // --- Subscription links page ---
    const subscribeMatch = path.match(/^\/subscribe\/(\d+)\/?$/);
    if (subscribeMatch) {
      return handleSubscribePage(subscribeMatch[1], url, env);
    }

    // --- Landing page ---
    if (path === '/' || path === '') {
      return new Response(renderLandingPage(env), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

// ─── Route Handlers ─────────────────────────────────────────────────────────

async function handleCalendarFeed(teamId, url, ctx, request, env) {
  if (env?.AE) {
    env.AE.writeDataPoint({
      blobs: [
        teamId,
        request.headers.get('CF-Connecting-IP') ?? '',
        (request.headers.get('user-agent') ?? '').slice(0, 100),
        request.cf?.country ?? 'XX',
      ],
      indexes: [teamId],
    });
  }

  const cacheKey = new Request(`${url.origin}/calendar/${teamId}`, { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const icalContent = await buildCalendar(teamId);
    const response = new Response(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="heartland-soccer-${teamId}.ics"`,
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
        'Access-Control-Allow-Origin': '*',
        'X-Generated-At': new Date().toISOString(),
      },
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return new Response(`Error generating calendar: ${err.message}`, {
      status: 502,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function handleTeamAPI(teamId, origin, ctx) {
  try {
    const [{ events, teamName }, results] = await Promise.all([
      fetchTeamInfo(teamId),
      fetchResults(teamId, origin, ctx).catch(() => null),
    ]);
    const eventsWithLoc = events.map(e => {
      const loc = resolveLocation(e.description);
      return { summary: e.summary, dtstart: e.dtstart, dtend: e.dtend, location: loc };
    });

    // Build opponent records map from unique opponent IDs in results
    let opponentRecords = {};
    if (results && results.games) {
      const opponentIds = [...new Set(results.games.map(g => g.opponentId).filter(Boolean))];
      const opponentEntries = await Promise.all(
        opponentIds.map(async oppId => {
          try {
            const oppResults = await fetchResults(oppId, origin, ctx);
            return oppResults ? [oppId, oppResults.record] : null;
          } catch {
            return null;
          }
        })
      );
      for (const entry of opponentEntries) {
        if (entry) opponentRecords[entry[0]] = entry[1];
      }
    }

    return new Response(JSON.stringify({ teamId, teamName, events: eventsWithLoc, results, opponentRecords }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function handleSubscribePage(teamId, url, env) {
  return new Response(renderSubscribePage(teamId, url, env), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ─── Calendar Building ──────────────────────────────────────────────────────

async function fetchTeamInfo(teamId) {
  const sourceUrl = `${SOURCE_BASE_URL}/${teamId}`;
  const resp = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'HeartlandSoccerCalendarMerger/1.0', Accept: 'text/html' },
  });
  if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status}`);
  const html = await resp.text();
  const events = parseEventsFromHTML(html);
  if (events.length === 0) throw new Error('No events found for this team ID.');
  const teamName = extractTeamName(events, teamId);
  return { events, teamName };
}

async function buildCalendar(teamId) {
  const { events, teamName } = await fetchTeamInfo(teamId);
  return generateICal(events, teamId, teamName, `${SOURCE_BASE_URL}/${teamId}`);
}

function parseEventsFromHTML(html) {
  const events = [];
  const base64Pattern = /data:text\/calendar[^,]*;base64,([A-Za-z0-9+/=]+)/g;
  let match;
  while ((match = base64Pattern.exec(html)) !== null) {
    const icalData = atob(match[1]);
    const event = parseVEvent(icalData);
    if (event) events.push(event);
  }
  return events;
}

function parseVEvent(icalText) {
  const getField = (field) => {
    const m = icalText.match(new RegExp(`^${field}[;:](.*)$`, 'm'));
    return m ? m[1].trim() : null;
  };
  const uid = getField('UID');
  const summary = getField('SUMMARY');
  const dtstart = getField('DTSTART');
  const dtend = getField('DTEND');
  const description = getField('DESCRIPTION');
  if (!summary || !dtstart) return null;
  return { uid: uid || generateUID(summary, dtstart), summary, dtstart, dtend, description, raw: icalText };
}

// ─── Field Location Mapping ──────────────────────────────────────────────────

let _locationsCache = null;
let _locationsCacheTime = 0;
const LOCATIONS_CACHE_TTL = 86400000; // 24 hours in ms

function parseLocationsCSV(text) {
  const map = {};
  const lines = text.trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    fields.push(current.trim());
    if (fields.length >= 3) {
      map[fields[0]] = { name: fields[1], address: fields[2], mapUrl: fields[3] || null };
    }
  }
  return map;
}

function getFieldLocations() {
  const now = Date.now();
  if (!_locationsCache || (now - _locationsCacheTime) > LOCATIONS_CACHE_TTL) {
    _locationsCache = parseLocationsCSV(locationsCSV);
    _locationsCacheTime = now;
  }
  return _locationsCache;
}

function resolveLocation(fieldStr) {
  if (!fieldStr) return null;
  const raw = fieldStr.replace(/^Field:\s*/i, '').trim();
  if (!raw) return null;
  const m = raw.match(/^([A-Z]+)\s/);
  const prefix = m ? m[1] : null;
  const locations = getFieldLocations();
  const complex = prefix && locations[prefix];
  if (complex) {
    return { field: raw, name: complex.name, address: complex.address, mapUrl: complex.mapUrl || null };
  }
  return { field: raw, name: null, address: null, mapUrl: null };
}

// ─── Results Scraping ────────────────────────────────────────────────────────

const RESULTS_BASE_URL = 'https://heartlandsoccer.net/reports/cgi-jrb/team_results.cgi?team_number=';

function resultsDateToISO(d) {
  // MM/DD/YY → YYYY-MM-DD
  const [mm, dd, yy] = d.split('/');
  return `20${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function icalDateToISO(dtstart) {
  // DTSTART or DTSTART;TZID=...: YYYYMMDD[Thhmmss] → YYYY-MM-DD
  const raw = dtstart.includes(':') ? dtstart.split(':').pop() : dtstart;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function parseResultsHTML(html, teamId) {
  const teamIdStr = String(teamId);
  const games = [];
  const rowPattern = /<tr[^>]*class=text[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const clean = raw => raw.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();

  let rowMatch;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells = [];
    let cellMatch;
    const cellRe = new RegExp(cellPattern.source, 'gi');
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(clean(cellMatch[1]));
    }
    if (cells.length < 8) continue;

    const [, date, field, time, homeTeam, homeScore, visitorTeam, visitorScore] = cells;
    if (!date || !date.includes('/')) continue;

    const homeNum = (homeTeam.match(/^(\d+)/) || [])[1] || '';
    const visitorNum = (visitorTeam.match(/^(\d+)/) || [])[1] || '';
    const isHome = homeNum === teamIdStr;
    const opponentNum = isHome ? visitorNum : homeNum;
    const opponentName = isHome ? visitorTeam : homeTeam;

    const scored = homeScore !== '' && visitorScore !== '';
    const teamScore = isHome ? homeScore : visitorScore;
    const oppScore = isHome ? visitorScore : homeScore;

    games.push({
      date: resultsDateToISO(date),
      field,
      time,
      isHome,
      opponentId: opponentNum,
      opponentName: opponentName.replace(/^\d+\s*/, '').trim(),
      scored,
      teamScore: scored ? Number(teamScore) : null,
      oppScore: scored ? Number(oppScore) : null,
    });
  }

  // Compute W-L-T record from scored games
  let wins = 0, losses = 0, ties = 0;
  for (const g of games) {
    if (!g.scored) continue;
    if (g.teamScore > g.oppScore) wins++;
    else if (g.teamScore < g.oppScore) losses++;
    else ties++;
  }

  return { record: { wins, losses, ties }, games };
}

async function fetchResults(teamId, origin, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(`${origin}/api/results/${teamId}`, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const resp = await fetch(`${RESULTS_BASE_URL}${teamId}`, {
    headers: { 'User-Agent': 'heartland-soccer-calendar/1.0' },
  });
  if (!resp.ok) return null;

  const html = await resp.text();
  const data = parseResultsHTML(html, teamId);

  const jsonResp = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, jsonResp.clone()));
  return data;
}

// RFC 5545 §3.3.5: use ; before parameters (TZID=...), : before bare datetime values.
function dtProp(name, val) {
  const eq = val.indexOf('=');
  const colon = val.indexOf(':');
  const hasParam = eq !== -1 && (colon === -1 || eq < colon);
  return `${name}${hasParam ? ';' : ':'}${val}`;
}

function generateICal(events, teamId, teamName, sourceUrl) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HeartlandSoccerCalendarMerger//EN',
    `X-WR-CALNAME:${teamName} - Heartland Soccer`, 'X-WR-TIMEZONE:America/Chicago',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    'BEGIN:VTIMEZONE', 'TZID:America/Chicago',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT',
    'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST',
    'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${now}`, `SUMMARY:${e.summary}`);
    if (e.dtstart) lines.push(dtProp('DTSTART', e.dtstart));
    if (e.dtend) lines.push(dtProp('DTEND', e.dtend));
    const loc = resolveLocation(e.description);
    // Build DESCRIPTION with field details
    const descParts = [];
    if (loc) {
      descParts.push(`Field: ${loc.field}`);
      if (loc.name) descParts.push(loc.name);
      if (loc.mapUrl) descParts.push(`Field map: ${loc.mapUrl}`);
    } else if (e.description) {
      descParts.push(e.description);
    }
    const vsIdx = (e.summary || '').search(/\bvs\.?\b/i);
    const beforeVs = vsIdx >= 0 ? (e.summary || '').slice(0, vsIdx) : (e.summary || '');
    const isHome = beforeVs.includes(teamId);
    const jerseyColor = isHome ? 'Home \u2014 White/Light jerseys' : 'Away \u2014 Dark jerseys';
    descParts.push(jerseyColor);
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${descParts.join('\\n')}`);
    }
    // LOCATION = address for maps linking; escape commas per RFC 5545
    if (loc && loc.address) {
      const escaped = loc.address.replace(/,/g, '\\,');
      lines.push(`LOCATION:${escaped}`);
      // Apple Calendar structured location for native maps integration
      const title = (loc.name || loc.field).replace(/"/g, '\\"');
      const addr = loc.address.replace(/"/g, '\\"');
      lines.push(`X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="${addr}";X-APPLE-RADIUS=100;X-TITLE="${title}":geo:`);
    }
    lines.push(`URL:${sourceUrl}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function extractTeamName(events, teamId) {
  for (const e of events) {
    const s = e.summary || '';
    const m = s.match(new RegExp(`${teamId}\\s*-\\s*([^\\s].*?)\\s*vs`, 'i'))
      || s.match(new RegExp(`vs\\s*${teamId}\\s*-\\s*(.+)$`, 'i'));
    if (m) return m[1].trim();
  }
  return `Team ${teamId}`;
}

function generateUID(summary, dateStr) {
  let hash = 0;
  const str = `${summary}-${dateStr}`;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash = hash & hash; }
  return `${Math.abs(hash).toString(16)}@heartland-soccer-merger`;
}

// ─── Shared HTML Helpers ────────────────────────────────────────────────────

function htmlHead(title, analyticsToken = null) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<link rel="icon" type="image/png" href="/heartland-shield.png">
<link rel="apple-touch-icon" href="/heartland-shield.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root {
    --bg: #f5f5f5;
    --surface: #ffffff;
    --surface-hover: #fafafa;
    --border: #e2e2e2;
    --border-accent: #d62e2f;
    --text: #333333;
    --text-dim: #666666;
    --accent: #d62e2f;
    --accent-dim: #b52526;
    --accent-glow: rgba(214,46,47,.08);
    --danger: #d62e2f;
    --danger-glow: rgba(214,46,47,.07);
    --danger-border: rgba(214,46,47,.2);
    --radius: 12px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111111;
      --surface: #1a1a1a;
      --surface-hover: #222222;
      --border: #2e2e2e;
      --border-accent: #e04040;
      --text: #f0f0f0;
      --text-dim: #999999;
      --accent: #e04040;
      --accent-dim: #c93535;
      --accent-glow: rgba(224,64,64,.12);
      --danger: #f87171;
      --danger-glow: rgba(248,113,113,.08);
      --danger-border: rgba(248,113,113,.25);
      --icon-apple-bg: #1a1a1a;
      --icon-apple-border: #333;
      --icon-google-bg: #1a1f2e;
      --icon-google-border: #2a3a5f;
      --icon-outlook-bg: #1a1f28;
      --icon-outlook-border: #2a3550;
      --icon-copy-bg: #1f1a1a;
      --icon-copy-border: #3a2a2a;
    }
  }
  html { font-size: clamp(15px, 1vw + 13.5px, 17px); -webkit-text-size-adjust: 100%; }
  body {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    margin: 0;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
  }
  .page-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2.5rem 1.5rem 3rem;
  }
  .container { width: 100%; max-width: 700px; }

  /* ── Navbar ── */
  .navbar {
    background: #d62e2f;
    padding: .7rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .6rem;
  }
  .navbar img { width: 32px; height: 32px; }
  .navbar span {
    color: #fff;
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: -.01em;
  }

  /* ── Footer ── */
  .site-footer {
    background: #1a1a1a;
    color: #999;
    padding: 1.25rem 1.25rem;
    text-align: center;
    font-size: .85rem;
  }
  .site-footer a { color: #ccc; }
  .site-footer a:hover { color: #fff; }
  .footer-credit {
    display: inline-flex; align-items: center; gap: .4rem;
    color: #777; transition: color .2s;
  }
  .footer-credit:hover { color: #ccc; text-decoration: none; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* ── Card ── */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 2.25rem 2.25rem;
  }
  h1 { font-size: clamp(1.4rem, 4vw, 1.7rem); letter-spacing: -.03em; line-height: 1.25; margin-bottom: .4rem; }
  .subtitle { color: var(--text-dim); font-size: 1rem; margin-bottom: .4rem; }
  .source-hint { font-size: .75rem; color: var(--text-dim); opacity: .55; margin-bottom: 2rem; }

  /* ── Form ── */
  .field { display: flex; gap: .6rem; margin-bottom: .6rem; }
  input[type="text"] {
    flex: 1; font-family: 'DM Mono', monospace; font-size: 1rem;
    padding: .7rem 1rem; background: var(--bg);
    border: 1.5px solid var(--border); border-radius: 8px;
    color: var(--text); outline: none; transition: border-color .2s;
  }
  input[type="text"]:focus { border-color: var(--accent); }
  input::placeholder { color: var(--text-dim); opacity: .55; }
  .btn {
    display: inline-flex; align-items: center; gap: .45rem;
    font-family: 'DM Sans', system-ui, sans-serif; font-weight: 600; font-size: 1rem;
    padding: .7rem 1.35rem; border: none; border-radius: 8px;
    cursor: pointer; transition: background .2s, transform .1s; white-space: nowrap;
  }
  .btn:active { transform: scale(.97); }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover { background: var(--accent-dim); }
  .hint { font-size: .88rem; color: var(--text-dim); opacity: .7; }

  /* ── Subscribe Page ── */
  .heading-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap; margin-bottom: .4rem;
  }
  .heading-row h1 { margin-bottom: 0; flex: 1; min-width: 0; }
  .team-badge {
    display: inline-flex; align-items: center; gap: .5rem;
    background: var(--accent-glow); border: 1px solid var(--border-accent);
    border-radius: 100px; padding: .35rem .9rem;
    font-size: .9rem; font-weight: 600; color: var(--accent);
    white-space: nowrap; flex-shrink: 0;
  }
  .team-badge .dot { width: 7px; height: 7px; background: var(--accent); border-radius: 50%; }

  .links-heading {
    font-size: .85rem; text-transform: uppercase; letter-spacing: .08em;
    color: var(--text-dim); margin-bottom: .7rem; margin-top: .25rem;
  }

  .sub-link {
    display: flex; align-items: center; gap: .85rem;
    padding: .85rem 1rem; background: var(--bg);
    border: 1.5px solid var(--border); border-radius: 10px;
    margin-bottom: .55rem; cursor: pointer;
    transition: border-color .2s, background .2s;
    text-decoration: none !important; color: var(--text);
  }
  .sub-link:hover { border-color: var(--accent); background: var(--surface-hover); }
  .sub-link .icon {
    width: 36px; height: 36px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .sub-link .icon.apple   { background: var(--icon-apple-bg, #f0f0f0); border: 1px solid var(--icon-apple-border, #d0d0d0); }
  .sub-link .icon.google  { background: var(--icon-google-bg, #e8f0fe); border: 1px solid var(--icon-google-border, #a8c7fa); }
  .sub-link .icon.outlook { background: var(--icon-outlook-bg, #e6f0fa); border: 1px solid var(--icon-outlook-border, #a0c4e8); }
  .sub-link .icon.copy    { background: var(--icon-copy-bg, #fef0f0); border: 1px solid var(--icon-copy-border, #e8c4c4); }
  .sub-link .label { font-weight: 600; font-size: 1rem; }
  .sub-link .desc  { font-size: .88rem; color: var(--text-dim); }

  /* ── Subscribe Dropdown ── */
  .subscribe-toggle {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: .85rem 1.1rem;
    background: var(--accent); color: #fff;
    border: none; border-radius: 10px;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-weight: 600; font-size: 1rem;
    cursor: pointer; transition: background .2s, transform .1s;
  }
  .subscribe-toggle:hover { background: var(--accent-dim); }
  .subscribe-toggle:active { transform: scale(.98); }
  .subscribe-toggle .chevron {
    transition: transform .25s ease;
    flex-shrink: 0;
  }
  .subscribe-toggle[aria-expanded="true"] .chevron {
    transform: rotate(180deg);
  }
  .subscribe-panel {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows .3s ease;
  }
  .subscribe-panel[data-open="true"] {
    grid-template-rows: 1fr;
  }
  .subscribe-panel-inner {
    overflow: hidden;
  }
  .subscribe-panel-inner > :first-child {
    margin-top: .75rem;
  }

  .url-box {
    font-family: 'DM Mono', monospace; font-size: .85rem;
    background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
    padding: .65rem .85rem; color: var(--accent); word-break: break-all;
    margin-top: .35rem; margin-bottom: 1.5rem;
  }

  .divider { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }

  /* ── Events Preview ── */
  .events-heading {
    font-size: .85rem; text-transform: uppercase; letter-spacing: .08em;
    color: var(--text-dim); margin-bottom: .7rem;
  }
  .event-row {
    display: flex; gap: .85rem; padding: .75rem 0;
    border-bottom: 1px solid var(--border); align-items: flex-start;
  }
  .event-row:last-child { border-bottom: none; }
  .event-date { min-width: 44px; text-align: center; flex-shrink: 0; }
  .event-date .month {
    font-size: .75rem; text-transform: uppercase; letter-spacing: .06em;
    color: var(--accent); font-weight: 700;
  }
  .event-date .day { font-size: 1.35rem; font-weight: 700; line-height: 1.15; }
  .event-info { min-width: 0; overflow-wrap: break-word; }
  .event-info .title { font-size: .95rem; font-weight: 600; line-height: 1.3; }
  .event-info .meta { font-size: .85rem; color: var(--text-dim); margin-top: .15rem; }

  /* ── Toast ── */
  .toast {
    position: fixed; bottom: 1.5rem; left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--accent); color: #fff;
    font-weight: 600; font-size: .95rem; padding: .6rem 1.3rem;
    border-radius: 100px; opacity: 0;
    transition: opacity .25s, transform .25s;
    pointer-events: none; z-index: 999;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

  /* ── Loading ── */
  .spinner {
    width: 28px; height: 28px; margin: 2rem auto;
    border: 3px solid var(--border); border-top-color: var(--accent);
    border-radius: 50%; animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .skeleton {
    background: var(--border); border-radius: 6px; height: 1em;
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { opacity: .5; } 50% { opacity: 1; } }
  .skeleton-title { width: 65%; height: 1.5rem; margin-bottom: .5rem; }
  .skeleton-subtitle { width: 45%; height: .9rem; margin-bottom: 1.75rem; }
  .skeleton-btn { width: 100%; height: 44px; border-radius: 10px; }
  .skeleton-row { display: flex; gap: .85rem; padding: .65rem 0; border-bottom: 1px solid var(--border); }
  .skeleton-row:last-child { border-bottom: none; }
  .skeleton-date { width: 42px; height: 42px; border-radius: 6px; flex-shrink: 0; }
  .skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: .4rem; padding-top: .2rem; }
  .skeleton-line { height: .8rem; border-radius: 4px; }
  .skeleton-line:first-child { width: 80%; }
  .skeleton-line:last-child { width: 50%; }
  #loadError { display: none; }

  /* ── Error ── */
  .error-box {
    background: var(--danger-glow); border: 1px solid var(--danger-border);
    border-radius: 10px; padding: 1.25rem 1.5rem; margin-top: 1rem;
  }
  .error-box strong { color: var(--danger); }

  .back {
    display: inline-flex; align-items: center; gap: .35rem;
    font-size: .95rem; color: var(--text-dim); margin-bottom: 1.5rem;
  }
  .back:hover { color: var(--accent); text-decoration: none; }

  /* ── Section Heading ── */
  .section-heading {
    font-size: .85rem; text-transform: uppercase; letter-spacing: .08em;
    color: var(--text-dim); margin-bottom: .35rem; font-weight: 600;
  }

  /* ── Record Row (badge + toggle inline) ── */
  .record-row {
    display: flex; align-items: center; gap: .75rem;
    flex-wrap: wrap; margin-bottom: .5rem;
  }

  /* ── Record Badge & Results Table ── */
  .record-badge {
    display: inline-flex; align-items: center; gap: .45rem;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 100px; padding: .3rem .85rem;
    font-size: .9rem; font-weight: 600; color: var(--text);
  }
  .record-badge .record-label {
    font-size: .8rem; font-weight: 400; color: var(--text-dim);
    text-transform: uppercase; letter-spacing: .05em;
  }
  .results-toggle {
    display: inline-flex; align-items: center; gap: .3rem;
    background: none; border: 1px solid var(--border); border-radius: 100px;
    padding: .3rem .75rem;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: .88rem; color: var(--text-dim); cursor: pointer;
    text-decoration: none;
  }
  .results-toggle:hover { border-color: var(--accent); color: var(--accent); }
  .results-toggle .chevron { transition: transform .25s ease; }
  .results-table-wrap {
    overflow: hidden;
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows .3s ease;
  }
  .results-table-wrap[data-open="true"] { grid-template-rows: 1fr; }
  .results-table-inner { overflow: hidden; }
  .results-table {
    width: 100%; border-collapse: collapse;
    font-size: .88rem; margin-top: .6rem; margin-bottom: .75rem;
  }
  .results-table th {
    text-align: left; font-size: .78rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: .06em;
    color: var(--text-dim); padding: .35rem .5rem;
    border-bottom: 1px solid var(--border);
  }
  .results-table td {
    padding: .45rem .5rem; border-bottom: 1px solid var(--border);
    color: var(--text);
  }
  .results-table tr:last-child td { border-bottom: none; }
  .result-badge {
    display: inline-block; font-weight: 700; font-size: .82rem;
    padding: .1rem .4rem; border-radius: 4px;
    white-space: nowrap;
  }
  .result-W { background: #dcfce7; color: #166534; }
  .result-L { background: #fee2e2; color: #991b1b; }
  .result-T { background: var(--border); color: var(--text-dim); }
  @media (prefers-color-scheme: dark) {
    .result-W { background: #14532d; color: #86efac; }
    .result-L { background: #7f1d1d; color: #fca5a5; }
    .result-T { background: #2e2e2e; color: #999; }
  }
  .score-badge {
    display: inline-flex; align-items: center;
    font-weight: 700; font-size: .82rem;
    padding: .1rem .45rem; border-radius: 4px;
    white-space: nowrap; margin-left: .4rem;
  }
  .opp-record {
    display: inline-block; font-size: .8rem; color: var(--text-dim);
    margin-left: .4rem; white-space: nowrap;
  }
  #results-section { margin-bottom: .25rem; }

  /* ── Mobile-friendly touch & tap ── */
  @media (pointer: coarse) {
    .sub-link, .subscribe-toggle, .btn, .back { min-height: 44px; }
    .sub-link { padding: 1rem; }
  }

  /* ── Safe area insets for notched phones ── */
  .navbar { padding-left: max(.75rem, env(safe-area-inset-left)); padding-right: max(.75rem, env(safe-area-inset-right)); padding-top: max(.7rem, env(safe-area-inset-top)); }
  .site-footer { padding-bottom: max(1.25rem, env(safe-area-inset-bottom)); padding-left: max(1.25rem, env(safe-area-inset-left)); padding-right: max(1.25rem, env(safe-area-inset-right)); }

  @media (max-width: 720px) {
    .card { padding: 1.75rem 1.5rem; }
  }

  @media (max-width: 600px) {
    .page-content { padding: 1.5rem 1rem 2.5rem; }
    .card { padding: 1.5rem 1.25rem; }
    .field { flex-direction: column; }
    .btn { justify-content: center; width: 100%; }
  }

  @media (max-width: 380px) {
    .page-content { padding: 1.25rem .75rem 2rem; }
    .card { padding: 1.25rem 1rem; }
    .sub-link { gap: .6rem; padding: .75rem .85rem; }
    .sub-link .icon { width: 34px; height: 34px; }
    .event-date { min-width: 40px; }
  }

  /* ── Value Section ── */
  .value-section {
    margin-top: 2rem;
  }
  .value-section h2 {
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--text-dim);
    margin-bottom: 1rem;
  }
  .feature-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: .55rem;
  }
  .feature-list li {
    display: flex;
    align-items: flex-start;
    gap: .65rem;
    font-size: .95rem;
    color: var(--text);
    line-height: 1.45;
  }
  .feature-list li::before {
    content: '';
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: .1em;
    background: var(--accent);
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* checkmark via mask */
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M13 4L6.5 11 3 7.5' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E") center/contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M13 4L6.5 11 3 7.5' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E") center/contain no-repeat;
  }
  .planned-section {
    margin-top: 1.75rem;
  }
  .planned-section h2 {
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--text-dim);
    margin-bottom: 1rem;
  }
  .planned-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: .55rem;
  }
  .planned-list li {
    display: flex;
    align-items: flex-start;
    gap: .65rem;
    font-size: .95rem;
    color: var(--text-dim);
    line-height: 1.45;
  }
  .planned-list li::before {
    content: '';
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: .1em;
    border: 1.5px solid var(--border);
    border-radius: 50%;
  }
</style>${analyticsToken
    ? `\n<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${analyticsToken}"}'></script>`
    : ''}
</head>`;
}

const NAVBAR = `<nav class="navbar"><img src="/heartland-shield.png" alt="Heartland Soccer" /><span>Heartland Soccer Team Calendars</span></nav>`;
const FOOTER = `<footer class="site-footer">
  <p>This site is not affiliated with Heartland Soccer Association. For official information, visit <a href="https://www.heartlandsoccer.net" target="_blank">heartlandsoccer.net</a>.</p>
  <p style="margin-top:.6rem">
    <a href="https://github.com/erikankrom" target="_blank" class="footer-credit">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      Made by erikankrom
    </a>
  </p>
  <p style="margin-top:.75rem">
    <script type="text/javascript" src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js" data-name="bmc-button" data-slug="erikankrom" data-color="#FFDD00" data-emoji="" data-font="Cookie" data-text="Buy me a coffee" data-outline-color="#000000" data-font-color="#000000" data-coffee-color="#ffffff"><\/script>
  </p>
</footer>`;

// ─── Landing Page ───────────────────────────────────────────────────────────

function renderLandingPage(env) {
  return `${htmlHead('Heartland Soccer Team Calendars', env?.CF_ANALYTICS_TOKEN ?? null)}
<body>
${NAVBAR}
<div class="page-content">
<div class="container">
  <div class="card">
    <h1>Subscribe to your team schedule</h1>
    <p class="subtitle">Enter a Heartland Soccer team ID to generate a live calendar feed you can subscribe to from any device.</p>
    <form id="form">
      <div class="field">
        <input type="text" id="teamId" placeholder="e.g. 8174" pattern="[0-9]+" required autocomplete="off" inputmode="numeric" />
        <button type="submit" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Get Links
        </button>
      </div>
      <p class="hint">Find the team ID in the URL at <a href="https://calendar.heartlandsoccer.net" target="_blank">calendar.heartlandsoccer.net</a></p>
    </form>
  </div>

  <div class="value-section">
    <h2>Why use this?</h2>
    <ul class="feature-list">
      <li>Subscribe to all your team's games at once — no more adding events one by one</li>
      <li>Enhanced venue names (e.g. "GARMIN Olathe Soccer Complex") instead of raw field codes like "OSC 7A"</li>
      <li>Field map links included in each event so you can find the exact field</li>
      <li>Structured location data for native Maps integration on Apple and Google devices</li>
    </ul>
  </div>

  <div class="planned-section">
    <h2>Planned updates</h2>
    <ul class="planned-list">
      <li>Game video feed integration — links to match recordings when available</li>
    </ul>
  </div>
</div>
</div>
${FOOTER}
<script>
  document.getElementById('form').addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('teamId').value.trim();
    if (id && /^\\d+$/.test(id)) window.location.href = '/subscribe/' + id;
  });
</script>
</body></html>`;
}

// ─── Subscribe Page ─────────────────────────────────────────────────────────

function renderSubscribePage(teamId, url, env) {
  const webcalUrl = `webcal://${url.host}/calendar/${teamId}`;
  const httpsUrl = `${url.origin}/calendar/${teamId}`;
  const skeletonRows = Array(4).fill(`
    <div class="skeleton-row">
      <div class="skeleton skeleton-date"></div>
      <div class="skeleton-lines"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>
    </div>`).join('');

  return `${htmlHead('Loading… – Heartland Soccer Team Calendars', env?.CF_ANALYTICS_TOKEN ?? null)}
<body>
${NAVBAR}
<div class="page-content">
<div class="container">
  <a href="/" class="back">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Back
  </a>

  <div class="card">

    <!-- Loading state -->
    <div id="loadingState">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-subtitle"></div>
      <div class="skeleton skeleton-btn"></div>
      <hr class="divider">
      <p class="events-heading">Loading games…</p>
      ${skeletonRows}
    </div>

    <!-- Error state -->
    <div id="loadError">
      <h1>Couldn't load team</h1>
      <div class="error-box">
        <strong>Team ${escapeHtml(teamId)}</strong><br>
        <span id="errorMsg"></span>
      </div>
      <p class="subtitle" style="margin-top:1.25rem;margin-bottom:0">Double-check the team ID and try again. Find it in the URL on <a href="https://calendar.heartlandsoccer.net" target="_blank">calendar.heartlandsoccer.net</a>.</p>
    </div>

    <!-- Loaded content (hidden until populated) -->
    <div id="loadedContent" style="display:none">

      <!-- ── Team identity block ── -->
      <div class="heading-row">
        <h1 id="teamNameEl"></h1>
        <div class="team-badge"><span class="dot"></span> Team ${escapeHtml(teamId)}</div>
      </div>
      <div id="record-badge-area"></div>
      <div id="results-section"></div>
      <p class="source-hint" id="sourceHintEl"></p>

      <hr class="divider">

      <!-- ── Calendar block ── -->
      <h2 class="section-heading">Team Calendar</h2>
      <p class="subtitle" id="subtitleEl"></p>

      <button class="subscribe-toggle" id="subToggle" aria-expanded="false" aria-controls="subPanel">
        <span>Subscribe</span>
        <svg class="chevron" width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>

      <div class="subscribe-panel" id="subPanel" data-open="false">
        <div class="subscribe-panel-inner">
          <a href="${escapeHtml(webcalUrl)}" class="sub-link">
            <div class="icon apple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.12 4.43-3.74 4.25z"/></svg>
            </div>
            <div>
              <div class="label">Apple Calendar</div>
              <div class="desc">iPhone, iPad, Mac — subscribes automatically</div>
            </div>
          </a>

          <a id="googleLink" target="_blank" class="sub-link">
            <div class="icon google">
              <svg width="18" height="18" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="#4285f4" stroke-width="2"/><path d="M3 10h18" stroke="#4285f4" stroke-width="2"/><path d="M8 2v4M16 2v4" stroke="#4285f4" stroke-width="2" stroke-linecap="round"/></svg>
            </div>
            <div>
              <div class="label">Google Calendar</div>
              <div class="desc">Subscribe via Google Calendar web</div>
            </div>
          </a>

          <a id="outlookLink" target="_blank" class="sub-link">
            <div class="icon outlook">
              <svg width="18" height="18" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="#0078d4" stroke-width="2"/><path d="M2 8l10 5 10-5" stroke="#0078d4" stroke-width="2"/></svg>
            </div>
            <div>
              <div class="label">Outlook.com</div>
              <div class="desc">Subscribe via Outlook web calendar</div>
            </div>
          </a>

          <button class="sub-link" onclick="copyUrl('${escapeHtml(escapeJs(webcalUrl))}')" style="width:100%;text-align:left;">
            <div class="icon copy">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            </div>
            <div>
              <div class="label">Copy webcal:// URL</div>
              <div class="desc">For any other calendar app</div>
            </div>
          </button>

          <div class="url-box">${escapeHtml(webcalUrl)}</div>

          <p class="hint" style="margin-bottom:0">
            <strong>webcal://</strong> links create a <em>subscription</em> that auto-updates.
            Need a one-time import instead? <a href="${escapeHtml(httpsUrl)}" target="_blank">Download .ics file</a>
          </p>
        </div>
      </div>

      <p class="events-heading" style="margin-top:1.5rem">Upcoming Games</p>
      <div id="eventsList"></div>
    </div>
  </div>
</div>
</div>
${FOOTER}

<div class="toast" id="toast">Copied to clipboard!</div>
<script>
(function() {
  var TEAM_ID = '${escapeJs(teamId)}';
  var WEBCAL = '${escapeJs(webcalUrl)}';
  var HTTPS = '${escapeJs(httpsUrl)}';
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // Convert an iCal DTSTART/DTEND value to a JS Date in the user's local timezone.
  // Handles: "TZID=America/Chicago:20260301T090000", "20260301T150000Z", "20260301T090000"
  function dtToDate(val) {
    if (!val) return null;
    var raw = val, tzid = null;
    // Extract TZID parameter if present: "TZID=America/Chicago:20260301T090000"
    var ci = val.indexOf(':'), ei = val.indexOf('=');
    if (ci > 0 && ei !== -1 && ei < ci) {
      var tm = val.match(/TZID=([^;:]+)/);
      tzid = tm ? tm[1] : null;
      raw = val.slice(ci + 1);
    }
    var yr = +raw.slice(0,4), mo = +raw.slice(4,6)-1, dy = +raw.slice(6,8);
    var hr = +raw.slice(9,11)||0, mn = +raw.slice(11,13)||0;
    // UTC datetime — Date.UTC gives the correct instant
    if (raw.endsWith('Z')) return new Date(Date.UTC(yr, mo, dy, hr, mn));
    // TZID-qualified local time — use Intl offset trick to get the correct UTC instant
    if (tzid) {
      try {
        var fakeUTC = new Date(Date.UTC(yr, mo, dy, hr, mn));
        var parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tzid, hour: '2-digit', minute: '2-digit', hour12: false
        }).formatToParts(fakeUTC);
        var lh = +parts.find(function(p){return p.type==='hour';}).value;
        var lm = +parts.find(function(p){return p.type==='minute';}).value;
        var off = (hr - lh) * 60 + (mn - lm);
        if (off > 720) off -= 1440;
        if (off < -720) off += 1440;
        return new Date(fakeUTC.getTime() + off * 60000);
      } catch(e) {}
    }
    // Floating time — interpret as-is in the user's local timezone
    return new Date(yr, mo, dy, hr, mn);
  }

  function fmtTime(val) {
    if (!val) return '';
    try {
      var d = dtToDate(val);
      if (!d || isNaN(d)) return '';
      return d.toLocaleTimeString(navigator.language || 'en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
    } catch(e) { return ''; }
  }

  function timeRange(s, e) {
    var a = fmtTime(s), b = fmtTime(e);
    if (a && b) return a + ' \\u2013 ' + b;
    return a || b || '';
  }

  function parseDT(dt) {
    if (!dt) return { month: '???', day: '??' };
    var m = dt.match(/(\\d{4})(\\d{2})(\\d{2})T/);
    if (!m) return { month: '???', day: '??' };
    return { month: MONTHS[parseInt(m[2],10) - 1] || '???', day: parseInt(m[3],10) };
  }

  // Convert iCal DTSTART value to YYYY-MM-DD string for date matching
  function dtToISO(dtstart) {
    var raw = (dtstart && dtstart.indexOf(':') >= 0) ? dtstart.split(':').pop() : dtstart;
    if (!raw) return '';
    return raw.slice(0,4) + '-' + raw.slice(4,6) + '-' + raw.slice(6,8);
  }

  fetch('/api/team/' + TEAM_ID).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) throw new Error(data.error);

    document.title = esc(data.teamName) + ' \\u2013 Heartland Soccer Team Calendars';
    document.getElementById('teamNameEl').textContent = data.teamName;
    document.getElementById('subtitleEl').innerHTML = data.events.length + ' game' + (data.events.length === 1 ? '' : 's') + ' found &middot; auto-updates every hour';
    document.getElementById('sourceHintEl').innerHTML = 'Source: <a href="https://calendar.heartlandsoccer.net/team/events/' + esc(TEAM_ID) + '" target="_blank">calendar.heartlandsoccer.net</a>';

    var googleUrl = 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(WEBCAL);
    var outlookUrl = 'https://outlook.live.com/calendar/0/addfromweb?url=' + encodeURIComponent(HTTPS) + '&name=' + encodeURIComponent(data.teamName + ' - Heartland Soccer');
    document.getElementById('googleLink').href = googleUrl;
    document.getElementById('outlookLink').href = outlookUrl;

    // ── Record badge + collapsible results table ──
    var results = data.results || { record: { wins: 0, losses: 0, ties: 0 }, games: [] };
    var opponentRecords = data.opponentRecords || {};
    var rec = results.record || { wins: 0, losses: 0, ties: 0 };
    var totalPlayed = rec.wins + rec.losses + rec.ties;
    var scoredGames = (results.games || []).filter(function(g) { return g.scored; });
    var resultsByDate = {};
    for (var gi = 0; gi < scoredGames.length; gi++) {
      resultsByDate[scoredGames[gi].date] = scoredGames[gi];
    }

    // Record badge + "Show results" toggle — inline row below team name
    if (totalPlayed > 0 || scoredGames.length > 0) {
      var recordText = totalPlayed > 0
        ? rec.wins + 'W \\u2013 ' + rec.losses + 'L \\u2013 ' + rec.ties + 'T'
        : 'No results yet';
      var badgeRow = '<div class="record-row">';
      badgeRow += '<div class="record-badge"><span class="record-label">Record</span> ' + recordText + '</div>';
      if (scoredGames.length > 0) {
        badgeRow += '<button class="results-toggle" id="resultsToggle" aria-expanded="false" aria-controls="resultsTableWrap"><span class="toggle-label">Show results</span><svg class="chevron" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
      }
      badgeRow += '</div>';
      document.getElementById('record-badge-area').innerHTML = badgeRow;
    }

    // Results table — expands in results-section below the badge row
    if (scoredGames.length > 0) {
      var resultsHtml = '<div class="results-table-wrap" id="resultsTableWrap" data-open="false"><div class="results-table-inner">';
      resultsHtml += '<table class="results-table"><thead><tr><th>Date</th><th>Opponent</th><th>H/A</th><th>Result</th></tr></thead><tbody>';
      for (var ri = 0; ri < scoredGames.length; ri++) {
        var g = scoredGames[ri];
        var dateParts = g.date ? g.date.split('-') : [];
        var dateLabel = dateParts.length === 3 ? (parseInt(dateParts[1],10) + '/' + parseInt(dateParts[2],10)) : g.date;
        var resultLetter = g.teamScore > g.oppScore ? 'W' : (g.teamScore < g.oppScore ? 'L' : 'T');
        var resultStr = resultLetter + ' ' + g.teamScore + '\\u2013' + g.oppScore;
        var oppCell = g.opponentId ? esc(g.opponentName || '') + ' <span style="color:var(--text-dim);font-size:.8em">#' + esc(g.opponentId) + '</span>' : esc(g.opponentName || '');
        resultsHtml += '<tr><td>' + esc(dateLabel) + '</td><td>' + oppCell + '</td><td>' + (g.isHome ? 'Home' : 'Away') + '</td><td><span class="result-badge result-' + resultLetter + '">' + resultStr + '</span></td></tr>';
      }
      resultsHtml += '</tbody></table></div></div>';
      document.getElementById('results-section').innerHTML = resultsHtml;

      var resultsToggleBtn = document.getElementById('resultsToggle');
      if (resultsToggleBtn) {
        resultsToggleBtn.addEventListener('click', function() {
          var wrap = document.getElementById('resultsTableWrap');
          var open = wrap.getAttribute('data-open') === 'true';
          wrap.setAttribute('data-open', open ? 'false' : 'true');
          this.setAttribute('aria-expanded', open ? 'false' : 'true');
          var chevron = this.querySelector('.chevron');
          if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
          var lbl = this.querySelector('.toggle-label');
          if (lbl) lbl.textContent = open ? 'Show results' : 'Hide results';
        });
      }
    }

    var today = new Date(); today.setHours(0,0,0,0);

    var html = '';
    data.events.forEach(function(e) {
      var gameDate = dtToISO(e.dtstart);
      var gameDateObj = gameDate ? new Date(gameDate + 'T00:00:00') : null;
      var isPast = gameDateObj && gameDateObj < today;

      // Only render upcoming games in this list; past games appear in the results section
      if (isPast) return;

      var d = parseDT(e.dtstart);
      var t = timeRange(e.dtstart, e.dtend);
      var loc = e.location;
      var fieldAnchor = (loc && loc.field)
        ? (loc.mapUrl
            ? '<a href="' + esc(loc.mapUrl) + '" target="_blank" rel="noopener">' + esc(loc.field) + '</a>'
            : esc(loc.field))
        : '';
      var locLabel = fieldAnchor
        ? (loc && loc.name ? fieldAnchor + ' \u2014 ' + esc(loc.name) : fieldAnchor)
        : '';
      var vsIdx = (e.summary || '').search(/\\bvs\\.?\\b/i);
      var beforeVs = vsIdx >= 0 ? (e.summary || '').slice(0, vsIdx) : (e.summary || '');
      var isHome = beforeVs.indexOf(TEAM_ID) >= 0;
      var jerseyHtml = '<div class="meta">' + (isHome ? 'Home \u2014 White/Light jerseys' : 'Away \u2014 Dark jerseys') + '</div>';

      // Opponent record annotation for upcoming games — extract team number after "vs" in SUMMARY
      var annotationHtml = '';
      var oppIdMatch = (e.summary || '').match(/vs\s+(\d+)/i);
      var oppId = oppIdMatch ? oppIdMatch[1] : null;
      if (oppId && opponentRecords[oppId]) {
        var or = opponentRecords[oppId];
        annotationHtml = '<span class="opp-record">Opp: ' + or.wins + 'W\\u2013' + or.losses + 'L\\u2013' + or.ties + 'T</span>';
      }

      var titleHtml = '<div class="title">' + esc(e.summary) + annotationHtml + '</div>';
      html += '<div class="event-row"><div class="event-date"><div class="month">' + esc(d.month) + '</div><div class="day">' + d.day + '</div></div><div class="event-info">' + titleHtml + '<div class="meta">' + t + '</div>' + (locLabel ? '<div class="meta">' + locLabel + '</div>' : '') + jerseyHtml + '</div></div>';
    });
    document.getElementById('eventsList').innerHTML = html;

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('loadedContent').style.display = '';

    document.getElementById('subToggle').addEventListener('click', function() {
      var panel = document.getElementById('subPanel');
      var open = panel.getAttribute('data-open') === 'true';
      panel.setAttribute('data-open', open ? 'false' : 'true');
      this.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  }).catch(function(err) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorMsg').textContent = err.message || 'Unknown error';
    document.getElementById('loadError').style.display = '';
  });
})();

function copyUrl(url) {
  navigator.clipboard.writeText(url).then(function() {
    var t = document.getElementById('toast');
    t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 2000);
  });
}
</script>
</body></html>`;
}

// ─── Utility ────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeJs(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\u003c');
}
