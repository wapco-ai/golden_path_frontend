# Support Feedback Flows (Frontend)

## Prerequisites
- Backend running and accessible via the configured `apiBaseUrl`.
- Admin access token available in local storage/session storage for admin endpoints.

## User Feedback (Support.jsx)
1. Open the Support page and fill in the **subject** and **message** fields.
2. Click **Send**.
3. Expected results:
   - Button shows loading state.
   - Success toast appears and the fields are cleared.
   - If the server returns validation errors, an error toast is shown.
   - If the server is unreachable, a network error toast is shown.

Example request:
```bash
curl -X POST "http://localhost:8080/api/v1/support/feedback" \
  -H "Content-Type: application/json" \
  -d '{"subject":"مشکل نقشه","message":"در حالت ویرایش لایه صفحه سریع ریفرش می‌شود."}'
```

## Admin Feedbacks
1. Go to the admin Feedbacks screen.
2. Use the status filter and search input to refine the list.
3. Click **جزئیات بیشتر** to view a feedback message.
4. Opening a new feedback marks it as seen; the existing status filter can show new or read messages.
5. Pagination buttons should fetch the next/previous pages.
6. In the details footer, click **حذف بازخورد** and confirm the deletion. Cancel leaves the message in place.

Expected results:
- List loads with all statuses by default.
- Status updates reflect immediately (optimistic update) and rollback on failure.
- Delete is available only inside the existing details modal. While deletion is pending, repeated deletion and closing the modal are disabled.
- A failed deletion keeps the message and details available for retry. A missing message (404) is treated as already removed.
- Successful deletion reloads the current search and status filter. An emptied last page moves to the last remaining page; an empty inbox stays on page 1.

## Admin deletion API

`DELETE /api/v1/admin/support-feedbacks/{id}` requires the existing active-admin JWT session. It physically removes only that record from `support_feedbacks`; it does not delete users or the separate `user_feedbacks` comments/ratings.

Success returns HTTP 200 with `{ "success": true, "id": 123, "message": "بازخورد حذف شد." }`. A missing or invalid identifier returns 404. The list's existing `user.phone` response key is populated from `users.mobile`.

Deploy the matching backend before the frontend build. No database migration or image rebuild is required for the backend bind mount; after pulling, clear Laravel caches with `docker compose exec -T app php artisan optimize:clear`. Rollback can revert the application code without a schema rollback. Deleted messages are not restored by a code rollback.
