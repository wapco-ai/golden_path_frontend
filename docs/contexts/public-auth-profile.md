## مستندات کوتاه برای فرانت (Markdown)

### `docs/public-auth-profile.md`

````md
# GoldenPath - Public Auth & Profile APIs (After OTP)

## Base URL
`/api/v1`

---

## Sequence پیشنهادی بعد از OTP
1) (OTP قبلاً انجام شده و موبایل verified است)
2) `POST /users`  → ایجاد/ثبت‌نام کاربر
3) `GET /auth/me` → تشخیص اینکه پروفایل کامل است یا نه (profileCompleted)
4) اگر کامل نیست: `PATCH /users/me` یا `PUT /users/me/profile`
5) در طول کار: refresh توکن با `POST /auth/refresh`
6) خروج: `POST /auth/logout`

---

## 1) POST /users
ایجاد کاربر بعد از OTP

### Request
```json
{
  "phone": "09xxxxxxxxx",
  "fullName": "نام و نام خانوادگی",
  "email": "user@example.com",
  "nationalId": "**********",
  "referralCode": "ABC123",
  "password": "strong-password"
}
````

### Response (201)

```json
{
  "id": 10,
  "phone": "0912....",
  "fullName": "....",
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

* 409 `PHONE_EXISTS`
* 409 `EMAIL_EXISTS`
* 400 `VALIDATION_ERROR` (laravel validation)

---

## 2) GET /auth/me

Header: `Authorization: Bearer <accessToken>`

### Response (200)

```json
{
  "id": 10,
  "phone": "0912....",
  "fullName": "....",
  "email": "user@example.com",
  "profileCompleted": false,
  "roles": [],
  "level": null
}
```

---

## 3) PATCH /users/me  (or PUT /users/me/profile)

Header: `Authorization: Bearer <accessToken>`

### Request

```json
{
  "fullName": "نام و نام خانوادگی",
  "email": "user@example.com",
  "gender": "male",
  "birthDate": "2000-01-01",
  "nationalId": "**********",
  "address": {
    "province": "تهران",
    "city": "تهران",
    "postalCode": "##########",
    "line1": "..."
  },
  "preferences": {
    "language": "fa",
    "notifications": { "sms": true, "push": true, "email": false }
  },
  "avatarUrl": "https://..."
}
```

### Response (200)

همان ساختار User + `profileCompleted: true/false`

### Errors

* 401 `UNAUTHORIZED`
* 409 `EMAIL_EXISTS`
* 400 `VALIDATION_ERROR`

---

## 4) POST /auth/refresh

### Request

```json
{ "refreshToken": "..." }
```

### Response (200)

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 1800,
  "user": { "...": "..." }
}
```

### Errors

* 401 `INVALID_TOKEN`
* 401 `TOKEN_EXPIRED` (در عمل همان invalid/expired)

---

## 5) POST /auth/logout

Header: `Authorization: Bearer <accessToken>`

### Request

```json
{ "refreshToken": "..." }
```

### Response (204)

بدون body (یا پیام کوتاه)

---

## Error Format

```json
{
  "message": "....",
  "code": "PHONE_EXISTS",
  "errors": {}
}
```

```

---

## 7) نکات امنیتی/Session (طبق نیازمندی شما)
- access کوتاه‌مدت: `JWT_PUBLIC_ACCESS_TTL` (پیش‌فرض 1800 ثانیه)
- refresh بلندمدت: `JWT_PUBLIC_REFRESH_TTL` (پیش‌فرض 30 روز)
- Rotation روی refresh: در `/auth/refresh` توکن قبلی revoke و توکن جدید صادر می‌شود (مثل ادمین).
- logout: همه refresh tokenهای فعال همان user revoke می‌شوند (مرتبط با همان نشست/توکن).
