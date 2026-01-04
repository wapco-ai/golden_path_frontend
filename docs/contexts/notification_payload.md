# Admin dashboard notification payload

The admin dashboard expects the notifications endpoint to return a **bare JSON array** (not wrapped in an object). Each item in the array should supply the fields below so the UI can render type-specific labels and dates correctly.

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
    "id": 101,
    "type": "new_user",
    "title": "ثبت‌نام جدید",
    "message": "زهرا رضایی ثبت‌نام کرد",
    "entityId": 101,
    "createdAt": "2026-01-04T13:53:03Z",
    "read": false
  },
  {
    "id": 102,
    "type": "support_message",
    "title": "پیام پشتیبانی",
    "message": "کاربر: گزارش مشکل پرداخت",
    "entityId": 3,
    "createdAt": "2026-01-01T14:35:29Z",
    "read": false
  },
  {
    "id": 103,
    "type": "new_comment",
    "title": "دیدگاه جدید",
    "message": "have good time",
    "entityId": 5,
    "createdAt": "2025-12-19T14:43:43Z",
    "read": true
  }
]
```

## Notes
- The endpoint should respond with the array directly, not wrapped in a `data` or `notifications` property; the front end treats any wrapper as empty content.
- Any additional fields are ignored by the UI but should not replace the required keys above.
