# کانتکست دقیق سرویس‌های CRUD محدوده‌ها (areas)

## 1. خلاصه

سرویس‌ها برای مدیریت محدوده‌ها (صحن، رواق، سالن، …) استفاده می‌شن.
محدودیت‌های زمانی و نماز:

* هم داخل فیلد `attrs` به شکل JSON ذخیره می‌شن (برای مصرف فرانت)
* هم بک‌اند به‌صورت خودکار اون‌ها رو روی جداول نرمال‌شده
  `access_time_restrictions` و `access_prayer_restrictions` سینک می‌کنه.
  👉 فرانت **فقط** با JSON کار داره، هیچ کاری با جداول جدید نداره.

در حال حاضر **اوتنتیکیشن فعاله نیست**؛ یعنی نیازی به `Authorization` تو هدرها ندارید.

---

## 2. آدرس‌ها (Endpoints)

(فرض می‌کنیم روی سرور مثلاً زیر `/api/v1` مپ شده، ولی خود Routeها اینن:)

```php
GET    /areas
GET    /areas/{id}
POST   /areas
PUT    /areas/{id}
DELETE /areas/{id}
```

هدرهای پایه:

```http
Content-Type: application/json
Accept: application/json
```

---

## 3. ساختار کلی شیء محدوده در فرانت

### 3.1. فرم کلی که فرانت می‌فرسته (POST و PUT)

بدنه درخواست این ساختار رو داره:

```json
{
  "basic_info": {
    "title": {
      "fa": "عنوان فارسی (اجباری)",
      "en": "English title (اختیاری)",
      "ar": "عنوان عربی (اختیاری)",
      "ur": "عنوان اردو (اختیاری)"
    },
    "description": "توضیح فارسی اختیاری"
  },
  "grouping": {
    "group_id": "sahn",
    "sub_group_id": "sahn_jame",
    "sub_group_label": "صحن جامع"
  },
  "operational": {
    "status": "active",                      // active, inactive, ...
    "transport_modes": ["walk","wheelchair"],
    "gender_access": ["male","female","family"],
    "is_covered": true,                      // مسقف است یا نه
    "description": "توضیحات عملیاتی/داخلی"
  },
  "time_restrictions": [
    {
      "date_scope": ["این ماه"],            // اختیاری (لیست برچسب‌ها)
      "gender": ["male","family"],          // اختیاری (لیست جنسیت‌ها)
      "time_ranges": [                      // می‌تونه چند بازه ساعتی داشته باشه
        { "start": "00:00", "end": "23:59" }
      ],
      "all_hours": true                     // اگر true باشد، کل روز همین محدودیت اعمال می‌شه
    }
  ],
  "prayer_restrictions": [
    {
      "events": ["نماز صبح","نماز مغرب و عشاء"],  // چند نماز
      "before_minutes": 25,                       // چند دقیقه قبل از نماز محدودیت شروع می‌شه
      "after_minutes": 26,                        // چند دقیقه بعد از نماز هم ادامه دارد
      "date": "روز 2 فروردین 1403"                // فعلاً فقط متن؛ بک‌اند در attrs نگه می‌داره
    }
  ],
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [640000, 4020000],
        [640050, 4020000],
        [640050, 4020050],
        [640000, 4020050],
        [640000, 4020000]
      ]
    ]
  },
  "meta": {
    "area_type": "normal_area",   // مقدار enum در DB
    "floor": 0,
    "allowed_gender": "both",     // gender_enum: male, female, both, family, ...
    "is_closed": false,
    "weight_open_space": 1.0
  }
}
```

> مختصات هندسه (`geometry`) در SRID 32640 (مختصات متری) هست؛ یعنی چیزی که از map server/leaflet با projection UTM می‌گیرید، نه lat/lng.

### 3.2. اعتبارسنجی مهم (POST)

الان در بک‌اند این‌ها چک می‌شن:

* `basic_info.title.fa` → **اجباری**
* `operational.status` → **اجباری**
* `operational.is_covered` → **اجباری (boolean)**
* `geometry` → **اجباری (GeoJSON)**
* `meta.area_type` → **اجباری**
* `meta.floor` → **اجباری**

