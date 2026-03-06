# Phase 8: Standings Scraping — Research

**Researched:** 2026-03-05
**Domain:** Heartland Soccer `subdiv_standings.cgi` — HTML scraping + auto-discovery
**Confidence:** HIGH (all findings verified by direct HTTP probing)

<research_summary>
## Summary

The standings page is `subdiv_standings.cgi` and takes four URL params: `level`, `b_g`, `age`, and `subdivision`. There is no direct teamId → standings URL mapping — the team results and calendar pages expose no division metadata. However, auto-discovery is feasible: the param space is small (level is always "Premier" in the current season, b_g and age can be inferred from opponent names, and subdivision is 1–9 at most). The full search for a given team is ~15 parallel requests — fast and cacheable.

The HTML structure is simple, well-formed enough to parse with regex (same approach used for `team_results.cgi`), and team rows are identifiable by the leading teamId in the Team cell.

**Primary recommendation:** Auto-discover standings URL from teamId by inferring b_g/age from opponent names, then scanning subdivisions 1–15 in parallel. Cache discovered params alongside the standings data with 1-hour TTL.
</research_summary>

<standard_stack>
## Standard Stack

No new libraries needed. Implementation follows the exact same pattern as the existing results scraper:

- **Fetch HTML** — `fetch(standingsUrl)` with User-Agent header (same as existing)
- **Parse with regex** — extract `<td>` values from rows (same pattern as team_results.cgi parser)
- **Cache API** — store at `{origin}/api/standings/{teamId}` (same cache pattern)
- **Parallel fetching** — `Promise.all()` for subdivision scan (same as opponent records)

No additional packages. No new dependencies.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Standings URL

```
https://heartlandsoccer.net/reports/cgi-jrb/subdiv_standings.cgi
  ?level=Premier
  &b_g=Girls          ← "Boys" or "Girls"
  &age=U-11           ← "U-9" through "U-16" (Boys), "U-9" through "U-15" (Girls)
  &subdivision=7      ← integer 1–N
```

**Important:** Both `subdivision` (correct) and `subdivison` (typo) are accepted by the server. Use the correct spelling `subdivision` in implementation.

### Valid Parameter Space (confirmed by probing)

| Param | Valid Values |
|-------|-------------|
| level | `Premier` only — no Classic/Recreation/etc exist in current season |
| b_g | `Boys`, `Girls` |
| age (Girls) | U-9 through U-15 |
| age (Boys) | U-9 through U-16 |
| subdivision | 1–9 max (varies by age/gender; U-11 Girls Premier has 9) |

### Error Response (distinguishable)

Invalid combinations return:
```html
<html><head><title>Select Subdivision Error</title></head>
<body>The system could not match this combination of entries...</body></html>
```

Check for `Select Subdivision Error` in the response to detect a miss.

### HTML Structure

```html
<h4 align=center>U-11 Girls Premier Subdivision 7</h4>
<table ...>
  <!-- header row -->
  <tr ...>
    <td><b>Team</b></td><td><b>Win</b></td><td><b>Lose</b></td><td><b>Tie</b></td>
    <td><b>GF</b></td><td><b>GA</b></td><td><b>RC</b></td><td><b>Pts</b></td>
  </tr>
  <!-- data rows — alternating bgColor=D6DCEA / no bgcolor -->
  <tr rules=1 align=center valign=middle class=text, bgColor=D6DCEA>
    <td align=left height=21>8174 KRSC Strikers</td>  ← "{teamId} {teamName}"
    <td>0</td>   <!-- Win -->
    <td>0</td>   <!-- Lose -->
    <td>1</td>   <!-- Tie -->
    <td>1</td>   <!-- GF (Goals For) -->
    <td>1</td>   <!-- GA (Goals Against) -->
    <td>&nbsp</td>   <!-- RC (Red Cards) — often empty -->
    <td><strong>1</strong></td>   <!-- Pts — always wrapped in <strong> -->
  </tr>
  ...
</table>
```

**Team cell parsing:** `{teamId} {teamName}` — split on first space. The teamId is the leading integer, same format as `team_results.cgi`.

