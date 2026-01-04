# Admin dashboard notification payload

The admin dashboard expects the notifications endpoint to return a **bare JSON array** (not wrapped in an object). Each item in
the array should supply the fields below so the UI can render type-specific labels and dates correctly.

## Required fields per notification
- `id` (preferred) or `entityId`: unique identifier for the notification. If `id` is absent, the UI falls back to `entityId`.
- `type`: one of `new_user`, `new_comment`, or `support_message`.
- `title`: short label for the notification type.
- `message`: descriptive text (e.g., user name or comment excerpt).
- `createdAt`: ISO 8601 timestamp parsable by JavaScript.
- `read`: boolean read/unread flag.

## Example response
```json
[
  {
    "id": 1000000011,
    "type": "new_user",
    "title": "ثبت‌نام جدید",
    "message": "رضا ریاضی ثبت‌نام کرد",
    "entityId": 11,
    "createdAt": "2026-01-02T09:57:47Z",
    "read": false
  },
  {
    "id": 3000000003,
    "type": "support_message",
    "title": "پیام پشتیبانی",
    "message": "کاربر: شسیب",
    "entityId": 3,
    "createdAt": "2026-01-01T14:35:29Z",
    "read": false
  },
  {
    "type": "new_comment",
    "title": "دیدگاه جدید",
    "message": "have good time",
    "entityId": 5,
    "createdAt": "2025-12-19 14:43:43",
    "read": false
  },
  {
    "id": 1000000005,
    "type": "new_user",
    "title": "ثبت‌نام جدید",
    "message": "Super Admin ثبت‌نام کرد",
    "entityId": 5,
    "createdAt": "2025-12-07T16:13:21Z",
    "read": false
  }
]
```

## Notes
- The endpoint should respond with the array directly, not wrapped in a `data` or `notifications` property; the front end treats
 any wrapper as empty content.
- Any additional fields are ignored by the UI but should not replace the required keys above.
- The UI normalizes timestamps that contain a space separator (e.g., `2025-12-19 14:43:43`) to ISO format automatically.
- If you must keep a response wrapper for other consumers, you can also nest the array under `data`; the front end now supports
 both shapes.

## Minimal payload
The dashboard only needs the fields above. If you return more data, it will be ignored by the current UI components.
```json
[
  {
    "id": 1,
    "type": "new_user",
    "title": "ثبت‌نام جدید",
    "message": "نام کاربر...",
    "entityId": 1,
    "createdAt": "2026-01-04T13:53:03Z",
    "read": false
  },
  {
    "id": 2,
    "type": "support_message",
    "title": "پیام پشتیبانی",
    "message": "کاربر: ...",
    "entityId": 3,
    "createdAt": "2026-01-01T14:35:29Z",
    "read": false
  }
]
```
