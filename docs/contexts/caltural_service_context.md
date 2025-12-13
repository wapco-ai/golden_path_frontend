## کانتکست اتصال فرانت به سرویس «اطلاعات فرهنگی»

### Base URL

همه درخواست‌ها از این مسیرها استفاده می‌کنند:

* `GET    /api/v1/cultural-items`
* `GET    /api/v1/cultural-items/{poiId}`
* `POST   /api/v1/cultural-items`
* `PUT    /api/v1/cultural-items/{poiId}`
* `DELETE /api/v1/cultural-items/{poiId}`

> نکته: کلید اصلی این سرویس **poiId** است (نه id جدول contents).

---

# 1) لیست جدول + جستجو + صفحه‌بندی

### Request

```http
GET /api/v1/cultural-items?page=1&pageSize=10&search=کتابخانه
```

### Response

```json
{
  "items": [
    {
      "poiId": 878,

      "title": "عنوان فارسی",
      "description": "توضیح فارسی",

      "titles": { "fa": "…", "en": "…", "ar": "…", "ur": "…" },
      "descriptions": { "fa": "…", "en": "…", "ar": "…", "ur": "…" },

      "primaryImage": "https://...",
      "media": [
        { "type": "image", "url": "https://..." }
      ],

      "addressInShrine": "…",

      "showUserFeedbacks": true,
      "showMediaGallery": true,
      "placeType": "farhangi",

      "location": { "x": 734900.1, "y": 4018800.5, "lat": 36.28, "lng": 59.61, "floor": 0 }
    }
  ],
  "totalItems": 125,
  "page": 1,
  "pageSize": 10
}
```

### نکات UI

* جدول از `title`, `addressInShrine`, `description` استفاده کند.
* برای نمایش روی نقشه، مختصات از `location.lat/lng` (یا x/y) خوانده شود.
* برای نمایش زبان دیگر (در UI)، از `titles[lang]` و `descriptions[lang]` استفاده کنید.

---

# 2) جزئیات یک آیتم (برای ویرایش/نمایش جزئیات)

### Request

```http
GET /api/v1/cultural-items/878
```

### Response

```json
{
  "poiId": 878,
  "titles": { "fa": "…", "en": "…", "ar": "…", "ur": "…" },
  "descriptions": { "fa": "…", "en": "…", "ar": "…", "ur": "…" },

  "media": {
    "fa": [ { "type": "image", "url": "https://..." } ],
    "en": [],
    "ar": [],
    "ur": []
  },

  "addressInShrine": "…",

  "showUserFeedbacks": true,
  "showMediaGallery": false,
  "placeType": "ziyarati",

  "location": { "x": null, "y": null, "lat": 36.28, "lng": 59.61, "floor": 0 },

  "time_restrictions": [
    {
      "date_scope": ["ALL_DAYS"],
      "gender": ["family"],
      "time_ranges": [{ "start": "00:00", "end": "23:59" }],
      "all_hours": true
    }
  ],
  "prayer_restrictions": [
    {
      "events": ["fajr", "dhuhr_asr"],
      "before_minutes": 25,
      "after_minutes": 25,
      "date": null,
      "gender": ["family"]
    }
  ]
}
```

### نکات UI

* `media` در جزئیات **به تفکیک زبان** است.
* محدودیت‌ها در خروجی، از `access_time_restrictions` و `access_prayer_restrictions` خوانده شده‌اند و مستقیماً قابل نمایش/ویرایش هستند.

---

# 3) ایجاد آیتم فرهنگی (ذخیره کامل)

### Request

```http
POST /api/v1/cultural-items
Content-Type: application/json
```

### Body (نمونه کامل)

```json
{
  "poi_id": 878,

  "translations": {
    "fa": {
      "title": "عنوان فارسی",
      "body": "متن فارسی",
      "media": [
        { "type": "image", "url": "https://.../fa1.jpg", "mime": "image/jpeg" }
      ]
    },
    "en": { "title": "English title", "body": "English body", "media": [] },
    "ar": { "title": "…", "body": "…", "media": [] },
    "ur": { "title": "…", "body": "…", "media": [] }
  },

  "settings": {
    "showUserFeedbacks": true,
    "showMediaGallery": false,
    "placeType": "farhangi"
  },

  "time_restrictions": [
    {
      "date_scope": ["ALL_DAYS"],
      "gender": ["family"],
      "time_ranges": [{ "start": "00:00", "end": "23:59" }],
      "all_hours": true
    }
  ],

  "prayer_restrictions": [
    {
      "events": ["fajr", "dhuhr_asr", "maghrib_isha"],
      "before_minutes": 25,
      "after_minutes": 25,
      "date": null,
      "gender": ["family"]
    }
  ]
}
```

### Response

همان خروجی `GET /api/v1/cultural-items/{poiId}` (یعنی جزئیات کامل) برمی‌گردد.

---

# 4) آپدیت آیتم (ویرایش)

### Request

```http
PUT /api/v1/cultural-items/878
Content-Type: application/json
```

### نکات مهم آپدیت

* هر کدام از بخش‌های زیر را اگر بفرستید، جایگزین/آپدیت می‌شود:

  * `translations` → upsert روی جدول `contents` (برای هر زبان)
  * `settings` → ذخیره در `poi_points.attrs.cultural`
  * `time_restrictions` → **پاک کردن قبلی‌ها + درج جدید** در `access_time_restrictions`
  * `prayer_restrictions` → **پاک کردن قبلی‌ها + درج جدید** در `access_prayer_restrictions`
* اگر بخشی را در آپدیت **نفرستید** دست نخورده می‌ماند.

### Body نمونه (ویرایش فقط تنظیمات و محدودیت‌ها)

```json
{
  "settings": {
    "showUserFeedbacks": false,
    "showMediaGallery": true,
    "placeType": "tarikhi"
  },
  "time_restrictions": [],
  "prayer_restrictions": []
}
```

---

# 5) حذف آیتم فرهنگی

### Request

```http
DELETE /api/v1/cultural-items/878
```

### Response

```json
{ "success": true }
```

### اثر حذف

* تمام `contents` های مربوط به آن `poi_id` حذف می‌شود (fa/en/ar/ur)
* تمام رکوردهای محدودیت در `access_time_restrictions` و `access_prayer_restrictions` برای همان POI حذف می‌شود
* `poi_points.has_content` به false برمی‌گردد و `attrs.cultural` پاک می‌شود

---

# 6) مقادیر مجاز placeType (نوع مکان)

فرانت باید مقدار کُدی زیر را ارسال کند:

* `ziyarati` (زیارتی)
* `farhangi` (فرهنگی)
* `khadamati` (خدماتی)
* `tarikhi` (تاریخی)
* `memari` (معماری)

---

# 7) رادیوها (نمایش/عدم نمایش)

* `settings.showUserFeedbacks` → Boolean
* `settings.showMediaGallery` → Boolean

در خروجی هم همین نام‌ها به صورت Boolean برمی‌گردند.

