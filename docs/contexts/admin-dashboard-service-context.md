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
- **Purpose:** Replace hard-coded notification cards and support the in-UI actions (badge count, mark-as-read, delete).
- **Endpoint (list):** `GET /api/v1/admin/dashboard/notifications?limit=10&unreadOnly=false`
- **Response:**
  ```json
  {
    "items": [
      {
        "id": 1,
        "title": "دیدگاه جدید",
        "message": "کاربر \"سیدمحمدحسین میرشفیعی\" دیدگاه جدیدی ثبت کرده است",
        "time": "2024-09-01T09:20:00Z",
        "type": "comment",
        "read": false
      }
    ],
    "unreadCount": 3
  }
  ```
- **Notes:**
  - `type` currently used values: `comment`, `user`, `feedback`.
  - Provide `unreadCount` for badge support; the UI currently derives it from items but can display a server value.
  - `time` should be an ISO date; the UI shows relative strings (e.g., "۱۰ دقیقه پیش") and can format the ISO value.
  - The popup supports three actions that should be wired to backend endpoints:
    - **Mark all as read:** `POST /api/v1/admin/dashboard/notifications/read-all`
    - **Mark one as read:** `PATCH /api/v1/admin/dashboard/notifications/{id}/read`
    - **Delete one notification:** `DELETE /api/v1/admin/dashboard/notifications/{id}`

### 5) Latest Registered Users Table
- **Purpose:** Replace the mock user list and support search/pagination.
- **Endpoint:** `GET /api/v1/admin/dashboard/recent-users?search=&page=1&pageSize=10`
- **Response:**
  ```json
  {
    "items": [
      {
        "id": 1,
        "fullName": "سیدمحمدحسین میرشفیعی",
        "phone": "+98 9193937869",
        "registerDate": "2024-08-08",
        "gender": "male",
        "successCount": 8
      }
    ],
    "page": 1,
    "pageSize": 10,
    "total": 120
  }
  ```
- **Notes:**
  - UI search box filters by `fullName` client-side; backend should support `search` to avoid returning large datasets.
  - `successCount` represents completed/successful navigations per user (displayed as "X بار").
  - `registerDate` can be ISO; frontend handles formatting to Jalaali.

## Authentication
All endpoints should honor existing admin auth (Bearer token) used elsewhere under `/api/v1/admin`. No change to auth scheme is required.

## Minimal Frontend Changes Needed
Once these endpoints are available, the frontend can replace the hard-coded states in `Amain.jsx` with fetch calls and state updates for each block above.
