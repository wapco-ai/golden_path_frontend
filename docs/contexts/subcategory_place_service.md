# Subcategory / Place Service Context (`subGroups`)

این سند نیازمندی‌های کامل برای سرویس «زیرگروه/مکان» را مشخص می‌کند تا داده‌های سخت‌کد‌شده `subGroups` در
`src/components/groupData.js` از صفحات MPB و MPR حذف و با API قابل استقرار جایگزین شود. خروجی باید بدون تغییر ساختار فعلی،
مستقیما در مودال جستجوی MapRouting و کارت‌های دسته‌بندی MapBegin قابل استفاده باشد.

## اهداف و دامنه
- تامین لیست زیرگروه‌ها برای یک یا چند گروه مشخص با کلیدها و انواع فعلی.
- پشتیبانی چندزبانه (حداقل `fa`, `en`, `ar`, `ur`) برای عنوان، آدرس و توضیحات.
- کنترل اندازه پاسخ (فیلتر گروه، جستجو، صفحه‌بندی، حذف عکس‌ها) برای UI موبایل.
- هم‌راستایی با سرویس متادیتای گروه‌ها و امکان ادغام در همان سرویس در صورت نیاز.
- خروجی پایدار برای کش فرانت‌اند و سوییچ سریع بین داده آنلاین و آفلاین.

## گزینه‌های Endpoint
- **مسیر مستقل پیشنهادی:** `GET /api/groups/subgroups`
- **گزینه ادغام:** افزودن کلید `subGroups` به پاسخ `/api/groups/metadata` در صورت ارسال پارامتر `includeSubGroups=true`.

> در هر دو حالت بدنه پاسخ باید یکسان باشد؛ نام پارامتر و کلید پاسخ را ثابت نگه دارید تا فرانت‌اند بتواند بدون تغییر کد بین حالت‌ها
> سوییچ کند.

## پارامترهای درخواست
- `language` *(string, optional, default=`fa`; مجاز: `fa`, `en`, `ar`, `ur`)* — زبان پیش‌فرض برای مقداردهی `label` و `address`.
- `group` *(string, optional, repeatable)* — اگر ارسال شود، فقط زیرگروه‌های همان گروه‌ها برگردد. چند مقدار تکرارشونده پشتیبانی شود.
- `search` *(string, optional)* — جستجو روی عنوان یا آدرس در زبان انتخاب‌شده برای فیلتر سریع.
- `limit` *(integer, optional, default=`50`, max=`200`)* و `offset` *(integer, optional, default=`0`)* — صفحه‌بندی لیست‌های بزرگ.
- `withImages` *(boolean, optional, default=`true`)* — اگر `false` باشد کلید `img` حذف می‌شود تا پاسخ کوچک شود.
- `includeEmpty` *(boolean, optional, default=`false`)* — در صورت `true` گروه‌هایی که زیرگروه ندارند هم با آرایه خالی برگردند.
- `sort` *(string, optional, default=`weight`)* — ترتیب آرایه‌های هر گروه؛ مقادیر مجاز: `weight` (از DB/UI weight)، `label`,
  `distance`, `rating`.

## ساختار پاسخ
```json
{
  "subGroups": {
    "sahn": [
      {
        "value": "sahn-enqelab",
        "label": {
          "fa": "صحن انقلاب",
          "en": "Enghelab Courtyard",
          "ar": "ساحة الثورة",
          "ur": "صحن انقلاب"
        },
        "description": {
          "fa": "توضیحات کوتاه",
          "en": "Description",
          "ar": "الوصف",
          "ur": "توضیحات"
        },
        "img": [
          "https://cdn.example.com/images/s37.jpg",
          "https://cdn.example.com/images/s38.jpg"
        ],
        "address": {
          "fa": "ضریح مطهر اما رضا(ع)",
          "en": "Holy Shrine Core",
          "ar": "الضريح",
          "ur": "ضریح مطهر"
        },
        "distance": 150,
        "time": 2,
        "rating": 3.6,
        "views": 17,
        "weight": 10
      }
    ]
  },
  "language": "fa",
  "generatedAt": "2025-01-17T10:00:00Z",
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 120
  }
}
```

