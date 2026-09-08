# RNG guidance, preview and demo

## Behavior

- In either expanded or collapsed panel state, one frame supplies the map position,
  the selected step's end-to-end heading, floor and image query.
- Preview uses the selected segment start; actual navigation uses current DR/GPS.
- The direction icon is a keyboard-accessible button again. Each click previews
  the next step, including the final segment, wrapping to the first. Demo is labeled
  as simulated and cannot advance from real sensor movement. Exit demo returns to
  the first preview; Start begins real navigation from its origin, not a demo step.
- Progress reads fromM before routeM and never guesses index/(stepCount-1).
  The final segment remains active until near the actual destination.
- RNG requests source=guidance_points. NO_MATCH clears the image. An older backend
  that returns a POI or ignores the source is rejected with an error, not displayed.
- One request is active at a time. Latest position is sampled between polls;
  step/floor/mode changes abort the previous context. Errors clear stale imagery.
- Guidance-only image selection uses NetworkOnly in the PWA service worker; it
  cannot replay a previously cached API match when the network is unavailable.

## Deployment

Deploy backend PR wapco-ai/golden_path_backend#3 first, then this frontend.
No new migration, graph rebuild or dependency version update is required.
Use the local frontend checkout on Windows for git pull and npm commands, not the
WSL backend folder. Vite may be restarted with npm run dev after the pull.
For local use the image API must target localhost:8080, not the production domain.
The explicit override is VITE_LANDMARK_VIEW_IMAGE_URL when needed.

The old routeAnalysis test used to overwrite the installed Zustand package.
That has been removed. A one-time npm ci restores node_modules if the old test ran.
The existing lock file and dependency versions are unchanged.

## Verification

npm ci
npm test
npm run build

Tests cover both preview states, DR movement, isolated demo, unequal two-step
boundaries, arrival, floor selection, strict imagery and request cleanup/retry.
No test database is needed. Full GPS/DR behavior on a physical device and the
production deployment require separate acceptance checks.

Manual acceptance: load a server-generated route on /#/rng, inspect image requests
for source=guidance_points, click the direction icon in both panel states, verify
marker/instruction/heading/image agreement, wrap at the end, exit demo and start
real navigation. A no-match state is expected outside coverage or image FOV.
Guidance image coordinates never become new routing graph vertices or edges.

Rollback: revert frontend changes first, then the companion backend code if needed.
