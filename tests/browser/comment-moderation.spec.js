import { expect, test } from '@playwright/test';

test('admin sees the target name and approval makes the comment visible on that place', async ({ page }) => {
  const place = { id: '944', title: 'چایخانه رضوان', floor: 0 };
  const review = { id: '7', postId: 944, postTitle: place.title, content: 'دیدگاه آزمایشی', status: 'pending' };
  const admin = { name: 'مدیر آزمایشی', roles: ['super_dashboard_admin', 'manage_comments'], permissions: ['*'] };

  await page.addInitScript(account => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
    localStorage.setItem('gp_admin_auth_store', JSON.stringify({
      state: { admin: account, roles: account.roles, permissions: account.permissions }, version: 0
    }));
  }, admin);

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    switch (pathname) {
      case '/api/v1/admin/auth/me':
        return route.fulfill({ json: { user: admin } });
      case '/api/v1/admin/comments':
        return route.fulfill({ json: { data: [review], pagination: { totalPages: 1 } } });
      case '/api/v1/admin/comments/7':
        return route.fulfill({ json: review });
      case '/api/v1/admin/comments/7/status':
        expect(request.method()).toBe('PATCH');
        expect(request.postDataJSON()).toEqual({ status: 'approved' });
        review.status = 'approved';
        return route.fulfill({ json: { success: true } });
      case '/api/v1/floors':
        return route.fulfill({ json: [{ floor: 0, label: 'همکف' }] });
      case '/api/v1/landmark-places':
        return route.fulfill({ json: { places: { landmarkPlaces: [place] } } });
      case '/api/v1/feedbacks': {
        expect(searchParams.get('targetType')).toBe('poi');
        expect(searchParams.get('targetId')).toBe(place.id);
        expect(searchParams.get('lang')).toBe('fa');
        const approved = review.status === 'approved';
        const data = approved ? Array.from({ length: Number(searchParams.get('page')) === 1 ? 20 : 1 }, (_, index) => ({
          id: `${searchParams.get('page')}-${index}`,
          userName: index === 0 ? 'نویسندهٔ دیدگاه' : null,
          body: Number(searchParams.get('page')) === 2 ? 'دیدگاه صفحهٔ دوم' : `${review.content} ${index + 1}`,
          createdAt: '2026-11-11T06:30:00Z',
          rating: index === 0 ? 4 : null
        })) : [];
        return route.fulfill({ json: {
          summary: { ratingAvg: approved ? 4 : 0 },
          feedbacks: { data, pagination: { total: approved ? 21 : 0, lastPage: approved ? 2 : 1 } }
        } });
      }
      default:
        return route.fulfill({ json: { data: [] } });
    }
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: {
    version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }]
  } }));

  await page.goto('/#/location?id=944');
  await expect(page.locator('.comments-header')).toContainText('دیدگاه‌ها (۰)');
  await expect(page.locator('.comment-list-horizontal .comment-item')).toHaveCount(0);

  await page.goto('/?moderation-test#/admin');
  await page.getByText('گزارشات', { exact: true }).click();
  await page.getByText('دیدگاه ها', { exact: true }).click();
  const row = page.locator('#reviews-table tbody tr').filter({ hasText: review.content });
  await expect(row).toContainText('چایخانه رضوان (944)');
  await row.getByRole('button', { name: 'جزئیات بیشتر' }).click();
  const details = page.locator('.review-details-modal');
  await expect(details).toContainText('چایخانه رضوان (944)');
  await details.getByRole('button', { name: 'تایید و نمایش' }).click();
  await expect(row).toContainText('تایید شده');

  await page.goto('/#/location?id=944');
  await expect(page.locator('.comments-header')).toContainText('دیدگاه‌ها (۲۱)');
  await expect(page.locator('.comment-list-horizontal .comment-item').first())
    .toContainText('نویسندهٔ دیدگاه');
  await expect(page.locator('.comment-list-horizontal .comment-item').first()).toContainText('دیدگاه آزمایشی 1');
  await page.locator('.view-more-comments-container').click();
  await expect(page.locator('.all-comments-modal')).toContainText('دیدگاه صفحهٔ دوم');
});
