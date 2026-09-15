# Multi-floor routing and connector forms

Requires backend PR https://github.com/wapco-ai/golden_path_backend/pull/9.
Apply its versioned database changes and deploy that API before this frontend.
The database floor catalog must contain each real floor before its map geometry
is imported. Small elevation differences inside one floor are not modeled.

The map manager keeps its existing three-step modal and styles. The connection
type list now includes stairs and ramps. Step two edits one shared connector and
its ordered stops; every stop belongs to a floor and a walkable access area.
Clicking “select point” temporarily shows that floor's map, then returns to the
same form and step. Escape cancels the pick. One unambiguous access area is
selected automatically; overlapping candidate areas require an explicit choice.

Select an existing named connector to load all its stops, or edit its portal on
any floor. Shared edits carry the server version, so an outdated form cannot
overwrite a newer change. Adding a point no longer creates an active door before
the modal is complete. Final save commits all stops and their metadata together.
Canceling a new form writes nothing.

The point used to open the form is marked as the selected point. Its location and
floor stay fixed and it cannot be deleted from that form. This follows the point's
identity, so it also works when editing from a middle floor or reordering stops.
Other stops can still be picked on the map. Access-space selection remains
available when the selected point has multiple candidate areas. Choosing a shared
connector with a different point already on this floor leaves the draft intact.
The stop section uses the modal's existing typography, colors and input styling.

Elevators connect all usable served floors. Waiting time applies once per boarding.
Stairs, ramps and escalators connect consecutive stops in the displayed physical
order. Reverse travel time defaults to forward time and can be overridden.
Wheelchairs cannot use stairs/escalators; electric vans cannot use connectors.

Selected origin/destination floors survive search, map selection and route storage.
Routes retain separate walk geometry per floor and explicit transfer steps.
No line is drawn between floors. During live navigation the existing direction
arrow confirms reaching the next floor; GPS alone cannot confirm a transfer.
The local routing fallback cannot create cross-floor paths or override an API
rejection. Existing single-floor route geometry and RNG styles are preserved.

Verification:

- `npm test`: existing routing, RNG appearance, guidance and profile regressions;
  connector validation, segmented geometry, floor metadata and navigation checks.
- `npm run build`: production build.
- `npm run test:browser`: actual React admin forms and navigation in Chromium,
  with controlled API/map fixtures. Checks three-floor save, shared editing,
  cancel/return, desktop/mobile overflow and floor transitions in the RNG preview.
- Real PostgreSQL/PostGIS/pgRouting and HTTP integration tests run in backend CI.

Deployments still require populating the real connector stops on the map and
running the existing `graph` queue worker. Queued/failed graphs stay unavailable
to routing until rebuilding succeeds. No production map data is created by this PR.
