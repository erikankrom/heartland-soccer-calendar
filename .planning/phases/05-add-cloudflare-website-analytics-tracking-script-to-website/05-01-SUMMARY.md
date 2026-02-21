---
phase: 05-add-cloudflare-website-analytics-tracking-script-to-website
plan: 01
subsystem: infra
tags: [cloudflare, analytics, web-analytics, beacon, worker]

# Dependency graph
requires: []
provides:
  - Cloudflare Web Analytics beacon injected into landing page and subscribe page <head>
  - CF_ANALYTICS_TOKEN Worker secret pattern for storing the token out of source
affects: []

# Tech tracking
tech-stack:
  added: [Cloudflare Web Analytics beacon (external CDN script)]
  patterns: [env-conditional script injection via optional Worker secret]

key-files:
  created: []
  modified: [src/index.js]

key-decisions:
  - "beacon script injected into htmlHead() via analyticsToken param — graceful no-op when absent"
  - "token sourced from env.CF_ANALYTICS_TOKEN (Worker secret) — never hardcoded in source"
  - "defer attribute used on beacon script so it never blocks page render"

patterns-established:
  - "env-conditional feature pattern: pass env object into render functions, read optional vars with env?.VAR ?? null"

# Metrics
duration: 15min
completed: 2026-02-20
---

# Phase 5-01: Add Cloudflare Website Analytics Tracking Script Summary

**Privacy-first page-view analytics via Cloudflare Web Analytics beacon injected into both HTML pages, gated on CF_ANALYTICS_TOKEN Worker secret**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `htmlHead(title, analyticsToken = null)` now conditionally emits the Cloudflare Web Analytics `<script defer>` beacon before `</head>`
- `renderLandingPage(env)` and `renderSubscribePage(teamId, url, env)` thread `env?.CF_ANALYTICS_TOKEN` through to `htmlHead()`
- Token is stored in `.dev.vars` locally and as a Worker secret in production — never appears in source code
- Pages render identically when `CF_ANALYTICS_TOKEN` is absent (zero regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread CF_ANALYTICS_TOKEN through HTML rendering and inject beacon script into htmlHead** - `afbcd43` (feat)

## Files Created/Modified
- `src/index.js` - Updated `htmlHead`, `renderLandingPage`, `renderSubscribePage`, `handleSubscribePage`, and the two callers in the `fetch()` handler

## Decisions Made
- Beacon script uses `defer` so it never blocks page render
- `env` is passed as a whole object into render functions rather than the token string directly — keeps the pattern consistent with how Worker env is normally used and makes it easy to add more env-gated features later
- `env?.CF_ANALYTICS_TOKEN ?? null` (optional chaining + nullish coalescing) handles missing `env` or missing key gracefully

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
**External services require manual configuration.**

To enable analytics:
1. Go to Cloudflare Dashboard → Analytics & Logs → Web Analytics → Add a site (or view existing site for heartland.ankrom.ai)
2. Copy the alphanumeric token from the generated `<script>` snippet (`data-cf-beacon` `"token"` field)
3. **Local dev:** The token is already present in `.dev.vars` (file is gitignored via `.*.vars*` pattern)
4. **Production:** Set via Cloudflare Dashboard → Workers & Pages → heartland-soccer-calendar → Settings → Variables and Secrets, or run:
   ```
   echo 'YOUR_TOKEN' | wrangler secret put CF_ANALYTICS_TOKEN
   ```

## Next Phase Readiness
- Analytics are live on next deploy
- No blockers

---
*Phase: 05-add-cloudflare-website-analytics-tracking-script-to-website*
*Completed: 2026-02-20*
