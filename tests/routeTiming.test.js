import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRouteDuration, routeSpanDuration } from '../src/utils/routeTiming.js';

const intl = { formatMessage: ({ id }) => ({ minutesUnit: 'دقیقه', secondsUnit: 'ثانیه' })[id] };

test('displays whole seconds without rounding or imposing a one-minute minimum', () => {
  assert.equal(formatRouteDuration(357 / 1.2, intl), '4 دقیقه 57 ثانیه');
  assert.equal(formatRouteDuration(59.999, intl), '59 ثانیه');
  assert.equal(formatRouteDuration(60, intl), '1 دقیقه');
  assert.equal(formatRouteDuration(0.999, intl), '0 ثانیه');
  assert.equal(formatRouteDuration(null, intl), '—');
});

test('uses elapsed server time to preserve the cost of timed sections', () => {
  assert.equal(routeSpanDuration({ fromStep: { elapsed_s: 11 }, step: { elapsed_s: 28.5 }, fromM: 0.1, toM: 0.2 }, 100), 17.5);
  assert.equal(routeSpanDuration({ fromStep: { elapsed_s: 2, end_elapsed_s: 9 }, step: { elapsed_s: 11 } }, 11), 2);
  assert.equal(routeSpanDuration({ fromM: 0.25, toM: 0.5 }, 105), 26.25);
  assert.equal(routeSpanDuration({ fromM: 0, toM: 1 }, null), null);
});
