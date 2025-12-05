## ۱. کلیت ماجرا

سیستم جدید «نظر و امتیاز» ۳ کار اصلی می‌کنه:

1. کاربر روی **POI / محتوا / مسیر** می‌تونه امتیاز (۱ تا ۵ ستاره) و متن نظر ثبت کنه.
2. هر نظر اول می‌ره تو وضعیت **`pending`** و **تا ادمین تأیید نکنه نمایش داده نمی‌شه**.
3. برای هر کاربر، **روی هر هدف و هر زبان فقط یک فیدبک** داریم؛ اگر دوباره فرم رو پر کنه، همون رکورد قبلیش به‌روزرسانی می‌شه و دوباره `pending` می‌شه.

در API از این فیلدها استفاده می‌شه:

* `targetType`: نوع هدف

  * `poi` → برای `poi_points` (نقاط مکانی)
  * `content` → برای محتواها (مثلاً `contents`)
  * `route` → برای مسیر (در صورت نیاز)
* `targetId`: شناسه رکورد هدف (مثلاً `poi_points.id`)
* `lang`:‌ زبان فیدبک (`fa`, `en`, `ar`, `ur`)
* `rating`: عدد ۱ تا ۵ (اختیاری، می‌تونه فقط متن باشه)
* `title`, `body`: عنوان و متن نظر

---

## ۲. لیست APIها (برای فرانت)

### ۲.۱. لیست نظرات تأیید شده

**URL**
`GET /api/v1/feedbacks`

**Auth**
نیاز به لاگین ندارد (Public).

**Query Params**

| نام          | نوع    | اجباری | توضیح                                                     |
| ------------ | ------ | ------ | --------------------------------------------------------- |
| `targetType` | string | ✔      | یکی از: `poi`, `content`, `route`                         |
| `targetId`   | int    | ✔      | شناسه هدف                                                 |
| `lang`       | string | ✖      | یکی از: `fa`, `en`, `ar`, `ur`؛ اگر خالی باشد همه زبان‌ها |
| `page`       | int    | ✖      | پیش‌فرض ۱                                                 |
| `limit`      | int    | ✖      | پیش‌فرض ۲۰، حداکثر ۱۰۰                                    |

**رفتار**

* فقط فیدبک‌های با `status = 'approved'` برمی‌گردونه.
* بر اساس `created_at DESC` مرتب می‌کنه.
* خروجی شامل `summary` و لیست نظرات + pagination است.

**نمونه Response:**

```json
{
  "target": {
    "type": "poi",
    "id": 123
  },
  "summary": {
    "ratingAvg": 4.3,
    "ratingCount": 27,
    "lastReviewAt": "2025-12-05T10:12:00Z"
  },
  "feedbacks": {
    "data": [
      {
        "id": 987,
        "userName": "کاربر مهمان",
        "lang": "fa",
        "rating": 5,
        "title": "خیلی خوب بود",
        "body": "محیط آرام و دسترسی عالی.",
        "createdAt": "2025-12-05T10:12:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "lastPage": 3,
      "perPage": 10,
      "total": 27
    }
  }
}
```

---

### ۲.۲. خلاصه امتیاز (بدون لیست نظرات)

برای نمایش روی کارت‌ها، یا بالای صفحه دیتیل.

**URL**
`GET /api/v1/feedbacks/summary`

**Auth**
Public.

**Query Params**

| نام          | نوع    | اجباری                        |
| ------------ | ------ | ----------------------------- |
| `targetType` | string | ✔ (`poi`, `content`, `route`) |
| `targetId`   | int    | ✔                             |

**Response:**

```json
{
  "targetType": "poi",
  "targetId": 123,
  "ratingAvg": 4.3,
  "ratingCount": 27,
  "lastReviewAt": "2025-12-05T10:12:00Z"
}
```

> برای `poi` این اعداد از ویو/attrs محاسبه شده‌ان و همیشه فقط نظرات تأیید شده حساب می‌شن.

---

### ۲.۳. ثبت/ویرایش نظر توسط کاربر

**URL**
`POST /api/v1/feedbacks`

**Auth**
لاگین لازم است (همون سیستم `auth:sanctum` که بقیه APIهای protected استفاده می‌کنن).

**Body (JSON)**

| نام          | نوع    | اجباری | توضیح                     |
| ------------ | ------ | ------ | ------------------------- |
| `targetType` | string | ✔      | `poi`, `content`, `route` |
| `targetId`   | int    | ✔      | شناسه هدف                 |
| `lang`       | string | ✔      | `fa`, `en`, `ar`, `ur`    |
| `rating`     | int    | ✖      | ۱ تا ۵                    |
| `title`      | string | ✖      | حداکثر ۲۵۵ کاراکتر        |
| `body`       | string | ✖      | حداکثر ~۵۰۰۰ کاراکتر      |

**نمونه Request:**

```json
{
  "targetType": "poi",
  "targetId": 123,
  "lang": "fa",
  "rating": 4,
  "title": "خیلی خوب",
  "body": "مسیر دسترسی واضح و تابلوها مناسب بودند."
}
```

**رفتار:**

* `user_id` از توکن فعلی گرفته می‌شه.
* اگر قبلاً همین کاربر برای همین (`targetType`, `targetId`, `lang`) نظر داده باشد:

  * همان رکورد **آپدیت** می‌شود.
  * `status` دوباره `pending` می‌شود تا ادمین دوباره تأیید کند.
* اگر اولین بار است، رکورد جدید با `status = 'pending'` ساخته می‌شود.
* پس از ثبت، در Front بهتر است پیام «نظر شما ثبت شد و پس از تأیید ادمین نمایش داده می‌شود.» نشان داده شود.

