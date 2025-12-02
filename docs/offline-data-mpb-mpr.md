# Offline data used in MPB/MPR pages

## Category metadata (groups)
- `src/components/groupData.js` exports a `groups` array with hardcoded category definitions (value, translation key, icon id, and PNG asset imports) used by both MapBegin (MPB) and MapRouting (MPR) pages to render category selectors.
- MapBegin maps over `groups` to build the horizontal category list at the top of the page; MapRouting reuses the same array inside its search modal.

## Subcategory/place stubs (`subGroups`)
- The same `groupData.js` file contains a `subGroups` object with numerous hardcoded places under each category. Each entry includes Persian labels, placeholder descriptions, image references, address strings, distance/time values, ratings, and view counts.
- MapRouting localizes and displays these subgroups inside the destination/origin modal, including image-backed cards and list items.

## Fixed entry list in MPR
- The MPR entry modal renders a static `[1, 2, 3, 4]` list of entry numbers for destination selection instead of loading them from an API.

## References
- Category definitions and subgroup data: `src/components/groupData.js`.
- Category rendering in MPB: `src/pages/MapBegin.jsx`.
- Category and subgroup rendering in MPR, plus static entry numbers: `src/pages/MapRouting.jsx`.
