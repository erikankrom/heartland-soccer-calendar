# Plan 01-01 Summary: Field Map Links

**Phase:** 01-field-map-links
**Plan:** 01
**Status:** Complete — awaiting checkpoint verification
**Date:** 2026-02-20

## Objective

Add field map links to both the subscribe page event list and the iCal calendar DESCRIPTION field, so users can tap "Field map" to pull up the venue map from either surface.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Plumb field_map_url through CSV parsing, location resolution, and iCal DESCRIPTION | `96fc975` | `src/index.js` |
| 2 | Add Field map link to subscribe page event rows | `cc1ce1b` | `src/index.js` |

## Changes Made

### src/index.js

**`parseLocationsCSV` (line 188):**
Added `mapUrl: fields[3] || null` to the location object stored in the map. This reads the fourth column (`field_map_url`) from `src/locations.csv`.

**`resolveLocation` (lines 212–214):**
Both return paths now include `mapUrl`:
- Known venue: `mapUrl: complex.mapUrl || null`
- Unknown venue: `mapUrl: null`

**`generateICal` DESCRIPTION building (line 241):**
After the venue name line, added:
```js
if (loc.mapUrl) descParts.push(`Field map: ${loc.mapUrl}`);
```
This appends `\nField map: https://...` to the iCal DESCRIPTION for events at known venues.

**Subscribe page client-side JS (lines 830–831):**
Added `mapLink` variable and included it after `locLabel` in the event HTML:
```js
var mapLink = (loc && loc.mapUrl) ? '<div class="meta"><a href="' + esc(loc.mapUrl) + '" target="_blank" rel="noopener">Field map</a></div>' : '';
```

## Data Flow

```
locations.csv (field_map_url column)
  → parseLocationsCSV() → { mapUrl }
  → resolveLocation() → { field, name, address, mapUrl }
  → generateICal() DESCRIPTION → "Field map: https://..."
  → handleTeamAPI() JSON response → location.mapUrl
  → subscribe page JS → <a href="{mapUrl}">Field map</a>
```

## Venues with Map URLs (6 total)

| Prefix | Venue |
|--------|-------|
| OSC | GARMIN Olathe Soccer Complex |
| OP | SCHEELS Overland Park Soccer Complex |
| CMSF | Compass Minerals Sporting Fields |
| SSV | Swope Soccer Village |
| HSP | Heritage Soccer Park |
| MAW | Mid-America West Sports Complex |

## Checkpoint

A `checkpoint:human-verify` task follows. The user needs to:
1. Run `npm run dev`
2. Visit `/subscribe/{team-id}` and verify "Field map" links appear for known venues
3. Visit `/calendar/{team-id}` and verify `Field map:` appears in DESCRIPTION
4. Confirm unknown venues have no link/text
