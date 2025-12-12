**Base URL**

```
http://localhost:8080/api/v1
```

---

## 1) آپلود فایل

**Endpoint**

```
POST /files
```

**Headers**

```
Content-Type: multipart/form-data
Accept: application/json
```

**Body (form-data)**

* `file` (required) → فایل
* `entity_table` (required) → نام جدول/دامنه (مثلاً: `poi_points`, `contents`, `areas`, `doors`)
* `entity_id` (required) → شناسه رکورد
* `bucket` (optional) → دسته فایل (مثلاً: `images`, `files`, `audio`, `cover`, `gallery`) (پیش‌فرض: `files`)
* `keep_original_name` (optional) → `true|false` (پیش‌فرض: `false`)

**نمونه cURL**

```bash
curl -X POST "http://localhost:8080/api/v1/files" \
  -H "Accept: application/json" \
  -F "file=@/path/to/photo.jpg" \
  -F "entity_table=poi_points" \
  -F "entity_id=798" \
  -F "bucket=images"
```

**نمونه Response (201)**

```json
{
  "path": "uploads/poi_points/798/images/550e8400-e29b-41d4-a716-446655440000.jpg",
  "url": "http://localhost:8080/storage/uploads/poi_points/798/images/550e8400-e29b-41d4-a716-446655440000.jpg",
  "original_name": "photo.jpg",
  "mime": "image/jpeg",
  "size": 184233,
  "entity_table": "poi_points",
  "entity_id": 798,
  "bucket": "images"
}
```

---

## 2) دانلود فایل

**Endpoint**

```
GET /files?path=...
```

**Query Params**

* `path` (required) → همون `path` ذخیره‌شده در دیتابیس
* `inline` (optional) → `1` برای نمایش در مرورگر (تصاویر/PDF)
* `as` (optional) → اسم فایل هنگام دانلود

**نمونه**

```http
GET /api/v1/files?path=uploads/poi_points/798/images/550e8400-e29b-41d4-a716-446655440000.jpg
```

**Inline نمونه**

```http
GET /api/v1/files?path=uploads/poi_points/798/images/550e8400-e29b-41d4-a716-446655440000.jpg&inline=1
```

---

## 3) حذف فایل

**Endpoint**

```
DELETE /files?path=...
```

**نمونه**

```bash
curl -X DELETE "http://localhost:8080/api/v1/files?path=uploads/poi_points/798/images/550e8400-e29b-41d4-a716-446655440000.jpg" \
  -H "Accept: application/json"
```

**Response (200)**

```json
{
  "deleted": true,
  "path": "uploads/poi_points/798/images/550e8400-e29b-41d4-a716-446655440000.jpg"
}
```

---

## 4) متادیتا فایل (اختیاری)

**Endpoint**

```
GET /files/meta?path=...
```

**نمونه**

```http
GET /api/v1/files/meta?path=uploads/poi_points/798/images/550e8400-e29b-41d4-a716-446655440000.jpg
```

**Response**

```json
{
  "path": "uploads/poi_points/798/images/550e8400-e29b-41d4-a716-446655440000.jpg",
  "url": "http://localhost:8080/storage/uploads/poi_points/798/images/550e8400-e29b-41d4-a716-446655440000.jpg",
  "size": 184233,
  "mime": "image/jpeg",
  "last_modified": 1765561200
}
```

---

## نکته مهم برای فرانت (جلوگیری از دوباره ذخیره شدن)

* فایل‌ها را **فقط یک‌بار** با `POST /files` آپلود کن.
* در سرویس ذخیره محتوای فرهنگی/فرم اصلی، فقط `path` (و اگر خواستی `type/bucket`) را ذخیره کن.
* در دفعات بعدی Save، اگر فایل جدید انتخاب نشده، **آپلود انجام نده** و همان `path` قبلی را ارسال کن.
