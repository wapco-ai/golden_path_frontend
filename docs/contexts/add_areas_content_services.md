
# کانتکست کامل سرویس CRUD محدوده‌ها (`areas`)

## 1. خلاصه

این سرویس برای مدیریت محدوده‌ها (صحن، رواق، ایوان، سالن‌ها و...) در پنل ادمین استفاده می‌شود.
از نظر ساختار ورودی، **تقریباً ۱:۱ شبیه سرویس CRUD درب‌هاست** و فقط یک تفاوت اصلی دارد:

* در محدوده‌ها، مفهومی مثل «باز/بسته بودن لحظه‌ای در» نداریم، ولی:

  * در جدول فیزیکی `areas` فیلدهای: `area_type`, `floor`, `allowed_gender`, `is_closed`, `weight_open_space`, `geom`, `attrs` وجود دارد.
  * در بخش `operational` یک فیلد اضافه داریم: `is_covered` (مسقف/غیرمسقف).

---

## 2. آدرس‌ها (Endpoints)

همه‌ی سرویس‌ها زیر prefix ادمین هستند و نیاز به توکن ادمین دارند:

```text
GET    /api/v1/areas          لیست + فیلتر
GET    /api/v1/areas/{id}     جزییات
POST   /api/v1/areas          ایجاد
PUT    /api/v1/areas/{id}     ویرایش
DELETE /api/v1/areas/{id}     حذف
```

Header مشترک:

```http
Authorization: Bearer {admin_access_token}
Content-Type: application/json
Accept: application/json
```

---

## 3. مفهوم کلی دیتا در فرانت

### 3.1. شکل کلی بدنه برای POST/PUT

بدنه‌ای که فرانت باید بفرسته، این ساختار رو داره:

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
    "sub_group_id": "sahn_jadid",
    "sub_group_label": "صحن جدید" 
  },
  "operational": {
    "status": "active",                      // active, inactive, ...
    "transport_modes": ["walk","wheelchair"],
    "gender_access": ["male","female","family"],
    "is_covered": true,                      // مسقف است؟
    "description": "توضیح عملیاتی/داخلی"
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
      "before_minutes": 30,
      "after_minutes": 20,
      "date": "روز 2 فروردین 1403"
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

> **نکته:** ساختار بالا از نظر ایده، دقیقاً همون چیزیه که برای درب‌ها استفاده می‌کنید؛ فقط `is_covered` اضافه شده.

---

## 4. جزئیات هر Endpoint

### 4.1. لیست محدوده‌ها – `GET /api/v1/areas`

#### Query Params (همه اختیاری)

* `floor` (int) → فیلتر طبقه
* `area_type` (string) → فیلتر نوع محدوده (مثلاً `normal_area`, `courtyard`, ...)
* `allowed_gender` (string) → مقادیر enum جنسیت مجاز (مثلاً `male`, `female`, `both`, `family`)
* `is_closed` (0/1 یا true/false) → بسته بودن محدوده
* `is_covered` (0/1 یا true/false) → مسقف بودن (از داخل `attrs.operational.is_covered`)
* `status` (string) → مثلا `active`, `inactive` (از داخل `attrs.operational.status`)
* `bbox` (string) → جعبه‌ی مکانی در SRID=32640 به صورت `"minX,minY,maxX,maxY"`
* `search` (string) → جستجو روی عنوان (در زبان انتخاب‌شده)
* `language` (string) → یکی از `fa,en,ar,ur` (پیش‌فرض `fa`)
* `per_page` (int) → پیش‌فرض ۵۰

#### مثال درخواست:

```http
GET /api/v1/areas?floor=0&status=active&is_covered=1&language=fa&search=صحن
Authorization: Bearer {token}
```

#### ساختار پاسخ (Laravel pagination)

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
        "basic_info": {...},
        "grouping": {...},
        "operational": {...},
        "time_restrictions": [...],
        "prayer_restrictions": [...]
      },
      "updated_at": "2025-12-10T10:00:00Z",
      "geom_geojson": "{\"type\":\"Polygon\",\"coordinates\":[[...] ]}",
      "title": "صحن جامع رضوی"
    }
  ],
  "first_page_url": "...",
  "from": 1,
  "last_page": 3,
  "last_page_url": "...",
  "links": [...],
  "next_page_url": "...",
  "path": "...",
  "per_page": 50,
  "prev_page_url": null,
  "to": 50,
  "total": 123
}
```

> **نکته مهم برای فرانت:**
>
> * فیلد `geom_geojson` یک **رشته‌ی JSON** است. اگر لازم دارید روی نقشه استفاده کنید باید:
>
>   * در JS: `const geom = JSON.parse(item.geom_geojson);`

---

### 4.2. جزییات یک محدوده – `GET /api/v1/areas/{id}`

#### Query params

* `language` (اختیاری، پیش‌فرض `fa`)

#### مثال:

```http
GET /api/v1/areas/123?language=fa
Authorization: Bearer {token}
```

#### پاسخ نمونه:

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
    "time_restrictions": [...],
    "prayer_restrictions": [...]
  },
  "updated_at": "2025-12-10T10:00:00Z",
  "geom_geojson": "{\"type\":\"Polygon\",\"coordinates\":[[...]]}",
  "title": "صحن جامع رضوی",
  "description": "توضیحات فارسی..."
}
```