**نمونه Response:**

```json
{
  "id": 1001,
  "status": "pending",
  "message": "نظر شما ثبت شد و پس از تأیید ادمین نمایش داده می‌شود."
}
```

**کدهای خطای محتمل:**

* `401 Unauthorized` → اگر کاربر لاگین نباشد.
* `422 Unprocessable Entity` → اگر ورودی‌ها با ولیدیشن نخوره (مثلاً rating=10).

---

## ۳. APIهای Admin (برای پنل مدیریتی)

این بخش برای تیم فرانت پنل ادمین / بک‌آفیس است.

### ۳.۱. لیست نظرات برای مدیریت

**URL**
`GET /api/v1/admin/feedbacks`

**Auth**
لاگین + دسترسی admin (middleware: `auth:sanctum` + `can:manage-feedbacks` یا مشابه).

**Query Params**

| نام          | نوع    | اجباری | توضیح                                                           |
| ------------ | ------ | ------ | --------------------------------------------------------------- |
| `status`     | string | ✖      | `pending`, `approved`, `rejected`, `hidden` (پیش‌فرض `pending`) |
| `targetType` | string | ✖      | فیلتر روی `poi`, `content`, `route`                             |
| `targetId`   | int    | ✖      | فیلتر روی یک هدف خاص                                            |
| `lang`       | string | ✖      | `fa`, `en`, `ar`, `ur`                                          |
| `userId`     | int    | ✖      | فیلتر روی یک کاربر خاص                                          |
| `page`       | int    | ✖      |                                                                 |
| `limit`      | int    | ✖      | پیش‌فرض ۲۰، حداکثر ۱۰۰                                          |

**Response نمونه:**

```json
{
  "data": [
    {
      "id": 1001,
      "user": {
        "id": 7,
        "name": "Ali"
      },
      "targetType": "poi",
      "targetId": 123,
      "lang": "fa",
      "rating": 4,
      "title": "خیلی خوب",
      "body": "متن کامل نظر...",
      "status": "pending",
      "adminNote": null,
      "approvedAt": null,
      "approvedBy": null,
      "createdAt": "2025-12-05T10:12:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "lastPage": 1,
    "perPage": 20,
    "total": 1
  }
}
```

---

### ۳.۲. تغییر وضعیت نظر (تأیید / رد / مخفی)

**URL**
`PATCH /api/v1/admin/feedbacks/{id}`

**Auth**
admin.

**Body (JSON)**

| نام         | نوع    | اجباری | توضیح                            |
| ----------- | ------ | ------ | -------------------------------- |
| `status`    | string | ✔      | `approved`, `rejected`, `hidden` |
| `adminNote` | string | ✖      | توضیح ادمین (مثلاً دلیل رد)      |

**نمونه Request:**

```json
{
  "status": "approved",
  "adminNote": "بررسی شد، محتوای مناسبی دارد."
}
```

یا:

```json
{
  "status": "rejected",
  "adminNote": "حاوی الفاظ نامناسب بود."
}
```

**نمونه Response:**

```json
{
  "message": "وضعیت نظر به‌روزرسانی شد.",
  "feedback": {
    "id": 1001,
    "status": "approved",
    "adminNote": "بررسی شد، محتوای مناسبی دارد.",
    "approvedAt": "2025-12-05T10:20:00Z"
  }
}
```

**نکته:**
هر بار که `status` عوض بشه، سمت دیتابیس تریگر، جمع‌امتیازهای POI رو دوباره حساب می‌کنه؛ فرانت لازم نیست کاری انجام بده.

---

## ۴. پیشنهاد جریان استفاده در فرانت

### ۴.۱. صفحه دیتیل POI / محتوا

1. وقتی صفحه دیتیل لود می‌شه:

   * همزمان:

     * `GET /api/v1/feedbacks?targetType=poi&targetId=123&lang=fa&limit=10`
     * `GET /api/v1/feedbacks/summary?targetType=poi&targetId=123`
   * بالای صفحه، امتیاز میانگین (`ratingAvg`) و تعداد نظرات (`ratingCount`) نمایش داده می‌شه.
   * پایین صفحه، لیست نظرات (با pagination).

2. اگر کاربر لاگین است:

   * فرم ارسال/ویرایش نظر را نمایش بده.
   * بعد از submit:

     * `POST /api/v1/feedbacks` را call کن.
     * در صورت موفق:

       * پیام «نظر شما ثبت شد و پس از تأیید ادمین نمایش داده می‌شود.» را نشان بده.
       * می‌تونی فرم را disable کنی یا متن فعلی کاربر را نگه داری، ولی در لیست عمومی نظرات تا زمان تأیید نشان نده.

3. اگر مهم است که کاربر بداند قبلاً نظر داده:

   * می‌توانی یک سرویس اضافی برای گرفتن نظر خود کاربر بسازیم (الان نساختیم)، اما فعلاً پشت صحنه `updateOrCreate` این را مدیریت می‌کند و خطای duplicate نخواهیم داشت.

### ۴.۲. پنل ادمین

* یک صفحه مثلاً **“مدیریت نظرات کاربران”**:

  * لیست `GET /api/v1/admin/feedbacks?status=pending`.
  * امکان فیلتر بر اساس نوع هدف، زبان، کاربر.
  * برای هر آیتم، دکمه‌های:

    * **تأیید** → `PATCH` با `status=approved`
    * **رد** → `PATCH` با `status=rejected`
    * **مخفی کردن** (روی نظراتی که قبلاً approved بوده‌اند) → `status=hidden`

---

