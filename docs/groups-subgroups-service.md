# Groups & Subgroups Service Context

## Purpose
Provide the category metadata and detailed subcategory cards that `MapBeginPage` and its map components consume. The front-end currently imports this data from `src/components/groupData.js`; the service should replicate that structure so filters, image markers, and info cards keep working.

## Endpoint
`GET /api/groups`

### Query Parameters
- `language` (string, optional, default `fa`; supported: `fa`, `en`, `ar`, `ur`)
- `includeSubgroups` (boolean, optional, default `true`) — allows fetching only the top-level groups when set to `false`.
- `group` (string, optional) — when provided, returns only the matching group and its subgroups.

### Sample Request
```
GET /api/groups?language=en&group=sahn
```

### Sample Response
```json
{
  "groups": [
    {
      "value": "sahn",
      "label": { "fa": "صحن‌ها", "en": "Courtyards", "ar": "الساحات", "ur": "صحن" },
      "icon": "courtyard",
      "property": "group",
      "png": "https://cdn.example.com/icons/courtyard.png"
    },
    {
      "value": "ravaq",
      "label": { "fa": "رواق‌ها", "en": "Porticos", "ar": "الرواقات", "ur": "رواق" },
      "icon": "shrine",
      "property": "group",
      "png": "https://cdn.example.com/icons/shrine.png"
    }
  ],
  "subGroups": {
    "sahn": [
      {
        "value": "sahn-enqelab",
        "label": { "fa": "صحن انقلاب", "en": "Enghelab Courtyard", "ar": "ساحة الثورة", "ur": "صحن انقلاب" },
        "description": "توضیحات",              
        "img": [
          "https://cdn.example.com/images/s37.jpg",
          "https://cdn.example.com/images/s38.jpg",
          "https://cdn.example.com/images/s1.jpg"
        ],
        "address": { "fa": "ضریح مطهر اما رضا(ع)", "en": "Holy Shrine Core", "ar": "الضريح", "ur": "ضریح مطهر" },
        "distance": 150,
        "time": 2,
        "rating": 3.6,
        "views": 17
      },
      {
        "value": "sahn-azadi",
        "label": { "fa": "صحن آزادی", "en": "Azadi Courtyard", "ar": "ساحة الحرية", "ur": "صحن آزادی" },
        "description": "توضیحات",
        "img": ["https://cdn.example.com/images/s41.jpg"],
        "address": { "fa": "ضریح مطهر اما رضا(ع)", "en": "Holy Shrine Core", "ar": "الضريح", "ur": "ضریح مطهر" },
        "distance": 200,
        "time": 3,
        "rating": 4.7,
        "views": 17
      }
    ],
    "eyvan": [
      {
        "value": "eyvan-tala",
        "label": { "fa": "ایوان طلا", "en": "Golden Portico", "ar": "ايوان الذهب", "ur": "ایوان طلا" },
        "description": "توضیحات",
        "img": ["https://cdn.example.com/images/s3.jpg"],
        "address": { "fa": "صحن انقلاب", "en": "Enghelab Courtyard", "ar": "ساحة الثورة", "ur": "صحن انقلاب" },
        "distance": 180,
        "time": 2.5,
        "rating": 3.7,
        "views": 17
      }
    ]
  },
  "language": "en",
  "generatedAt": "2025-01-15T10:00:00Z"
}
```

## Behavior & Validation
- Always include the `groups` array; include `subGroups` only when `includeSubgroups=true`.
- Distances and times should be numeric so the UI can add localized units; ratings and views remain numeric.
- Return HTTP 200 with empty arrays if a filter yields no results; return 404 only when the endpoint path is incorrect.
- Keep multi-language labels even when a specific `language` is requested to let the front-end cache translations.

## Front-end integration notes
- Current code imports `groups` and `subGroups` from `src/components/groupData.js`; preserving the same keys (`value`, `label`, `img`, `distance`, `time`, `rating`, `views`) allows a drop-in replacement with a `fetch` call.
- `subGroupValue` from the GeoJSON properties can align with `subGroups[*].value` to link map markers and bottom-sheet cards.
- Icon URLs (`png`) can be absolute or relative; ensure CORS/host permissions allow direct image loading in the browser.
