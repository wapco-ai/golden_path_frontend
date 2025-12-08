## 0. کلیات سرویس درب

این سرویس‌ها برای مدیریت درب‌ها در دو لایه‌ی دیتابیس استفاده می‌شوند:

* جدول **`doors`**: هندسه‌ی خطی درب (segment حدوداً ۲ متری روی مرز محدوده‌ها)
* جدول **`door_access_points`**: نقطه‌ی دسترسی روی وسط درب، برای ناوبری

منطق کلی:

1. **ایجاد درب (Create)**

   * کاربر روی نقشه کلیک می‌کند (نزدیک مرز یک محدوده).
   * بک‌اند:

     * نزدیک‌ترین محدوده‌ی روی همان طبقه را پیدا می‌کند.
     * نقطه کلیک را روی مرز اسنپ می‌کند.
     * روی مرز یک segment حدوداً ۲ متری می‌سازد (درب).
     * وسط درب را به‌عنوان door_access_point ذخیره می‌کند.
2. **نمایش/ویرایش ویژگی‌ها (Read / Update)**

   * گرفتن اطلاعات درب و access pointها
   * ویرایش فیلدهایی مثل جنسیت مجاز، باز/بسته بودن، حالت حرکت (walk/wheelchair)، یک‌طرفه/دوطرفه
3. **جابجایی درب (Move)**

   * کاربر دوباره روی نقشه کلیک می‌کند.
   * درب موجود روی مرز نزدیک اسنپ می‌شود، هندسه‌اش دوباره تولید و نقطه دسترسی هم به‌روز می‌شود.
4. **حذف (Delete)**

   * درب و تمام access pointهای مرتبط با آن پاک می‌شود.

---

## 1. مشخصات عمومی API

* **Base URL** (در محیط dev فعلی):
  `http://localhost:8080/api/v1`
* **Prefix مشترک**:
  تمام مسیرهای این سرویس با `/doors` شروع می‌شوند.
* **هدرها** (مثل سایر سرویس‌های پروژه):

  * `Content-Type: application/json`
  * هدرهای احراز هویت (مثلاً `Authorization: Bearer <token>`) اگر در بقیه‌ی APIها استفاده می‌کنید، اینجا هم لازم است.

### 1.1. سیستم مختصات و طبقات

**ورودی سرویس‌ها برای مختصات:**

* فیلدهای `x` و `y` روی تمام endpointهایی که کلیک می‌گیرند:

  * نوع: `number`
  * سیستم مختصات: **UTM / EPSG:32640** (متر)
* فیلد `floor`:

  * نوع: `integer` (مثلاً: `-1`, `0`, `1`, `2`)

> نکته مهم برای فرانت:
> الان فانکشن‌های DB فرض می‌کنند `x,y` در سیستم UTM 32640 هستند.
> اگر نقشه شما در WebMercator یا WGS84 است:
>
> * یا باید در فرانت تبدیل مختصات انجام شود و UTM 32640 ارسال شود،
> * یا (در آینده) با بک‌اند هماهنگ شود تا نسخه‌ای از سرویس با ورودی lat/lng (EPSG:4326) و تبدیل داخلی (`ST_Transform`) اضافه شود.

---

## 2. ایجاد درب جدید (Create)

### 2.1. Endpoint

* **Method:** `POST`
* **URL:** `/api/v1/doors`

### 2.2. Request Body

```json
{
  "x": 734600.12,
  "y": 4018800.34,
  "floor": 0,

  "allowed_gender": "both",
  "is_open": true,
  "modes": ["walk", "wheelchair"],
  "bidirectional": true
}
```

فیلدها:

| فیلد             | نوع      | اجباری | توضیح                                                                  |
| ---------------- | -------- | ------ | ---------------------------------------------------------------------- |
| `x`              | number   | ✔️     | مختصات X در UTM 32640                                                  |
| `y`              | number   | ✔️     | مختصات Y در UTM 32640                                                  |
| `floor`          | integer  | ✔️     | شماره طبقه                                                             |
| `allowed_gender` | string   | ⭕      | مقدار enum جنسیت (`male`, `female`, `both` و …). پیش‌فرض: `both`       |
| `is_open`        | boolean  | ⭕      | باز/بسته بودن درب. پیش‌فرض: `true`                                     |
| `modes`          | string[] | ⭕      | حالت‌های مجاز (`walk`, `wheelchair`). پیش‌فرض: `["walk","wheelchair"]` |
| `bidirectional`  | boolean  | ⭕      | دوطرفه بودن درب. پیش‌فرض: `true`                                       |

