# Category Metadata Service Context (Groups)

این سند، نیازمندی‌های سرویس «دریافت متادیتای گروه‌ها» را برای صفحات MPB (Map Begin) و MPR (Map Routing) توضیح می‌دهد تا داده‌های سخت‌کد شده فایل `src/components/groupData.js` با فراخوانی API جایگزین شوند.

## هدف
- تامین لیست گروه‌ها (category bar و modal جستجو) با همان کلیدها و ساختار فعلی.
- امکان انتخاب زبان، فیلتر بر اساس `value`، و کنترل دریافت یا عدم دریافت آیکن PNG.
- فراهم کردن پاسخ پایدار برای کش فرانت‌اند.

## Endpoint
`GET /api/groups/metadata`

### Query Parameters
- `language` *(string, optional, default=`fa` — مقادیر مجاز: `fa`, `en`, `ar`, `ur`)*
- `only` *(string, optional)* — اگر مقدار `value` یک گروه ارسال شود، فقط همان گروه برگردانده می‌شود.
- `withPng` *(boolean, optional, default=`true`)* — اگر `false` باشد کلید `png` حذف می‌شود تا حجم پاسخ کم شود.

### Response Body
```json
{
  "groups": [
    {
      "value": "sahn",
      "label": {
        "fa": "groupCourtyardPlural",
        "en": "groupCourtyardPlural",
        "ar": "groupCourtyardPlural",
        "ur": "groupCourtyardPlural"
      },
      "property": "group",
      "icon": "courtyard",
      "png": "https://cdn.example.com/icons/courtyard.png"
    }
  ],
  "language": "fa",
  "generatedAt": "2025-01-16T10:00:00Z"
}
```

### ارتباط با `subGroups`
- این سرویس **الزامی نیست** که آرایه‌ی `subGroups` را برگرداند؛ داده‌ی زیرگروه‌ها طبق کانتکست جداگانه‌ی «Subcategory/Place Service» تامین می‌شود تا پاسخ متادیتای گروه‌ها کوچک بماند.
- اگر بک‌اند نیاز دارد هر دو را در یک پاسخ برگرداند، یک سویچ اختیاری مثل `withSubGroups=true` اضافه کند؛ در این حالت هر عضو `groups` می‌تواند کلید `subGroups` مطابق همان شِمای تعریف‌شده در سرویس زیرگروه‌ها داشته باشد.

#### فیلدها
- `value` *(string, required)*: شناسه یکتا و هم‌نام با `value` در `groupData.js`.
- `label` *(object, required)*: برای هر زبان یک مقدار رشته‌ای برمی‌گردد. در حال حاضر فرانت‌اند کلید i18n را انتظار دارد؛ اگر ترجمه آماده نیست، همان کلید را در همه زبان‌ها تکرار کنید.
- `property` *(string, required)*: مقدار ثابت «group» یا «nodeFunction» برای نگاشت به `feature.properties[property]` در نقشه.
- `icon` *(string, required)*: نام آیکن داخلی در UI (مثل `courtyard`, `eyvan`, `shrine`, `mosque`, `school`, `services`, `culture`, `cemetery`, `qr-code`, `elevator`, `other`).
- `png` *(string, optional)*: URL کامل یا نسبی به آیکن PNG؛ اگر `withPng=false` باشد حذف می‌شود.
- `language` *(string)*: زبان اعمال‌شده روی پاسخ.
- `generatedAt` *(string, ISO datetime)*: زمان تولید داده برای دیباگ و کش.

### Rules & Validation
- در همه حالت‌ها `groups` یک آرایه است؛ اگر فیلتر نتیجه نداد، آرایه خالی برگردانید (کد 200).
- `language` صرفا برای ترجمه‌ی مقدار `label` استفاده شود؛ با این حال تمام زبان‌ها در آبجکت `label` باقی بمانند تا فرانت‌اند بتواند کش کند.
- اگر مقدار `only` با هیچ گروهی تطابق نداشت، آرایه خالی برگردانید.
- `png` باید قابل بارگذاری مستقیم در مرورگر باشد (CORS/HTTPS). اگر فاقد آیکن هستید، کلید `png` را حذف کنید یا مقدار آن را `null` نگذارید.

## Front-end Integration
- کامپوننت‌ها داده را از `src/components/groupData.js` می‌خوانند؛ حفظ کلیدها/انواع فوق باعث جایگزینی آسان `fetch` می‌شود.
- `property` مستقیما با `feature.properties.group` یا `feature.properties.nodeFunction` در GeoJSON مقایسه می‌شود؛ تغییر نام این کلید باعث عدم فیلتر صحیح در نقشه خواهد شد.
- کلید `icon` برای انتخاب آیکن در UI استفاده می‌شود؛ مقدار باید یکی از گزینه‌های فوق باشد.

## نمونه درخواست‌ها
```http
GET /api/groups/metadata
GET /api/groups/metadata?language=en
GET /api/groups/metadata?only=eyvan&withPng=false
```
