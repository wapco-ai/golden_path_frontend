# POI endpoint search and floor-picker overlays

Text search for MPR origin/destination and MPB uses the existing
`landmark-places?search=...` request. The paired backend change makes nonblank
text search include matching POIs on every floor, even without cultural content,
images or category assignments. The frontend already renders text results without
an image requirement and preserves the returned POI floor. No map-floor or
featured filter is added to endpoint text search. Normal map landmark discovery
remains separate and keeps its existing behavior.

The MPR search modal remains on `/mpr`, so route allowlisting alone cannot hide
map controls. `FloorControl.css` now hides the entire floor control while the
conditionally mounted MPR `.map-search-modal` or MPB `.search-modal3` exists.
This is a scoped `display: none` rule, not a z-index workaround: the trigger/menu
are not visible or keyboard targets. Closing search or choosing from the map
restores the same control. Its appearance and placement are otherwise unchanged.
The existing route-floor synchronization and explicit unknown-floor prompt stay
intact; no routing/step geometry or database-derived coordinates are changed.

Verification: `npm test`, `npm run build`, `npm run test:browser`.
`tests/browser/poi-endpoint-search.spec.js` covers both MPR inputs at mobile and
desktop sizes, restoration when entering/leaving map selection, contentless and
imageless results on -1/0/1 at identical XY, independent endpoint floors, and MPB
search. The existing public-floor/QR/GPS and multifloor regressions still run.
Browser API responses are fixtures; real POI eligibility is tested by the paired
backend PostgreSQL/HTTP integration tests. Backend deployment requires applying
its new versioned SQL or targeted Artisan migration, not merely merging source.