### 2.3. Response (موفق – 200)

```json
{
  "door": {
    "id": 2001,
    "geom_wkt": "LINESTRING(734599.15 4018799.50, 734601.15 4018801.50)",
    "from_area": 2451,
    "to_area": 2539
  },
  "door_access_point": {
    "id": 18099,
    "geom_wkt": "POINT(734600.15 4018800.50)",
    "floor": 0
  }
}
```

معانی:

* `door.id`: شناسه‌ی اولیه‌ی درب در جدول `doors`.
* `door.geom_wkt`: هندسه‌ی خطی درب به‌صورت WKT (برای نمایش در نقشه باید تبدیل شود).
* `from_area`, `to_area`: id محدوده‌هایی که درب بین آن‌ها قرار دارد (ممکن است `to_area` در برخی موارد `null` باشد اگر محدوده مقابل تشخیص داده نشود).
* `door_access_point.id`: شناسه‌ی نقطه دسترسی در جدول `door_access_points`.
* `door_access_point.geom_wkt`: نقطه‌ی وسط درب به‌صورت WKT.

> پیشنهاد برای فرانت:
> اگر WKT را مستقیم مصرف نمی‌کنید، در فرانت آن را با یک کتابخانه (مثلاً `wellknown` در JS) به GeoJSON تبدیل کنید و روی MapLibre نمایش دهید.

### 2.4. خطاهای رایج

* `422 Unprocessable Entity`

  * ولیدیشن بدنه‌ی درخواست (مثلاً نبودن `x` یا `y` یا `floor`).
* `500 Internal Server Error`

  * اگر:

    * محدوده‌ای نزدیک کلیک پیدا نشود.
    * مرز محدوده مشکل هندسی داشته باشد (خیلی نادر).

---

## 3. دریافت جزئیات درب (Show)

### 3.1. Endpoint

* **Method:** `GET`
* **URL:** `/api/v1/doors/{id}`

### 3.2. Response (موفق – 200)

```json
{
  "door": {
    "id": 2001,
    "geom": "...",
    "from_area": 2451,
    "to_area": 2539,
    "floor": 0,
    "allowed_gender": "both",
    "is_open": true,
    "modes": ["walk", "wheelchair"],
    "bidirectional": true,
    "attrs": {
      "source": "manual_click",
      "created_at": "2025-12-08T10:15:00Z"
    },
    "created_at": "2025-12-08T10:15:00Z",
    "updated_at": "2025-12-08T10:15:00Z"
  },
  "access_points": [
    {
      "id": 18099,
      "door_id": 2001,
      "geom": "...",
      "floor": 0,
      "from_area": 2451,
      "to_area": 2539
    }
  ]
}
```

> **هندسه‌ی `geom` و `geom` در access_points در حال حاضر به‌صورت خام از PG برمی‌گردد** (ممکن است به‌شکل WKB string یا مشابه). اگر نیاز به فرمت مشخص (مثل GeoJSON یا WKT) دارید، باید با بک‌اند هماهنگ کنید تا `ST_AsGeoJSON` یا `ST_AsText` در کوئری استفاده شود.

### 3.3. خطا

* `404 Not Found`
  اگر دربی با آن `id` وجود نداشته باشد.

---

## 4. ویرایش ویژگی‌های درب (Update – بدون جابجایی هندسی)

### 4.1. Endpoint

* **Method:** `PUT`
* **URL:** `/api/v1/doors/{id}`

### 4.2. Request Body

تمام فیلدها **اختیاری** هستند؛ هر کدام را بفرستید همان مقدار آپدیت می‌شود:

```json
{
  "allowed_gender": "male",
  "is_open": false,
  "modes": ["walk"],
  "bidirectional": false
}
```

### 4.3. Response (موفق – 200)

