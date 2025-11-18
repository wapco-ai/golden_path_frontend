کانتکست نهایی سرویس QR برای استفاده در فرانت 👇
(می‌تونی همین متن رو بذاری توی docs پروژه‌ات)

---

## QR Location Metadata API

### هدف سرویس

ارائهٔ **متای نمایشی یک لوکیشن** بر اساس **کد QR** برای استفاده در صفحه‌ای مثل `MapBeginPage`
(نمایش: عنوان، توضیح، موقعیت، تصاویر، محتوای چندرسانه‌ای، نظرات، آمار بازدید و امتیاز).

---

## Endpoint

```http
GET /api/qrcodes/{code}
```

* `{code}` = مقدار ستون `qrcodes.code`
* این سرویس **فقط برای QRها** است (نه همهٔ لوکیشن‌ها).

---

## Query Parameters

```http
GET /api/qrcodes/{code}?language=fa&includeContents=true&includeComments=false
```

* `language` (اختیاری، پیش‌فرض: `fa`)

  * مقادیر مجاز: `fa`, `en`, `ar`, `ur`
  * خروجی همیشه **تک‌زبانه** است؛ تمام متن‌ها بر اساس این زبان resolve می‌شوند.
  * اگر زبان نامعتبر باشد یا ترجمه موجود نباشد:

    * زبان به `fa` برمی‌گردد، یا
    * از اولین ترجمهٔ موجود استفاده می‌شود (fallback).

* `includeContents` (اختیاری، پیش‌فرض: `true`)

  * `true` → آرایهٔ `contents` با داده برمی‌گردد.
  * `false` → آرایهٔ `contents` خالی (`[]`).

* `includeComments` (اختیاری، پیش‌فرض: `false`)

  * `true` → آرایهٔ `comments` با داده برمی‌گردد.
  * `false` → آرایهٔ `comments` خالی (`[]`).

---

## ساختار Response (موفق / 200)

```jsonc
{
  "id": "saqqakhaneh",      // = qrcodes.code
  "lang": "fa",             // زبان resolve شده نهایی

  "title": "سقاخانه حرم مطهر رضوی",

  "location": "صحن انقلاب اسلامی، ضلع غربی، کنار گنبد طلا | حرم مطهر رضوی",

  "images": [
    "https://example.org/images/saqqakhaneh-main.jpg",
    "https://example.org/images/saqqakhaneh-night.jpg"
  ],

  "openingHours": "این فضا به‌صورت ۲۴ ساعته باز است؛ در زمان‌های ازدحام ممکن است دسترسی به‌صورت مقطعی محدود شود.",

  "about": {
    "short": "سقاخانه حرم، جایی که زائران با نیت توسل جرعه‌ای از آب متبرک می‌نوشند.",
    "full": "سقاخانه حرم مطهر رضوی یکی از محبوب‌ترین نقاط زیارتی برای زائران است..."
  },

  "contents": [
    {
      "id": "content1",
      "type": "audio",       // نمونه: audio | video | article | image | ...
      "title": "نوای زیارت در کنار سقاخانه",
      "description": "قطعه صوتی کوتاه برای همراهی با لحظه‌های دعا و توسل در کنار سقاخانه.",
      "fileKey": "saqqakhaneh_audio_1",   // کلیدی که بک‌اند/CDN باهاش فایل رو برمی‌گردونه
      "thumbnail": "https://example.org/thumbs/saqqakhaneh-audio-1.jpg"
    }
  ],

  "comments": [
    {
      "id": "comment1",
      "author": "محمد حسین میرشفیعی",
      "text": "آبی که همیشه شفا می‌دهد، فقط کافی است با دل شکسته بنوشی.",
      "date": "۴ بهمن",       // متن نمایشی تاریخ (localised)
      "rating": 5             // 1..5
    }
  ],

  "views": 237,              // تعداد بازدید/اسکن
  "averageRating": 4.7       // میانگین امتیاز (nullable)
}
```

### توضیح فیلدها

* `id: string`
  کد عمومی QR برای استفاده در URL / نمایش (`qrcodes.code`).

* `lang: string`
  زبان نهایی که محتوا بر اساس آن resolve شده است.

* `title: string | null`
  عنوان لوکیشن (مثلاً نام سقاخانه / صحن / ورودی و …).
  از `i18n_texts` (`field = 'name'`) خوانده می‌شود.

* `location: string | null`
  متن نمایشی موقعیت/محل (مثلاً نام صحن + توضیح کوتاه).
  از `qrcodes.attrs.location[lang]` خوانده می‌شود.

