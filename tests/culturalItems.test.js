import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCulturalItem } from '../src/services/culturalItemMapper.js';
import { formatCulturalCreatedAt } from '../src/utils/culturalItemDate.js';
import { convertLngLatToUtm32640 } from '../src/utils/utm.js';

test('real API responses retain geographic precision when UTM coordinates are also present', () => {
  const point = { lat: 36.29081234, lng: 59.61612345 };
  const item = normalizeCulturalItem({ location: { ...convertLngLatToUtm32640(point), ...point, floor: -1 } });
  assert.deepEqual(item.location, { ...point, floor: -1 });
  assert.deepEqual(normalizeCulturalItem({ location: { lat: 0, lng: 0, x: 500000, y: 4000000, floor: 0 } }).location,
    { lat: 0, lng: 0, floor: 0 });
});

test('legacy cultural locations still convert UTM when a complete valid geographic pair is absent', () => {
  const utm = convertLngLatToUtm32640({ lat: 36.290812, lng: 59.616123 });
  for (const point of [{}, { lat: 36.29 }, { lat: null, lng: null }, { lat: 91, lng: 59.61 }]) {
    const item = normalizeCulturalItem({ location: { ...utm, ...point, floor: 0 } });
    assert.deepEqual(item.location, { lat: 36.290812, lng: 59.616123, floor: 0 });
  }
});

test('normalizes creation dates from the list and detail API without inventing missing dates', () => {
  const createdAt = '2026-10-18T14:43:24Z';

  assert.equal(normalizeCulturalItem({ id: 7, createdAt }).createdAt, createdAt);
  assert.equal(normalizeCulturalItem({ poi_id: 7, created_at: createdAt }).createdAt, createdAt);
  assert.equal(normalizeCulturalItem({ id: 7 }).createdAt, null);
  assert.equal(normalizeCulturalItem({ id: 7, createdAt: null }).createdAt, null);
  assert.equal(normalizeCulturalItem({ id: 7, createdAt: null, created_at: createdAt }).createdAt, null);
});

test('keeps the canonical date when both response field names exist', () => {
  const createdAt = '2026-10-18T14:43:24Z';
  const item = normalizeCulturalItem({ createdAt, created_at: '2026-10-19T14:43:24Z' });
  assert.equal(item.createdAt, createdAt);
});

test('date mapping preserves existing identifiers, content, location and media', () => {
  const item = normalizeCulturalItem({
    poi_id: 7,
    titles: { fa: 'عنوان' },
    descriptions: { fa: 'توضیحات' },
    location: { lng: 59.616, lat: 36.288, floor: 0 },
    primary_image: '/storage/cultural/item.jpg',
    created_at: '2026-10-18T14:43:24Z'
  });

  assert.equal(item.id, 7);
  assert.equal(item.poiId, 7);
  assert.equal(item.title, 'عنوان');
  assert.equal(item.description, 'توضیحات');
  assert.equal(item.primaryImage, '/storage/cultural/item.jpg');
  assert.deepEqual(item.location, { lng: 59.616, lat: 36.288, floor: 0 });
});

test('formats API timestamps as a Persian calendar date in Tehran', () => {
  assert.equal(formatCulturalCreatedAt('2026-10-18T00:00:00Z'), '۱۴۰۵/۰۷/۲۶');
  assert.equal(formatCulturalCreatedAt('2026-10-18T14:43:24Z'), '۱۴۰۵/۰۷/۲۶');
  assert.equal(formatCulturalCreatedAt('2026-10-18T18:13:24+03:30'), '۱۴۰۵/۰۷/۲۶');
});

test('uses the Tehran calendar day across UTC midnight and the Persian new year', () => {
  assert.equal(formatCulturalCreatedAt('2026-10-18T20:29:59Z'), '۱۴۰۵/۰۷/۲۶');
  assert.equal(formatCulturalCreatedAt('2026-10-18T20:30:00Z'), '۱۴۰۵/۰۷/۲۷');
  assert.equal(formatCulturalCreatedAt('2026-10-18T23:59:59Z'), '۱۴۰۵/۰۷/۲۷');
  assert.equal(formatCulturalCreatedAt('2026-10-19T00:00:00Z'), '۱۴۰۵/۰۷/۲۷');
  assert.equal(formatCulturalCreatedAt('2026-03-20T20:30:00Z'), '۱۴۰۵/۰۱/۰۱');
});

test('shows the existing placeholder for empty or invalid creation dates', () => {
  for (const value of [undefined, null, '', ' ', 'invalid', '2026-99-99T00:00:00Z', 0, false, {}]) {
    assert.equal(formatCulturalCreatedAt(value), '-', String(value));
  }
});
