import json
import math
import re
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError(f"Unexpected redirect for {req.selector}")


base = "http://94.101.176.78"
opener = urllib.request.build_opener(NoRedirect)


def fetch(path, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        base + path, data=body, headers={"Content-Type": "application/json"}
    )
    with opener.open(request, timeout=20) as response:
        assert response.status == 200, (path, response.status)
        return response.read()


def route(origin, destination, gender="male"):
    result = json.loads(fetch("/api/v1/routing/route", {
        "mode": "walk", "gender": gender, "lang": "fa", "maxAlternatives": 0,
        "origin": origin, "destination": destination,
    }))
    assert result["status"] == "OK" and result["steps"], result.get("status")
    return {"geometry": result["geo"]["geometry"], "steps": result["steps"]}


def point(floor, lon, lat):
    return {"type": "coordinate", "floor": floor, "lon": lon, "lat": lat}


def one_sided_routes():
    area_id = 1001506
    data = json.loads(fetch(f"/api/v1/area-doors?area_id={area_id}&floor=0&mode=walk&gender=both"))
    doors = {int(door["accessId"]): door for door in data["data"]["doors"]}
    endpoints = []
    for access_id in (2200370, 2200259):
        door = doors[access_id]
        assert door["routingStatus"] == "available"
        lon, lat = door["coord4326"]
        endpoints.append({**point(0, lon, lat), "type": "door", "accessId": access_id, "areaId": area_id})

    routes = []
    for start, end in (endpoints, endpoints[::-1]):
        result = route(start, end, gender="both")
        coordinates = result["geometry"]["coordinates"]
        for endpoint, (lon, lat) in ((start, coordinates[0]), (end, coordinates[-1])):
            assert math.isclose(endpoint["lon"], lon, rel_tol=0, abs_tol=1e-7)
            assert math.isclose(endpoint["lat"], lat, rel_tol=0, abs_tol=1e-7)
        routes.append(result)
    return routes


floors = json.loads(fetch("/api/v1/floors"))
assert {-1, 0} <= {record["floor"] for record in floors}
basement = fetch("/tiles/public.fn_public_engineering_map_mvt/16/43620/25670.pbf?p_floor=-1&p_lang=fa")
ground = fetch("/tms/services/gsm/tiles/16/43620/25670.jpg")
assert basement and ground
origin = point(0, 59.612625308, 36.288858535)
destination = point(0, 59.61256273, 36.289251892)
basement_origin = point(-1, 59.612444574, 36.287082318)
ground_destination = point(0, 59.612771094, 36.287290984)
multifloor = route(basement_origin, ground_destination)
assert any(step.get("type") == "stepChangeFloor" for step in multifloor["steps"])
query = urllib.parse.urlencode({"language": "fa", "search": "چایخانه"})
places = json.loads(fetch("/api/v1/landmark-places?" + query))["places"]["landmarkPlaces"]
thumbnail = next(place["thumbnail"] for place in places if str(place["id"]) == "942")
assert re.fullmatch(r"/storage/uploads/card-thumbnails-v1/[0-9a-f]{64}\.webp", thumbnail)
image = fetch(thumbnail)
assert image[:4] == b"RIFF" and image[8:12] == b"WEBP"
print(json.dumps({
    "floors": floors,
    "sameFloorRoute": route(origin, destination),
    "multifloorRoute": multifloor,
    "oneSidedRoutes": one_sided_routes(),
    "landmarkThumbnail": thumbnail,
}, sort_keys=True))
