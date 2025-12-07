# 📄 **admin_auth_frontend_context.md**

## **Admin Authentication – Frontend Integration Guide**

(Full SPA Context – Login, Refresh, Session Handling)

---

# 1) Overview

سیستم احراز هویت ادمین از **JWT Access Token** + **Database-stored Refresh Token** استفاده می‌کند.

الگوی کلی:

* `POST /login` → دریافت access/refresh token
* `accessToken` کوتاه‌مدت (۳۰ دقیقه)
* `refreshToken` بلندمدت (۳۰ روز)
* هنگام 401 → تلاش برای refresh
* هنگام failure در refresh → Logout

---

# 2) API Endpoints

Base Path:

```
/api/v1/admin/auth
```

Endpoints:

| Method | Path       | Description                   |
| ------ | ---------- | ----------------------------- |
| POST   | `/login`   | ورود ادمین و گرفتن توکن‌ها    |
| POST   | `/refresh` | گرفتن accessToken جدید        |
| GET    | `/me`      | دریافت پروفایل ادمین فعلی     |
| POST   | `/logout`  | خروج و باطل کردن refreshToken |

---

# 3) **Login API**

## **POST /api/v1/admin/auth/login**

### **Request**

```json
{
  "usernameOrEmail": "admin@example.com",
  "password": "Password123!"
}
```

### **Response 200**

```json
{
  "accessToken": "JWT_ACCESS_TOKEN",
  "refreshToken": "RANDOM_REFRESH_TOKEN",
  "expiresIn": 1800,
  "user": {
    "id": 1,
    "username": "admin",
    "name": "Super Admin",
    "email": "admin@example.com",
    "roles": ["ADMIN"]
  }
}
```

### **Common Errors**

```json
{ "error": "INVALID_CREDENTIALS", "message": "نام کاربری یا رمز عبور اشتباه است." }

{ "error": "ACCOUNT_LOCKED", "message": "حساب کاربری قفل یا غیرفعال است." }

{ "error": "UNAUTHORIZED", "message": "این کاربر دسترسی ادمین ندارد." }
```

---

# 4) **Current Admin Profile**

## **GET /api/v1/admin/auth/me**

### **Headers**

```
Authorization: Bearer <accessToken>
```

### **Response 200**

```json
{
  "id": 1,
  "username": "admin",
  "name": "Super Admin",
  "email": "admin@example.com",
  "roles": ["ADMIN"],
  "status": "active",
  "lastLoginAt": "2025-12-07T10:12:00Z",
  "lastLoginIp": "10.0.0.1"
}
```

### **401 Errors**

* `TOKEN_INVALID`
* `UNAUTHORIZED`

---

# 5) **Refresh Token API**

## **POST /api/v1/admin/auth/refresh**

### **Request**

```json
{
  "refreshToken": "RANDOM_REFRESH_TOKEN"
}
```

### **Response 200**

```json
{
  "accessToken": "NEW_JWT_ACCESS_TOKEN",
  "refreshToken": "NEW_RANDOM_REFRESH_TOKEN",
  "expiresIn": 1800
}
```

### **Errors**

```json
{ "error": "TOKEN_INVALID", "message": "Refresh token نامعتبر یا منقضی است." }

{ "error": "ACCOUNT_LOCKED", "message": "حساب کاربری قفل یا غیرفعال است." }
```

---

# 6) **Logout API**

## **POST /api/v1/admin/auth/logout**

### **Headers**

```
Authorization: Bearer <accessToken>
```

### **Request**

```json
{
  "refreshToken": "RANDOM_REFRESH_TOKEN"
}
```

### **Response**

```json
{ "message": "LOGOUT_SUCCESS" }
```

---

# 7) **Token Storage Strategy (SPA)**

| Token Type   | Storage          | Reason                          |
| ------------ | ---------------- | ------------------------------- |
| accessToken  | `sessionStorage` | حذف با بسته شدن تب، امنیت بیشتر |
| refreshToken | `localStorage`   | نگهداری سشن بین رفرش صفحه       |

