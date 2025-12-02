هم سرویس **گروه‌ها** هست، هم سرویس **زیرگروه‌ها (subGroups)**، با الگوی آدرس‌دهی خودت:

* `GET /api/v1/groups/metadata`
* `GET /api/v1/groups/subgroups`

---

## 1. سرویس متادیتای گروه‌ها

### 1.1. هدف سرویس

برگرداندن لیست گروه‌های اصلی (صحن، ایوان، مسجد، خدمات، QRCode و …) برای استفاده در فیلترها، لیست‌ها، و UI.
این سرویس جایگزین داده‌های استاتیک گروه‌ها در فرانت می‌شود.

---

### 1.2. آدرس و متد

```http
GET /api/v1/groups/metadata
```

---

### 1.3. پارامترهای ورودی (Query String)

همه پارامترها اختیاری‌اند:

1. `language`

   * نوع: `string`
   * مقادیر مجاز: `fa`, `en`, `ar`, `ur`
   * پیش‌فرض: `fa`
   * فعلاً فقط در خروجی جهت اطلاع برگردانده می‌شود؛ روی مقدار `label` تأثیر ندارد (label یک key مشترک برای همه زبان‌هاست).

2. `only`

   * نوع: `string`
   * اگر ست شود، فقط همان گروه با `code` مشخص را برمی‌گرداند.
   * مثال: `only=sahn`

3. `withPng`

   * نوع: `boolean` (`true`/`false` یا `1`/`0`)
   * پیش‌فرض: `true`
   * اگر `true` باشد و روی سرور آدرس base برای آیکن‌ها تنظیم شده باشد، فیلد `png` در خروجی وجود دارد.
   * اگر `false` باشد، کلید `png` اصلاً در آیتم‌ها نمی‌آید.

#### مثال URLها

```http
GET /api/v1/groups/metadata
GET /api/v1/groups/metadata?language=en&withPng=false
GET /api/v1/groups/metadata?only=sahn
```

---

### 1.4. ساختار خروجی

**Status Code:** `200 OK`

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
  "generatedAt": "2025-12-02T14:23:11+00:00"
}
```

#### توضیح فیلدهای هر آیتم در `groups[]`

* `value` (string – اجباری)
  کد گروه (از دیتابیس). مثال:

  * `sahn`, `eyvan`, `ravaq`, `mosque`, `school`, `services`, `culture`, `cemetery`, `qr-code`, …

* `label` (object – اجباری)

  * شامل کلیدهای زبان: `fa`, `en`, `ar`, `ur`.
  * **نکته مهم:** مقدارها **key ترجمه** (مثل `groupCourtyardPlural`) هستند، نه متن ترجمه‌شده.
  * در فرانت باید از این key در سیستم i18n پروژه استفاده شود:

    * `t(item.label[currentLang])`

* `property` (string – اجباری)

  * نوع هدف گروه:

    * `group` → دسته‌بندی گروهی محدوده‌ها/صحن‌ها
    * `nodeFunction` → مربوط به نوع نود (مثل QRCode)

* `icon` (string – اجباری)
  نام منطقی آیکن برای این گروه، مانند:

  * `courtyard`, `eyvan`, `mosque`, `school`, `services`, `culture`, `cemetery`, `qr-code`, `elevator`, `other`
  * فرانت می‌تواند بر اساس این نام، SVG یا آیکن فونت را انتخاب کند.

* `png` (string – اختیاری)
  آدرس PNG آیکن. فقط اگر:

  * `withPng=true`
  * و backend برای آن گروه URL تولید کرده باشد.
    اگر وجود نداشته باشد، کلید `png` در آیتم نیست (نه `null`).

#### فیلدهای ریشه

* `groups`
  آرایه گروه‌ها (ممکن است خالی باشد).
* `language`
  زبانی که برای درخواست نهایی در نظر گرفته شده (اگر ورودی نامعتبر بود، `fa` می‌شود).
* `generatedAt`
  زمان تولید پاسخ (ISO8601).

---

### 1.5. نمونه مصرف در فرانت (Pseudo-code)

```js
async function fetchGroupMetadata(language = 'fa') {
  const res = await axios.get('/api/v1/groups/metadata', {
    params: {
      language,
      withPng: true,
    },
  });

  const { groups } = res.data;

  return groups.map(item => ({
    value: item.value,
    labelKey: item.label[language], // مثلاً 'groupCourtyardPlural'
    icon: item.icon,
    png: item.png || null,
    property: item.property,
  }));
}

