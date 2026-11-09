# Terminal route steps

The ROP carousel and RNG navigation slice same-floor routes between numeric
`routeM` positions. A terminal `stepArriveDestination` belongs at `routeM: 1`.
The floor-aware backend originally appended that step without its position,
which removed both the destination instruction and the final walking segment
from those displays.

The backend now supplies the endpoint position. `normalizeRouteMSteps` also
infers it for a terminal arrival with a missing or null position, so existing
saved routes remain usable. Other missing positions are still excluded. Arrival
is retained even when the last door also has position 1; that arrival has zero
distance. Input steps and routing geometry are not modified.

ROP uses the selected destination name when the server leaves the arrival title
empty. The existing carousel, controls, styling and translations are retained.

`npm test` covers position normalization and the complete final segment.
`npm run test:browser` covers ROP arrival in desktop and mobile views, stored and
fresh API responses, direct routes, endpoint doors and a multi-floor route.
The backend integration suite checks the endpoint position on main routes,
alternatives, direct same-floor routes and lift routes.

Deployment requires the usual frontend build and backend code update; no database
migration or graph rebuild is needed. To roll back, revert the respective code
commits and rebuild the frontend.

## Nearby destinations from MPR

MPR continues with the selected coordinates when the area lookup has no
entrances to offer. Its routing flow opts in to `allowNearbyDestination`. An
exact route takes precedence. When the exact destination is unreachable,
the backend checks live routing edges within 60 m of the point or of the
unavailable area's extent, on the requested floor. A registered access point
on the public side takes priority when reachable. The terminal geometry comes
from the live static edge, and the end of the route is identified by
`geo.properties.nearbyDestination`. When the origin is private or cannot
attach to the graph, the engine can start from a reachable point on the same
floor within the same search radius. It prefers a route to the exact
destination where possible. `geo.properties.nearbyOrigin` identifies the
actual starting point. The selected places stay available for editing or
swapping. The preview uses the actual route endpoints.

Apply backend migrations `2026_11_09_090000_add_nearby_route_destination.php`,
`2026_11_09_100000_expand_nearby_route_radius.php`, and
`2026_11_09_110000_add_nearby_route_origin.php` before enabling the updated
frontend. The SQL changes do not rebuild the graph.
