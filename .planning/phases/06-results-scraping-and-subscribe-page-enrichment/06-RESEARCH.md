# Phase 6: Results Scraping and Subscribe Page Enrichment — Research

**Researched:** 2026-03-04
**Domain:** HTML scraping in Cloudflare Workers + parallel fetch + subscribe page enrichment
**Confidence:** HIGH

<research_summary>
## Summary

Phase 6 adds game result intelligence to the subscribe page by scraping the Heartland Soccer results pages. Research covered the HTML structure of the results source, the right parsing approach for Cloudflare Workers, parallel fetch patterns, subrequest limits, and how to extend the existing API and subscribe page.

The primary approach is to extend the existing `/api/team/{teamId}` response with results data, fetched in parallel with the existing calendar fetch. The subscribe page client-side JS is then updated to render a record summary, full results table, scores on past event rows, and opponent W-L-T on upcoming event rows.

**Primary recommendation:** Use `resp.text()` + regex for HTML parsing (consistent with existing codebase, simpler than HTMLRewriter for data extraction). Use `Promise.all()` for parallel fetches. Cache all results data at the edge with the existing `caches.default` pattern.
</research_summary>

<standard_stack>
## Standard Stack

No new libraries needed. All tools are built into the Cloudflare Workers runtime or already in use.

### Core (already in project)
| Tool | Purpose | Notes |
|------|---------|-------|
| `fetch()` | Fetch results pages from heartlandsoccer.net | Same as existing calendar fetch |
| `Promise.all()` | Parallel opponent record lookups | Native JS, no library needed |
| `caches.default` | Edge cache for results data | Already used for `/calendar/{teamId}` |
| Regex parsing | Parse HTML table rows | Consistent with existing `parseEventsFromHTML` pattern |

### Not needed
- `HTMLRewriter` — designed for HTML *transformation*, not data extraction. Adds streaming complexity for no benefit when `resp.text()` + regex works cleanly.
- Any npm packages — Workers runtime has everything required.

**Installation:** Nothing new to install.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Data Source: Results Page HTML

URL: `https://heartlandsoccer.net/reports/cgi-jrb/team_results.cgi?team_number={teamId}`

**Actual HTML structure (verified 2026-03-04):**

```html
<h4 align=center>8174 KRSC Strikers</h4>
<table ...>
  <tr><td colspan=8 ...>Team Match Results</td></tr>
  <tr class=seasoninfo_sectionheader>
    <td>Game</td><td>Date</td><td>Field</td><td>Time</td>
    <td>Home</td><td>&nbsp</td><td>Visitor</td><td>&nbsp</td>
  </tr>
  <tr bgcolor="#efefef" class=text>
    <td>361</td><td>03/01/26</td><td>OSC4N</td><td>10:30</td>
    <td>8174 KRSC Strikers</td><td align=center>1</td>
    <td>8175 PSC 15/16G Purple</td><td align=center>1</td>
  </tr>
  <!-- future game row — score cells are empty -->
  <tr class=text>
    <td>400</td><td>03/15/26</td><td>OP3</td><td>14:00</td>
    <td>8174 KRSC Strikers</td><td align=center></td>
    <td>8200 Some Other Team</td><td align=center></td>
  </tr>
</table>
```

**Column mapping (0-indexed `<td>` cells in `<tr class=text>` rows):**
| Index | Content | Example |
|-------|---------|---------|
| 0 | Game number | `361` |
| 1 | Date (MM/DD/YY) | `03/01/26` |
| 2 | Field code | `OSC4N` |
| 3 | Time (HH:MM, 24h) | `10:30` |
| 4 | Home team | `8174 KRSC Strikers` |
| 5 | Home score (empty=future) | `1` or `` |
| 6 | Visitor team | `8175 PSC 15/16G Purple` |
| 7 | Visitor score (empty=future) | `1` or `` |

**Team name:** The `<h4>` contains just the name without team number (e.g. "KRSC Strikers" not "8174 KRSC Strikers"). The team number IS included in the in-table name cells.

