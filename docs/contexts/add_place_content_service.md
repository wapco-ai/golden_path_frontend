
## 0. کلیات

* **Base URL (dev):**
  `http://localhost:8080/api/v1`
* تمام مسیرها زیر این prefix تعریف شده‌اند.
* هدرهای معمول:

  * `Content-Type: application/json`
  * در صورت نیاز: `Authorization: Bearer <token>`

### سیستم مختصات و طبقات

* ورودی‌های `x`, `y` برای کلیک روی نقشه:

  * نوع: number
  * سیستم مختصات: **UTM / EPSG:32640** (متر)
* `floor`:

  * نوع: integer (مثلاً `-1`, `0`, `1`, …)

فرانت اگر روی WGS84 یا WebMercator کار می‌کند، باید قبل از فراخوانی سرویس، مختصات را به UTM 32640 تبدیل کند.

---

## 1. ایجاد درب جدید از روی کلیک (Create)

### Endpoint

* **POST** `/api/v1/doors`

### Request JSON

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

**فیلدها:**

| فیلد           | نوع      | اجباری | توضیح                                                         |
| -------------- | -------- | ------ | ------------------------------------------------------------- |
| x              | number   | ✔️     | مختصات X در UTM 32640                                         |
| y              | number   | ✔️     | مختصات Y در UTM 32640                                         |
| floor          | integer  | ✔️     | طبقه                                                          |
| allowed_gender | string   | ⭕      | enum دیتابیس (مثلاً `male`, `female`, `both`). پیش‌فرض `both` |
| is_open        | boolean  | ⭕      | وضعیت درب. پیش‌فرض `true`                                     |
| modes          | string[] | ⭕      | حالت‌های حرکت (`walk`, `wheelchair` و …). پیش‌فرض هر دو       |
| bidirectional  | boolean  | ⭕      | یک‌طرفه/دوطرفه. پیش‌فرض `true`                                |

### Response (موفق)

```json
{
  "door": {
    "id": 2001,
    "from_area": 2451,
    "to_area": 2539
  },
  "door_access_point": {
    "id": 18099,
    "floor": 0
  }
}
```

> درب به‌صورت segment حدوداً ۲ متری روی نزدیک‌ترین مرز محدوده‌ی همان طبقه ساخته می‌شود و یک نقطه‌ی دسترسی در وسط آن ایجاد می‌گردد.

---

## 2. خواندن اطلاعات خام درب (Show – برای نیازهای سیستمی)

### Endpoint

* **GET** `/api/v1/doors/{id}`

### Response (موفق)

