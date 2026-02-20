# Phase 1: Field Map Links - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<vision>
## How This Should Work

When a user views the subscribe page, each game in the events list already shows the field name and complex name as a meta line. Under that location line, a small "Field map →" link should appear that opens the field map URL for that venue.

In the iCal feed itself, when the event is opened in Apple Calendar, Google Calendar, or Outlook, the event description/notes should include a field map link so users can tap it to pull up directions or the field layout map from within their calendar app.

</vision>

<essential>
## What Must Be Nailed

- **Site:** Small, unobtrusive "Field map" link below the location line on each event row in the games preview
- **Calendar:** Field map URL included in the iCal event DESCRIPTION field so it's tappable in any calendar app
- Only show the link when a `field_map_url` exists for that field prefix (not all games may have one)

</essential>

<specifics>
## Specific Ideas

- Site: link appears below the location meta line (same pattern as existing "meta" rows)
- Calendar: appears as a line in the event description/notes, not as the primary URL field
- No map pin icon needed on the site — a plain text link is fine

</specifics>

<notes>
## Additional Context

- `src/locations.csv` already has the `field_map_url` column populated for all 6 known field prefixes
- The location lookup is already working — this phase just adds the URL as an additional output of that lookup
- Some field map URLs are PDFs, some are images, some are web pages — the link text should be generic ("Field map") to cover all cases

</notes>

---

*Phase: 01-field-map-links*
*Context gathered: 2026-02-20*