**Pts parsing:** Strip `<strong>` wrapper. Use `parseInt()`.

**RC parsing:** `&nbsp` (no red cards) should parse to `0` or `null`.

### Auto-Discovery Algorithm

Since there's no teamId → standings URL mapping, discovery scans possible subdivisions:

```js
async function discoverStandings(teamId, opponentNames) {
  // 1. Infer b_g from opponent names
  const b_g = inferGender(opponentNames);  // "Boys" or "Girls"

  // 2. Infer age from birth years in opponent names + current season year
  const age = inferAge(opponentNames, currentSeasonYear);  // "U-11"

  // 3. Scan subdivisions 1..15 in parallel (level is always "Premier")
  const results = await Promise.all(
    Array.from({ length: 15 }, (_, i) => i + 1).map(n =>
      fetchStandingsPage("Premier", b_g, age, n)
        .then(html => containsTeam(html, teamId) ? { n, html } : null)
    )
  );

  return results.find(Boolean);  // first non-null hit
}
```

### b_g Inference from Opponent Names

Team names frequently encode gender with a "G" or "B" suffix adjacent to a birth year:
- `2015G` → Girls
- `15/16G` → Girls
- `G15` → Girls (G prefix before 2-digit year)
- `2015B` → Boys

Pattern: `/\b(?:G\d{2}|\d{2,4}G)\b/` for Girls; `/\b(?:B\d{2}|\d{2,4}B)\b/` for Boys.

Use majority vote across all opponent names. If no names match, default logic or leave standings unshown.

### Age Inference from Opponent Names

Extract birth years from opponent names:
- 4-digit pattern: `/\b20(\d{2})\b/` → e.g., 2015
- 2-digit range: `/\b1(\d)\/1(\d)\b/` → e.g., 15/16 → 2015

Season year: extract from iCal DTSTART dates (not hardcoded).

Age: `U-${seasonYear - birthYear}`

Where birthYear is the **minimum** birth year found (= oldest kids = higher age group), or the most common value.

### Cache Keys

Follow existing pattern:
- Standings data: `{origin}/api/standings/{teamId}` (1-hour TTL)
- No separate "discovery" cache needed — cache the discovered params alongside the data

### Response Shape (addition to `/api/team/{teamId}`)

```json
{
  "results": { ... },
  "opponentRecords": { ... },
  "standings": {
    "division": "U-11 Girls Premier Subdivision 7",
    "params": { "level": "Premier", "b_g": "Girls", "age": "U-11", "subdivision": 7 },
    "teams": [
      { "teamId": "8175", "name": "PSC 15/16G Purple", "w": 1, "l": 0, "t": 1, "gf": 4, "ga": 1, "rc": 0, "pts": 4 },
      { "teamId": "8174", "name": "KRSC Strikers",      "w": 0, "l": 0, "t": 1, "gf": 1, "ga": 1, "rc": 0, "pts": 1 },
      ...
    ]
  }
}
```

`standings` is `null` if discovery fails (unrecognized team names, no opponent data).
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML table parsing | Full DOM parser | Regex on known structure | The HTML is simple, static, and consistent — regex is sufficient (same as existing results parser) |
| Parallel requests | Sequential fetch loop | `Promise.all()` | Already used for opponent records — apply same pattern |
| Cache | Custom TTL logic | Cloudflare Cache API | Already used in the project — same `caches.default.put()` pattern |

**Key insight:** This phase is a straight application of existing patterns. No new parsing library is needed — the HTML structure is as simple as `team_results.cgi` which is already handled with regex.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Using `subdivison` typo in URL params
**What goes wrong:** URL param `subdivison` (missing one 'i') is in the example URL from the user. Both spellings happen to work on the server today, but the correct spelling is `subdivision`.
**How to avoid:** Always use `subdivision` (correct spelling) in implementation code.
**Warning signs:** If you copy-paste the example URL, you'll get the typo.

### Pitfall 2: Some team names don't encode gender/age
**What goes wrong:** "KRSC Strikers" and "Captains SC 15/16 Gold" don't have the `G`/`B` age-suffix pattern. If the subscribed team's own name is the only one checked, inference fails.
**How to avoid:** Run inference across ALL opponent names (not just the subscribed team name). With 9 teams per subdivision, 7+ will typically encode the pattern.
**Warning signs:** b_g inference returning null or defaulting incorrectly.