Storage keys:

```
gp_admin_access
gp_admin_refresh
```

---

# 8) **Bootstrap Logic (Initial Load)**

### **Pseudo-code**

```ts
async function bootstrapAuth() {
  const refreshToken = localStorage.getItem('gp_admin_refresh');
  if (!refreshToken) return guestMode();

  try {
    const refreshRes = await fetch('/api/v1/admin/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!refreshRes.ok) throw await refreshRes.json();

    const tokens = await refreshRes.json();
    sessionStorage.setItem('gp_admin_access', tokens.accessToken);
    localStorage.setItem('gp_admin_refresh', tokens.refreshToken);

    const meRes = await fetch('/api/v1/admin/auth/me', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` }
    });

    const me = await meRes.json();

    authState.user = me;
    authState.isAuthenticated = true;

  } catch (e) {
    logoutAndClear();
  }
}
```

---

# 9) **Login Flow (Frontend)**

```ts
async function login(usernameOrEmail, password) {
  const res = await fetch('/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail, password })
  });

  const data = await res.json();

  if (!res.ok) throw data;

  sessionStorage.setItem('gp_admin_access', data.accessToken);
  localStorage.setItem('gp_admin_refresh', data.refreshToken);

  authState.user = data.user;
  authState.isAuthenticated = true;

  navigate('/admin/dashboard');
}
```

---

# 10) **Logout Flow**

```ts
async function logout() {
  try {
    const refresh = localStorage.getItem('gp_admin_refresh');
    const access = sessionStorage.getItem('gp_admin_access');

    await fetch('/api/v1/admin/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access || ''}`
      },
      body: JSON.stringify({ refreshToken: refresh })
    });
  } catch {}

  logoutAndClear();
}
```

---

# 11) **Axios Interceptor (Recommended)**

### **1) Attach Token**

```ts
axios.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('gp_admin_access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

---

### **2) Auto-refresh on 401**

```ts
axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const refreshToken = localStorage.getItem('gp_admin_refresh');
      if (!refreshToken) return logoutAndClear();

      try {
        const { data } = await axios.post('/api/v1/admin/auth/refresh', { refreshToken });

        sessionStorage.setItem('gp_admin_access', data.accessToken);
        localStorage.setItem('gp_admin_refresh', data.refreshToken);

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return axios(original);

      } catch {
        return logoutAndClear();
      }
    }

    return Promise.reject(error);
  }
);
```

---

# 12) **Helper: logoutAndClear()**

```ts
function logoutAndClear() {
  sessionStorage.removeItem('gp_admin_access');
  localStorage.removeItem('gp_admin_refresh');

  authState.user = null;
  authState.isAuthenticated = false;

  navigate('/admin/login');
}
```

---

# 13) UI Expected Behaviors

## **Login Page**

* نمایش خطای:

  * `INVALID_CREDENTIALS`
  * `ACCOUNT_LOCKED`
  * `UNAUTHORIZED`
* پس از موفقیت → انتقال به `/admin/dashboard`

## **Protected Pages**

* هنگام `401` → تلاش برای refresh
* اگر refresh موفق نبود → logout → انتقال به `/admin/login`

## **Header/Sidebar**

* نمایش نام ادمین (`user.name`)
* نمایش نقش‌ها (`user.roles`)

---

# 14) Summary for Frontend Team

1. **accessToken → sessionStorage**
2. **refreshToken → localStorage**
3. همهٔ درخواست‌های ادمین باید header زیر را داشته باشند:
   `Authorization: Bearer <accessToken>`
4. روی 401:

   * یک بار تلاش برای refresh
   * در صورت failure → logout
5. در لود اولیه app:

   * اگر refreshToken وجود دارد → تلاش برای refresh
   * سپس fetch `/me`