```json
{
  "door": {
    "id": 2001,
    "floor": 0,
    "from_area": 2451,
    "to_area": 2539,
    "allowed_gender": "male",
    "is_open": false,
    "modes": ["walk"],
    "bidirectional": false,
    "attrs": { ... },
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

## 5. جابجایی درب با کلیک جدید (Move)

### 5.1. Endpoint

* **Method:** `PUT` (یا در صورت نیاز `POST`)
* **URL:** `/api/v1/doors/{id}/move`

### 5.2. Request Body

```json
{
  "x": 734602.12,
  "y": 4018799.85,
  "floor": 0
}
```

* `x`, `y`: مختصات کلیک جدید روی نقشه (UTM 32640)
* `floor`: اختیاری؛ اگر فرستاده نشود، از `doors.floor` درب استفاده می‌شود.

### 5.3. رفتار سرویس

* نزدیک‌ترین محدوده روی همان طبقه را پیدا می‌کند.
* درب را روی مرز آن محدوده دوباره می‌سازد (segment حدود ۲ متری).
* `from_area`، `to_area`، و `floor` در `doors` را آپدیت می‌کند.
* همه‌ی `door_access_points` قدیمی آن درب را حذف می‌کند و یک نقطه‌ی جدید وسط درب می‌سازد.

### 5.4. Response (موفق – 200)

```json
{
  "door": {
    "id": 2001,
    "from_area": 2500,
    "to_area": 2600
  },
  "door_access_point": {
    "id": 18123
  }
}
```

> در صورت نیاز می‌توان در آینده در پاسخ این endpoint نیز هندسه‌ها را به‌صورت WKT/GeoJSON برگرداند تا فرانت بدون رفرش کل لایه بتواند feature را آپدیت کند.

---

## 6. حذف درب (Delete)

### 6.1. Endpoint

* **Method:** `DELETE`
* **URL:** `/api/v1/doors/{id}`

### 6.2. رفتار سرویس

* تمام `door_access_points` مربوط به `door_id` داده شده حذف می‌شود.
* سپس خود رکورد `doors` پاک می‌شود.

### 6.3. Response (موفق – 200)

```json
{
  "status": "ok",
  "message": "Door and related access points deleted",
  "id": 2001
}
```

---

## 7. سناریوهای استفاده در فرانت

### 7.1. اضافه کردن درب جدید از روی نقشه

1. کاربر ابزار «افزودن درب» را فعال می‌کند.

2. روی نقشه کلیک می‌کند (روی یا نزدیک مرز محدوده).

3. فرانت باید مختصات کلیک را به UTM 32640 تبدیل کند (یا در صورت اضافه‌شدن نسخه lat/lng، طبق قرارداد جدید).

4. ارسال درخواست:

   ```http
   POST /api/v1/doors
   Content-Type: application/json
   Authorization: Bearer <token>

   {
     "x": <utmX>,
     "y": <utmY>,
     "floor": <currentFloor>,
     "allowed_gender": "both",
     "is_open": true,
     "modes": ["walk", "wheelchair"],
     "bidirectional": true
   }
   ```

5. در پاسخ، `door` و `door_access_point` برمی‌گردند؛ فرانت می‌تواند:

   * روی لایه‌ی درب‌ها یک LineString جدید رسم کند.
   * روی لایه‌ی door_access_points یک نقطه‌ی جدید رسم کند.

---

### 7.2. جابجایی یک درب موجود

1. کاربر درب را روی نقشه انتخاب می‌کند (با استفاده از `door.id`).

2. ابزار «جابجایی درب» را فعال می‌کند.

3. کلیک جدید روی نقشه.

4. تبدیل مختصات به UTM 32640.

5. درخواست:

   ```http
   PUT /api/v1/doors/2001/move
   Content-Type: application/json

   {
     "x": <utmX>,
     "y": <utmY>,
     "floor": <floor>
   }
   ```

6. پاسخ شامل `door.id` و `door_access_point.id` جدید است؛ فرانت:

   * یا کل لایه‌ی درب‌ها را مجدد لود می‌کند،
   * یا اگر در آینده GeoJSON در پاسخ اضافه شود، همان فیچر را inline آپدیت می‌کند.

---

### 7.3. تغییر ویژگی‌های درب (بدون جابجایی)

* برای تغییر جنسیت مجاز، وضعیت باز/بسته بودن، و…:

```http
PUT /api/v1/doors/2001
Content-Type: application/json

{
  "is_open": false,
  "allowed_gender": "female",
  "modes": ["walk"]
}
```

---

### 7.4. حذف درب

```http
DELETE /api/v1/doors/2001
```

در صورت موفقیت، هم درب و هم access pointها حذف می‌شوند و فرانت باید فیچر مربوطه را از روی نقشه بردارد.