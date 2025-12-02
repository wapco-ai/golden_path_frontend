## 1. معرفی سرویس

**نام سرویس:** دریافت متادیتای گروه‌ها (Category / Group Metadata)
**هدف:**
برگرداندن لیست گروه‌ها و دسته‌بندی‌های اصلی (مثل صحن، ایوان، مسجد، خدمات، QRCode و …) با اطلاعات لازم برای UI.

**آدرس:**

```text
GET /api/groups/metadata
```

(اگر API نسخه‌بندی دارید، می‌تونه مثلا `/api/v1/groups/metadata` هم بشه، ولی فعلا در بک‌اند روی همین مسیر `/api/groups/metadata` تنظیم شده.)

---

## 2. ورودی‌ها (Query Params)

سرویس فقط Query String می‌گیرد:

1. `language` (اختیاری)

   * انواع مجاز: `fa`, `en`, `ar`, `ur`
   * پیش‌فرض: `fa`
   * فعلاً فقط برای برگرداندن مقدار انتخاب‌شده در پاسخ استفاده می‌شود، ولی **خود متن ترجمه شده را برنمی‌گردانیم**؛ فقط کلید ترجمه را می‌دهیم.

2. `only` (اختیاری)

   * نوع: `string`
   * اگر ست شود، فقط همان گروهی که `code` آن برابر این مقدار است برگردانده می‌شود.
   * مثال: `only=sahn` فقط گروه صحن را بر می‌گرداند.

3. `withPng` (اختیاری)

   * نوع: `boolean` (`true`/`false` یا `1`/`0`)
   * پیش‌فرض: `true`
   * اگر `true` باشد و در بک‌اند آدرس base برای آیکن‌ها تنظیم شده باشد، فیلد `png` در هر آیتم برگردانده می‌شود (آدرس PNG بر اساس نام آیکن).
   * اگر `false` باشد یا base URL تنظیم نشده باشد، کلاً فیلد `png` در خروجی وجود نخواهد داشت.

### نمونه URLهای فراخوانی

* گرفتن همه گروه‌ها (پیش‌فرض فارسی، با PNG):

  ```text
  GET /api/groups/metadata
  ```

* گرفتن همه گروه‌ها با مشخص کردن زبان و بدون PNG:

  ```text
  GET /api/groups/metadata?language=en&withPng=false
  ```

* گرفتن فقط متادیتای گروه صحن:

  ```text
  GET /api/groups/metadata?only=sahn
  ```

---

## 3. ساختار خروجی

