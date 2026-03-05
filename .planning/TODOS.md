# TODOs

## ✓ DONE: Clickable team number links for scouting

In the "Show results" table and on upcoming game rows, make the opponent team number a link to `/subscribe/{opponentId}` so users can easily pull up that team's schedule to scout them.

Context: opponentId is already available on results.games entries and can be parsed from event SUMMARY for upcoming games. The /subscribe/{teamId} route already exists.
