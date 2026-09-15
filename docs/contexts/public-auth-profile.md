# GoldenPath - Public Auth & Profile APIs (After OTP)

## Base URL
`/api/v1`

## قرارداد نام کاربر

از این نسخه، `firstName` و `lastName` فیلدهای canonical پروفایل هستند و مرز آن‌ها باید همان چیزی باشد که کاربر در دو ورودی مستقل فرم وارد کرده است. هر دو فیلد می‌توانند شامل فاصله باشند؛ برای مثال `firstName = "محمد رضا"` و `lastName = "حسینی سادات"` معتبر است.

`fullName` برای نمایش و سازگاری با کلاینت‌های قدیمی حفظ می‌شود، اما نباید برای استخراج نام و نام خانوادگی split شود. برای رکوردهای قدیمی که فقط `fullName/name` دارند، API می‌تواند `firstName` و `lastName` را `null` برگرداند تا کاربر در اولین ویرایش آن‌ها را صریحاً مشخص کند.

شماره موبایل شناسه احراز هویت OTP است و از endpoint ویرایش پروفایل تغییر نمی‌کند. تغییر شماره موبایل باید در یک flow مستقل همراه با OTP انجام شود.

## Sequence پیشنهادی بعد از OTP

1. OTP تأیید می‌شود.
2. `POST /users` برای ایجاد/ثبت‌نام کاربر.
3. `GET /auth/me` برای دریافت کاربر و `profileCompleted`.
4. ویرایش پروفایل با `PATCH /users/me` یا `PUT /users/me/profile`.
5. refresh توکن با `POST /auth/refresh`.
6. خروج با `POST /auth/logout`.

## POST /users

### Request پیشنهادی برای کلاینت جدید

```json
{
  "phone": "09xxxxxxxxx",
  "firstName": "محمد رضا",
  "lastName": "حسینی",
  "fullName": "محمد رضا حسینی",
  "email": "user@example.com",
  "nationalId": "**********",
  "referralCode": "ABC123",
  "password": "strong-password"
}
```

`fullName` همچنان برای سازگاری با کلاینت‌های قدیمی پذیرفته می‌شود.

### Response (201)

```json
{
  "id": 10,
  "phone": "0912....",
  "username": null,
  "firstName": "محمد رضا",
  "lastName": "حسینی",
  "fullName": "محمد رضا حسینی",
  "email": "user@example.com",
  "nationalId": "**********",
  "gender": null,
  "birthDate": null,
  "address": {},
  "preferences": {},
  "avatarUrl": null,
  "profileCompleted": false,
  "roles": [],
  "level": null
}
```

### Errors

- 409 `PHONE_EXISTS`
- 409 `EMAIL_EXISTS`
- 400/422 validation error مطابق middleware/handler فعال پروژه

## GET /auth/me و GET /users/me

Header:

```text
Authorization: Bearer <accessToken>
```

هر دو endpoint ساختار عمومی User را برمی‌گردانند؛ پاسخ شامل `firstName`, `lastName`, `fullName`, `address`, `avatarUrl` و `profileCompleted` است.

## PATCH /users/me یا PUT /users/me/profile

Header:

```text
Authorization: Bearer <accessToken>
```

### Request

```json
{
  "firstName": "محمد رضا",
  "lastName": "حسینی سادات",
  "fullName": "محمد رضا حسینی سادات",
  "email": "user@example.com",
  "gender": "male",
  "birthDate": "2000-01-01",
  "nationalId": "**********",
  "address": {
    "province": "خراسان رضوی",
    "city": "مشهد",
    "postalCode": "##########",
    "line1": "..."
  },
  "preferences": {
    "language": "fa",
    "notifications": {
      "sms": true,
      "push": true,
      "email": false
    }
  }
}
```

در صورت وجود `firstName/lastName`، بک‌اند مقدار legacy `name/fullName` را از همین دو فیلد sync می‌کند. اگر یک کلاینت قدیمی فقط `fullName` بفرستد، فقط فیلد legacy به‌روزرسانی می‌شود و بک‌اند مرز نام/نام خانوادگی را حدس نمی‌زند.

## POST /files/avatar

Header:

```text
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

Form field:

```text
file=<image>
```

محدودیت فعلی: تصویر، حداکثر 2MB. فایل روی disk عمومی پروژه ذخیره می‌شود و پاسخ شامل URL قابل نمایش است:

```json
{
  "url": "/storage/avatars/..."
}
```

## DELETE /files/avatar

تصویر فعلی پروفایل را از رکورد کاربر و storage عمومی حذف می‌کند.

## POST /auth/refresh

### Request

```json
{
  "refreshToken": "..."
}
```

### Response (200)

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 1800,
  "user": {
    "...": "..."
  }
}
```

## POST /auth/logout

Header:

```text
Authorization: Bearer <accessToken>
```

Request:

```json
{
  "refreshToken": "..."
}
```

## نکات Session

- access کوتاه‌مدت: `JWT_PUBLIC_ACCESS_TTL`، پیش‌فرض 1800 ثانیه.
- refresh بلندمدت: `JWT_PUBLIC_REFRESH_TTL`، پیش‌فرض 30 روز.
- refresh token در `/auth/refresh` rotate می‌شود.
- logout refresh tokenهای معتبر مرتبط را revoke می‌کند.
