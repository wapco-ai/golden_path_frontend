import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/cultural-media.json', import.meta.url), 'utf8'));
const png = Buffer.from(fixture.png, 'base64');
const mp4 = Buffer.from(fixture.mp4, 'base64');
const media = [
  { type: 'image', mime: 'image/png', url: '/storage/cover.png', path: 'uploads/contents/7/images/cover.png', name: 'cover.png' },
  { type: 'video', mime: 'video/mp4', url: '/storage/film.mp4', path: 'uploads/contents/7/videos/film.mp4', name: 'film.mp4', title: 'فیلم فرهنگی', description: 'توضیح فیلم فرهنگی' },
  { type: 'audio', mime: 'audio/mpeg', url: '/storage/sound.mp3', path: 'uploads/contents/7/audio/sound.mp3', name: 'sound.mp3' },
  { type: 'file', mime: 'application/pdf', url: '/storage/guide.pdf', path: 'uploads/contents/7/files/guide.pdf', name: 'guide.pdf' }
];

async function setup(page, { mediaItems = media, primaryImage = '/storage/cover.png' } = {}) {
  const writes = [], uploads = [], deletes = [], errors = [], dialogs = [];
  let item = {
    poiId: 7, title: 'مکان فرهنگی آزمایشی', description: 'شرح مکان فرهنگی',
    titles: { fa: 'مکان فرهنگی آزمایشی', en: '', ar: '', ur: '' },
    descriptions: { fa: 'شرح مکان فرهنگی', en: '', ar: '', ur: '' },
    media: { fa: mediaItems, en: [], ar: [], ur: [] }, primaryImage,
    addressInShrine: 'صحن آزمایشی', grouping: { group_id: 1 },
    placeType: 'farhangi', showUserFeedbacks: true, showMediaGallery: true,
    location: { lng: 59.6134, lat: 36.2853, floor: 0 },
    time_restrictions: [], prayer_restrictions: [], createdAt: '2026-10-18T10:00:00Z'
  };
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
    localStorage.setItem('gp_admin_auth_store', JSON.stringify({ state: { admin: { name: 'مدیر آزمایشی' }, roles: ['super_dashboard_admin'], permissions: ['*'] }, version: 0 }));
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    let json = { data: [], total: 0 };
    if (path.endsWith('/admin/auth/me')) json = { user: { name: 'مدیر آزمایشی', roles: ['super_dashboard_admin'], permissions: ['*'] } };
    else if (path.endsWith('/floors')) json = [{ floor: 0, label: 'همکف' }];
    else if (path.endsWith('/categories')) json = { items: [{ id: 1, title: 'گروه آزمایشی', code: 'test' }], total: 1 };
    else if (path.endsWith('/groups/metadata')) json = { groups: [] };
    else if (path.endsWith('/groups/subgroups')) json = { subGroups: {} };
    else if (path.endsWith('/cultural-items') && request.method() === 'GET') json = { items: [{ ...item, media: item.media.fa }], totalItems: 1, page: 1, pageSize: 7 };
    else if (path.endsWith('/cultural-items/7') && request.method() === 'GET') json = item;
    else if (path.endsWith('/cultural-items/7') && request.method() === 'PUT') {
      const body = request.postDataJSON(); writes.push(body);
      item = { ...item, media: Object.fromEntries(Object.entries(body.translations).map(([lang, entry]) => [lang, entry.media])) };
      json = item;
    } else if (path.endsWith('/files') && request.method() === 'POST') {
      const multipart = request.postDataBuffer().toString('latin1'); uploads.push(multipart);
      const filename = multipart.match(/filename="([^"]+)"/)?.[1] || 'new.mp4';
      json = { path: `uploads/contents/7/videos/${filename}`, url: `/storage/${filename}`, mime: 'video/mp4', bucket: 'videos' };
    } else if (path.endsWith('/files') && request.method() === 'DELETE') {
      deletes.push(url.searchParams.get('path')); json = { success: true };
    } else if (path.endsWith('/landmark-places')) json = { places: { landmarkPlaces: [{
      id: '7', title: 'مکان فرهنگی آزمایشی', coordinates: [36.2853, 59.6134], floor: 0,
      image: primaryImage, content: { body: 'شرح مکان فرهنگی', media: mediaItems }
    }] } };
    await route.fulfill({ json });
  });
  await page.context().route('**/storage/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ status: 200, contentType: path.endsWith('.mp4') ? 'video/mp4' : path.endsWith('.png') ? 'image/png' : path.endsWith('.txt') ? 'text/plain' : 'application/octet-stream', body: path.endsWith('.mp4') ? mp4 : path.endsWith('.txt') ? 'Cultural guide' : png });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  return { writes, uploads, deletes, errors, dialogs };
}

