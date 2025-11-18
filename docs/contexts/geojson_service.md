<context>
ServiceName: Map GeoJSON Provider
Purpose: Supply all geometry and metadata that MapBeginPage uses to draw points/polygons, find nearest doors/connections, and show feature bubbles.

Endpoint: GET /api/v1/maps/geojson
Query Parameters:
  - language (string, optional, default "fa"; accepted: fa, en, ar, ur)

Sample Request:
  GET /api/va/maps/geojson?language=en

Sample Response Body:
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [59.61590796209613, 36.28614634336729] },
      "properties": {
        "name": "درب غربی صحن کوثر",
        "description": "",
        "group": "sahn",
        "subGroup": "صحن کوثر",
        "subGroupValue": "sahn-kosar",
        "types": ["farhangi"],
        "services": { "wheelchair": true, "electricVan": false, "walking": true },
        "gender": "family",
        "nodeFunction": "door",
        "restrictedTimes": [],
        "latitude": 36.28614634336729,
        "longitude": 59.61590796209613,
        "gpsMeta": null,
        "timestamp": "2025-06-12T07:55:21.187Z",
        "transportModes": []
      }
    },
    …
  ]
}

Validation Rules:
- Ensure `type` at root is `FeatureCollection`.
- Each feature must include `geometry.type`, `geometry.coordinates`, and `properties.group`.
- If `geometry.type` = Polygon/MultiPolygon, coordinates must follow GeoJSON winding rules.

Notes:
- Future enhancements (e.g., caching, auth) can be layered without changing the response schema.
</context>
