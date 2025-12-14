## 1) مفاهیم دیتا (برای فرانت)

### 1.1) Van Node (نقطه)

* یک نقطه روی نقشه با مختصات **UTM / SRID:32640**
* فیلدهای اصلی:

  * `id`
  * `floor` (عدد)
  * `node_type` یکی از: `stop | junction`
  * `geom = {x,y}`
  * `basic_info.title` و `basic_info.description` (چندزبانه)

**کاربرد:**

* `stop`: ایستگاه/نقطه توقف ون
* `junction`: نقطه اتصال/تغییر مسیر (بدون نمایش به‌عنوان ایستگاه، یا نمایش با سبک متفاوت)

---

### 1.2) Van Edge (یال/مسیر بین دو نقطه)

* یک خط بین `src` و `dst` (هر دو id نود)
* فیلدهای اصلی:

  * `id`
  * `src`, `dst`
  * `one_way` (true/false)
  * `is_open` (true/false)
  * `length_m` (متر)
  * `attrs` (JSON آزاد)
  * `geom_geojson` (برای نمایش روی نقشه)

**کاربرد:**

* اگر `one_way=true` یعنی مسیر فقط از `src -> dst` مجاز است.
* اگر `is_open=false` یعنی مسیر بسته است (فرانت می‌تواند خاکستری/خط‌چین نمایش دهد و در Route گرفتن لحاظ نشود).

---

## 2) Endpoint ها (Admin)

### 2.1) Nodes

* `GET   /api/v1/admin/van/nodes?language=fa&floor=0&node_type=stop&limit=50`
* `GET   /api/v1/admin/van/nodes/{id}?language=fa`
* `POST  /api/v1/admin/van/nodes`
* `PUT   /api/v1/admin/van/nodes/{id}`
* `DELETE /api/v1/admin/van/nodes/{id}`

### 2.2) Edges

* `GET   /api/v1/admin/van/edges?floor=0&is_open=1&src=101&dst=102&limit=50`
* `GET   /api/v1/admin/van/edges/{id}`
* `POST  /api/v1/admin/van/edges`
* `PUT   /api/v1/admin/van/edges/{id}`
* `DELETE /api/v1/admin/van/edges/{id}`

> نکته مهم برای UI: چون `edges` ستون `floor` ندارد، فیلتر floor در بک‌اند با join به nodes انجام می‌شود. پس فرانت فقط `floor` را می‌فرستد.

---

## 3) فرمت Request/Response استاندارد

### 3.1) لیست Nodes

**Request**

```http
GET /api/v1/admin/van/nodes?language=fa&floor=0&limit=50
```

**Response (paginate)**

```json
{
  "current_page": 1,
  "data": [
    {
      "id": 101,
      "floor": 0,
      "node_type": "stop",
      "x": 734700.12,
      "y": 4018800.55,
      "updated_at": "2025-12-14T09:10:00Z",
      "name": "ایستگاه ون ۱",
      "description": "کنار ورودی اصلی"
    }
  ],
  "per_page": 50,
  "total": 1,
  "next_page_url": null
}
```

**نکته UI:**

* برای نمایش سریع لیست، همین `name/description` کافی است.
* برای فرم ویرایش چندزبانه، باید `show` بزنید.

---

### 3.2) دریافت جزئیات Node (برای فرم ویرایش)

**Request**

```http
GET /api/v1/admin/van/nodes/101?language=fa
```

**Response**

```json
{
  "id": 101,
  "floor": 0,
  "node_type": "stop",
  "geom": { "x": 734700.12, "y": 4018800.55 },
  "basic_info": {
    "title": { "fa": "ایستگاه ون ۱", "en": "Van Stop 1", "ar": "", "ur": "" },
    "description": { "fa": "کنار ورودی اصلی", "en": "", "ar": "", "ur": "" }
  },
  "updated_at": "2025-12-14T09:10:00Z"
}
```

---

### 3.3) ایجاد Node

**Request**

```http
POST /api/v1/admin/van/nodes
Content-Type: application/json
```

```json
{
  "floor": 0,
  "node_type": "stop",
  "geom": { "x": 734700.12, "y": 4018800.55 },
  "basic_info": {
    "title": { "fa": "ایستگاه ون ۱", "en": "Van Stop 1", "ar": "", "ur": "" },
    "description": { "fa": "کنار ورودی اصلی", "en": "", "ar": "", "ur": "" }
  }
}
```

**Response**

```json
{ "id": 101 }
```

---

### 3.4) ویرایش Node (Partial Update)

فرانت می‌تواند فقط فیلدهای تغییرکرده را بفرستد.

**Request**

```http
PUT /api/v1/admin/van/nodes/101
```

```json
{
  "basic_info": {
    "title": { "fa": "ایستگاه ون شماره ۱" }
  }
}
```

**Response**

```json
{ "id": 101 }
```

---

### 3.5) حذف Node

**Request**

