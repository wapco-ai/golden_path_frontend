# 1) Routes (routes/api.php)

```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Admin\TempBlockAreaController;

Route::prefix('v1/admin')->group(function () {

    // CRUD
    Route::get   ('/temp-block-areas',            [TempBlockAreaController::class, 'index']);
    Route::get   ('/temp-block-areas/active',     [TempBlockAreaController::class, 'active']);
    Route::get   ('/temp-block-areas/{id}',       [TempBlockAreaController::class, 'show']);
    Route::post  ('/temp-block-areas',            [TempBlockAreaController::class, 'store']);
    Route::put   ('/temp-block-areas/{id}',       [TempBlockAreaController::class, 'update']);
    Route::delete('/temp-block-areas/{id}',       [TempBlockAreaController::class, 'destroy']);

    // Useful ops for UI
    Route::patch ('/temp-block-areas/{id}/stop',  [TempBlockAreaController::class, 'stop']);    // valid_to=now()
    Route::patch ('/temp-block-areas/{id}/extend',[TempBlockAreaController::class, 'extend']);  // update valid_to
});
```

> بعداً هر وقت auth فعال شد فقط همینجا middleware اضافه کن.

---

# 2) Controller (app/Http/Controllers/Api/Admin/TempBlockAreaController.php)

```php
<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Requests\Admin\TempBlockAreaStoreRequest;
use App\Http\Requests\Admin\TempBlockAreaUpdateRequest;

class TempBlockAreaController extends Controller
{
    /**
     * GET /api/v1/admin/temp-block-areas
     *
     * Query:
     *  - floor: int
     *  - only_active: bool
     *  - from: ISO date-time (filter overlaps)
     *  - to:   ISO date-time (filter overlaps)
     *  - bbox: "minLng,minLat,maxLng,maxLat" in EPSG:4326 (optional)
     *  - limit: int (default 500)
     */
    public function index(Request $r)
    {
        $q = DB::table('temp_block_areas_live as t')
            ->selectRaw("
                t.id, t.floor, t.restrict_type, t.valid_from, t.valid_to,
                t.created_by, t.reason, t.created_at,
                ST_AsGeoJSON(ST_Transform(t.geom, 4326))::json as geom_geojson_4326
            ");

        if ($r->filled('floor')) {
            $q->where('t.floor', (int)$r->input('floor'));
        }

        if ($r->boolean('only_active')) {
            $q->whereRaw("t.valid_from <= now() AND (t.valid_to IS NULL OR t.valid_to >= now())");
        }

        // Overlap filter with [from,to]
        if ($r->filled('from')) {
            $from = $r->input('from');
            // anything whose valid_to is null or >= from
            $q->whereRaw("(t.valid_to IS NULL OR t.valid_to >= ?)", [$from]);
        }
        if ($r->filled('to')) {
            $to = $r->input('to');
            // anything whose valid_from <= to
            $q->whereRaw("t.valid_from <= ?", [$to]);
        }

        // bbox in 4326 -> transform to 32640 for intersect
        if ($r->filled('bbox')) {
            $parts = explode(',', $r->input('bbox'));
            if (count($parts) === 4) {
                [$minLng, $minLat, $maxLng, $maxLat] = array_map('floatval', $parts);
                $q->whereRaw("
                    ST_Intersects(
                        t.geom,
                        ST_Transform(ST_MakeEnvelope(?, ?, ?, ?, 4326), 32640)
                    )
                ", [$minLng, $minLat, $maxLng, $maxLat]);
            }
        }

        $limit = (int)($r->input('limit', 500));
        $limit = max(1, min($limit, 5000));

        $items = $q->orderByDesc('t.created_at')->limit($limit)->get();

        return response()->json([
            'items' => $items,
            'meta' => [
                'limit' => $limit,
                'count' => $items->count(),
            ],
        ]);
    }

    /**
     * GET /api/v1/admin/temp-block-areas/active
     * Reads from view v_temp_block_areas_active
     */
    public function active(Request $r)
    {
        $q = DB::table('v_temp_block_areas_active as v')
            ->selectRaw("
                v.id, v.floor, v.restrict_type, v.valid_from, v.valid_to,
                v.created_by, v.reason, v.created_at,
                ST_AsGeoJSON(ST_Transform(v.geom, 4326))::json as geom_geojson_4326
            ");

        if ($r->filled('floor')) {
            $q->where('v.floor', (int)$r->input('floor'));
        }

        $items = $q->orderByDesc('v.created_at')->get();

        return response()->json([
            'items' => $items,
            'meta' => [
                'count' => $items->count(),
            ],
        ]);
    }

    /**
     * GET /api/v1/admin/temp-block-areas/{id}
     */
    public function show($id)
    {
        $row = DB::table('temp_block_areas_live as t')
            ->selectRaw("
                t.id, t.floor, t.restrict_type, t.valid_from, t.valid_to,
                t.created_by, t.reason, t.created_at,
                ST_AsText(t.geom) as geom_wkt_32640,
                ST_AsGeoJSON(ST_Transform(t.geom, 4326))::json as geom_geojson_4326
            ")
            ->where('t.id', (int)$id)
            ->first();

        if (!$row) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json($row);
    }

    /**
     * POST /api/v1/admin/temp-block-areas
     */
    public function store(TempBlockAreaStoreRequest $req)
    {
        $data = $req->validated();

        $geom = $this->geomExprAndBind($data);

        // created_by: اگر بعدا auth آمد، از $req->user()->id بگیر
        $createdBy = $data['created_by'] ?? null;

        $row = DB::selectOne("
            INSERT INTO temp_block_areas_live
                (floor, geom, restrict_type, valid_from, valid_to, created_by, reason)
            VALUES
                (?, {$geom['expr']}, ?, COALESCE(?, now()), ?, ?, ?)
            RETURNING id
        ", array_merge(
            [(int)$data['floor']],
            $geom['bind'],
            [
                $data['restrict_type'] ?? 'close',
                $data['valid_from'] ?? null,
                $data['valid_to'] ?? null,
                $createdBy,
                $data['reason'] ?? null,
            ]
        ));

        return $this->show($row->id);
    }

    /**
     * PUT /api/v1/admin/temp-block-areas/{id}
     */
    public function update(TempBlockAreaUpdateRequest $req, $id)
    {
        $id = (int)$id;
        $data = $req->validated();

        // ensure exists
        $exists = DB::table('temp_block_areas_live')->where('id', $id)->exists();
        if (!$exists) return response()->json(['message' => 'Not found'], 404);

        $sets = [];
        $bind = [];

        foreach (['floor', 'restrict_type', 'valid_from', 'valid_to', 'reason'] as $k) {
            if (array_key_exists($k, $data)) {
                $sets[] = "{$k} = ?";
                $bind[] = $data[$k];
            }
        }

        $hasGeom = array_key_exists('geom_wkt_32640', $data) || array_key_exists('geom_geojson_4326', $data);
        if ($hasGeom) {
            $geom = $this->geomExprAndBind($data);
            $sets[] = "geom = {$geom['expr']}";
            $bind = array_merge($bind, $geom['bind']);
        }

        if (!$sets) {
            return response()->json(['message' => 'Nothing to update'], 422);
        }

        $bind[] = $id;

        DB::update("UPDATE temp_block_areas_live SET " . implode(', ', $sets) . " WHERE id = ?", $bind);

        return $this->show($id);
    }

    /**
     * PATCH /api/v1/admin/temp-block-areas/{id}/stop
     * Set valid_to = now() (soft stop)
     */
    public function stop($id)
    {
        $id = (int)$id;
        $updated = DB::update("UPDATE temp_block_areas_live SET valid_to = now() WHERE id = ?", [$id]);

        if ($updated === 0) return response()->json(['message' => 'Not found'], 404);

        return $this->show($id);
    }

    /**
     * PATCH /api/v1/admin/temp-block-areas/{id}/extend
     * Body: { "valid_to": "..." } or { "valid_to": null } (open-ended)
     */
    public function extend(Request $r, $id)
    {
        $id = (int)$id;

        $data = $r->validate([
            'valid_to' => ['nullable', 'date'],
        ]);

        $updated = DB::update("UPDATE temp_block_areas_live SET valid_to = ? WHERE id = ?", [
            $data['valid_to'] ?? null,
            $id,
        ]);

        if ($updated === 0) return response()->json(['message' => 'Not found'], 404);

        return $this->show($id);
    }

    /**
     * DELETE /api/v1/admin/temp-block-areas/{id}
     */
    public function destroy($id)
    {
        $id = (int)$id;
        $deleted = DB::delete("DELETE FROM temp_block_areas_live WHERE id = ?", [$id]);

        if ($deleted === 0) return response()->json(['message' => 'Not found'], 404);

        return response()->json(['ok' => true]);
    }

    /**
     * Build geometry expression and binds.
     * Supports:
     *  - geom_wkt_32640: WKT (Polygon/MultiPolygon) in 32640
     *  - geom_geojson_4326: GeoJSON in 4326, auto transformed to 32640
     */
    private function geomExprAndBind(array $data): array
    {
        if (isset($data['geom_wkt_32640'])) {
            return [
                'expr' => "ST_Multi(ST_GeomFromText(?, 32640))::geometry(MultiPolygon,32640)",
                'bind' => [$data['geom_wkt_32640']],
            ];
        }

        // GeoJSON
        $geojson = json_encode($data['geom_geojson_4326'], JSON_UNESCAPED_UNICODE);

        return [
            'expr' => "ST_Multi(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(?), 4326), 32640))::geometry(MultiPolygon,32640)",
            'bind' => [$geojson],
        ];
    }
}
```

