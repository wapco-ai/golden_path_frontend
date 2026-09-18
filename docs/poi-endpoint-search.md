# POI endpoint search and floor-picker overlays

Text search for MPR origin/destination and MPB uses the existing
`landmark-places?search=...` request. The paired backend change makes nonblank
text search include matching POIs on every floor, even without cultural content,
images or category assignments. MPR already renders text results without an
image requirement; MPB's remaining image-only search filter is now removed.
Both preserve the returned POI floor. No map-floor or featured filter is added
to endpoint text search. Normal map landmark discovery remains unchanged.

The MPR search modal remains on `/mpr`, so route allowlisting alone cannot hide
map controls. MPR now passes `hidden={showOriginModal || showDestinationModal}`
to FloorControl; MPB passes `hidden={showSearchModal}`. FloorControl returns null
for its UI while hidden, closes any open menu and releases its layout observers.
It stays mounted so route-floor synchronization is not lost. Opening search
removes the trigger/menu from the DOM and keyboard navigation; closing search or
choosing from the map restores the same control. The existing explicit
unknown-endpoint-floor prompt remains available after the search modal closes.
The final implementation does not depend on CSS :has or a larger z-index, and
retains the original stylesheet, appearance and placement.

No routing/step geometry, graph sources or database-derived coordinates change.

Verification: `npm test`, `npm run build`, `npm run test:browser`.
`tests/browser/poi-endpoint-search.spec.js` covers both MPR inputs at mobile and
desktop sizes, restoration when entering/leaving map selection, contentless and
imageless results on -1/0/1 at identical XY, independent endpoint floors, and MPB
search. The existing public-floor/QR/GPS and multifloor regressions still run.
Browser API responses are fixtures; real POI eligibility is tested by the paired
backend PostgreSQL/HTTP integration tests. Backend deployment requires applying
its new versioned SQL or targeted Artisan migration, not merely merging source.