```json
{
  "door": {
    "id": 2001,
    "geom": "...",              // هندسه خام از PG (WKB یا مشابه)
    "from_area": 2451,
    "to_area": 2539,
    "floor": 0,
    "allowed_gender": "both",
    "is_open": true,
    "modes": ["walk", "wheelchair"],
    "bidirectional": true,
    "attrs": { ... },
    "created_at": "...",
    "updated_at": "..."
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

> این سرویس بیشتر برای استفاده‌ی داخلی/ادمین است. برای مودال توصیفی، از `/info` استفاده شود.

---

## 3. آپدیت ساده‌ی تنظیمات درب (Update بدون جابجایی هندسی)

### Endpoint

* **PUT** `/api/v1/doors/{id}`

### Request JSON (همه اختیاری)

```json
{
  "allowed_gender": "male",
  "is_open": false,
  "modes": ["walk"],
  "bidirectional": false
}
```

فیلدی که ارسال شود، همان در دیتابیس آپدیت می‌شود.

### Response (موفق)

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

## 4. جابجایی درب موجود با کلیک جدید (Move)

### Endpoint

* **PUT** `/api/v1/doors/{id}/move`

### Request JSON

```json
{
  "x": 734602.32,
  "y": 4018915.53,
  "floor": 0
}
```

* `x`, `y`: نقطه‌ی جدید روی/نزدیک مرز
* `floor`: اختیاری؛ اگر نیاید، از `doors.floor` استفاده می‌شود.

### رفتار

* نزدیک‌ترین محدوده در آن طبقه پیدا می‌شود.
* روی مرز آن محدوده یک segment ~۲ متری ساخته می‌شود.
* `geom`, `from_area`, `to_area`, `floor` در جدول `doors` آپدیت می‌شود.
* تمام `door_access_points` قبلی حذف و یک نقطه‌ی جدید در وسط درب ساخته می‌شود.

### Response (موفق)

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

---

## 5. حذف درب (Delete)

### Endpoint

* **DELETE** `/api/v1/doors/{id}`

### رفتار

* همه‌ی `door_access_points` مربوط به این درب حذف می‌شوند.
* سپس خود رکورد `doors` حذف می‌شود.

### Response (موفق)

```json
{
  "status": "ok",
  "message": "Door and related access points deleted",
  "id": 2001
}
```

---

## 6. سرویس مودال اطلاعات توصیفی درب (`/info`)

این دو سرویس مخصوص فرم/مودال مدیریت توصیفی و عملیاتی درب هستند.
هدف: فرانت فقط با یک JSON کار کند و درگیر جداول دیتابیس نشود.

### 6.1. خواندن اطلاعات برای پرکردن مودال

* **GET** `/api/v1/doors/{id}/info`

### Response (موفق)

```json
{
  "basic_info": {
    "title": {
      "fa": "درب شماره ۱۰",
      "en": "Gate 10"
    },
    "description": "درب ورودی ویژه زائران ویلچری"
  },
  "operational": {
    "status": "active",                      // یا "inactive"
    "transport_modes": ["walk", "wheelchair"],
    "gender_access": ["male", "female", "family"]
  },
  "time_restrictions": [
    {
      "date_scope": ["this_month"],
      "gender": ["female", "family"],
      "time_ranges": [
        { "start": "08:00", "end": "10:00" }
      ],
      "all_hours": false
    }
  ],
  "prayer_restrictions": [
    {
      "events": ["dhuhr"],
      "before_minutes": 15,
      "after_minutes": 20,
      "date": null
    }
  ]
}
```

**نگاشت سمت بک‌اند (برای اطلاع):**

* `basic_info.title[lang]` ← جدول `i18n_texts` (field = `name`, entity_table=`doors`)
* `basic_info.description` ← `i18n_texts` (field=`about_short`, lang=`fa` فعلاً)
* `operational.status` ← `doors.is_open` + `attrs.operational.status`
* `operational.transport_modes` ← `doors.modes` (text[])
* `operational.gender_access` ← `attrs.operational.gender_access` (لیست)
* `time_restrictions` و `prayer_restrictions` ← جدول `door_schedules` (rule_type = `time_restriction` یا `prayer` + جزئیات در `note` به صورت JSON)

### 6.2. ذخیره / آپدیت اطلاعات مودال

* **PUT** `/api/v1/doors/{id}/info`

### Request JSON

همان ساختار بالا؛ مثل نمونه:

```json
{
  "basic_info": {
    "title": {
      "fa": "درب شماره ۱۰",
      "en": "Gate 10"
    },
    "description": "درب ورودی ویژه زائران ویلچری"
  },
  "operational": {
    "status": "active",
    "transport_modes": ["walk", "wheelchair"],
    "gender_access": ["male", "female", "family"]
  },
  "time_restrictions": [
    {
      "date_scope": ["this_month"],
      "gender": ["female", "family"],
      "time_ranges": [
        { "start": "08:00", "end": "10:00" },
        { "start": "18:00", "end": "21:00" }
      ],
      "all_hours": false
    }
  ],
  "prayer_restrictions": [
    {
      "events": ["dhuhr", "maghrib"],
      "before_minutes": 15,
      "after_minutes": 20,
      "date": null
    }
  ]
}
```

### رفتار بک‌اند (خلاصه)

* **basic_info**:

  * برای هر زبان در `title` → `i18n_texts (name)` به‌روزرسانی می‌شود.
  * `description` → در `i18n_texts (about_short, lang='fa')` ذخیره می‌شود.

* **operational**:

  * `status`:

    * اگر `active` → `doors.is_open = true`
    * اگر `inactive` → `doors.is_open = false`
  * `transport_modes` → `doors.modes` (text[])
  * `gender_access`:

    * در `doors.attrs.operational.gender_access` ذخیره می‌شود.
    * اگر فقط **یک** مقدار باشد، همان روی `doors.allowed_gender` هم ست می‌شود.

* **time_restrictions** و **prayer_restrictions**:

  * تمام رکوردهای قبلی `door_schedules` با `rule_type` های `time_restriction` و `prayer` برای این `door_id` حذف می‌شوند.
  * از روی آرایه‌های `time_restrictions` و `prayer_restrictions` رکوردهای جدید در `door_schedules` ساخته می‌شوند؛ جزئیات (date_scope, gender, …) به صورت JSON در فیلد `note` ذخیره می‌شوند.

### Response (موفق)

```json
{
  "status": "ok"
}
```

---

## 7. سناریوهای متداول برای فرانت

### 7.1. اضافه کردن درب جدید

1. کاربر ابزار «افزودن درب» را فعال می‌کند.
2. روی نقشه کلیک می‌کند → تبدیل مختصات به UTM 32640.
3. فراخوانی:

```http
POST /api/v1/doors
```

با بدنه:

```json
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

4. از `door.id` در پاسخ برای باز کردن مودال اطلاعات و نمایش درب روی نقشه استفاده می‌شود.

### 7.2. پرکردن فرم مودال برای یک درب

1. وقتی روی یک درب کلیک می‌شود و مودال باز می‌شود:

```http
GET /api/v1/doors/{id}/info
```

2. فرم را با JSON برگشتی پر کنید.

3. هنگام ذخیره:

```http
PUT /api/v1/doors/{id}/info
```

با همان ساختار JSON (با تغییرات کاربر).

### 7.3. جابجایی درب

1. کاربر درب را انتخاب می‌کند.
2. ابزار «جابجایی درب» را فعال می‌کند.
3. روی نقشه کلیک جدید → تبدیل به UTM.
4. فراخوانی:

```http
PUT /api/v1/doors/{id}/move
```

با بدنه:

```json
{
  "x": <utmX_new>,
  "y": <utmY_new>,
  "floor": <floor>
}
```

5. در صورت نیاز، لایه‌ی درب‌ها/نقاط دسترسی را رفرش کنید.

### 7.4. حذف درب

```http
DELETE /api/v1/doors/{id}
```

در موفقیت، فیچر مربوطه را از روی نقشه حذف کنید.