بقیه فیلدها اختیاری‌اند.

---

## 4. Endpointها با مثال

### 4.1. لیست محدوده‌ها – `GET /areas`

#### پارامترهای Query (اختیاری)

* `floor` (int) → فیلتر بر اساس طبقه
* `area_type` (string) → نوع محدوده (مثلاً `normal_area`, `courtyard`, …)
* `allowed_gender` (string) → فیلتر جنسیت مجاز
* `is_closed` (0/1 یا true/false)
* `is_covered` (0/1 یا true/false) → از داخل `attrs.operational.is_covered`
* `status` (string) → از `attrs.operational.status` (مثلاً `active`)
* `bbox` (string) → جعبه مکانی `"minX,minY,maxX,maxY"`
* `search` (string) → جستجو روی عنوان (با توجه به زبان انتخاب‌شده)
* `language` (string) → یکی از `fa,en,ar,ur` (پیش‌فرض `fa`)
* `per_page` (int) → پیش‌فرض ۵۰

#### مثال درخواست

```http
GET /areas?floor=0&status=active&is_covered=1&language=fa&search=صحن
Accept: application/json
```

#### نمونه پاسخ (pagination لاراول)

```json
{
  "current_page": 1,
  "data": [
    {
      "id": 123,
      "area_type": "normal_area",
      "floor": 0,
      "allowed_gender": "both",
      "is_closed": false,
      "weight_open_space": 1,
      "attrs": {
        "basic_info": {
          "title": {
            "fa": "صحن جامع رضوی",
            "en": "Razavi Courtyard"
          },
          "description": "توضیحات فارسی..."
        },
        "grouping": {
          "group_id": "sahn",
          "sub_group_id": "sahn_jame",
          "sub_group_label": "صحن جامع"
        },
        "operational": {
          "status": "active",
          "transport_modes": ["walk","wheelchair"],
          "gender_access": ["family"],
          "is_covered": false,
          "description": "..."
        },
        "time_restrictions": [
          {
            "date_scope": ["این ماه"],
            "gender": ["male"],
            "time_ranges": [
              { "start": "00:00", "end": "23:59" }
            ],
            "all_hours": true
          }
        ],
        "prayer_restrictions": [
          {
            "events": ["نماز صبح"],
            "before_minutes": 25,
            "after_minutes": 26,
            "date": "روز 2 فروردین 1403"
          }
        ]
      },
      "updated_at": "2025-12-10T10:00:00Z",
      "geom_geojson": "{\"type\":\"Polygon\",\"coordinates\":[[...]]}",
      "title": "صحن جامع رضوی"
    }
  ],
  "first_page_url": "...",
  "from": 1,
  "last_page": 3,
  "last_page_url": "...",
  "links": [...],
  "next_page_url": "...",
  "path": "/areas",
  "per_page": 50,
  "prev_page_url": null,
  "to": 50,
  "total": 123
}
```

> برای استفاده روی نقشه، `geom_geojson` رو باید در فرانت `JSON.parse` کنید.

---

### 4.2. جزییات محدوده – `GET /areas/{id}`

#### Query params

* `language` (اختیاری، پیش‌فرض `fa`)

#### مثال:

```http
GET /areas/123?language=fa
Accept: application/json
```

#### نمونه پاسخ:

```json
{
  "id": 123,
  "area_type": "normal_area",
  "floor": 0,
  "allowed_gender": "both",
  "is_closed": false,
  "weight_open_space": 1.0,
  "attrs": {
    "basic_info": {
      "title": {
        "fa": "صحن جامع رضوی",
        "en": "Razavi Courtyard",
        "ar": "صحن الرضوي",
        "ur": "رضوی صحن"
      },
      "description": "توضیحات فارسی..."
    },
    "grouping": {
      "group_id": "sahn",
      "sub_group_id": "sahn_jame",
      "sub_group_label": "صحن جامع"
    },
    "operational": {
      "status": "active",
      "transport_modes": ["walk","wheelchair"],
      "gender_access": ["family"],
      "is_covered": false,
      "description": "..."
    },
    "time_restrictions": [
      {
        "date_scope": ["این ماه"],
        "gender": ["male"],
        "time_ranges": [
          { "start": "00:00", "end": "23:59" }
        ],
        "all_hours": true
      }
    ],
    "prayer_restrictions": [
      {
        "events": ["نماز صبح","نماز مغرب و عشاء"],
        "before_minutes": 25,
        "after_minutes": 26,
        "date": "روز 2 فروردین 1403"
      }
    ]
  },
  "updated_at": "2025-12-10T10:00:00Z",
  "geom_geojson": "{\"type\":\"Polygon\",\"coordinates\":[[...]]}",
  "title": "صحن جامع رضوی",
  "description": "توضیحات فارسی..."
}
```

