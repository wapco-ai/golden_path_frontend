# Haram navigation policy

The public policy is loaded before mounting from `/api/v1/navigation-settings`, validated, and cached for offline use. Default: GPS disabled; uncertainty warning 20 m; arrival radius 3 m. Offline or malformed responses retain the last valid policy. Settings are edited in the existing administrator settings dialog and take effect on the next application load.

A verified QR or selected known origin anchors pedestrian dead reckoning. GPS never starts or corrects positioning in Haram mode. Device motion and an absolute heading are required. Wheelchair/vehicle modes do not invent steps. Missing heading increases uncertainty for unobserved steps; absent sensors stop automatic positioning and show a warning.

Raw dead-reckoned position and uncertainty stay separate from the displayed route projection. Projection uses only the server line, a continuous distance window, heading consistency, and ambiguity checks. It neither creates routing geometry nor resets uncertainty. Above the configured uncertainty/discrepancy limit, a warning latches until a new anchor; maps and QR correction remain available. No automatic reroute is invented from an unknown position.

Automatic arrival requires the last route step, a raw estimate within the separate endpoint radius, valid heading/fresh steps, acceptable cumulative uncertainty, and distinct consecutive arrival observations. A destination QR is not required. This is an estimated arrival under sensor assumptions, not a guarantee of physical position; biased phone headings and stride estimates require field validation.

Pausing stores raw position and the complete uncertainty budget. Without a new QR, resuming requires the user to confirm they are still at the pause location, preserving uncertainty. Floor transfer remains an explicit user action and carries the error budget forward. A later QR correction preserves the existing camera and cancellation behavior.

Validation includes motion-event browser navigation without GPS, arrival without QR, over-limit warnings in both panel states, pause/resume continuity, settings persistence, hairpin projection, floor boundaries and legacy administrator-enabled GPS scenarios. Physical device accuracy has not been measured by these automated tests.