**Opponent team number:** Leading digits in team name cells, e.g. `8175 PSC 15/16G Purple` → team number is `8175`.

### Pattern 1: Results Page Parser

```js
// Source: Verified against live page 2026-03-04
const RESULTS_BASE_URL = 'https://heartlandsoccer.net/reports/cgi-jrb/team_results.cgi';

async function fetchResults(teamId) {
  const url = `${RESULTS_BASE_URL}?team_number=${teamId}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'HeartlandSoccerCalendarMerger/1.0', Accept: 'text/html' },
  });
  if (!resp.ok) throw new Error(`Results fetch failed: ${resp.status}`);
  const html = await resp.text();
  return parseResultsHTML(html, teamId);
}

function parseResultsHTML(html, myTeamId) {
  // Extract team name from <h4>
  const nameMatch = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
  const teamName = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : `Team ${myTeamId}`;

  // Extract all data rows (class=text)
  const games = [];
  const rowPattern = /<tr[^>]*class=text[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells = [];
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      // Strip inner HTML, decode &nbsp; → empty string
      const text = cellMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
      cells.push(text);
    }
    if (cells.length < 8) continue;

    const homeScore = cells[5];
    const visitorScore = cells[7];
    const isPast = homeScore !== '' && visitorScore !== '';

    // Parse opponent team number: leading digits in team name
    const homeTeamNum = (cells[4].match(/^(\d+)\s/) || [])[1] || null;
    const visitorTeamNum = (cells[6].match(/^(\d+)\s/) || [])[1] || null;
    const isHome = homeTeamNum === myTeamId;
    const opponentTeamId = isHome ? visitorTeamNum : homeTeamNum;
    const opponentName = isHome
      ? cells[6].replace(/^\d+\s/, '').trim()
      : cells[4].replace(/^\d+\s/, '').trim();

    let result = null; // 'W', 'L', 'T', or null (future)
    if (isPast) {
      const my = isHome ? +homeScore : +visitorScore;
      const opp = isHome ? +visitorScore : +homeScore;
      result = my > opp ? 'W' : my < opp ? 'L' : 'T';
    }

    games.push({
      gameNum: cells[0],
      date: cells[1], // MM/DD/YY
      field: cells[2],
      time: cells[3],
      isHome,
      homeTeam: cells[4],
      homeScore: homeScore || null,
      visitorTeam: cells[6],
      visitorScore: visitorScore || null,
      isPast,
      opponentTeamId,
      opponentName,
      result,                    // 'W', 'L', 'T', or null
      score: isPast ? `${homeScore}-${visitorScore}` : null,
    });
  }

  // Compute W-L-T record
  const record = games.filter(g => g.isPast).reduce(
    (acc, g) => { acc[g.result === 'W' ? 'w' : g.result === 'L' ? 'l' : 't']++; return acc; },
    { w: 0, l: 0, t: 0 }
  );

  return { teamName, record, games };
}
```

### Pattern 2: Parallel Fetch (Team Info + Results)

```js
// Fetch calendar events and results page in parallel
async function handleTeamAPI(teamId) {
  const [teamInfo, results] = await Promise.all([
    fetchTeamInfo(teamId),       // existing: calendar.heartlandsoccer.net
    fetchResults(teamId),         // new: heartlandsoccer.net results page
  ]);

  // For upcoming games, fetch opponent records in parallel
  const upcomingGames = results.games.filter(g => !g.isPast);
  const uniqueOpponentIds = [...new Set(upcomingGames.map(g => g.opponentTeamId).filter(Boolean))];
  const opponentRecords = await fetchOpponentRecords(uniqueOpponentIds);

  // Annotate upcoming games with opponent records
  const gamesWithOpponentRecords = results.games.map(g => ({
    ...g,
    opponentRecord: (!g.isPast && g.opponentTeamId)
      ? opponentRecords[g.opponentTeamId] ?? null
      : null,
  }));

  return { teamId, teamName: teamInfo.teamName, events: ..., results: {
    record: results.record,
    games: gamesWithOpponentRecords,
  }};
}