---

### 4.3. ایجاد محدوده – `POST /areas`

#### مثال درخواست کامل

```http
POST /areas
Content-Type: application/json
Accept: application/json

{
  "basic_info": {
    "title": {
      "fa": "سالن غذاخوری زائرین",
      "en": "Pilgrims Dining Hall"
    },
    "description": "سالن غذاخوری در طبقه همکف..."
  },
  "grouping": {
    "group_id": "khadamat",
    "sub_group_id": "restaurant",
    "sub_group_label": "رستوران/غذاخوری"
  },
  "operational": {
    "status": "active",
    "transport_modes": ["walk","wheelchair"],
    "gender_access": ["family"],
    "is_covered": true,
    "description": "ویژه سرو غذای نذری"
  },
  "time_restrictions": [
    {
      "date_scope": ["این ماه"],
      "gender": ["family"],
      "time_ranges": [
        { "start": "08:00", "end": "22:00" }
      ],
      "all_hours": false
    }
  ],
  "prayer_restrictions": [
    {
      "events": ["نماز ظهر و عصر"],
      "before_minutes": 30,
      "after_minutes": 30,
      "date": "ایام خاص"
    }
  ],
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [640100, 4020100],
        [640150, 4020100],
        [640150, 4020150],
        [640100, 4020150],
        [640100, 4020100]
      ]
    ]
  },
  "meta": {
    "area_type": "normal_area",
    "floor": 0,
    "allowed_gender": "both",
    "is_closed": false,
    "weight_open_space": 1.0
  }
}
```

#### رفتار بک‌اند در POST

* رکورد جدید در جدول `areas` ساخته می‌شود.
* کل ساختار بالا در `attrs` ذخیره می‌شود.
* عنوان‌ها به جدول `i18n_texts` سینک می‌شوند.
* `time_restrictions` به `access_time_restrictions` تبدیل و برای این `area` درج می‌شوند.
* `prayer_restrictions` به `access_prayer_restrictions` تبدیل و درج می‌شوند.

#### نمونه پاسخ (۲۰۱ Created)

```json
{
  "id": 456,
  "area_type": "normal_area",
  "floor": 0,
  "allowed_gender": "both",
  "is_closed": false,
  "weight_open_space": 1.0,
  "attrs": {
    "basic_info": { ... },
    "grouping": { ... },
    "operational": { ... },
    "time_restrictions": [ ... ],
    "prayer_restrictions": [ ... ]
  },
  "updated_at": "2025-12-10T10:30:00Z",
  "geom_geojson": "{\"type\":\"Polygon\",\"coordinates\":[[...]]}"
}
```

---

### 4.4. ویرایش محدوده – `PUT /areas/{id}`

* همه‌چیز **اختیاری** است؛ هر فیلدی بیاد، همون قسمت آپدیت می‌شه.
* اگر `time_restrictions` در body باشد:

  * `attrs.time_restrictions` جایگزین می‌شود.
  * تمام رکوردهای قبلی `access_time_restrictions` برای این `area` حذف و از روی JSON جدید ساخته می‌شوند.
* اگر `prayer_restrictions` در body باشد:

  * `attrs.prayer_restrictions` جایگزین می‌شود.
  * جدول `access_prayer_restrictions` برای این `area` کامل ری‌بیلد می‌شود.
