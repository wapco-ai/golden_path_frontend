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
4. Use the status dropdown in the table row to update the feedback status.
5. Pagination buttons should fetch the next/previous pages.

Expected results:
- List loads with `status=new` by default.
- Status updates reflect immediately (optimistic update) and rollback on failure.
