# Subcategory / Place Service Context (`subGroups`)

این سند نیازمندی‌های سرویس تامین‌کننده داده‌های "زیرگروه/مکان" را مشخص می‌کند تا داده‌های سخت‌کد‌شده `subGroups` در
`src/components/groupData.js` برای صفحات MPB و MPR با API جایگزین شود. خروجی باید بدون تغییر ساختار فعلی، مستقیم در
مودال جستجوی MapRouting و کارت‌های دسته‌بندی MapBegin قابل استفاده باشد.

## هدف‌ها
- بازگرداندن لیست زیرگروه‌ها برای یک یا چند گروه مشخص با همان کلیدها و انواع فعلی.
- پشتیبانی از چندزبانگی (حداقل `fa`, `en`, `ar`, `ur`) برای عنوان و آدرس.
- امکان کنترل اندازه پاسخ (فیلتر گروه، جستجو، صفحه‌بندی، حذف عکس‌ها) برای بهینه‌سازی UI موبایل.
- هم‌راستایی با سرویس متادیتای گروه‌ها؛ امکان تجمیع در همان سرویس در صورت نیاز.

## گزینه‌های پیاده‌سازی Endpoint
- **مسیر پیشنهادی مستقل:** `GET /api/groups/subgroups`
- **یا الحاق به سرویس موجود:** افزودن کلید `subGroups` به پاسخ `/api/groups/metadata` هنگام ارسال پارامتر `includeSubGroups=true`.

> هر دو حالت باید قرارداد یکسانی در بدنه پاسخ داشته باشند. اگر با سرویس موجود ادغام می‌کنید، نام پارامتر و کلید پاسخ را ثابت
> نگه دارید تا فرانت‌اند بتواند سوییچ کند.

## پارامترهای درخواست
- `language` *(string, optional, default=`fa`; مقادیر مجاز: `fa`, `en`, `ar`, `ur`)* — زبان پیش‌فرض برای مقداردهی `label` و `address`.
- `group` *(string, optional, repeatable)* — اگر ارسال شود، فقط زیرگروه‌های همان گروه یا گروه‌ها برگردانده شود. اگر خالی باشد همه برگردد.
- `search` *(string, optional)* — جستجو روی عنوان یا آدرس (در زبان انتخاب‌شده) برای فیلتر سریع.
- `limit` *(integer, optional, default=`50`, max=`200`)* و `offset` *(integer, optional, default=`0`)* — برای صفحه‌بندی لیست‌های بزرگ.
- `withImages` *(boolean, optional, default=`true`)* — اگر `false` باشد کلید `img` حذف می‌شود تا پاسخ کوچک شود.

## ساختار پاسخ
```json
{
  "subGroups": {
    "sahn": [
      {
        "value": "sahn-enqelab",
        "label": { "fa": "صحن انقلاب", "en": "Enghelab Courtyard", "ar": "ساحة الثورة", "ur": "صحن انقلاب" },
        "description": { "fa": "توضیحات", "en": "Description", "ar": "الوصف", "ur": "توضیحات" },
        "img": ["https://cdn.example.com/images/s37.jpg", "https://cdn.example.com/images/s38.jpg"],
        "address": { "fa": "ضریح مطهر اما رضا(ع)", "en": "Holy Shrine Core", "ar": "الضريح", "ur": "ضریح مطهر" },
        "distance": 150,
        "time": 2,
        "rating": 3.6,
        "views": 17
      }
    ]
  },
  "language": "fa",
  "generatedAt": "2025-01-17T10:00:00Z"
}
```

### قواعد و انواع فیلد
- همیشه کلید `subGroups` بازگردانده شود؛ اگر فیلتر نتیجه نداشت، مقدار آن آبجکت خالی `{}` باشد.
- مقدار هر کلید گروه (مثل `sahn`, `eyvan`) یک آرایه است؛ اگر گروه خالی است، آرایه خالی برگردانید.
- `value` *(string, required)*: شناسه یکتا و هم‌نام با `feature.properties.subGroupValue` در GeoJSON.
- `label` *(object, required)*: مقدار در همه زبان‌ها نگه داشته شود؛ اگر ترجمه ندارید همان کلید فارسی تکرار شود.
- `description` *(object, optional)*: توضیحات کوتاه؛ در نبود ترجمه، حداقل کلید زبان درخواست‌شده را با مقدار فارسی پر کنید.
- `img` *(array<string>, optional)*: آدرس‌های HTTPS قابل دسترس مرورگر. در صورت `withImages=false` حذف شود؛ از مقدار `null` استفاده نشود.
- `address` *(object, optional)*: متن قابل نمایش زیر عنوان کارت؛ مشابه `label` چندزبانه باشد.
- `distance` *(number, optional)*: مقدار متریک (متر) بدون واحد؛ UI خودش واحد را اضافه می‌کند.
- `time` *(number, optional)*: زمان تقریبی (دقیقه) بدون واحد.
- `rating` *(number, optional)*: عدد اعشاری بین 0 تا 5؛ اگر داده ندارید حذف شود.
- `views` *(integer, optional)*: تعداد بازدید؛ اگر داده ندارید حذف شود.

## قوانین پاسخ‌دهی
- در هر حالت کد 200 برگردد؛ فقدان داده برابر با آرایه یا آبجکت خالی است نه خطا.
- `language` صرفا مشخص می‌کند مقدار پیش‌فرض رشته‌ها چه باشد؛ اما تمام زبان‌ها در آبجکت‌ها باقی بماند تا کش فرانت‌اند خراب نشود.
- اگر پارامتر `group` تکراری یا ناشناخته بود، فقط گروه‌های معتبر را برگردانید و بقیه را نادیده بگیرید.
- زمان پاسخ (`generatedAt`) برای دیباگ و کش مفید است؛ ISO8601.

## ملاحظات فرانت‌اند
- کامپوننت‌ها فعلا از `subGroups` در `src/components/groupData.js` تغذیه می‌شوند؛ کلیدها و انواع فوق باید بدون تغییر باقی بماند تا
  فراخوانی fetch جایگزین ایمپورت شود.
- MapRouting کارت‌ها و آیتم‌های لیست را مستقیما از `label`, `address`, `img`, `rating`, `views` می‌سازد؛ حذف یا تغییر نام این کلیدها UI را می‌شکند.
- مقدار `value` باید با `feature.properties.subGroupValue` یا `value` های موجود در GeoJSON هم‌تراز باشد تا انتخاب روی نقشه و لیست
  با هم کار کند.

## نمونه درخواست‌ها
```http
GET /api/groups/subgroups
GET /api/groups/subgroups?language=en&group=sahn&group=eyvan&limit=20&offset=0
GET /api/groups/metadata?includeSubGroups=true&withImages=false  # در صورت ادغام با سرویس گروه
```