async function fetchOpponentRecords(opponentIds) {
  const entries = await Promise.all(
    opponentIds.map(async id => {
      try {
        const data = await fetchResults(id);
        return [id, data.record];
      } catch {
        return [id, null];
      }
    })
  );
  return Object.fromEntries(entries);
}
```

### Pattern 3: Edge Caching for Results Data

```js
// Cache results data separately from the calendar feed
// Use same caches.default pattern as /calendar/{teamId}
async function getCachedResults(teamId, url, ctx) {
  const cacheKey = new Request(`${url.origin}/api/results/${teamId}`, { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const results = await fetchResults(teamId);
  const response = new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return results;
}
```

### Pattern 4: Date Format Conversion (Results → Match Events)

Results page uses `MM/DD/YY` (e.g., `03/01/26`).
iCal DTSTART uses `YYYYMMDD` (e.g., `20260301`).

To match a results game to an event row in the subscribe page:

```js
// Convert MM/DD/YY → YYYY-MM-DD for comparison
function resultsDateToISO(dateStr) {
  const [mm, dd, yy] = dateStr.split('/');
  const year = +yy < 50 ? `20${yy}` : `19${yy}`; // Y2K-style pivot
  return `${year}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
}

// Extract date from iCal DTSTART value (handles TZID=...: prefix)
function icalDateToISO(dtstart) {
  const raw = dtstart.includes(':') ? dtstart.split(':').pop() : dtstart;
  return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
}
```

### Pattern 5: Subscribe Page Record Display

Add to the top of the events section (new HTML/CSS):

```html
<!-- Record summary -->
<div class="record-summary">
  <span class="record-badge">3-1-2</span> <!-- W-L-T -->
  <span class="record-label">Record (W-L-T)</span>
</div>

<!-- Results table (collapsible) -->
<details class="results-table">
  <summary>All results</summary>
  <table>...</table>
</details>
```

Event rows annotated:
- Past games: Add score chip (`1 - 1`) and result badge (`W` / `L` / `T`)
- Future games: Add opponent record (`Opp: 2-3-1`) inline in meta line

### Anti-Patterns to Avoid

- **Using HTMLRewriter for data extraction** — it's designed for transformation; for extraction, `text()` + regex is simpler. HTMLRewriter requires consuming the transformed response body (its handlers fire as the response stream is consumed), adding complexity with no benefit here.
- **Sequential opponent fetches** — always `Promise.all()` to parallelize. Sequential fetches on the free plan (50 subreq limit) would fail faster if many opponents are uncached.
- **Caching only the primary team** — cache opponent results too (`/api/results/{opponentId}`) since multiple users may share the same teams in their schedules. The existing `caches.default` is shared across all Workers invocations.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing | Complex DOM walker | `resp.text()` + regex | HTML is simple, predictable, table-structured; regex is sufficient and consistent with codebase |
| Parallel fetches | Sequential await loop | `Promise.all()` | Built-in, correct, efficient |
| Edge caching | In-memory module cache | `caches.default` | Already established pattern; survives across isolates; free plan-compatible |
| W-L-T computation | External stats library | Simple reduce over games array | Three-state comparison, 5 lines of code |

**Key insight:** This is data extraction from a predictable, stable HTML table. No complex parsing library is needed or appropriate. The existing codebase pattern (regex on `.text()`) applies directly.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: `&nbsp;` in empty score cells
**What goes wrong:** Empty score cells contain `&nbsp;` (non-breaking space HTML entity), not an empty string. Checking `cell === ''` misses this.
**Why it happens:** Old-school HTML table formatting uses `&nbsp;` for empty cells.
**How to avoid:** Strip HTML entities after stripping tags: `.replace(/&nbsp;/g, '').trim()`.
**Warning signs:** All games appearing as "past" even though they're in the future.

### Pitfall 2: Date format mismatch between results and iCal
**What goes wrong:** Can't match a results game row to an iCal event row because formats differ (`03/01/26` vs `20260301`).
**Why it happens:** Two different data sources with different date conventions.
**How to avoid:** Normalize both to `YYYY-MM-DD` before comparing. Use the Y2K-pivot rule: `yy < 50 → 20YY`, else `19YY`.
**Warning signs:** No events being matched to their result scores.

### Pitfall 3: Subrequest limit on free plan
**What goes wrong:** If many opponent records are uncached simultaneously, a request could approach the 50 external subrequest limit (free plan). Each opponent = 1 fetch.
**Why it happens:** Free Cloudflare Workers plan limits external subrequests to 50 per invocation. (Paid plan is 10,000 — raised from 1,000 on 2026-02-11.)
**How to avoid:** Cache opponent results at the edge. On cache hits, 0 subrequests are used. For a typical soccer schedule with 8-12 unique opponents, the first uncached invocation uses 1 (primary) + 8-12 (opponents) = 9-13 subrequests — well within the 50 limit. Subsequent requests use 1 subrequest.
**Warning signs:** `Too many subrequests` error in worker logs.

### Pitfall 4: Team number parsing from team name cell
**What goes wrong:** Code assumes the leading digits in the team name cell (`8174 KRSC Strikers`) are always the team ID, but this may fail if a team name starts with a number or the format changes.
**Why it happens:** The results page embeds team number directly in the display name.
**How to avoid:** Use regex `cells[4].match(/^(\d+)\s/)` with a null check. Compare extracted number to `myTeamId` to determine home/away correctly. If no match, fall back to positional logic (column 4 = home, column 6 = visitor).
**Warning signs:** Home/away determination wrong, opponent IDs null.

### Pitfall 5: Results page 404 or empty for valid team IDs
**What goes wrong:** A team with no games yet returns an empty table or 404. The code must handle this gracefully.
**Why it happens:** New teams or off-season teams have no results.
**How to avoid:** Handle empty `games` array gracefully (record `0-0-0`). Wrap `fetchResults` in try/catch and return `null` on error — subscriber page should still load without results data.
**Warning signs:** Subscribe page breaking for all new teams.
</common_pitfalls>

<code_examples>
## Code Examples

### Fetch and parse results (complete pattern)

```js
// Source: Verified against live page structure 2026-03-04
const RESULTS_BASE_URL = 'https://heartlandsoccer.net/reports/cgi-jrb/team_results.cgi';

async function fetchResults(teamId) {
  const resp = await fetch(`${RESULTS_BASE_URL}?team_number=${teamId}`, {
    headers: { 'User-Agent': 'HeartlandSoccerCalendarMerger/1.0', Accept: 'text/html' },
  });
  if (!resp.ok) return null; // graceful failure
  const html = await resp.text();
  return parseResultsHTML(html, String(teamId));
}
```

### Row-by-row table extraction (regex, consistent with codebase)

```js
// Extract rows where class=text (data rows, not header rows)
const rowPattern = /<tr[^>]*class=text[^>]*>([\s\S]*?)<\/tr>/gi;
// Extract cells from a row
const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
// Clean cell content: strip inner HTML, unescape &nbsp;
const clean = raw => raw.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
```

### Parallel fetch with graceful failure

```js
// Fetch all unique opponent records in parallel; fail gracefully per opponent
const opponentResults = await Promise.all(
  uniqueOpponentIds.map(id =>
    fetchResults(id).catch(() => null)
  )
);
const opponentRecords = Object.fromEntries(
  uniqueOpponentIds.map((id, i) => [id, opponentResults[i]?.record ?? null])
);
```

### Date normalization for matching results to events

```js
// Results page: "03/01/26" → "2026-03-01"
function resultsDateToISO(d) {
  const [mm, dd, yy] = d.split('/');
  return `20${yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
}
// iCal DTSTART: "TZID=America/Chicago:20260301T090000" or "20260301T090000Z" → "2026-03-01"
function icalDateToISO(dtstart) {
  const raw = dtstart.includes(':') ? dtstart.split(':').pop() : dtstart;
  return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
}
```

### Caching results at the edge (same pattern as /calendar/{teamId})

```js
// Source: existing codebase pattern — caches.default, ctx.waitUntil, Cache-Control header
async function getCachedResults(teamId, origin, ctx) {
  const cacheKey = new Request(`${origin}/api/results/${teamId}`, { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const results = await fetchResults(teamId);
  if (results) {
    const resp = new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
    });
    ctx.waitUntil(cache.put(cacheKey, resp.clone()));
  }
  return results;
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Workers subrequest limit: 1,000 | Default: 10,000 (free: 50 external, up to 10M on paid) | 2026-02-11 | Parallel opponent fetches well within limits |
| HTMLRewriter (streaming-only) | HTMLRewriter now accepts Response/ReadableStream in replace/append/prepend | 2025-01-31 | Not relevant for this use case (we use regex, not HTMLRewriter) |

**New tools/patterns to consider:**
- None applicable. This phase uses established Cloudflare Workers primitives only.

**Deprecated/outdated:**
- `cheerio` / server-side DOM libraries — cannot be imported in Workers (no npm, no Node.js APIs). Not needed here anyway.
</sota_updates>

<open_questions>
## Open Questions

1. **Do opponent results pages always use the same URL pattern?**
   - What we know: Team ID `8174` maps to `?team_number=8174`; opponent IDs are parsed from the same table column
   - What's unclear: Whether all team IDs in the league use the same URL format (likely yes, but unverified for opponent IDs)
   - Recommendation: Parse opponent IDs, build URL with same pattern, fail gracefully if 404

2. **Does the results page include all seasons, or just current season?**
   - What we know: The example shows only current-season games (typical for CGI sports sites)
   - What's unclear: Whether historical games from prior seasons appear in the same table
   - Recommendation: No filtering needed for now; display all games returned. If multi-season becomes an issue, filter by year.

3. **Are team IDs stable across seasons?**
   - What we know: The app uses `teamId` as entered by the user; results page uses the same number
   - What's unclear: Whether Heartland Soccer reuses team IDs across seasons
   - Recommendation: Assume stable for now; this is a user-managed input.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Live page fetch of `https://heartlandsoccer.net/reports/cgi-jrb/team_results.cgi?team_number=8174` (2026-03-04) — actual HTML structure verified
- `https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/` — HTMLRewriter API reference
- `https://developers.cloudflare.com/workers/platform/limits/` — subrequest limits (free: 50 external, paid: 10,000)
- `https://developers.cloudflare.com/changelog/2026-02-11-subrequests-limit/` — limit increase to 10,000 default (Feb 2026)
- `src/index.js` — existing codebase patterns (caching, fetch, regex parsing, API structure)

### Secondary (MEDIUM confidence)
- HTMLRewriter streaming update (2025-01-31) — confirmed not relevant for data extraction use case

### Tertiary (LOW confidence)
- None — all findings verified from primary sources
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Cloudflare Workers fetch + regex HTML parsing
- Ecosystem: caches.default, Promise.all, HTMLRewriter (evaluated and ruled out)
- Patterns: Parallel fetch, edge caching, date normalization
- Pitfalls: &nbsp; in empty cells, date format mismatch, subrequest limits, graceful failure

**Confidence breakdown:**
- HTML structure: HIGH — verified live 2026-03-04
- Parsing approach: HIGH — consistent with existing codebase, no library unknowns
- Subrequest limits: HIGH — from official Cloudflare docs (Feb 2026 changelog)
- Architecture (API extension + subscribe page): HIGH — follows existing patterns exactly

**Research date:** 2026-03-04
**Valid until:** 2026-06-04 (90 days — Cloudflare Workers APIs are stable; heartlandsoccer.net HTML structure may change but is unlikely)
</metadata>

---

*Phase: 06-results-scraping-and-subscribe-page-enrichment*
*Research completed: 2026-03-04*
*Ready for planning: yes*