async function openEdit(page) {
  await page.goto('/#/admin');
  await page.getByText('مدیریت امکانات', { exact: true }).click();
  await page.getByText('مدیریت اطلاعات فرهنگی', { exact: true }).click();
  await page.locator('.edit-cultural-btn').first().click();
  await expect(page.locator('.edit-cultural-page')).toBeVisible();
}

for (const width of [1440, 1920]) {
  test(`${width}px cultural editor keeps the image card and puts video beside audio and documents`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1080 });
    const { errors } = await setup(page); await openEdit(page);
    const videos = page.getByTestId('cultural-video-section-edit');
    await expect(videos).toBeVisible();
    await expect(page.locator('.edit-media-section video')).toHaveCount(0);
    await expect(page.locator('.edit-media-section img').first()).toHaveAttribute('src', /cover\.png$/);
    expect(await videos.evaluate(el => Boolean(el.closest('.edit-files-section')))).toBe(true);
    await expect(videos.locator('video')).toHaveCount(1);
    expect((await videos.locator('video').boundingBox()).height).toBeLessThanOrEqual(142);
    await expect(page.locator('.edit-media-section .cultural-upload-hint')).toContainText('۵');
    await expect(videos.locator('.cultural-upload-hint')).toContainText('MP4');
    const right = await page.locator('.edit-right-section').boundingBox();
    const left = await page.locator('.edit-left-section').boundingBox();
    expect(left.x + left.width).toBeLessThanOrEqual(right.x + 2);
    expect(await page.locator('.edit-files-section').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.locator('.edit-files-section').evaluate(el => getComputedStyle(el).borderRadius)).toBe('24px');
    await page.locator('.edit-files-section').screenshot({ path: testInfo.outputPath(`cultural-media-${width}.png`) });
    expect(errors).toEqual([]);
  });
}

