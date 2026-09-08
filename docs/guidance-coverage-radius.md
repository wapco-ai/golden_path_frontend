# Guidance-point coverage radius

User-approved UI change: one numeric field labeled شعاع پوشش (متر), using the existing input style, in both Add and Edit guidance-point dialogs. No changes to RNG, map layout, image controls or existing stylesheets.

New-point state and form resets default to 100 m. Editing loads coverage_radius_m from the saved point, including older 10 m values. Both create and update send the validated value in multipart FormData. The accepted range is 0.01 through 100 m with up to two decimal places, matching the database column and existing upper bound.

Companion backend change sets the omitted-create default and null selection fallback to 100 m, and adds a targeted migration for the database default. Existing points are not mass-updated. Edit and save an existing point explicitly to change its radius.

Coverage is only a distance filter. Floor and image heading/FOV still apply, and preview/demo still samples the selected step start. Increasing coverage alone is not a guarantee that an image is directionally eligible. No route geometry or graph source changes.

Deploy backend code and its targeted migration before pulling frontend main in the Windows checkout. Run npm.cmd test and restart Vite with npm.cmd run dev. No dependency versions changed. Validate one new point defaults to 100, an old point retains 10 on opening, and a saved custom value survives reload.
