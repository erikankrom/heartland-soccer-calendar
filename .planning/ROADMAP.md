# Heartland Soccer Calendar — Roadmap

## Milestones

- ✅ [v1.0 Launch](milestones/v1.0-launch.md) (Phases 1–2) — SHIPPED 2026-02-20

## Phases

### ✅ v1.0 Launch (Phases 1–2) — SHIPPED 2026-02-20

- [x] Phase 1: Field Map Links (1/1 plans) — completed 2026-02-20
- [x] Phase 2: Homepage Value Section (1/1 plans) — completed 2026-02-20

### Phase 3: Home/Away Jersey Color Assignment

**Goal:** Update the subscribe page event rows and iCal VEVENT descriptions to show home/away jersey color assignments for each game. The home team (listed first on the schedule) wears white/light jerseys; the visiting team (listed second) wears dark jerseys. The subscribed team's jersey color should be clearly indicated in both the calendar event and the subscribe page preview.
**Depends on:** Phase 2
**Plans:** 0 plans

Plans:

- [ ] TBD (run `/gsd:plan-phase 3` to break down)

**Details:**

[To be added during planning]

### Phase 4: Modify Field Map Link Location

**Goal:** On the subscribe page, change the field map link so it is applied to the actual field name text rather than a separate statically-named "Map" link. The park/complex location text remains unlinked.
**Depends on:** Phase 3
**Plans:** 0 plans

Plans:

- [ ] TBD (run `/gsd:plan-phase 4` to break down)

**Details:**

[To be added during planning]

### Phase 5: Add CloudFlare Website Analytics tracking script to website

**Goal:** Add the Cloudflare Web Analytics beacon script to both HTML pages (landing and subscribe). Token sourced from `CF_ANALYTICS_TOKEN` Worker env var so it is never hardcoded in source. Gracefully absent when env var is unset.
**Depends on:** Phase 4
**Plans:** 1 plan

Plans:

- [ ] 05-01: Add beacon script to htmlHead via CF_ANALYTICS_TOKEN env var

**Details:**

- `htmlHead(title, analyticsToken)` updated to inject beacon script when token is provided
- `renderLandingPage` and `renderSubscribePage` updated to accept and thread `env`
- Token set via Cloudflare Dashboard or `wrangler secret put CF_ANALYTICS_TOKEN`

---

## Progress

| Phase                                          | Milestone | Plans Complete | Status      | Completed  |
| ---------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Field Map Links                             | v1.0      | 1/1            | Complete    | 2026-02-20 |
| 2. Homepage Value Section                      | v1.0      | 1/1            | Complete    | 2026-02-20 |
| 3. Home/Away Jersey Color Assignment           | —         | 0/?            | Not planned | —          |
| 4. Modify Field Map Link Location              | —         | 0/?            | Not planned | —          |
| 5. Add CloudFlare Website Analytics to website | —         | 0/1            | Planned     | —          |
