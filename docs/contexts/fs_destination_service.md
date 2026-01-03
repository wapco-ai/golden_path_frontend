## 0. کلیات

* **Base URL (dev):** `http://localhost:8080/api/v1`
* تمام مسیرها زیر این prefix تعریف شده‌اند.
* هدرهای معمول:
  * `Content-Type: application/json`
  * در صورت نیاز: `Authorization: Bearer <token>` (ذخیره مقصد برای کاربر لاگین‌شده)

### مختصات

* فرانت روی نقشه WebMercator/WGS84 کار می‌کند؛ برای ذخیره در دیتابیس لازم است `x`, `y` را در سیستم **UTM / EPSG:32640** بفرستید.
* اگر فقط `lat`, `lng` دارید، قبل از ارسال باید به `x`, `y` (متر) تبدیل کنید.

### موجودیت «مقصد ذخیره‌شده»

| فیلد        | نوع        | اجباری | توضیح                                                                                      |
| ----------- | ---------- | ------ | ------------------------------------------------------------------------------------------ |
| id          | integer    | -      | شناسه دیتابیس                                                                              |
| title       | string     | ✔️     | عنوانی که کاربر می‌بیند (نام مکان یا نام انتخابی کاربر)                                    |
| description | string     | ⭕      | توضیح کوتاه                                                                                |
| x           | number     | ✔️     | مختصات UTM 32640                                                                            |
| y           | number     | ✔️     | مختصات UTM 32640                                                                            |
| floor       | integer    | ⭕      | طبقه؛ اگر نداشت مقدار `null` ذخیره شود                                                     |
| source      | string     | ✔️     | نوع منبع: یکی از `poi`, `area`, `manual`                                                   |
| source_id   | string/int | ⭕      | شناسه منبع (مثلاً `poi-667` یا `area-2451`)؛ در حالت `manual` خالی است                    |
| tags        | string[]   | ⭕      | لیست تگ‌های ساده برای گروه‌بندی فرانت (مثلاً `favorite`, `family`)                         |
| address     | string     | ⭕      | آدرس یا توضیح نمایشی (برای نمایش زیر عنوان)                                               |
| metadata    | object     | ⭕      | هر داده اضافی که فرانت نیاز دارد (مثلاً تصویر بندانگشتی، امتیاز، ...)                      |
| created_at  | datetime   | -      | زمان ایجاد                                                                                 |
| updated_at  | datetime   | -      | زمان آخرین ویرایش                                                                          |

---

## 1. ذخیره مقصد جدید (Create)

### Endpoint

* **POST** `/api/v1/destinations`

### Request JSON

```json
{
  "title": "روضه منوری",
  "description": "نزدیک صحن انقلاب",
  "x": 734601.12,
  "y": 4018799.44,
  "floor": 0,
  "source": "poi",
  "source_id": "poi-667",
  "tags": ["favorite"],
  "address": "روضه منوری، صحن انقلاب",
  "metadata": {
    "image": null,
    "rating": 4.7,
    "views": 1523
  }
}
```

### Response (موفق)

```json
{
  "destination": {
    "id": 9101,
    "title": "روضه منوری",
    "description": "نزدیک صحن انقلاب",
    "x": 734601.12,
    "y": 4018799.44,
    "floor": 0,
    "source": "poi",
    "source_id": "poi-667",
    "tags": ["favorite"],
    "address": "روضه منوری، صحن انقلاب",
    "metadata": {
      "image": null,
      "rating": 4.7,
      "views": 1523
    },
    "created_at": "2024-04-20T10:15:00Z",
    "updated_at": "2024-04-20T10:15:00Z"
  }
}
```

---

## 2. لیست مقاصد ذخیره‌شده کاربر (List)

### Endpoint

* **GET** `/api/v1/destinations`
* فیلترها (همه اختیاری) از طریق query string:
  * `source=poi|area|manual`
  * `tag=favorite`
  * `q=<search>` (جست‌وجو در عنوان/آدرس)

### Response (موفق)