---

### 4.3. ایجاد محدوده – `POST /api/v1/areas`

#### بدنه (Body)

همان ساختار کلی بخش ۳.۱.
فیلدهای مهم از نظر اعتبارسنجی:

* `basic_info.title.fa` → **اجباری**
* `operational.status` → **اجباری**
* `operational.is_covered` → **اجباری (boolean)**
* `geometry` → **اجباری (GeoJSON)**
* `meta.area_type` → **اجباری**
* `meta.floor` → **اجباری**

بقیه‌ی موارد اختیاری هستند.

#### مثال درخواست:

```http
POST /api/v1/areas
Authorization: Bearer {token}
Content-Type: application/json

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
  "time_restrictions": [],
  "prayer_restrictions": [],
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

#### پاسخ موفق (۲۰۱ Created):

```json
{
  "id": 456,
  "area_type": "normal_area",
  "floor": 0,
  "allowed_gender": "both",
  "is_closed": false,
  "weight_open_space": 1.0,
  "attrs": {
    "basic_info": {...},
    "grouping": {...},
    "operational": {...},
    "time_restrictions": [],
    "prayer_restrictions": []
  },
  "updated_at": "2025-12-10T10:30:00Z",
  "geom_geojson": "{\"type\":\"Polygon\",\"coordinates\":[[...]]}"
}
```

---

### 4.4. ویرایش محدوده – `PUT /api/v1/areas/{id}`

* همه‌ی فیلدها **اختیاری** هستند؛ هر چیزی که فرستاده شود، آپدیت می‌شود، بقیه دست‌نخورده می‌ماند.
* `geometry` اگر ارسال شود، هندسه عوض می‌شود.
* `meta.*` اگر ارسال شود، به ترتیب فیلدهای جدول را آپدیت می‌کند.
* `basic_info`, `grouping`, `operational`, `time_restrictions`, `prayer_restrictions` روی `attrs` merge می‌شوند (جایگزین کل همان key، نه merge ریز به ریز).

#### مثال: تغییر فقط عنوان و مسقف بودن

```http
PUT /api/v1/areas/456
Authorization: Bearer {token}
Content-Type: application/json

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

پاسخ ساختار مشابه POST است (کل آبجکت area با فیلدهای جدید).

---

### 4.5. حذف محدوده – `DELETE /api/v1/areas/{id}`

#### مثال:

```http
DELETE /api/v1/areas/456
Authorization: Bearer {token}
```

#### پاسخ موفق:

```json
{
  "message": "Area deleted successfully"
}
```

اگر پیدا نشود:

```json
{
  "message": "Area not found"
}
```

---

## 5. مدیریت خطاها (برای فرانت)

### 5.1. خطای اعتبارسنجی (Validation Error – HTTP 422)

ساختار استاندارد Laravel:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "basic_info.title.fa": [
      "The basic_info.title.fa field is required."
    ],
    "operational.is_covered": [
      "The operational.is_covered field is required."
    ]
  }
}
```

**کار فرانت:**

* اگر status code = 422:

  * روی `errors` لوپ بزنید و پیام‌ها را در فرم نشان دهید.

### 5.2. خطای ۴۰۴

برای `show`, `update`, `delete` در صورت نبودن رکورد:

```json
{
  "message": "Area not found"
}
```

### 5.3. خطای احراز هویت (401/403)

طبق سیستم لاگین ادمین خودتان؛ معمولاً:

```json
{
  "message": "Unauthenticated."
}
```

---

## 6. نکات پیاده‌سازی در فرانت

1. **نقشه و هندسه**

   * از `geom_geojson` استفاده کنید.
   * در زمان ثبت/ویرایش:

     * از ابزار ترسیم Polygon/MultiPolygon روی map استفاده کنید.
     * GeoJSON خروجی را **همان‌طور** به فیلد `geometry` بفرستید.
   * دقت کنید که سیستم روی SRID=32640 کار می‌کند (مختصات متری، نه lat/lng).

2. **راست‌چین/چپ‌چین**

   * برای زبان `fa` و `ar`، UI را RTL کنید.
   * در فرم عنوان‌ها، چهار input برای `fa,en,ar,ur` در نظر بگیرید.

3. **فیلتر سمت لیست**

   * کامبو برای `floor`, `area_type`, `status`, `is_covered`.
   * سرچ با `search` (روی عنوان همان زبان انتخاب‌شده).
   * اگر نقشه دارید، می‌توانید BBOX را از view فعلی نقشه حساب کنید و به صورت `"minX,minY,maxX,maxY"` بفرستید.

4. **نمایش operational**

   * `status` را با رنگ (مثلاً سبز برای active، قرمز برای inactive) نشان دهید.
   * `is_covered` را با آیکون سقف/هوای آزاد نمایش دهید.
   * `gender_access` را با تگ/label (مثلاً "خانوادگی", "آقایان", "بانوان") نشان دهید.

5. **محدودیت‌های زمانی**

   * هنوز جدول مجزا ندارند؛ فقط در JSON ذخیره می‌شوند:

     * `attrs.time_restrictions`
     * `attrs.prayer_restrictions`
   * اگر لازم شد UI برای مدیریت‌شان بگذارید، می‌توانید فقط روی این آرایه‌ها کار کنید و همان‌ها را در POST/PUT بفرستید.

---