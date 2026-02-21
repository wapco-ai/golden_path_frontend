# Context: سرویس مورد نیاز برای جدول `userlogs-table`

این سند قرارداد بک‌اند لازم برای صفحه `Userlogs.jsx` را مشخص می‌کند تا جدول «لاگ‌های مسیریابی کاربران در اپلیکیشن» با داده واقعی تغذیه شود.

## 1) نیازمندی دقیق فرانت

بر اساس UI فعلی، جدول این ستون‌ها را نیاز دارد:
- `fullName`: نام و نام خانوادگی کاربر
- `lastLogin`: تاریخ/زمان آخرین ورود کاربر
- `successfulRoutes`: تعداد مسیریابی موفق
- `totalRoutes`: تعداد کل مسیریابی انجام‌شده
- `lastRoutingDate`: تاریخ آخرین مسیریابی
- `lastRouting`: متن آخرین مسیر (مبدأ → مقصد)

ویژگی‌های لازم UI:
- جستجو روی نام کاربر و متن آخرین مسیر
- صفحه‌بندی (page, pageSize, total, pages)
- رفرش دستی جدول
- خروجی اکسل (ترجیحاً دریافت کل داده با فیلتر جاری)

---

## 2) سرویس اصلی پیشنهادی (لیست جدول)

### Endpoint
`GET /api/admin/user-logs`

### Query Params
- `page` (number, پیش‌فرض: 1)
- `pageSize` (number, پیش‌فرض: 6)
- `search` (string, اختیاری)
- `sortBy` (string, اختیاری؛ پیش‌فرض: `lastLogin`)
- `sortOrder` (`asc|desc`, اختیاری؛ پیش‌فرض: `desc`)
- `fromDate` / `toDate` (اختیاری، اگر فیلتر تاریخ لازم است)

### Response (200)
```json
{
  "items": [
    {
      "id": 123,
      "fullName": "علی محمدی",
      "lastLogin": "2025-01-05T10:30:00Z",
      "successfulRoutes": 8,
      "totalRoutes": 12,
      "lastRoutingDate": "2025-01-04",
      "lastRouting": "دروازه شماره ۲ → حرم مطهر"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 6,
    "total": 248,
    "pages": 42
  }
}
```

### Error نمونه
- `400`: پارامتر نامعتبر
- `401/403`: عدم دسترسی ادمین
- `500`: خطای داخلی

---

## 3) سرویس خروجی اکسل (پیشنهادی)

### گزینه A (بهتر برای داده زیاد)
`GET /api/admin/user-logs/export`

ورودی‌ها همان فیلترهای endpoint لیست را می‌گیرد (`search`, `fromDate`, `toDate`, ...)
و خروجی فایل `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` می‌دهد.

### گزینه B
فرانت تمام صفحات را بگیرد و اکسل بسازد (در وضعیت فعلی UI همین کار شبیه‌سازی شده). برای scale بالا مناسب نیست.

---

## 4) منطق محاسباتی مورد انتظار در بک‌اند

برای هر کاربر:
- `successfulRoutes` = تعداد رکوردهای route با وضعیت موفق
- `totalRoutes` = تعداد کل route ثبت‌شده
- `lastRouting` = آخرین route بر اساس `createdAt`
- `lastRoutingDate` = تاریخ همان آخرین route
- `lastLogin` = آخرین لاگین از جدول session/auth log

پیشنهاد Performance:
- ایندکس روی `user_id`, `created_at`, `status`
- برای search روی نام کاربر full-text یا index مناسب
- در صورت ترافیک بالا، materialized view یا جدول تجمیعی روزانه

---

## 5) قرارداد DTO پیشنهادی برای هماهنگی تیم‌ها

```ts
type UserLogRowDto = {
  id: number;
  fullName: string;
  lastLogin: string | null;      // ISO datetime
  successfulRoutes: number;
  totalRoutes: number;
  lastRoutingDate: string | null; // YYYY-MM-DD
  lastRouting: string | null;
};

type UserLogsListResponse = {
  items: UserLogRowDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
};
```

---

## 6) تعریف done برای تیم بک‌اند

- endpoint لیست با pagination و search آماده و مستند شده باشد.
- داده‌ها دقیقاً قابل map شدن به فیلدهای جدول فرانت باشند.
- endpoint خروجی اکسل با همان فیلترها آماده باشد.
- خطاها با فرمت استاندارد API پروژه برگردند.
- پاسخ endpoint لیست در SLA قابل قبول (مثلاً زیر 500ms برای pageSize عادی) باشد.