---

# 3) FormRequest ها

## 3.1) StoreRequest (app/Http/Requests/Admin/TempBlockAreaStoreRequest.php)

```php
<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class TempBlockAreaStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        // فعلا auth ندارید => true
        return true;
    }

    public function rules(): array
    {
        return [
            'floor' => ['required', 'integer'],

            // در DB text است ولی در API محدودش می‌کنیم
            'restrict_type' => ['sometimes', 'in:close,penalty'],

            'valid_from' => ['sometimes', 'date'],
            'valid_to'   => ['nullable', 'date'],

            'reason' => ['nullable', 'string', 'max:2000'],

            // geom: دقیقا یکی کافیست (custom validation در withValidator)
            'geom_wkt_32640'     => ['sometimes', 'string'],
            'geom_geojson_4326'  => ['sometimes', 'array'],

            // موقت/اختیاری تا auth بیاد
            'created_by' => ['sometimes', 'nullable', 'integer'],
        ];
    }

    public function withValidator($validator)
    {
        $validator->after(function ($v) {
            $data = $this->all();
            $hasWkt = array_key_exists('geom_wkt_32640', $data);
            $hasGeo = array_key_exists('geom_geojson_4326', $data);

            if (!$hasWkt && !$hasGeo) {
                $v->errors()->add('geom', 'Either geom_wkt_32640 or geom_geojson_4326 is required.');
            }

            if (isset($data['valid_from'], $data['valid_to']) && $data['valid_to'] !== null) {
                if (strtotime($data['valid_to']) < strtotime($data['valid_from'])) {
                    $v->errors()->add('valid_to', 'valid_to must be >= valid_from.');
                }
            }
        });
    }
}
```

