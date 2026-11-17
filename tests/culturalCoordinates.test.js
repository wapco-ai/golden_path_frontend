import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordinate, parseCulturalCoordinates } from '../src/utils/culturalCoordinates.js';

test('coordinates accept Persian, Arabic and English decimals without rounding', () => {
  for (const value of ['36.291234567', '۳۶٫۲۹۱۲۳۴۵۶۷', '٣٦.٢٩١٢٣٤٥٦٧', '  +36.291234567  ']) {
    assert.equal(parseCoordinate(value, 90), 36.291234567);
  }
  assert.equal(parseCoordinate('−۵۹٫۶', 180), -59.6);
  assert.deepEqual(parseCulturalCoordinates({ lat: '۰', lng: '٠' }), { lat: 0, lng: 0 });
});

test('empty, partial, nondecimal and out-of-range coordinates cannot retain a location', () => {
  for (const value of ['', ' ', '-', '.', '+', '1e2', '36x', 'NaN', 'Infinity', '0x10', '36,29', '90.00001', '-90.00001']) {
    assert.equal(parseCoordinate(value, 90), null, value);
    assert.equal(parseCulturalCoordinates({ lat: value, lng: '59.6' }), null, value);
  }
  for (const value of ['180.00001', '-180.00001', '']) {
    assert.equal(parseCulturalCoordinates({ lat: '36.29', lng: value }), null);
  }
});

test('coordinate limits are inclusive and latitude and longitude keep their order', () => {
  assert.deepEqual(parseCulturalCoordinates({ lat: '-90', lng: '180' }), { lat: -90, lng: 180 });
  assert.deepEqual(parseCulturalCoordinates({ lat: '90', lng: '-180' }), { lat: 90, lng: -180 });
  assert.deepEqual(parseCulturalCoordinates({ lat: '36.29', lng: '59.61' }), { lat: 36.29, lng: 59.61 });
});