* اگر این دو کلید اصلاً نباشند → محدودیت‌های قبلی دست‌نخورده می‌مانند.

#### مثال ۱ – تغییر فقط عنوان و مسقف بودن

```http
PUT /areas/456
Content-Type: application/json
Accept: application/json

{
  "basic_info": {
    "title": {
      "fa": "سالن غذاخوری زائرین (ویرایش شده)"
    }
  },
  "operational": {
    "is_covered": false
  }
}
```

در این حالت:

* `time_restrictions` و `prayer_restrictions` دست‌نخورده می‌مونن (چون نیومدن).
* فقط `basic_info` و `operational.is_covered` آپدیت می‌شن.

#### مثال ۲ – فقط تغییر محدودیت زمانی

```http
PUT /areas/456
Content-Type: application/json
Accept: application/json

{
  "time_restrictions": [
    {
      "date_scope": ["ایام خاص"],
      "gender": ["male","family"],
      "time_ranges": [
        { "start": "09:00", "end": "21:00" }
      ],
      "all_hours": false
    }
  ]
}
```

در این حالت:

* `attrs.time_restrictions` کامل جایگزین می‌شه.
* در جدول `access_time_restrictions`:

  * همه ردیف‌های قبلی این `area` حذف،
  * و فقط ردیف‌های متناظر با JSON جدید درج می‌شن.
* بقیه‌ی فیلدها (basic_info، geometry و …) دست‌نخورده می‌مونن.

---

### 4.5. حذف محدوده – `DELETE /areas/{id}`

#### مثال:

```http
DELETE /areas/456
Accept: application/json
```

#### رفتار:

* رکورد `areas` حذف می‌شه.
* متن‌های مرتبط در `i18n_texts` حذف می‌شن.
* تمام `access_time_restrictions` و `access_prayer_restrictions` مربوط به این `area` حذف می‌شن.

#### پاسخ موفق:

```json
{
  "message": "Area deleted successfully"
}
```

اگر پیدا نشه:

```json
{
  "message": "Area not found"
}
```

---

## 5. خطاهای مهم برای هندل سمت فرانت

### 5.1. اعتبارسنجی (HTTP 422)

مثال:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "basic_info.title.fa": [
      "The basic_info.title.fa field is required."
    ],
    "operational.is_covered": [
      "The operational.is_covered field is required."
    ],
    "geometry": [
      "The geometry field is required."
    ]
  }
}
```

* اگر status = 422 → پیام‌های `errors` را روی فرم نمایش دهید.

### 5.2. پیدا نشدن (404)

مثلاً در `GET /areas/9999` یا `PUT/DELETE /areas/9999`:

```json
{
  "message": "Area not found"
}
```

---

## 6. نکات عملی برای تیم فرانت

1. **State فرم**
   می‌تونید در فرم، یک آبجکت React/Vue دقیقاً مطابق همین ساختار داشته باشید (`basic_info`, `grouping`, `operational`, `time_restrictions`, `prayer_restrictions`, `geometry`, `meta`) و هنگام POST/PUT همون state رو مستقیم بفرستید.

2. **کار با هندسه (`geometry`)**

   * روی نقشه Polygon/MultiPolygon ترسیم کنید.
   * آبجکت GeoJSON تولید شده رو بدون تغییر در فیلد `geometry` بفرستید.
   * جواب سرور در `geom_geojson` میاد که باید `JSON.parse` بشه.

3. **محدودیت‌ها**

   * سمت فرانت فقط JSON می‌سازه/ویرایش می‌کنه (آرایه‌ها `time_restrictions`, `prayer_restrictions`).
   * بک‌اند خودش این JSON رو روی جداول نرمال‌شده sync می‌کنه؛ فرانت نیازی به چیز extra نداره.

4. **ویرایش**

   * اگر نمی‌خواید محدودیت‌ها عوض بشن، اصلاً `time_restrictions` و `prayer_restrictions` رو در PUT نفرستید.
   * اگر می‌خواید کامل عوض بشن، آرایه‌ی جدید رو بفرستید؛ بک‌اند قبلی‌ها رو پاک می‌کنه و از نو می‌سازه.