```json
{
  "items": [
    {
      "id": 9101,
      "title": "روضه منوری",
      "address": "روضه منوری، صحن انقلاب",
      "x": 734601.12,
      "y": 4018799.44,
      "floor": 0,
      "source": "poi",
      "source_id": "poi-667",
      "tags": ["favorite"],
      "metadata": {
        "image": null,
        "rating": 4.7,
        "views": 1523
      },
      "created_at": "2024-04-20T10:15:00Z",
      "updated_at": "2024-04-20T10:15:00Z"
    },
    {
      "id": 9102,
      "title": "پارکینگ شماره ۳",
      "address": "ورودی غربی، طبقه -1",
      "x": 734420.01,
      "y": 4018705.22,
      "floor": -1,
      "source": "manual",
      "source_id": null,
      "tags": ["family"],
      "metadata": {
        "color": "#3B82F6"
      },
      "created_at": "2024-04-20T11:02:00Z",
      "updated_at": "2024-04-20T11:02:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 2
  }
}
```

---

## 3. جزئیات یک مقصد (Show)

### Endpoint

* **GET** `/api/v1/destinations/{id}`

### Response (موفق)

```json
{
  "destination": {
    "id": 9101,
    "title": "روضه منوری",
    "description": "نزدیک صحن انقلاب",
    "x": 734601.12,
    "y": 4018799.44,
    "floor": 0,
    "source": "poi",
    "source_id": "poi-667",
    "tags": ["favorite"],
    "address": "روضه منوری، صحن انقلاب",
    "metadata": {
      "image": null,
      "rating": 4.7,
      "views": 1523
    },
    "created_at": "2024-04-20T10:15:00Z",
    "updated_at": "2024-04-20T10:15:00Z"
  }
}
```

---

## 4. ویرایش مقصد ذخیره‌شده (Update)

### Endpoint

* **PUT** `/api/v1/destinations/{id}`

### Request JSON (همه فیلدها اختیاری)

```json
{
  "title": "روضه منوری (جدید)",
  "description": "نزدیک ورودی شرقی",
  "tags": ["favorite", "family"],
  "address": "صحن انقلاب، ورودی شرقی"
}
```

### Response (موفق)

```json
{
  "destination": {
    "id": 9101,
    "title": "روضه منوری (جدید)",
    "description": "نزدیک ورودی شرقی",
    "x": 734601.12,
    "y": 4018799.44,
    "floor": 0,
    "source": "poi",
    "source_id": "poi-667",
    "tags": ["favorite", "family"],
    "address": "صحن انقلاب، ورودی شرقی",
    "metadata": {
      "image": null,
      "rating": 4.7,
      "views": 1523
    },
    "created_at": "2024-04-20T10:15:00Z",
    "updated_at": "2024-04-21T09:00:00Z"
  }
}
```

---

## 5. حذف مقصد (Delete)

### Endpoint

* **DELETE** `/api/v1/destinations/{id}`

### Response (موفق)

```json
{
  "status": "ok"
}
```

---

## 6. آماده‌سازی داده برای لیست اولیه صفحه /#/fs

* برای اینکه صفحه سریع بارگیری شود، یک سرویس پیشنهاد (suggestions) نیاز است که مقاصد پیش‌فرض یا اخیر را برگرداند.
* منطق پیشنهادی: آخرین مقاصد ذخیره‌شده کاربر + چند مقصد محبوب عمومی (از گروه `poi` یا `area`).

### Endpoint

* **GET** `/api/v1/destinations/suggestions`

### Response نمونه

```json
{
  "recent": [
    {
      "id": 9101,
      "title": "روضه منوری",
      "address": "روضه منوری، صحن انقلاب",
      "floor": 0,
      "source": "poi",
      "source_id": "poi-667",
      "x": 734601.12,
      "y": 4018799.44
    }
  ],
  "popular": [
    {
      "id": null,
      "title": "ورودی باب الجواد",
      "address": "ورودی اصلی",
      "floor": 0,
      "source": "area",
      "source_id": "area-2451",
      "x": 734500.00,
      "y": 4018700.00
    }
  ]
}
```

---

## 7. سناریوی جریان فرانت (نمونه)

1. کاربر روی نقشه مقصدی را انتخاب می‌کند یا از نتایج جست‌وجو یک POI برمی‌دارد.
2. فرانت مختصات WGS84 را به UTM 32640 تبدیل کرده و درخواست `POST /destinations` می‌فرستد.
3. پس از ذخیره موفق، آیتم جدید به لیست local state صفحه /#/fs اضافه می‌شود.
4. برای بارگذاری بعدی صفحه، `GET /destinations` (با فیلتر `source=poi`) اجرا می‌شود و داده‌ها را نمایش می‌دهد.
5. کاربر می‌تواند از اکشن‌های ویرایش/حذف برای مدیریت مقاصد شخصی استفاده کند.
