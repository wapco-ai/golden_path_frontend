# Admin Dashboard Data Service Requirements

Context for backend team to provide real data for the admin dashboard section titled "آمار و جزئیات کلی محصول مسیربایی حرم تا امروز" in `src/AdminPanel/Amain.jsx`.

## Overview of UI Data Needs
The dashboard currently renders static, hard-coded data for key statistics, charts, comment status, notifications, and the "latest registered users" table. Each dataset should be backed by an API so the UI can replace the mock data.

## Required Service Endpoints
Below are the suggested endpoints/payloads for each dashboard block. Field names reflect what the UI currently consumes.

### 1) Summary Cards (Top Stats)
- **Purpose:** Replace hard-coded totals for users, successful navigations, and cultural centers.
- **Endpoint:** `GET /api/v1/admin/dashboard/summary`
- **Response:**
  ```json
  {
    "totalUsers": 1456003,
    "successfulNavigations": 728105,
    "culturalCenters": 156,
    "lastUpdated": "2024-08-01T12:00:00Z"
  }
  ```
- **Notes:**
  - The UI only displays the three counts; `lastUpdated` is optional for future freshness indicators.

### 2) User Visits Chart (Bar Chart)
- **Purpose:** Populate the "آمار بازدید ... کاربران" bar chart with time-filtered counts.
- **Endpoint:** `GET /api/v1/admin/dashboard/user-visits?range=week|month|quarter|year`
- **Response:**
  ```json
  {
    "range": "week",
    "points": [
      { "label": "شنبه", "count": 175 },
      { "label": "یکشنبه", "count": 112 },
      { "label": "دوشنبه", "count": 213 },
      { "label": "سه شنبه", "count": 150 },
      { "label": "چهارشنبه", "count": 75 },
      { "label": "پنجشنبه", "count": 225 },
      { "label": "جمعه", "count": 125 }
    ],
    "maxYAxis": 250
  }
  ```
- **Notes:**
  - UI filters: `هفته اخیر`, `ماه اخیر`, `سه ماه اخیر`, `سال اخیر` mapped to `range` values `week`, `month`, `quarter`, `year`.
  - Provide `label` strings as shown in Farsi for x-axis; `count` feeds the bar height and tooltip.
  - Optional `maxYAxis` lets the server tune Y-axis scaling; if absent, the UI can derive max from counts.

### 3) Comment Status Pie (Total/Approved/Rejected)
- **Purpose:** Replace static totals for comments.
- **Endpoint:** `GET /api/v1/admin/dashboard/comment-stats?range=week|month|quarter|year`
- **Response:**
  ```json
  {
    "range": "week",
    "total": 152,
    "approved": 89,
    "rejected": 46
  }
  ```
- **Notes:**
  - UI also computes `unknown = total - approved - rejected`; ensure totals are consistent.

### 4) Notifications List
- **Endpoint:** `GET /api/v1/admin/dashboard/notifications?limit=10&unreadOnly=true&includeMeta=true`.
- The current response is `{ "items": [], "unreadCount": 0 }` when `includeMeta=true`; the default remains a bare array for compatibility.
- IDs are stable `new_user:ID`, `new_comment:ID` or `support_message:ID` strings, dates are UTC ISO 8601, and read state is stored separately for each authenticated admin.
- The badge uses the global unread count before the display limit. The existing popup displays unread groups and reloads each time it opens.
- `POST /api/v1/admin/dashboard/notifications/read` accepts explicit group IDs; `POST /api/v1/admin/dashboard/notifications/read-all` marks all records in one server statement snapshot. These operations never delete the underlying source records.
- See [notification_payload.md](notification_payload.md) for the implemented contract, read-all semantics and deployment dependency.

### 5) Latest Registered Users Table
- **Purpose:** Replace the mock user list and support search/pagination.
- **Endpoint:** `GET /api/v1/admin/dashboard/recent-users?search=&page=1&pageSize=10`
- **Response:**
  ```json
  {
    "data": [
      {
        "id": 1,
        "name": "کاربر نمونه",
        "email": "user@example.test",
        "mobile": "09120000001",
        "phone": "09120000001",
        "joinDate": "2026-10-18T12:00:00.000000Z",
        "birthDate": "1990-01-01",
        "gender": "male",
        "province": "فارس",
        "city": "شیراز",
        "lastLoginAt": "2026-10-18T10:00:00.000000Z",
        "successCount": 8,
        "savedRoutesCount": null,
        "placeVisitsCount": null
      }
    ],
    "pagination": { "page": 1, "pageSize": 10, "total": 120, "pages": 12 }
  }
  ```
- **Notes:**
  - Search and pagination use the server. `successCount` counts successful route requests for this user; malformed route metadata is ignored safely.
  - `joinDate` is the naive-UTC registration timestamp serialized as explicit UTC ISO, or null. `lastLoginAt` is the actual persisted login instant or null. Both display in Tehran time.
  - `birthDate` is the stored Gregorian calendar date or null. It displays as a Jalali date without browser-timezone shifts.
  - Province/city come from stored profile address strings; full address and security fields are excluded. The popup receives the actual row data, with no injected profile placeholders.
  - The server does not measure saved-route or confirmed place-visit totals, so both counts are null and use the existing missing-value display. Real zero values remain zero.
  - The current-page Excel action uses the same unmodified phone and real success count as the table. No schema migration is needed; deploy backend before frontend.

## Authentication
All endpoints should honor existing admin auth (Bearer token) used elsewhere under `/api/v1/admin`. No change to auth scheme is required.

## Minimal Frontend Changes Needed
Once these endpoints are available, the frontend can replace the hard-coded states in `Amain.jsx` with fetch calls and state updates for each block above.