```http
DELETE /api/v1/admin/van/nodes/101
```

**Response**

```json
{ "ok": true }
```

> رفتار مهم: با حذف Node، بک‌اند اول edgeهای مرتبط (`src` یا `dst`) را حذف می‌کند، بعد خود node را.

---

## 4) کار با Edges

### 4.1) لیست Edges

**Request**

```http
GET /api/v1/admin/van/edges?floor=0&is_open=1&limit=50
```

**Response**

```json
{
  "current_page": 1,
  "data": [
    {
      "id": 9001,
      "src": 101,
      "dst": 102,
      "length_m": 65.42,
      "one_way": true,
      "is_open": true,
      "attrs": { "speed_kmh": 10, "notes": "مسیر سرویس" },
      "geom_geojson": {
        "type": "LineString",
        "coordinates": [
          [734700.12, 4018800.55],
          [734760.1, 4018850.2]
        ]
      }
    }
  ],
  "per_page": 50,
  "total": 1
}
```

**نکته نقشه:**

* `geom_geojson` آماده‌ی draw است (LineString).
* اگر خواستید استایل:

  * `is_open=false` => رنگ خاکستری/opacity کم/خط‌چین
  * `one_way=true` => فلش روی خط یا نماد جهت

---

### 4.2) ایجاد Edge (حالت ساده: بدون geom)

اگر `geom` نفرستید، بک‌اند خودش از مختصات `src/dst` خط می‌سازد و `length_m` را محاسبه می‌کند.

**Request**

```http
POST /api/v1/admin/van/edges
```

```json
{
  "src": 101,
  "dst": 102,
  "one_way": true,
  "is_open": true,
  "attrs": {
    "speed_kmh": 10,
    "notes": "مسیر سرویس"
  }
}
```

**Response**

```json
{ "id": 9001 }
```

---

### 4.3) ایجاد Edge (حالت دقیق: با geom دلخواه)

برای مواقعی که خط باید چندین نقطه داشته باشد (مسیر خمیده/واقعی).

```json
{
  "src": 101,
  "dst": 102,
  "one_way": true,
  "is_open": true,
  "attrs": { "notes": "مسیر دقیق" },
  "geom": {
    "type": "LineString",
    "srid": 32640,
    "coordinates": [
      [734700.12, 4018800.55],
      [734720.00, 4018820.10],
      [734740.50, 4018831.90],
      [734760.10, 4018850.20]
    ]
  }
}
```

---

### 4.4) ویرایش Edge (مثلاً بستن مسیر)

```http
PUT /api/v1/admin/van/edges/9001
```

```json
{
  "is_open": false,
  "attrs": { "notes": "موقتاً بسته" }
}
```

---

### 4.5) حذف Edge

```http
DELETE /api/v1/admin/van/edges/9001
```

---

## 5) سناریو کامل UI (گام به گام)

### سناریو A: ساخت شبکه ون از صفر

1. کاربر روی نقشه کلیک می‌کند → مختصات UTM را می‌گیریم → `POST node`
2. دو تا node که ساخته شد → کاربر «اتصال» می‌زند → `POST edge`
3. فرانت برای رندر:

   * `GET nodes` و marker بگذارد
   * `GET edges` و line رسم کند

### سناریو B: ویرایش چندزبانه یک ایستگاه

1. `GET /nodes/{id}` (تا title/description همه زبان‌ها را بگیرد)
2. کاربر فقط `fa` را تغییر می‌دهد
3. `PUT /nodes/{id}` فقط با همان بخش

### سناریو C: خاموش/روشن کردن مسیرها

* برای هر edge یک toggle:

  * روشن: `PUT {is_open:true}`
  * خاموش: `PUT {is_open:false}`
* روی نقشه مسیر بسته به‌صورت خاکستری نمایش داده شود.

---

## 6) خطاها و پیام‌های مورد انتظار (برای UX)

### 6.1) Validation Error (422)

مثلاً `node_type` نامعتبر:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "node_type": ["The selected node type is invalid."]
  }
}
```

### 6.2) Not Found (404)

```json
{ "message": "Not found" }
```

### 6.3) Foreign Key (در Edge)

اگر `src/dst` وجود نداشته باشد، 422 می‌گیرید چون `exists:van_nodes,id` داریم.

---

## 7) نکات مهم برای فرانت (که معمولاً دردسر می‌شود)

1. **مختصات‌ها UTM هستند (32640)**
   اگر MapLibre شما روی 4326 است، تبدیل لازم دارید. (یا بک‌اند برای فرانت 4326 بدهد. فعلاً در این API، x/y همان 32640 است.)

2. **لیست nodes فقط name/description تک‌زبانه می‌دهد**
   برای ویرایش چندزبانه، همیشه `show` را بزنید.

3. **Edge geom دلخواه اختیاری است**
   برای MVP بدون geom هم جواب می‌دهد (اتصال مستقیم بین دو node).