پاسخ به صورت JSON است و ساختار کلی به این شکل است:

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
    // ...
  ],
  "language": "fa",
  "generatedAt": "2025-12-02T14:23:11+00:00"
}
```

### توضیح فیلدها

#### ریشه پاسخ

* `groups`:
  آرایه‌ای از آبجکت‌ها، هرکدام معرف یک گروه (Category) یا نوع nodeFunction (مثل QRCode و …).

* `language`:
  زبانی که با آن درخواست ارسال شده (یا پیش‌فرض `fa` اگر مقدار نامعتبر داده شده باشد).

* `generatedAt`:
  زمان تولید پاسخ به فرمت ISO (برای لاگ و دیباگ).

---

### فیلدهای هر آیتم در `groups`

هر عضو آرایه `groups` ساختاری مثل زیر دارد:

```json
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
```

#### `value` (اجباری)

* رشته‌ای که کد گروه را نشان می‌دهد.
* مستقیماً از ستون `code` در جدول `categories` می‌آید.
* مثال‌ها:

  * `sahn`
  * `eyvan`
  * `ravaq`
  * `mosque`
  * `school`
  * `services`
  * `culture`
  * `cemetery`
  * …
  * برای nodeFunction مثل QRCode هم مقادیر متناظر خودش را دارد.

#### `label` (اجباری)

* آبجکتی شامل کلیدهای زبان (`fa`, `en`, `ar`, `ur`).

* **نکته مهم:**
  مقدار این فیلد **خود متن ترجمه‌شده نیست**، بلکه **کلید ترجمه (i18n key)** است.
  این کلید برای همه زبان‌ها یکسان است و از دیتابیس (`label_key`) گرفته می‌شود.

* مثال: برای گروه صحن:

  ```json
  "label": {
    "fa": "groupCourtyardPlural",
    "en": "groupCourtyardPlural",
    "ar": "groupCourtyardPlural",
    "ur": "groupCourtyardPlural"
  }
  ```

* در فرانت، بر اساس زبان انتخابی کاربر، همین مقدار (`groupCourtyardPlural`) باید در فایل‌های ترجمه استاتیک پروژه resolve شود و متن نهایی نمایش داده شود.
  یعنی:

  * دیتابیس → key: `groupCourtyardPlural`
  * فرانت → ترجمه این key در `fa.json`، `en.json`، …

#### `property` (اجباری)

* نوع هدف این گروه:

  * برای دسته‌بندی گروهی محدوده‌ها: `group`
  * برای گروه‌هایی که روی `nodeFunction` اعمال می‌شوند (مثل QRCode): `nodeFunction`

مثال‌ها:

```json
"property": "group"
```

یا:

```json
"property": "nodeFunction"
```

فرانت می‌تواند بر اساس این فیلد تصمیم بگیرد این گزینه در کدام بخش UI استفاده شود (فیلتر مناطق، فیلتر QR، …).

#### `icon` (اجباری)

* نام آیکن منطقی این گروه.
* رشته‌ای مثل:

  * `courtyard`
  * `eyvan`
  * `mosque`
  * `school`
  * `services`
  * `culture`
  * `cemetery`
  * `qr-code`
  * `elevator`
  * `other`
* فرانت می‌تواند:

  * یا آیکن SVG اختصاصی برای هر نام داشته باشد،
  * یا از روی این مقدار، آیکن Font/Library (مثلاً FontAwesome, Material Icons, …) را مپ کند.

#### `png` (اختیاری)

* آدرس کامل PNG آیکن این گروه.

* فقط در صورت:

  * `withPng=true` در Query Params،
  * و تنظیم بودن `GROUP_ICONS_BASE_URL` در `.env` بک‌اند،
  * و داشتن مقدار `icon`،
    برگردانده می‌شود.

* شکل تولید آدرس:

  ```text
  {GROUP_ICONS_BASE_URL}/{icon}.png
  ```

  مثال:

  ```text
  https://cdn.example.com/icons/courtyard.png
  ```

* اگر `withPng=false` باشد یا base URL تنظیم نشده باشد، **فیلد `png` اصلاً در آیتم‌ها نمی‌آید** (نه null و نه خالی)؛ فرانت نباید روی وجودش حساب قطعی کند.

---

## 4. رفتار خطاها / وضعیت‌های HTTP

* در حالت عادی، پاسخ موفق:

  * **Status Code:** `200 OK`
  * Body به فرمت توضیح داده‌شده در بالا.

* اگر `language` مقدار نامعتبر باشد:

  * سرور آن را نادیده می‌گیرد و `fa` در نظر می‌گیرد.
  * در پاسخ، فیلد `language` مقدار واقعی استفاده شده (`fa`) را نشان می‌دهد.

* در خطاهای داخلی (مثلاً مشکل دیتابیس):

  * **Status Code:** `500 Internal Server Error`
  * بدنه استاندارد خطای لاراول برمی‌گردد.
    (برای فرانت پیشنهاد می‌شود صرفاً پیام یوزر-فرندلی نمایش داده شود و جزئیات لاگ سمت بک‌اند بررسی شود.)

---

## 5. نکات مهم برای فرانت‌اند

1. **نمایش عنوان گروه**

   * از `groups[i].label[currentLang]`، مقدار key را بگیرید (مثلاً `groupCourtyardPlural`)
   * این key را به فایل‌های ترجمه بدهید (مثلاً Vue i18n، React i18next، …) تا متن نهایی تولید شود.

2. **استفاده از property**

   * اگر `property === 'group'`:

     * این گزینه مربوط به گروه‌بندی محدوده‌ها/صحن‌ها و … است (فیلترهای نقشه، دسته‌بندی POI و …).
   * اگر `property === 'nodeFunction'`:

     * این گزینه مربوط به نوع خاص روی nodeFunctionها (مثل QRCode) است.

3. **استفاده از icon**

   * می‌توانید آیکن‌های خودتان را بر اساس این نام نگاشت دهید، مثلاً:

     * `courtyard` → `icon-courtyard.svg`
     * `mosque` → `icon-mosque.svg`
   * یا در CSS/کامپوننت‌ها سوئیچ کنید.

4. **استفاده از png**

   * اگر وجود داشت، می‌تواند مستقیماً به `<img src="...">` متصل شود.
   * اگر نبود، فرانت باید graceful fallback داشته باشد (مثلاً استفاده از SVG داخلی یا آیکن فونت).

---

## 6. نمونه استفاده (Pseudo-code)

### مثال با Axios (جاوااسکریپت)

```js
async function fetchGroupsMetadata(language = 'fa') {
  const res = await axios.get('/api/groups/metadata', {
    params: {
      language,
      withPng: true
    }
  });

  const { groups } = res.data;

  return groups.map(item => ({
    value: item.value,
    // کلید ترجمه که باید resolve شود
    labelKey: item.label[language],
    property: item.property,
    icon: item.icon,
    png: item.png || null
  }));
}
```

بعد در UI، `labelKey` را به سیستم ترجمه بدید:

```jsx
<Text>{t(labelKey)}</Text>
```
