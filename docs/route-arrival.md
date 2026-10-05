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
