# Navigation position quality

Route geometry remains server-owned: door_access_points -> routing_nodes -> routing_edges_static. The client projects observations onto the returned polyline; it does not build edges from doors or alter a route to match GPS.

## Observation policy

- All GPS entry points retain acquisition time and reported accuracy, request high accuracy without cached fixes, and reject invalid, stale (>15 seconds), future or non-increasing timestamps. The map/origin may accept reported accuracy up to 25 m; automatic progress requires <=6 m and arrival <=3 m.
- Progress stays in a local along-route window (6 m plus elapsed time times 3 m/s walking or 10 m/s vehicle, capped at five seconds). Nearby return legs cannot steal progress through a global nearest-point projection. Repeated React renders of the same observation do not advance another step.
- Arrival needs three distinct qualifying observations spanning at least two seconds. Poor observations reset the arrival candidate. Floor changes still require the existing explicit confirmation.
- Resuming requires a new observation. Ambiguous nearby nonadjacent route legs require a better position or QR; successful resume seeds tracking at the revalidated along-route position.
- Hiding the application pauses the active trip with the existing pause control. Returning to the foreground requires explicit resume.

## QR and inertial estimates

- Registered QR links resolve ID, coordinates and floor through the server before mounting the application. URL coordinates cannot override the registered QR. Invalid/disabled lookups clear the previous QR. Numeric and poi_N cultural links retain the legacy POI lookup only after a QR 404.
- A QR capture time is not refreshed by a repeated lookup. A 2 m working allowance is assigned to a verified QR anchor; this is not proof of surveying accuracy or physical proximity to a shared link.
- Dead reckoning starts only with a fresh trusted GPS/QR anchor. The 0.7 m default stride is an estimate. Two consistent straight GPS-measured walks can calibrate stride (at least 20 steps, 20 m, 8 seconds, <=3 m GPS accuracy and combined endpoint allowance <=15% of distance). Turns invalidate the calibration segment.
- Dead reckoning expires after 60 seconds or 30 m, and uncertainty increases with distance. The 10 m cap is a conservative software budget, not a statistical accuracy guarantee. Automatic progress stops earlier when the 6 m budget is exceeded. Wheelchair/vehicle navigation does not translate phone steps into walking distance.
- Coarse GPS cannot replace a recent better anchor. Timestamp ordering and a speed/accuracy envelope reject implausible sequential GPS jumps.

## Validation and limits

Unit regressions cover parallel return legs, duplicate measurements, arrival debounce, bad GPS origins, anchor expiry, calibration, authoritative QR lookup, legacy cultural links and lookup races. Browser regressions cover continuous GPS motion, background pause, existing QR camera correction, pause/resume, floor transfers and unchanged controls.

No model-specific centimetre/metre accuracy is promised. GNSS reception, multipath, surveyed QR placement, phone bearing versus walking direction, browser permissions and sensor availability require on-site measurements. Browser tests do not replace a physical phone walk test.

References: [W3C Geolocation](https://www.w3.org/TR/geolocation/), [W3C Device Orientation](https://www.w3.org/TR/orientation-event/).
