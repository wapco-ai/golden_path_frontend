# Haram navigation policy

The public policy is loaded before mounting from `/api/v1/navigation-settings`, validated, and cached for offline use. The defaults disable GPS, warn at a route discrepancy greater than 20 m (`snap_distance_m`), and use a 3 m arrival radius. Offline or malformed responses retain the last valid policy. Settings are edited in the existing administrator settings dialog and take effect on the next application load.

A verified QR or selected known origin anchors the raw pedestrian dead-reckoned position. GPS never starts or corrects positioning in Haram mode. Detected walking steps advance the display; only steps with a valid heading update the raw position. Wheelchair and vehicle modes do not convert phone motion into walking steps.

Display progress follows the server line by detected step distance. The advisory measures the distance from the raw dead-reckoned position to the corresponding section of that line, bounded by recent along-route progress on the active segment. Crossing the configured distance shows a message below the top controls for four seconds and a small badge above the QR button. Tapping the badge shows the message again. The marker and step-based guidance continue. The badge and message clear when a fresh estimate returns within the limit or a successful QR correction re-anchors the trip. The discrepancy is a geometric estimate; it cannot reveal every position error without an independent reference.

Automatic arrival requires the last route step, display progress near the endpoint, and distinct fresh steps whose raw estimates are within the separate arrival radius with compatible heading. A destination QR is not required. Phone heading and stride estimates require field validation.

Pausing stores the raw position, route progress and last measured discrepancy. Without a new QR, resuming requires the user to confirm they are still at the pause location. Floor transfer remains an explicit user action. QR correction preserves the existing camera and cancellation behavior.

Validation covers motion-event navigation without GPS, arrival without QR, progress after a distance warning, false-arrival protection, both panel states, pause/resume, settings persistence, hairpin projection, floor boundaries and legacy administrator-enabled GPS scenarios. Physical device accuracy has not been measured by these automated tests.
