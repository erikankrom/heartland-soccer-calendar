# Heartland Soccer Calendar — Roadmap

## Milestones

- ✅ [v1.0 Launch](milestones/v1.0-launch.md) (Phases 1–2) — SHIPPED 2026-02-20
- ✅ [v1.1 Enhancements](milestones/v1.1-enhancements.md) (Phases 3–5) — SHIPPED 2026-02-20
- ✅ [v1.2 Game Intelligence](milestones/v1.2-game-intelligence.md) (Phases 6–7) — SHIPPED 2026-03-05
- 🚧 v1.3 Standings — Phases 8–9 (in progress)

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

<details>
<summary>✅ v1.2 Game Intelligence (Phases 6–7) — SHIPPED 2026-03-05</summary>

- [x] Phase 6: Results Scraping and Subscribe Page Enrichment (2/2 plans) — completed 2026-03-05
- [x] Phase 7: iCal Feed Enrichment with Results Data (no formal plan) — completed 2026-03-05

</details>

### 🚧 v1.3 Standings (In Progress)

**Milestone Goal:** Surface division standings on the subscribe page so users can see where their team ranks.

#### Phase 8: Standings Scraping

**Goal**: Scrape division standings from Heartland Soccer, enrich `/api/team/{teamId}` with standings data
**Depends on**: Phase 7 (v1.2 complete)
**Research**: Likely (standings URL follows a different format than results; data shape unknown)
**Research topics**: Standings page URL structure, HTML format, how to identify the subscribed team's row, relationship between teamId and standings data
**Plans**: TBD

Plans:
- [ ] 08-01: Scraping utilities + auto-discovery + API integration

#### Phase 9: Standings UI

**Goal**: Render division standings table on the subscribe page with the subscribed team highlighted
**Depends on**: Phase 8
**Research**: Unlikely (internal HTML/CSS patterns established in v1.2)
**Plans**: TBD

Plans:
- [ ] 09-01: Standings table HTML + CSS + client-side rendering

---

## Progress

| Phase                                          | Milestone | Plans Complete | Status      | Completed  |
| ---------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Field Map Links                             | v1.0      | 1/1            | Complete    | 2026-02-20 |
| 2. Homepage Value Section                      | v1.0      | 1/1            | Complete    | 2026-02-20 |
| 3. Home/Away Jersey Color Assignment           | v1.1      | 1/1            | Complete    | 2026-02-20 |
| 4. Modify Field Map Link Location              | v1.1      | 1/1            | Complete    | 2026-02-20 |
| 5. Add CloudFlare Website Analytics to website | v1.1      | 1/1            | Complete    | 2026-02-20 |
| 6. Results Scraping and Subscribe Page Enrichment | v1.2   | 2/2            | Complete    | 2026-03-05 |
| 7. iCal Feed Enrichment with Results Data      | v1.2      | 0/0            | Complete    | 2026-03-05 |
| 8. Standings Scraping                          | v1.3      | 0/1            | Not started | -          |
| 9. Standings UI                                | v1.3      | 0/1            | Not started | -          |
