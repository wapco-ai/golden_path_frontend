
# 🧭 سرویس مسیریابی GoldenPath – کانتکست برای Front-End

## 1. معماری کلی

* **Stack بک‌اند:** Laravel + PostgreSQL/PostGIS
* **فانکشن اصلی DB:** `fn_route(...)`
* **سرویس HTTP:**

  * Method: `POST`
  * URL: `/api/v1/routing/route`
* **کارکرد:**

  * گرفتن مبدأ و مقصد (به چند شکل مختلف: مختصات، POI، درب، Area، QRCode)
  * محاسبه مسیر روی NavMesh (شبکه سلول‌های داخل صحن/رواق/راهرو)
  * اعمال محدودیت‌ها (الان ساده؛ در فاز بعد: ویلچر، جنسیت، محدودیت ادمین…)
  * برگرداندن مسیر به صورت GeoJSON برای رسم روی نقشه

> **نکته مختصات:**
> داخل دیتابیس همه‌چیز در **EPSG:32640** است،
> ولی در API خروجی مسیر به **GeoJSON با lon/lat (WGS84 – EPSG:4326)** داده می‌شود تا مستقیماً بشود روی MapLibre استفاده کرد.

(اگر در کنترلر فعلی هنوز `ST_Transform` نگذاشتی، کافی است آن را به شکل `ST_AsGeoJSON(ST_Transform(geom, 4326))` اصلاح کنی.)

---

## 2. Endpoint اصلی

### URL و Method

```http
POST /api/v1/routing/route
Content-Type: application/json
Accept: application/json
```

---

## 3. ساختار Request

### 3.1. اسکیمای کلی

```jsonc
{
  "mode": "walk",        // "walk" | "wheelchair"
  "gender": "both",      // باید با enum دیتابیس بخواند: مثلا "male" | "female" | "both"

  "origin": {
    "type": "coordinate",  // "coordinate" | "poi" | "door" | "area" | "qrcode"
    "id": null,            // برای نوع poi/door/area
    "code": null,          // برای نوع qrcode
    "lat": 36.2861,        // برای نوع coordinate
    "lon": 59.6159
  },

  "destination": {
    "type": "coordinate",  // مشابه origin
    "id": null,
    "code": null,
    "lat": 36.2867,
    "lon": 59.6162
  }
}
```

### 3.2. توضیح فیلدها

#### سطح بالا

* `mode`

  * `"walk"` – مسیر پیاده
  * `"wheelchair"` – مسیر مناسب ویلچر (در فاز بعدی سخت‌تر فیلتر می‌شود)

* `gender`

  * باید مقدار معتبر `gender_enum` دیتابیس باشد
  * الان ما معمولاً از `"both"`  استفاده می‌کنیم (طبق DDL پروژه)

#### بخش origin / destination

هر کدام از این اشیاء شکل زیر را دارند:

```jsonc
{
  "type": "poi | door | area | coordinate | qrcode",
  "id":   123,        // فقط برای poi/door/area
  "code": "QR12345",  // فقط برای qrcode
  "lat":  36.2861,    // فقط برای coordinate
  "lon":  59.6159
}
```

**نوع‌ها:**

1. `type = "coordinate"`

   * از lat/lon استفاده می‌شود
   * `id` و `code` نادیده گرفته می‌شوند.
2. `type = "poi"`

   * از جدول `poi_points` → با `id` شناسه نقطه پیدا می‌شود.
   * `lat/lon` لازم نیست (می‌تواند null باشد).
3. `type = "door"`

   * از جدول `doors` → با `id` درب پیدا می‌شود؛ نقطه‌ی وسط درب به‌عنوان نقطه استفاده می‌شود.
4. `type = "area"`

   * از جدول `areas` → با `id` area پیدا می‌شود؛ `PointOnSurface` آن area استفاده می‌شود.
5. `type = "qrcode"`

   * از جدول `qrcodes` → با `code` پیدا می‌شود (وضعیت فعال بودن هم چک می‌شود).
   * معمولاً برای شروع مسیریابی از روی QR.

---

## 4. ساختار Response

### 4.1. موفق (HTTP 200)

```jsonc
{
  "ok": true,
  "mode": "walk",
  "gender": "both",
  "distance_m": 245.3,     // مجموع طول مسیر (متر)
  "duration_s": 210.0,     // مدت تقریبی (ثانیه)

  "segments": [
    {
      "seq": 1,
      "mode": "walk",
      "floor": 0,          // طبقه (الان فقط 0 و -1 استفاده می‌شود)
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [59.6159, 36.2861],
          [59.6160, 36.2864],
          [59.6162, 36.2867]
        ]
      },
      "distance_m": 245.3,
      "duration_s": 210.0,
      "meta": {
        "origin_tri_id": 1234,
        "dest_tri_id": 5678,
        "gender": "both",
        "mode": "walk"
      }
    }
  ]
}
```