// استفاده در UI:
<Text>{t(group.labelKey)}</Text>
```

---

## 2. سرویس زیرگروه‌ها (subGroups / places)

این سرویس لیست مکان‌ها / زیرگروه‌ها را بر اساس گروه‌ها برمی‌گرداند.
مثلاً همه‌ی زیرگروه‌های مربوط به گروه `sahn`، `eyvan` و… با اطلاعات چندزبانه، آدرس و تصاویر.

---

### 2.1. آدرس و متد

```http
GET /api/v1/groups/subgroups
```

---

### 2.2. پارامترهای ورودی (Query String)

همه پارامترها اختیاری‌اند:

1. `language`

   * نوع: `string`
   * مقادیر مجاز: `fa`, `en`, `ar`, `ur`
   * پیش‌فرض: `fa`
   * برای انتخاب زبان اصلی جهت جستجو و fallback.

2. `group`

   * نوع: `string` یا `string[]`
   * اگر ست نشود، همه گروه‌های موجود برگردانده می‌شوند.
   * اگر ست شود، فقط زیرگروه‌های گروه‌های موردنظر:

     * نمونه:

       * `?group=sahn`
       * `?group=sahn&group=eyvan`

3. `search`

   * نوع: `string`
   * جستجو روی متن **label** و **address** در زبان انتخابی (`language`).
   * اگر خالی باشد، جستجو اعمال نمی‌شود.

4. `limit`

   * نوع: `int`
   * پیش‌فرض: `50`
   * حداکثر: `200`
   * روی مجموع رکوردها (قبل از گروهبندی) اعمال می‌شود.

5. `offset`

   * نوع: `int`
   * پیش‌فرض: `0`
   * اگر منفی باشد، به ۰ اصلاح می‌شود.

6. `withImages`

   * نوع: `boolean` (`true`/`false` یا `1`/`0`)
   * پیش‌فرض: `true`
   * اگر `false` باشد، کلید `img` اصلاً در آیتم‌ها وجود نخواهد داشت.

#### مثال URLها

```http
GET /api/v1/groups/subgroups
GET /api/v1/groups/subgroups?language=fa&group=sahn
GET /api/v1/groups/subgroups?language=en&group=sahn&group=eyvan&limit=100
GET /api/v1/groups/subgroups?language=fa&search=صحن%20انقلاب
GET /api/v1/groups/subgroups?withImages=false
```

---

### 2.3. ساختار خروجی

**Status Code:** `200 OK`

```json
{
  "subGroups": {
    "sahn": [
      {
        "value": "sahn_a",
        "label": {
          "fa": "صحن انقلاب",
          "en": "Enghelab Courtyard",
          "ar": "ساحة انقلاب",
          "ur": "صحن انقلاب"
        },
        "description": {
          "fa": "توضیح فارسی...",
          "en": "English description...",
          "ar": "",
          "ur": ""
        },
        "img": [
          "https://cdn.example.com/poi/sahn_a_1.jpg",
          "https://cdn.example.com/poi/sahn_a_2.jpg"
        ],
        "address": {
          "fa": "مشهد، حرم مطهر، صحن انقلاب",
          "en": "Mashhad, Haram, Enghelab Courtyard",
          "ar": "",
          "ur": ""
        }
      }
    ],
    "eyvan": [
      {
        "value": "eyvan_1",
        "label": { "fa": "...", "en": "...", "ar": "", "ur": "" },
        "description": { ... },
        "img": [ ... ],
        "address": { ... }
      }
    ]
  },
  "language": "fa",
  "generatedAt": "2025-12-02T14:35:00+00:00"
}
```

#### توضیح ساختار

* ریشه:

  * `subGroups` (object)

    * کلیدهای این آبجکت، **کد گروه** هستند (همان `value` سرویس groups/metadata، مثل `sahn`, `eyvan`, …)
    * مقدار هر کلید: آرایه‌ای از آیتم‌های زیرگروه / مکان.

  * `language`

    * زبان مؤثر روی جستجو و fallback.

  * `generatedAt`

    * زمان تولید پاسخ.

---

### 2.4. فیلدهای هر آیتم زیرگروه

هر آیتم داخل آرایه‌ی `subGroups[groupCode]` ساختاری مثل زیر دارد:

```json
{
  "value": "sahn_a",
  "label": {
    "fa": "صحن انقلاب",
    "en": "Enghelab Courtyard",
    "ar": "ساحة انقلاب",
    "ur": "صحن انقلاب"
  },
  "description": {
    "fa": "توضیح فارسی...",
    "en": "English description...",
    "ar": "",
    "ur": ""
  },
  "img": [
    "https://cdn.example.com/poi/sahn_a_1.jpg"
  ],
  "address": {
    "fa": "مشهد، حرم مطهر، صحن انقلاب",
    "en": "Mashhad, Haram, Enghelab Courtyard",
    "ar": "",
    "ur": ""
  }
}
```

* `value` (string – اجباری)

  * شناسه‌ی یکتای زیرگروه / مکان، همانی که در mapping استفاده می‌شود (`feature_key`).
  * این مقدار در GeoJSON و سایر سرویس‌ها هم به عنوان `subGroupValue` استفاده می‌شود.

* `label` (object – اجباری)

  * نام زیرگروه به تفکیک زبان.
  * اگر برای یک زبان مقدار خاصی وجود نداشته باشد، با منطق fallback (زبان اصلی کاربر → سایر زبان‌ها) مقدار پر می‌شود تا حد امکان خالی نباشد.

* `description` (object – اختیاری)

  * توضیح کوتاه درباره مکان به تفکیک زبان.
  * اگر هیچ مقداری برای هیچ زبانی نباشد، ممکن است کلید `description` در آیتم نیاید.

* `img` (array<string> – اختیاری)

  * لیست آدرس تصاویر مکان.
  * فقط اگر `withImages=true` و داده‌ای موجود باشد، این کلید برمی‌گردد.
  * اگر `withImages=false` باشد، کلید `img` اصلاً در پاسخ نیست.

* `address` (object – اختیاری)

  * آدرس/لوکیشن متنی به تفکیک زبان.
  * اگر داده‌ای نباشد، این کلید ممکن است وجود نداشته باشد.

> فیلدهایی مثل `distance`, `time`, `rating`, `views` فعلاً در این نسخه پیاده‌سازی نشده‌اند. اگر در آینده در دیتابیس اضافه شوند، با همین ساختار قابل اضافه‌کردن هستند.

---

### 2.5. نمونه مصرف در فرانت

```js
async function fetchSubGroups(params = {}) {
  const {
    language = 'fa',
    groups = [],
    search = '',
    limit = 50,
    offset = 0,
    withImages = true,
  } = params;

  const query = {
    language,
    search,
    limit,
    offset,
    withImages,
  };

  if (Array.isArray(groups) && groups.length > 0) {
    // axios این را به صورت group=sahn&group=eyvan می‌فرستد
    query.group = groups;
  }

  const res = await axios.get('/api/v1/groups/subgroups', { params: query });

  const { subGroups } = res.data;

  // subGroups یک آبجکت است: { sahn: [ ... ], eyvan: [ ... ] }
  return subGroups;
}

