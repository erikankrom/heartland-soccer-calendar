# Heartland Soccer Calendar — Roadmap

## Milestones

- ✅ [v1.0 Launch](milestones/v1.0-launch.md) (Phases 1–2) — SHIPPED 2026-02-20
- ✅ [v1.1 Enhancements](milestones/v1.1-enhancements.md) (Phases 3–5) — SHIPPED 2026-02-20
- 🚧 **v1.2 Game Intelligence** — Phases 6–7 (in progress)

## Phases

<details>
<summary>✅ v1.0 Launch (Phases 1–2) — SHIPPED 2026-02-20</summary>

- [x] Phase 1: Field Map Links (1/1 plans) — completed 2026-02-20
- [x] Phase 2: Homepage Value Section (1/1 plans) — completed 2026-02-20

</details>

<details>
<summary>✅ v1.1 Enhancements (Phases 3–5) — SHIPPED 2026-02-20</summary>

- [x] Phase 3: Home/Away Jersey Color Assignment (1/1 plans) — completed 2026-02-20
- [x] Phase 4: Modify Field Map Link Location (1/1 plans) — completed 2026-02-20
- [x] Phase 5: Add CloudFlare Website Analytics tracking script to website (1/1 plans) — completed 2026-02-20

</details>

### 🚧 v1.2 Game Intelligence (In Progress)

**Milestone Goal:** Enrich the subscribe page and iCal feed with real game results, team record, and opponent context by scraping the Heartland Soccer results pages.

#### Phase 6: Results Scraping and Subscribe Page Enrichment

**Goal**: Fetch and parse team results from `team_results.cgi`, compute W-L-T record, and surface all game intelligence on the subscribe page — record summary, full results table, scores on past event rows, and opponent W-L-T on upcoming event rows.
**Depends on**: Phase 5 (previous milestone complete)
**Research**: Likely (new external HTML scraping target, multi-fetch opponent lookup pattern, caching strategy for results data)
**Research topics**: HTML structure of `team_results.cgi` response; how to extract team number from opponent name column; Cloudflare Cache API usage for results data (TTL, cache key design); whether opponent fetch can be parallelized within a Worker
**Plans**: TBD

Plans:
- [ ] 06-01: TBD (run `/gsd:plan-phase 6` to break down)

#### Phase 7: iCal Feed Enrichment with Results Data

**Goal**: Inject game intelligence into the iCal feed — past VEVENTs get final score in DESCRIPTION, future VEVENTs get opponent W-L-T record in DESCRIPTION.
**Depends on**: Phase 6 (results scraping and data model established)
**Research**: Unlikely (extends existing iCal pipeline using internal patterns already established)
**Plans**: TBD

Plans:
- [ ] 07-01: TBD (run `/gsd:plan-phase 7` to break down)

---

## Progress

| Phase                                          | Milestone | Plans Complete | Status      | Completed  |
| ---------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Field Map Links                             | v1.0      | 1/1            | Complete    | 2026-02-20 |
| 2. Homepage Value Section                      | v1.0      | 1/1            | Complete    | 2026-02-20 |
| 3. Home/Away Jersey Color Assignment           | v1.1      | 1/1            | Complete    | 2026-02-20 |
| 4. Modify Field Map Link Location              | v1.1      | 1/1            | Complete    | 2026-02-20 |
| 5. Add CloudFlare Website Analytics to website | v1.1      | 1/1            | Complete    | 2026-02-20 |
| 6. Results Scraping and Subscribe Page Enrichment | v1.2   | 0/?            | Not started | -          |
| 7. iCal Feed Enrichment with Results Data      | v1.2      | 0/?            | Not started | -          |
