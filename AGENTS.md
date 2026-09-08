# GoldenPath frontend instructions

## Preserve the existing UI/UX

Do not change the application's appearance without the user's explicit approval.
A request to fix functionality does not authorize a redesign or additional visible
controls, labels, counters, messages, spacing, colors, typography or panel layout.
Diagnostic screenshots are evidence of a problem, not permission to redesign.
Keep functional fixes separate from visual changes and preserve the original
appearance in both expanded and collapsed RNG panel states. When a visual change
is necessary, describe it and obtain approval before implementing it.

## Routing geometry

`doors.geom` is drawing/display geometry only. Routing geometry comes from
`door_access_points.geom`; `routing_nodes.geom` is built only from those access
points, and `routing_edges_static.geom` only from routing nodes. Route output and
steps must use routing edges/access points, never raw door geometry. Guidance
images are visual aids, not routing graph vertices or edges.