## 3.2) UpdateRequest (app/Http/Requests/Admin/TempBlockAreaUpdateRequest.php)

```php
<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class TempBlockAreaUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'floor' => ['sometimes', 'integer'],
            'restrict_type' => ['sometimes', 'in:close,penalty'],

            'valid_from' => ['sometimes', 'date'],
            'valid_to'   => ['nullable', 'date'],

            'reason' => ['nullable', 'string', 'max:2000'],

            'geom_wkt_32640'     => ['sometimes', 'string'],
            'geom_geojson_4326'  => ['sometimes', 'array'],
        ];
    }

    public function withValidator($validator)
    {
        $validator->after(function ($v) {
            $data = $this->all();

            if (isset($data['valid_from'], $data['valid_to']) && $data['valid_to'] !== null) {
                if (strtotime($data['valid_to']) < strtotime($data['valid_from'])) {
                    $v->errors()->add('valid_to', 'valid_to must be >= valid_from.');
                }
            }
        });
    }
}
```

---

# 4) SQL ایندکس‌ها (برای سرعت مسیر‌یابی/نقشه)

این را داخل یک فایل مثل `database/sql/temp_block_areas_live_indexes.sql` بگذار و اجرا کن:

```sql
CREATE INDEX IF NOT EXISTS temp_block_areas_live_floor_idx
ON public.temp_block_areas_live (floor);

CREATE INDEX IF NOT EXISTS temp_block_areas_live_valid_idx
ON public.temp_block_areas_live (valid_from, valid_to);

CREATE INDEX IF NOT EXISTS temp_block_areas_live_geom_gix
ON public.temp_block_areas_live
USING GIST (geom);
```