### قواعد و انواع فیلد
- `subGroups` *(object, required)*: همیشه بازگردانده شود؛ اگر نتیجه‌ای نیست `{}` یا در حالت `includeEmpty=true`، آرایه‌های خالی.
- **کلید هر گروه** *(string)*: مثل `sahn`, `eyvan`, `holyhalls`; مقدار باید آرایه باشد (خالی مجاز).
- **آیتم آرایه** *(object)*:
  - `value` *(string, required)*: شناسه یکتا؛ باید با `feature.properties.subGroupValue` در GeoJSON برابر باشد.
  - `label` *(object, required)*: همه زبان‌ها؛ اگر ترجمه ندارید مقدار فارسی را تکرار کنید.
  - `description` *(object, optional)*: توضیحات کوتاه؛ اگر فقط فارسی موجود است، حداقل زبان درخواست‌شده را با همان مقدار پر کنید.
  - `img` *(array<string>, optional)*: آدرس HTTPS؛ در صورت `withImages=false` حذف شود؛ از `null` استفاده نشود.
  - `address` *(object, optional)*: متن زیر عنوان کارت؛ چندزبانه مشابه `label`.
  - `distance` *(number, optional)*: متر بدون واحد؛ UI واحد را اضافه می‌کند.
  - `time` *(number, optional)*: دقیقه بدون واحد.
  - `rating` *(number, optional)*: عدد اعشاری بین 0 تا 5؛ در نبود داده حذف شود.
  - `views` *(integer, optional)*: تعداد بازدید؛ در نبود داده حذف شود.
  - `weight` *(integer, optional)*: ترتیب پیش‌فرض کارت‌ها؛ اگر نبود، مرتب‌سازی بر اساس `label` انجام می‌شود.
- `language` *(string)*: زبان انتخاب‌شده در پاسخ.
- `generatedAt` *(string, optional)*: زمان تولید پاسخ در ISO8601 برای کش و دیباگ.
- `pagination` *(object, optional)*: در صورت استفاده از `limit/offset` باید شامل `limit`, `offset`, `total` باشد.

### قوانین و اعتبارسنجی پاسخ
- وضعیت موفق: `200`. نبود داده => آرایه یا آبجکت خالی، نه خطا.
- پارامتر `group` اگر تکراری یا ناشناخته باشد نادیده گرفته شود و فقط گروه‌های معتبر بازگردد.
- تمام زبان‌ها در آبجکت‌ها باقی بماند تا کش فرانت‌اند خراب نشود، حتی اگر `language` چیز دیگری است.
- در مرتب‌سازی `sort=distance` یا `rating`، آیتم‌های فاقد مقدار باید در انتهای لیست بیایند.
- محدودیت اندازه `img`: حداکثر 5 لینک در هر آیتم؛ در صورت بیشتر بودن، لینک‌های اضافی حذف شود.

## ملاحظات فرانت‌اند
- در حال حاضر `subGroups` از `src/components/groupData.js` تغذیه می‌شود؛ کلیدها و انواع فوق باید بدون تغییر بماند تا فقط جایگزینی
  fetch انجام شود.
- MapRouting کارت‌ها و آیتم‌های لیست را مستقیما از `label`, `address`, `img`, `rating`, `views`, `distance`, `time` می‌سازد؛ حذف
  یا تغییر نام این کلیدها UI را می‌شکند.
- `value` باید با `feature.properties.subGroupValue` یا `value`های موجود در GeoJSON هم‌تراز بماند تا انتخاب روی نقشه و لیست هماهنگ
  باشد.
- کلید `weight` برای حفظ ترتیب فعلی دسته‌ها روی موبایل ضروری است؛ اگر داده‌ای وجود ندارد backend یا `weight` بدهد یا براساس `label`
  مرتب کند.

## نمونه درخواست‌ها
```http
GET /api/groups/subgroups
GET /api/groups/subgroups?language=en&group=sahn&group=eyvan&limit=20&offset=0&sort=label
GET /api/groups/metadata?includeSubGroups=true&withImages=false  # در صورت ادغام با سرویس گروه
```
