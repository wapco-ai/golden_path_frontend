# RNG guidance, preview and demo

## Appearance policy

Preserve the existing UI/UX unless the user explicitly approves a visual change.
The unrequested visual additions from PR #697 have been removed: the demo banner,
step counter, separate Exit button, new placeholder copy and panel CSS overrides.
The original Routing.css is unchanged. The direction icon uses its original span
and classes, with click and keyboard handlers; no new visible control is added.
Its accessible name and navigation diagnostic data attributes are retained.

## Behavior

- In either expanded or collapsed panel state, one frame supplies the map position,
  the selected step's end-to-end heading, floor and image query.
- Preview uses the selected segment start; actual navigation uses current DR/GPS.
- Clicking the existing direction icon previews the next step, including the final
  segment, and wraps to the first. Real sensor movement cannot advance the demo.
  The existing Start button exits demo and starts real navigation from the origin.
- Progress reads fromM before routeM and never guesses index/(stepCount-1).
  The final segment remains active until near the actual destination.
- RNG requests source=guidance_points. NO_MATCH clears the image. An older backend
  that returns a POI or ignores the source is rejected, not displayed.
- The guide image panel shows distinct messages while loading, when no image is
  available, and when the lookup or image file fails. A matching image can still
  be displayed on the arrival step.
- Preview and demo fetch once per selected step. Live navigation continues
  polling with the latest position. Step, floor, and mode changes abort the
  previous context. Errors clear stale imagery.
- If a live image file fails, the next successful lookup can reload the same
  URL. The current image remains visible during later lookups after recovery.
- Guidance-only image selection uses NetworkOnly in the PWA service worker; it
  cannot replay a previously cached API match when the network is unavailable.

## Deployment

The navigation logic requires backend PR wapco-ai/golden_path_backend#3.
This appearance-only restoration does not require any further backend update,
SQL, migration, graph rebuild or dependency version update.
Pull frontend main in the Windows checkout and restart the existing Vite server.
For local use the image API must target localhost:8080, not the production domain.
The explicit override is VITE_LANDMARK_VIEW_IMAGE_URL when needed.

The old routeAnalysis test used to overwrite the installed Zustand package.
That has been removed. A one-time npm ci restores node_modules if that old test ran;
there is no need to reinstall dependencies solely for the appearance restoration.

## Verification

npm test
npm run build

Tests cover DR movement, isolated demo, unequal two-step boundaries, arrival,
floor selection, strict imagery and request cleanup/retry. Source-level appearance
guards check the original stylesheet, span icon, image panel classes and absence of
new visible controls. They are not pixel/screenshot or physical-device tests.

Manual acceptance: load a server-generated route on /#/rng, inspect image requests
for source=guidance_points, click the original icon in both panel states, verify
marker/instruction/heading/image agreement and wrap at the end. Use the existing
Start button to leave preview/demo and begin real navigation. Verify the original
panel layout and absence of the extra demo banner, counter and Exit button.
A no-match response is expected outside coverage or image FOV.
Guidance image coordinates never become new routing graph vertices or edges.