توضیحات:

* `geometry`

  * **GeoJSON LineString**
  * مختصات بر حسب **lon/lat (WGS84 – EPSG:4326)** تا مستقیم روی MapLibre رسم شود.
* در نسخه فعلی، کل مسیر در یک segment (`seq = 1`) برگردانده می‌شود.

  * در فاز بعد اگر بخواهیم turn-by-turn داشته باشیم، این segment می‌تواند به چند بخش (بین درب‌ها، فضای باز، …) تقسیم شود.

### 4.2. نبودن مسیر (HTTP 404)

اگر مسیر پیدا نشود:

```json
{
  "ok": false,
  "message": "مسیر مناسب یافت نشد"
}
```

فرانت می‌تواند روی این حالت:

* پیام مناسب به کاربر نشان دهد؛
* مثلاً پیشنهاد بدهد مبدأ/مقصد را عوض کند.

### 4.3. خطای ولیدیشن (HTTP 422)

اگر ورودی JSON ناقص یا نامعتبر باشد (Laravel validation):

```jsonc
{
  "message": "The given data was invalid.",
  "errors": {
    "mode": [
      "The mode field is required."
    ],
    "origin.type": [
      "The origin.type field is required."
    ]
  }
}
```

---

## 5. نمونه Request برای سناریوهای مختلف

### 5.1. از coordinate به coordinate

```json
{
  "mode": "walk",
  "gender": "both",
  "origin": {
    "type": "coordinate",
    "id": null,
    "code": null,
    "lat": 36.2861,
    "lon": 59.6159
  },
  "destination": {
    "type": "coordinate",
    "id": null,
    "code": null,
    "lat": 36.2867,
    "lon": 59.6162
  }
}
```

### 5.2. از POI به درب

```json
{
  "mode": "walk",
  "gender": "both",
  "origin": {
    "type": "poi",
    "id": 1024,
    "code": null,
    "lat": null,
    "lon": null
  },
  "destination": {
    "type": "door",
    "id": 305,
    "code": null,
    "lat": null,
    "lon": null
  }
}
```

### 5.3. از QRCode به POI

```json
{
  "mode": "walk",
  "gender": "both",
  "origin": {
    "type": "qrcode",
    "id": null,
    "code": "QR_A_REYHAN_01",
    "lat": null,
    "lon": null
  },
  "destination": {
    "type": "poi",
    "id": 2205,
    "code": null,
    "lat": null,
    "lon": null
  }
}
```

---

## 6. نکات برای تیم Front-End

### 6.1. نحوه‌ی فراخوانی سرویس (example با fetch)

```js
async function fetchRoute() {
  const res = await fetch('/api/v1/routing/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'walk',
      gender: 'both',
      origin: {
        type: 'coordinate',
        id: null,
        code: null,
        lat: 36.2861,
        lon: 59.6159
      },
      destination: {
        type: 'coordinate',
        id: null,
        code: null,
        lat: 36.2867,
        lon: 59.6162
      }
    }),
  });

  const data = await res.json();

  if (!data.ok) {
    console.warn('no route', data.message);
    return;
  }

  // data.segments[0].geometry is a GeoJSON LineString
  const line = data.segments[0].geometry;
  // این را می‌توانید به عنوان یک لایه line روی MapLibre اضافه کنید
}
```

### 6.2. رسم روی MapLibre

* `geometry` در پاسخ، همان GeoJSON استاندارد است.
* کافی‌ست آن را در یک `source` از نوع `geojson` قرار دهید و یک `line-layer` بسازید.

Pseudo-code:

```js
map.addSource('route', {
  type: 'geojson',
  data: {
    type: 'Feature',
    geometry: data.segments[0].geometry,
    properties: {}
  }
});

map.addLayer({
  id: 'route-line',
  type: 'line',
  source: 'route',
  paint: {
    'line-width': 4,
    'line-color': '#ff0000'
  }
});
```

(رنگ و استایل بسته به UI خودتان.)

### 6.3. Re-route (بازمحاسبه مسیر)

برای re-route (مثلاً وقتی کاربر حرکت کرده):

* کافی‌ست دوباره همین endpoint را صدا بزنید،
* فقط origin را با مختصات جدید کاربر عوض کنید:

```jsonc
"origin": {
  "type": "coordinate",
  "lat": <currentUserLat>,
  "lon": <currentUserLon>
}
```