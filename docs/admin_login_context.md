درخواست کاربر:
«در صفحه لاگین ادمین میخوام یوز رو اوتنتیکیت کنم.
بگو دقیقا چه سرویسی میخوای تا گروه بک برات آماده کنه؟»

پاسخ پیشنهادی برای سرویس‌ها:
- Endpoint اصلی: `POST /admin/auth/login`
  - Body: `{ "usernameOrEmail": "string", "password": "string" }`
  - پاسخ موفق: `{ "accessToken": "...", "refreshToken": "...", "expiresIn": 3600, "user": { "id": "...", "username": "...", "email": "...", "roles": ["ADMIN"], "permissions": [...] } }`
  - خطاها: `401` برای اعتبارسنجی اشتباه، `423` در صورت قفل شدن/غیرفعال بودن اکانت، `429` برای تلاش‌های زیاد.
- Endpoint ریفرش توکن: `POST /admin/auth/refresh`
  - Body: `{ "refreshToken": "..." }`
  - پاسخ: همان ساختار توکن جدید به‌همراه زمان انقضا.
- Endpoint خروج: `POST /admin/auth/logout`
  - Body: `{ "refreshToken": "..." }` (برای باطل کردن توکن‌های فعال)
  - پاسخ: status 204 یا پیام موفقیت ساده.
- Endpoint اعتبارسنجی توکن/پروفایل: `GET /admin/auth/me`
  - Header: `Authorization: Bearer <accessToken>`
  - پاسخ: اطلاعات کاربر و نقش/سطح دسترسی.

نیازمندی‌های امنیتی:
- استفاده از HTTPS، JWT با `aud`/`iss` مشخص، و مدت انقضای کوتاه برای access token (مثلاً 15–30 دقیقه) و بلندتر برای refresh token (مثلاً 7–30 روز).
- حساب ادمین باید حداقل فیلدهای `id`, `email/username`, `passwordHash`, `roles`, `permissions`, `status` (active/locked).
- امکان قفل کردن حساب پس از N تلاش ناموفق و لاگ فعالیت‌ها.
- CORS و SameSite برای کوکی‌ها اگر توکن را با کوکی HttpOnly می‌فرستید (ترجیح: کوکی HttpOnly + Secure + SameSite=Lax/Strict).

ولیدیشن و پاسخ‌ها:
- ولیدیشن سمت سرور روی فیلدها (طول/فرمت ایمیل، پیچیدگی رمز).
- پیام خطاهای قابل‌فهم برای فرانت (کد خطای قابل‌برنامه‌نویسی مثل `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `TOKEN_EXPIRED`).

گزینه‌های اختیاری:
- `POST /admin/auth/forgot-password` و `POST /admin/auth/reset-password` با توکن یک‌بارمصرف.
- MFA: `POST /admin/auth/login/mfa` یا پارامتر `otp` در لاگین.
- `GET /admin/auth/permissions` برای لیست نقش‌ها/دسترسی‌ها.