---

# 5) نمونه‌های CURL (برای تست سریع)

## ایجاد با GeoJSON (4326)

```bash
curl -X POST "http://localhost:8080/api/v1/admin/temp-block-areas" \
  -H "Content-Type: application/json" \
  -d '{
    "floor": 0,
    "restrict_type": "close",
    "valid_from": "2025-12-14T09:00:00Z",
    "valid_to": "2025-12-14T14:00:00Z",
    "reason": "نظافت",
    "geom_geojson_4326": {
      "type": "Polygon",
      "coordinates": [[[59.6171,36.2881],[59.6172,36.2881],[59.6172,36.2882],[59.6171,36.2882],[59.6171,36.2881]]]
    }
  }'
```

## لیست اکتیوها

```bash
curl "http://localhost:8080/api/v1/admin/temp-block-areas/active?floor=0"
```

## stop

```bash
curl -X PATCH "http://localhost:8080/api/v1/admin/temp-block-areas/123/stop"
```

## extend

```bash
curl -X PATCH "http://localhost:8080/api/v1/admin/temp-block-areas/123/extend" \
  -H "Content-Type: application/json" \
  -d '{"valid_to":"2025-12-14T18:00:00Z"}'
```

---

# 6) کانتکست آماده برای فرانت (قرارداد نهایی)

### Entity: TempBlockArea

```ts
type TempBlockArea = {
  id: number;
  floor: number;
  restrict_type: "close" | "penalty";
  valid_from: string; // ISO
  valid_to: string | null; // ISO or null(open-ended)
  reason: string | null;
  created_by: number | null;
  created_at: string; // ISO
  geom_geojson_4326: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}
```

### Endpoints

* `GET /api/v1/admin/temp-block-areas?floor=0&only_active=true&bbox=minLng,minLat,maxLng,maxLat`
* `GET /api/v1/admin/temp-block-areas/active?floor=0`
* `GET /api/v1/admin/temp-block-areas/{id}`
* `POST /api/v1/admin/temp-block-areas`
* `PUT /api/v1/admin/temp-block-areas/{id}`
* `PATCH /api/v1/admin/temp-block-areas/{id}/stop`
* `PATCH /api/v1/admin/temp-block-areas/{id}/extend`
* `DELETE /api/v1/admin/temp-block-areas/{id}`

### نکته UI

* برای نمایش روی نقشه: همیشه از `geom_geojson_4326` خروجی استفاده کنید.
* برای refresh سریع روی نقشه: endpoint `/active` را هر چند ثانیه یک بار (یا با action کاربر) بزنید.