// مثال استفاده:
const subGroups = await fetchSubGroups({
  language: 'fa',
  groups: ['sahn', 'eyvan'],
  search: '',
  limit: 100,
});

// نمونه دسترسی:
const sahnPlaces = subGroups['sahn'] || [];
sahnPlaces.forEach(place => {
  const title = place.label['fa'];
  const address = place.address?.['fa'] || '';
  const img = place.img?.[0] || null;
});
```

---

## 3. خلاصه برای تیم فرانت

* **Endpoints:**

  * گروه‌ها:

    * `GET /api/v1/groups/metadata`
  * زیرگروه‌ها / مکان‌ها:

    * `GET /api/v1/groups/subgroups`

* **گروه‌ها (`groups/metadata`):**

  * خروجی: آرایه‌ای از `{ value, label{langs}, property, icon, png? }`
  * `label[lang]` → کلید ترجمه (مثل `groupCourtyardPlural`) → در فایل‌های i18n resolve کنید.
  * `icon` → نگاشت به SVG یا آیکون.
  * `png` اختیاری، بسته به `withPng`.

* **زیرگروه‌ها (`groups/subgroups`):**

  * خروجی: آبجکت `subGroups` که کلیدهای آن کد گروه‌ها (`sahn`, `eyvan`, …) است.
  * مقدار هر کلید: آرایه‌ای از آیتم‌ها با `{ value, label{langs}, description{langs}? , img[]?, address{langs}? }`.
  * پارامتر `group` برای فیلتر روی گروه خاص، `search` برای جستجوی نام/آدرس، `withImages` برای کنترل برگرداندن تصاویر.