### Pitfall 3: Pts column has `<strong>` wrapper
**What goes wrong:** Parsing the last cell as plain text gives `<strong>4</strong>` not `4`.
**How to avoid:** Strip tags or use a regex that captures the inner number: `/<strong>(\d+)<\/strong>/`.
**Warning signs:** Pts values containing HTML tags in the output.

### Pitfall 4: RC column is `&nbsp` not `0`
**What goes wrong:** Parsing RC as an integer gives `NaN` for teams with no red cards.
**How to avoid:** Treat `&nbsp` (or empty/whitespace) as `0`.
**Warning signs:** `NaN` for RC values.

### Pitfall 5: Scanning 15 subdivisions on every uncached request
**What goes wrong:** 15 parallel requests on first load is noticeable latency, but on every load is wasteful.
**How to avoid:** Cache the standings result (including discovered params) with 1-hour TTL alongside the existing results cache. The discovered subdivision number is part of the cached payload.
**Warning signs:** Slow subscribe page loads even after the first visit.

### Pitfall 6: Hardcoding season year for age inference
**What goes wrong:** `currentYear = 2026` breaks when the app is used in a future season.
**How to avoid:** Derive season year from iCal event DTSTART dates (already parsed). Use the most recent game date's year.
**Warning signs:** Incorrect age group lookups in future seasons.
</common_pitfalls>

<code_examples>
## Code Examples

### Parse standings HTML into team rows

```js
function parseStandings(html) {
  // Extract division label from heading
  const headingMatch = html.match(/<h4[^>]*>([^<]+)<\/h4>/i);
  const division = headingMatch ? headingMatch[1].trim() : null;

  // Extract all data rows (skip header rows — they use <b> tags)
  const rows = [];
  const rowPattern = /<tr[^>]*class=text[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells = [];
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      // Strip HTML tags, decode &nbsp as empty
      const text = cellMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;?/g, '').trim();
      cells.push(text);
    }
    if (cells.length >= 8) {
      const teamCell = cells[0];  // "8174 KRSC Strikers"
      const spaceIdx = teamCell.indexOf(' ');
      const teamId = teamCell.slice(0, spaceIdx);
      const name = teamCell.slice(spaceIdx + 1);
      rows.push({
        teamId,
        name,
        w: parseInt(cells[1]) || 0,
        l: parseInt(cells[2]) || 0,
        t: parseInt(cells[3]) || 0,
        gf: parseInt(cells[4]) || 0,
        ga: parseInt(cells[5]) || 0,
        rc: parseInt(cells[6]) || 0,
        pts: parseInt(cells[7]) || 0,
      });
    }
  }
  return { division, teams: rows };
}
```

### Infer b_g from opponent names

```js
function inferGender(names) {
  let girls = 0, boys = 0;
  for (const name of names) {
    if (/\b(?:G\d{2}|\d{2,4}G)\b/.test(name)) girls++;
    if (/\b(?:B\d{2}|\d{2,4}B)\b/.test(name)) boys++;
  }
  if (girls > boys) return 'Girls';
  if (boys > girls) return 'Boys';
  return null;  // inconclusive
}
```

### Infer age from opponent names + season year

```js
function inferAge(names, seasonYear) {
  const years = [];
  for (const name of names) {
    const full = name.match(/\b(20\d{2})\b/);
    if (full) years.push(parseInt(full[1]));
    const short = name.match(/\b1(\d)\/1\d\b/);
    if (short) years.push(2000 + parseInt(short[1]));
  }
  if (years.length === 0) return null;
  const birthYear = Math.min(...years);  // oldest cohort
  return `U-${seasonYear - birthYear}`;
}
```

### Check if standings page contains a team

```js
function containsTeam(html, teamId) {
  // Quick check: teamId followed by space and a name in Team cell
  return html.includes(`>${teamId} `);
}
```

### Auto-discover standings for a team