* `images: string[]`
  آرایه URL تصاویر، برای نمایش گالری/اسلایدر.
  از `qrcodes.attrs.images[]`.

* `openingHours: string | null`
  توضیح متنی درباره ساعات دسترسی/باز بودن.
  از `qrcodes.attrs.openingHours[lang]`.

* `about: { short, full }`

  * `about.short: string | null`

    * توضیح کوتاه؛ اگر برای زبان مورد نظر موجود نباشد و `full` وجود داشته باشد،
      از روی full به صورت خودکار کوتاه می‌شود (تقریباً ۱۴۰ کاراکتر + `…`).
    * منبع: `qrcodes.attrs.about.short[lang]` یا fallback از full.
  * `about.full: string | null`

    * توضیح کامل/متن روایت‌گونه.
    * منبع اصلی: `i18n_texts` (`field = 'desc'`).

* `contents: ContentItem[]`
  فقط اگر `includeContents=true`.

  ```ts
  type ContentItem = {
    id: string | null;
    type: string | null;         // نمونه: "audio" | "video" | "article" | ...
    title: string | null;        // تک‌زبانه
    description: string | null;  // تک‌زبانه
    fileKey: string | null;      // برای گرفتن فایل از CDN/Backend
    thumbnail: string | null;    // URL تصویر پیش‌نمایش
  }
  ```

  * منبع: `qrcodes.attrs.contents[]`
  * در attrs، `title` و `description` به صورت map چندزبانه هستند،
    API آن‌ها را به یک `string` بر اساس `language` تبدیل می‌کند.

* `comments: CommentItem[]`
  فقط اگر `includeComments=true`.

  ```ts
  type CommentItem = {
    id: string | null;
    author: string | null;
    text: string | null;
    date: string | null;    // نمایش تاریخ (مثلاً "۴ بهمن" یا "12 Rajab")
    rating: number | null;  // 1..5
  }
  ```

  * منبع: `qrcodes.attrs.comments[]`
  * فعلاً نظرات تک‌زبانه هستند (همان زبانی که نویسنده نوشته).

* `views: number`

  * تعداد بازدید / اسکن ثبت‌شده برای این QR.
  * منبع: `qrcodes.attrs.views` (در آینده می‌تواند از جدول لاگ‌ها محاسبه شود).

* `averageRating: number | null`

  * میانگین امتیاز (۱ تا ۵).
  * منبع: `qrcodes.attrs.averageRating` (در آینده از جدول نظرات قابل محاسبه است).

---

## رفتار خطا

* اگر QR با این `code` پیدا نشود یا `is_active = false` باشد:

```http
404 Not Found
```

```json
{ "message": "Location not found" }
```

---

## نحوهٔ استفاده در فرانت

### مثال TypeScript برای گرفتن داده

```ts
type About = {
  short: string | null;
  full: string | null;
};

type ContentItem = {
  id: string | null;
  type: string | null;
  title: string | null;
  description: string | null;
  fileKey: string | null;
  thumbnail: string | null;
};

type CommentItem = {
  id: string | null;
  author: string | null;
  text: string | null;
  date: string | null;
  rating: number | null;
};

type QrLocationResponse = {
  id: string;
  lang: string;
  title: string | null;
  location: string | null;
  images: string[];
  openingHours: string | null;
  about: About;
  contents: ContentItem[];
  comments: CommentItem[];
  views: number;
  averageRating: number | null;
};

async function loadQrLocation(
  code: string,
  language: string,
  includeContents = true,
  includeComments = false
): Promise<QrLocationResponse> {
  const params = new URLSearchParams({
    language,
    includeContents: String(includeContents),
    includeComments: String(includeComments),
  });

  const res = await fetch(`/api/qrcodes/${code}?` + params.toString());
  if (!res.ok) {
    throw new Error('Location not found');
  }
  return res.json();
}
```

### نمونه استفاده در React

```tsx
const [data, setData] = useState<QrLocationResponse | null>(null);

useEffect(() => {
  loadQrLocation('saqqakhaneh', currentLanguage, true, true)
    .then(setData)
    .catch(() => setData(null));
}, [currentLanguage]);

return data ? (
  <>
    <h1>{data.title}</h1>
    <p>{data.location}</p>
    <p>{data.about.short}</p>
    {/* گالری، لیست محتواها، نظرات، امتیاز و ... */}
  </>
) : (
  <div>یافت نشد</div>
);
```

---

اگر دوست داشته باشی، قدم بعدی می‌تونم همین کانتکست رو به انگلیسی هم برات تولید کنم تا مستقیم تو repo (مثلاً `docs/qr-location-api.md`) بذاری.