test('saving an existing cultural item retains its video, audio, document and image without reuploading', async ({ page }) => {
  const { writes, uploads, errors } = await setup(page); await openEdit(page);
  await page.getByRole('button', { name: 'ثبت تغییرات', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  const saved = writes[0].translations.fa.media;
  expect(saved.map(file => file.path).sort()).toEqual(media.map(file => file.path).sort());
  expect(saved.find(file => file.type === 'video').title).toBe('فیلم فرهنگی');
  expect(writes[0].primaryImage).toMatch(/cover\.png$/);
  expect(uploads).toEqual([]); expect(errors).toEqual([]);
});

test('the separate video field uploads MP4 and preserves the existing image and videos', async ({ page }) => {
  const { writes, uploads, errors } = await setup(page); await openEdit(page);
  await page.getByTestId('cultural-video-input-edit').setInputFiles({ name: 'new.mp4', mimeType: 'video/mp4', buffer: mp4 });
  await page.getByPlaceholder('عنوان فایل را وارد کنید').fill('فیلم تازه');
  await page.getByPlaceholder('توضیحات فایل را وارد کنید').fill('شرح فیلم تازه');
  await page.getByRole('button', { name: 'ذخیره و آپلود فایل', exact: true }).click();
  await expect(page.getByTestId('cultural-video-section-edit').locator('video')).toHaveCount(2);
  await page.getByRole('button', { name: 'ثبت تغییرات', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(uploads).toHaveLength(1); expect(uploads[0]).toContain('filename="new.mp4"');
  expect(writes[0].translations.fa.media.filter(file => file.type === 'video')).toHaveLength(2);
  expect(writes[0].primaryImage).toMatch(/cover\.png$/); expect(errors).toEqual([]);
});

test('upload requirements reject a wrong video format and an oversized image before sending files', async ({ page }) => {
  const { uploads, dialogs, errors } = await setup(page); await openEdit(page);
  await page.getByTestId('cultural-video-input-edit').setInputFiles({ name: 'film.webm', mimeType: 'video/webm', buffer: mp4 });
  await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  expect(dialogs.at(-1)).toMatch(/MP4|فرمت/);
  await page.getByTestId('cultural-image-input-edit').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect.poll(() => dialogs.length).toBeGreaterThan(1);
  expect(dialogs.at(-1)).toMatch(/۵|5|حجم/);
  expect(uploads).toEqual([]); expect(errors).toEqual([]);
});

test('multiple selected videos are processed in order and all survive the final save', async ({ page }) => {
  const { writes, uploads, errors } = await setup(page); await openEdit(page);
  await page.getByTestId('cultural-video-input-edit').setInputFiles([
    { name: 'first.mp4', mimeType: 'video/mp4', buffer: mp4 },
    { name: 'second.mp4', mimeType: 'video/mp4', buffer: mp4 }
  ]);
  for (const title of ['فیلم نخست', 'فیلم دوم']) {
    await page.getByPlaceholder('عنوان فایل را وارد کنید').fill(title);
    await page.getByPlaceholder('توضیحات فایل را وارد کنید').fill(`توضیح ${title}`);
    await page.getByRole('button', { name: 'ذخیره و آپلود فایل', exact: true }).click();
  }
  await expect(page.getByTestId('cultural-video-section-edit').locator('video')).toHaveCount(3);
  await page.getByRole('button', { name: 'ثبت تغییرات', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(uploads).toHaveLength(2);
  const saved = writes[0].translations.fa.media.filter(file => file.type === 'video');
  expect(saved.map(file => file.title)).toEqual(['فیلم فرهنگی', 'فیلم نخست', 'فیلم دوم']);
  expect(errors).toEqual([]);
});

test('legacy path-only photos and multilingual video titles survive edit without duplicate attachments', async ({ page }) => {
  const oldMedia = [
    { type: 'image', mime: 'image/png', path: 'uploads/contents/7/images/cover.png' },
    { ...media[1], title: { fa: 'فیلم چندزبانه', en: 'Translated film' } }
  ];
  const { writes, errors } = await setup(page, { mediaItems: oldMedia, primaryImage: '/storage/uploads/contents/7/images/cover.png' });
  await openEdit(page);
  await expect(page.getByTestId('cultural-video-section-edit')).toContainText('فیلم چندزبانه');
  await expect(page.locator('.profile-images-grid-edit .profile-image-item-edit')).toHaveCount(1);
  await page.getByRole('button', { name: 'ثبت تغییرات', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].translations.fa.media).toHaveLength(2);
  expect(writes[0].translations.fa.media.find(file => file.type === 'video').title).toEqual(oldMedia[1].title);
  expect(errors).toEqual([]);
});

test('a newly selected primary photo is saved as the only primary and no video becomes primary', async ({ page }) => {
  const photos = [...media, { type: 'image', mime: 'image/png', url: '/storage/second.png', path: 'uploads/contents/7/images/second.png' }];
  const { writes, errors } = await setup(page, { mediaItems: photos }); await openEdit(page);
  const second = page.locator('.profile-image-item-edit').filter({ has: page.locator('img[src$="second.png"]') });
  await second.getByRole('button', { name: 'اصلی', exact: true }).click();
  await page.getByRole('button', { name: 'ثبت تغییرات', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  const primary = writes[0].translations.fa.media.filter(file => file.isPrimary);
  expect(primary).toHaveLength(1); expect(primary[0].path).toMatch(/second\.png$/);
  expect(writes[0].translations.fa.media.find(file => file.type === 'video').isPrimary).toBe(false);
  expect(errors).toEqual([]);
});

test('removing a stored video and canceling edit preserves its file and the unchanged item', async ({ page }) => {
  const { writes, deletes, errors } = await setup(page); await openEdit(page);
  await page.getByTestId('cultural-video-section-edit').getByRole('button').click();
  await expect(page.getByTestId('cultural-video-section-edit').locator('video')).toHaveCount(0);
  await page.locator('.cancel-edit-btn').click();
  await expect(page.locator('.edit-cultural-page')).toHaveCount(0);
  await page.locator('.edit-cultural-btn').first().click();
  await expect(page.getByTestId('cultural-video-section-edit').locator('video')).toHaveCount(1);
  expect(writes).toEqual([]); expect(deletes).toEqual([]); expect(errors).toEqual([]);
});

test('saving a removed video updates only media references and leaves a shared stored file intact', async ({ page }) => {
  const { writes, deletes, errors } = await setup(page); await openEdit(page);
  await page.getByTestId('cultural-video-section-edit').getByRole('button').click();
  await page.getByRole('button', { name: 'ثبت تغییرات', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].translations.fa.media.some(file => file.type === 'video')).toBe(false);
  expect(writes[0].translations.fa.media).toHaveLength(3);
  expect(deletes).toEqual([]); expect(errors).toEqual([]);
});

test('an audio file with generic browser MIME reaches the existing details modal', async ({ page }) => {
  const { dialogs, uploads, errors } = await setup(page); await openEdit(page);
  await page.locator('.edit-file-subsection input[accept^="audio/*"]').setInputFiles({ name: 'local.mp3', mimeType: 'application/octet-stream', buffer: Buffer.from('ID3') });
  await expect(page.getByPlaceholder('عنوان فایل را وارد کنید')).toHaveValue('local');
  expect(dialogs).toEqual([]); expect(uploads).toEqual([]); expect(errors).toEqual([]);
});

test('the create wizard exposes distinct image and video requirements in its existing final step', async ({ page }, testInfo) => {
  const { errors } = await setup(page);
  await page.goto('/#/admin');
  await page.getByText('مدیریت امکانات', { exact: true }).click();
  await page.getByText('مدیریت اطلاعات فرهنگی', { exact: true }).click();
  await page.getByRole('button', { name: 'ایجاد اطلاعات فرهنگی', exact: true }).click();
  await page.getByPlaceholder('عنوان اطلاعات فرهنگی را بنویسید').fill('مکان جدید');
  await page.locator('.cultural-type-option10').filter({ hasText: 'فرهنگی' }).click();
  await page.locator('.add-cultural-modal .step-circle').nth(3).click();
  await expect(page.getByTestId('cultural-video-section-create')).toBeVisible();
  await expect(page.getByTestId('cultural-image-input-create')).toHaveAttribute('accept', /png/);
  await expect(page.getByTestId('cultural-video-input-create')).toHaveAttribute('accept', /mp4/);
  await expect(page.getByTestId('cultural-video-section-create').locator('.cultural-upload-hint')).toContainText('۵۰');
  expect(await page.locator('.add-cultural-modal .modal-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.locator('.add-cultural-modal').screenshot({ path: testInfo.outputPath('cultural-create-upload.png') });
  expect(errors).toEqual([]);
});

test('public cultural media uses a direct video URL and never renders the film as a gallery image', async ({ page }) => {
  const { errors } = await setup(page);
  await page.goto('/#/location?id=7');
  await expect(page.locator('.content-list')).toBeVisible();
  await expect(page.locator('.carousel-slide img[src*=".mp4"]')).toHaveCount(0);
  await page.locator('.content-item').filter({ hasText: 'فیلم فرهنگی' }).locator('.video-thumbnail-link').click();
  await expect(page.locator('.video-player source')).toHaveAttribute('src', /\/storage\/film\.mp4$/);
  await expect(page.locator('.video-player source')).toHaveAttribute('type', 'video/mp4');
  expect(errors).toEqual([]);
});

test('a legacy bare base64 photo remains visible in the public gallery and the cultural editor', async ({ page }) => {
  const { errors } = await setup(page, { mediaItems: [fixture.png.replace(/=+$/, '')], primaryImage: null });
  await page.goto('/#/location?id=7');
  const photo = page.locator('.carousel-slide img').first();
  await expect(photo).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect.poll(() => photo.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await openEdit(page);
  await expect(page.locator('.profile-image-item-edit img').first()).toHaveAttribute('src', /^data:image\/png;base64,/);
  expect(errors).toEqual([]);
});

test('a document card opens its file with Enter and Space using the keyboard', async ({ page }) => {
  const document = { type: 'file', mime: 'text/plain', url: '/storage/guide.txt', title: 'راهنمای فرهنگی' };
  const { errors } = await setup(page, { mediaItems: [media[0], document] });
  await page.goto('/#/location?id=7');
  const card = page.getByRole('button', { name: 'راهنمای فرهنگی', exact: true });
  await expect(card).toHaveAttribute('tabindex', '0');
  for (const key of ['Enter', 'Space']) {
    await card.focus();
    const popupPromise = page.waitForEvent('popup');
    await card.press(key);
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/\/storage\/guide\.txt$/);
    await popup.close();
  }
  expect(errors).toEqual([]);
});