```js
async function discoverStandings(teamId, opponentNames, seasonYear) {
  const b_g = inferGender(opponentNames);
  const age = inferAge(opponentNames, seasonYear);
  if (!b_g || !age) return null;  // can't discover without inference

  const level = 'Premier';
  const SCAN_MAX = 15;
  const BASE = 'https://heartlandsoccer.net/reports/cgi-jrb/subdiv_standings.cgi';

  const results = await Promise.all(
    Array.from({ length: SCAN_MAX }, (_, i) => i + 1).map(async (n) => {
      const url = `${BASE}?level=${level}&b_g=${encodeURIComponent(b_g)}&age=${encodeURIComponent(age)}&subdivision=${n}`;
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'heartland-soccer-calendar/1.0' } });
        const html = await res.text();
        if (html.includes('Select Subdivision Error')) return null;
        if (!containsTeam(html, teamId)) return null;
        return { n, html, level, b_g, age };
      } catch { return null; }
    })
  );

  const hit = results.find(Boolean);
  if (!hit) return null;

  const { division, teams } = parseStandings(hit.html);
  return {
    division,
    params: { level: hit.level, b_g: hit.b_g, age: hit.age, subdivision: hit.n },
    teams,
  };
}
```
</code_examples>

<open_questions>
## Open Questions

1. **Does `level=Premier` cover all teams?**
   - What we know: Only Premier returns valid data for tested age groups. Classic/Recreation return errors for all tested combos.
   - What's unclear: Whether some teams in non-Premier leagues use different level values we haven't tested.
   - Recommendation: Start with Premier only. If `standings` comes back null, it means the team isn't in standings (or level param is wrong). Can be extended later.

2. **How stable are team name gender/age patterns?**
   - What we know: 7 of 9 teams in subdivision 7 encode the pattern clearly.
   - What's unclear: Whether other subdivisions/age groups follow the same naming convention.
   - Recommendation: Use majority vote with a minimum threshold (e.g., ≥2 matching names). Return `null` standings if inconclusive rather than guessing wrong.

3. **Season year derivation**
   - What we know: iCal events have DTSTART dates we already parse.
   - What's unclear: Edge case where no iCal events exist yet.
   - Recommendation: Fall back to `new Date().getFullYear()` if no events available.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence — verified by direct HTTP probing)
- Direct probing of `subdiv_standings.cgi` with varied params — all parameter space findings
- Direct probing of `subdiv_standings.cgi?level=Premier&b_g=Girls&age=U-11&subdivision=7` — HTML structure
- 12 age groups × Girls + 8 age groups × Boys × level variants tested

### Confirmed by cross-reference
- `team_results.cgi` response — confirmed no division metadata present
- `team_schedule.cgi` response — confirmed no division metadata present
- `calendar.heartlandsoccer.net/team/events/{teamId}` — confirmed no division metadata present
- All available CGI endpoints (from directory listing) tested for team_number param — none return standings URL

### Negative findings (verified)
- No endpoint accepts `team_number` and returns standings URL params (HIGH confidence — all likely endpoints tested)
- `level=Classic`, `level=Recreation`, etc. return no data for current season (HIGH confidence — verified directly)
- `subdivision` vs `subdivison` — both spellings accepted by server (HIGH confidence — verified directly)
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: `subdiv_standings.cgi` HTML scraping
- Ecosystem: Existing Cloudflare Worker patterns (Cache API, Promise.all, fetch)
- Patterns: Auto-discovery scan, gender/age inference from team names
- Pitfalls: typo in param name, sparse team name encoding, RC/Pts edge cases

**Confidence breakdown:**
- URL format and params: HIGH — verified by probing
- Valid parameter space: HIGH — exhaustively tested
- HTML structure: HIGH — fetched actual page
- Auto-discovery approach: HIGH — math confirmed (15 parallel requests max)
- b_g/age inference regex: MEDIUM — works for 7/9 teams in sample; edge cases possible in other divisions
- Pitfalls: HIGH — all confirmed by inspection

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (30 days — site structure very stable, CGI scripts unchanged since 2021)
</metadata>

---

*Phase: 08-standings-scraping*
*Research completed: 2026-03-05*
*Ready for planning: yes*
