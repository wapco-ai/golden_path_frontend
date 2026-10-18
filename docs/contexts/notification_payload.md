# Admin dashboard notifications

`GET /api/v1/admin/dashboard/notifications` retains its bare-array response by default. The current admin popup sends `limit=10&unreadOnly=true&includeMeta=true` and receives:

```json
{
  "items": [
    {
      "id": "new_comment:5",
      "type": "new_comment",
      "entityId": 5,
      "title": "دیدگاه جدید",
      "message": "متن دیدگاه",
      "createdAt": "2026-10-18T12:00:00Z",
      "read": false
    }
  ],
  "unreadCount": 24
}
```

The badge uses the global `unreadCount`, which can exceed the 10 fetched items. Unread filtering and chronological sorting happen before the display limit. IDs use `new_user`, `new_comment` or `support_message` followed by a colon and the source ID; they stay stable as the notification moves between date groups. Dates use UTC ISO 8601; calendar grouping uses Tehran time. Missing/invalid dates are not replaced with the current time.

The existing badge caps its visible label at `99+` while its title and accessible
name retain the exact global count. Periods and older days are chronological;
within each period/day, cards retain the existing comment–feedback–user order.

Clicking a group submits only its displayed IDs to `POST /api/v1/admin/dashboard/notifications/read`, with body `{ "ids": ["new_comment:5"] }`. The existing **خواندن همه** button calls `POST /api/v1/admin/dashboard/notifications/read-all` for all existing notifications, including old records and those beyond the fetched page. Both operations return `{ "success": true, "unreadCount": 0 }` with the current count (which can remain nonzero if new events arrive).

Read state belongs to the authenticated admin and persists on the server across reloads and sessions. No source user, comment or support feedback is deleted or modified by acknowledging a notification. Failures retain unread items and show the existing error toast; a successful read refreshes unread items without replaying an older response.

The list refreshes on initial load, every popup opening and after a successful read. The popup keeps the existing labels and layout, shows only unread cards, and exposes the existing read-all action for any unread age. Exact current-time and period boundaries do not hide an item from the list.

In the installed PWA, this GET uses `NetworkOnly` before the generic API cache
rule. Offline failures cannot replay cached pre-read data or another admin's
receipt state; the last confirmed in-memory state remains until a retry succeeds.
After building and installing Playwright Chromium, `npm run test:pwa-cache`
verifies this policy with the generated production worker and seeded old caches.

Deploy the backend companion and its targeted `2026_10_18_230000_create_admin_notification_reads.php` migration before deploying the frontend. See backend `docs/admin-notifications.md` for deployment and rollback.
