import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createIntl } from 'react-intl';
import {
  buildRouteMSegments,
  getLineDistanceMeters,
  normalizeRouteMSteps,
  sliceLineByFraction
} from '../src/utils/routeSegments.js';
import { withDoorStepInstructions } from '../src/utils/routeStepInstructions.js';
import { formatRouteDuration } from '../src/utils/routeDuration.js';
import { getNavigationProgress } from '../src/utils/rngNavigation.js';
import { finalStepDistanceMeters, liveStepInstruction, rngMessages } from '../src/utils/rngMessages.js';

const coordinates = [[59.615, 36.287], [59.6151, 36.287], [59.6151, 36.2872]];
const steps = [
  { type: 'stepStart', routeM: 0, floor: 0, segmentId: 0 },
  { type: 'stepPassDoor', routeM: 0.4, doorId: 7, floor: 0, segmentId: 0 },
  { type: 'stepArriveDestination', floor: 0, segmentId: 0 }
];

test('server durations use seconds below one minute, including zero and the rounding boundary', () => {
  const intl = createIntl({ locale: 'en', messages: { secondsUnit: 'sec', minutesUnit: 'min' } });
  assert.equal(formatRouteDuration(0, intl, String), '0 sec');
  assert.equal(formatRouteDuration(59.7, intl, String), '60 sec');
  assert.equal(formatRouteDuration(60, intl, String), '1 min');
  assert.equal(formatRouteDuration(89.7, intl, String), '1 min 30 sec');
  assert.equal(formatRouteDuration(null, intl, String), '—');
});

test('same-floor stair guidance continues through its exit and advances without floor confirmation', () => {
  const line = [[59.615, 36.287], [59.6152, 36.287]];
  const stair = {
    type: 'stepUseStairs', floor: -1, routeM: 0.3, endRouteM: 0.6, stairDirection: 'up',
    instruction: 'از پله‌ها بالا بروید.', elapsed_s: 2, end_elapsed_s: 9, duration_s: 7, span_duration_s: 9
  };
  const arrival = { ...steps[2], floor: -1, elapsed_s: 11 };
  const segments = buildRouteMSegments([{ ...steps[0], floor: -1, elapsed_s: 0, duration_s: 2 }, stair, arrival], line);
  assert.deepEqual(segments.map(s => [s.type, s.fromM, s.toM]), [
    ['stepUseStairs', 0, 0.6], ['stepArriveDestination', 0.6, 1]
  ]);
  assert.deepEqual(segments.map(s => s.durationSeconds), [9, 2]);
  assert.equal(segments[0].step.instruction, stair.instruction);
  assert.equal(segments[0].step.routeM, 0.3);

  const displayed = segments.map(s => ({ ...s, routeStep: s.step }));
  assert.equal(getNavigationProgress({ lng: 59.61506, lat: 36.287 }, displayed, 0, line).nextStep, 0);
  assert.equal(getNavigationProgress({ lng: 59.61512, lat: 36.287 }, displayed, 0, line).nextStep, 1);
});

test('door instructions use the next named area and keep the original route events', () => {
  const messages = JSON.parse(readFileSync(new URL('../src/locales/fa.json', import.meta.url), 'utf8'));
  const intl = createIntl({ locale: 'fa', messages });
  const door = {
    ...steps[1], doorId: 2000909, name: 'عبور از درب 2000909',
    toAreaName: 'راهرو غربی بین صحن پیامبر اعظم و قدس',
    instruction: 'از عبور از درب 2000909 عبور کنید و به راهرو غربی بین صحن پیامبر اعظم و قدس بروید'
  };
  const arrival = { ...steps[2], instruction: 'به نزدیک‌ترین نقطهٔ قابل‌دسترسی رسیدید.' };
  const display = withDoorStepInstructions([steps[0], door, arrival], intl);
  assert.deepEqual(display[1], { ...door, instruction: 'وارد راهروی غربی بین صحن پیامبر اعظم و قدس شوید.' });
  assert.equal(display[0], steps[0]);
  assert.equal(display[2], arrival);
  assert.match(door.instruction, /2000909/);

  const [named, unknown, sameArea] = withDoorStepInstructions([
    { ...door, name: 'عبور از اتصال باب‌الرضا', toAreaName: 'صحن جامع رضوی' },
    { ...door, name: 'درب ۲۰۰۰۹۰۹', toAreaName: 'area 123' },
    { ...door, fromAreaId: 1, toAreaId: 1 }
  ], intl);
  assert.equal(named.instruction, 'از باب‌الرضا به صحن جامع رضوی بروید.');
  assert.equal(unknown.instruction, 'مسیر را ادامه دهید.');
  assert.equal(sameArea.instruction, 'در راهروی غربی بین صحن پیامبر اعظم و قدس ادامه دهید.');
});

test('repeat steps in the same area are removed only on straight stretches', () => {
  const messages = JSON.parse(readFileSync(new URL('../src/locales/fa.json', import.meta.url), 'utf8'));
  const intl = createIntl({ locale: 'fa', messages });
  const line = [[59.61, 36.28], [59.611, 36.28], [59.611, 36.281]];
  const geo = { geometry: { type: 'LineString', coordinates: line } };
  const corner = getLineDistanceMeters(line.slice(0, 2)) / getLineDistanceMeters(line);
  const door = { ...steps[1], fromAreaId: 10, toAreaId: 11, toAreaName: 'صحن پیامبر اعظم' };
  const inside = { ...door, fromAreaId: 11 };
  const arrival = { ...steps[2], routeM: 1, instruction: 'به نزدیکی مقصد رسیدید.' };
  const input = [steps[0], { ...door, routeM: 0.1 }, { ...inside, toAreaId: 12, routeM: 0.2 },
    { ...inside, fromAreaId: 12, routeM: corner }, { ...inside, routeM: 0.65 },
    { ...inside, routeM: 0.7, landmark: 'آبنما' }, arrival];
  const before = structuredClone(input);
  const display = withDoorStepInstructions(input, intl, geo);

  assert.deepEqual(display.map(s => s.routeM), [0, 0.1, corner, 0.7, 1]);
  assert.equal(display[1].instruction, 'به صحن پیامبر اعظم بروید.');
  assert.equal(display[2].instruction, 'به چپ بپیچید.');
  assert.equal(display[2].maneuver, 'left');
  assert.equal(display[3].landmark, 'آبنما');
  assert.equal(display.at(-1), arrival);
  const segments = buildRouteMSegments(display, line);
  assert.deepEqual(segments.at(-1).coordinates.at(-1), line.at(-1));
  assert.ok(Math.abs(segments.reduce((sum, s) => sum + getLineDistanceMeters(s.coordinates), 0)
    - getLineDistanceMeters(line)) < 0.01);
  assert.deepEqual(input, before);
});

test('an entrance, a different area, and a floor transfer remain distinct', () => {
  const messages = JSON.parse(readFileSync(new URL('../src/locales/fa.json', import.meta.url), 'utf8'));
  const intl = createIntl({ locale: 'fa', messages });
  const line = [[59.61, 36.28], [59.612, 36.28]];
  const geo = { geometry: { type: 'LineString', coordinates: line } };
  const door = { ...steps[1], fromAreaId: 10, toAreaId: 11, toAreaName: 'رواق آزمایشی' };
  const transfer = { type: 'stepChangeFloor', floor: 0, toFloor: 1, instruction: 'با آسانسور به طبقهٔ یک بروید.' };
  const input = [{ ...door, routeM: 0.2 }, { ...door, routeM: 0.3, name: 'درگاه شمالی' },
    { ...door, routeM: 0.4, fromAreaId: 12 }, transfer, { ...door, floor: 1, routeM: 0.5 }];
  const display = withDoorStepInstructions(input, intl, geo);
  assert.equal(display.length, input.length);
  assert.equal(display[1].instruction, 'از درگاه شمالی عبور کنید.');
  assert.equal(display[2].instruction, 'وارد رواق آزمایشی شوید.');
  assert.equal(display[3], transfer);
  assert.equal(display[4].instruction, 'وارد رواق آزمایشی شوید.');
});

for (const [label, arrival] of [
  ['missing', steps.at(-1)],
  ['null', { ...steps.at(-1), routeM: null }],
  ['present', { ...steps.at(-1), routeM: 1 }]
]) {
  test(`${label} arrival position retains the final segment all the way to the destination`, () => {
    const input = [...steps.slice(0, -1), arrival];
    const before = structuredClone(input);
    const result = buildRouteMSegments(input, coordinates);

    assert.equal(result.length, 2);
    assert.equal(result.at(-1).type, 'stepArriveDestination');
    assert.equal(result.at(-1).fromM, 0.4);
    assert.equal(result.at(-1).toM, 1);
    assert.equal(result.at(-1).step.floor, 0);
    assert.equal(result.at(-1).step.segmentId, 0);
    assert.deepEqual(result.at(-1).coordinates, sliceLineByFraction(coordinates, 0.4, 1));
    assert.deepEqual(result.at(-1).coordinates.at(-1), coordinates.at(-1));
    const total = result.reduce((sum, segment) => sum + getLineDistanceMeters(segment.coordinates), 0);
    assert.ok(Math.abs(total - getLineDistanceMeters(coordinates)) < 0.001);
    assert.deepEqual(input, before);
  });
}

test('a direct route without doors still has a destination step', () => {
  const result = buildRouteMSegments([steps[0], steps.at(-1)], coordinates);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'stepArriveDestination');
  assert.deepEqual(result[0].coordinates, coordinates);
});

test('arrival remains visible when the final door is exactly at the destination', () => {
  const result = buildRouteMSegments([
    steps[0], { ...steps[1], routeM: 1 }, steps.at(-1)
  ], coordinates);
  assert.equal(result.length, 2);
  assert.equal(result[0].doorId, 7);
  assert.equal(result[1].type, 'stepArriveDestination');
  assert.equal(result[1].fromM, 1);
  assert.equal(result[1].toM, 1);
  assert.deepEqual(result[1].coordinates, [coordinates.at(-1), coordinates.at(-1)]);
  assert.equal(getLineDistanceMeters(result[1].coordinates), 0);
});

test('missing positions on other instructions are not invented or converted to zero', () => {
  const result = normalizeRouteMSteps([
    { type: 'stepStart', routeM: null },
    { type: 'stepPassDoor', routeM: undefined },
    { type: 'stepPassDoor', routeM: '0.4' },
    { type: 'stepPassDoor', routeM: NaN },
    steps.at(-1)
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'stepArriveDestination');
  assert.equal(result[0].routeM, 1);
});

test('only the terminal arrival receives an inferred endpoint position', () => {
  const result = normalizeRouteMSteps([steps.at(-1), steps[0]]);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'stepStart');
});

test('coincident door positions remain skipped without dropping the terminal arrival', () => {
  const result = buildRouteMSegments([
    steps[0], steps[1], { ...steps[1], doorId: 8 }, steps.at(-1)
  ], coordinates);
  assert.equal(result.length, 2);
  assert.equal(result.at(-1).type, 'stepArriveDestination');
});

const finalContext = (step, geo, name, label) => {
  const nearby = geo?.properties?.nearbyDestination;
  const meters = Math.round(getLineDistanceMeters(step.coordinates));
  return { nearby: Boolean(nearby), name: nearby ? label : name, distance: meters > 0 ? String(meters) : null };
};

test('direction to a reachable destination uses the final-segment distance and name', () => {
  const messages = rngMessages.fa;
  const line = [[59.615, 36.287], [59.615, 36.2876]];
  const segment = buildRouteMSegments([steps[0], { ...steps[2], instruction: 'backend' }], line).at(-1);
  const step = { ...segment.step, coordinates: segment.coordinates };
  const context = finalContext(step, null, 'باب‌الجواد');
  assert.equal(context.distance, '67');
  assert.equal(liveStepInstruction(step, messages, context), '67 متر به سمت باب‌الجواد حرکت کنید.');
  assert.equal(liveStepInstruction({ instruction: 'مسیر را ادامه دهید.' }, messages, context), 'مسیر را ادامه دهید.');
  assert.equal(liveStepInstruction(step, rngMessages.en, { ...context, name: 'Bab al-Jawad' }), 'Walk 67 meters toward Bab al-Jawad.');
  assert.equal(liveStepInstruction(step, messages, { ...context, name: '' }), messages.approach);
  assert.equal(liveStepInstruction(step, messages, { ...context, distance: null }), 'به سمت باب‌الجواد حرکت کنید.');
});

test('a long terminal step reports its whole final segment, not a short generic message', () => {
  const line = [[59.61, 36.28], [59.61, 36.282], [59.612, 36.282], [59.612, 36.285]];
  const total = getLineDistanceMeters(line);
  const input = [steps[0], { ...steps[1], routeM: 0.05 }, { ...steps[2], routeM: 1 }];
  const segment = buildRouteMSegments(input, line).at(-1);
  const step = { ...segment.step, coordinates: segment.coordinates };
  const context = finalContext(step, null, 'باب‌الجواد');
  assert.ok(Number(context.distance) > 400);
  assert.equal(Number(context.distance), Math.round(total * 0.95));
  assert.equal(liveStepInstruction(step, rngMessages.fa, context), `${context.distance} متر به سمت باب‌الجواد حرکت کنید.`);
});

test('guidance to a nearby endpoint uses the real route end and its label', () => {
  const messages = rngMessages.fa;
  const geo = { properties: { nearbyDestination: { coordinates: [36.2876, 59.615], floor: 0, label: { name: 'باب الجواد' } } } };
  const line = [[59.615, 36.287], [59.615, 36.2876]];
  const segment = buildRouteMSegments([steps[0], steps[2]], line).at(-1);
  const step = { ...segment.step, coordinates: segment.coordinates };
  const named = finalContext(step, geo, 'باب‌الجواد', 'باب الجواد');
  assert.equal(liveStepInstruction(step, messages, named), '67 متر به سمت باب الجواد حرکت کنید.');
  const unnamed = finalContext(step, geo, 'باب‌الجواد', null);
  assert.equal(liveStepInstruction(step, messages, unnamed), '67 متر تا انتهای مسیر ادامه دهید.');
  assert.equal(liveStepInstruction(step, messages, { nearby: true, name: null, distance: null }), messages.toEnd);
});

test('an unnamed nearby endpoint without a distance asks the pilgrim to continue to the route end', () => {
  const step = { type: 'stepArriveDestination' };
  for (const [language, expected] of [['fa', 'تا انتهای مسیر ادامه دهید.'], ['en', 'Continue to the end of the route.']]) {
    assert.equal(liveStepInstruction(step, rngMessages[language], { nearby: true, name: '', distance: null }), expected);
  }
  assert.equal(liveStepInstruction(step, rngMessages.fa, { nearby: true, name: null, distance: '42' }), '42 متر تا انتهای مسیر ادامه دهید.');
  assert.equal(liveStepInstruction(step, rngMessages.fa, { nearby: false, name: null, distance: null }), rngMessages.fa.approach);
});

test('a multifloor final step measures only the walk on the destination floor', () => {
  const walkLine = (floor, meters) => [[59.615, 36.287], [59.615, 36.287 + meters / 111195]].map(p => [p[0], p[1] + floor * 0]);
  const lower = walkLine(-1, 120);
  const upper = walkLine(0, 50);
  const geo = { properties: { multifloor: true, segments: [
    { id: 0, kind: 'walk', floor: -1, geometry: { coordinates: lower } },
    { id: 1, kind: 'lift', floor: -1, fromFloor: -1, toFloor: 0, geometry: null },
    { id: 2, kind: 'walk', floor: 0, geometry: { coordinates: upper } }
  ] } };
  const arrival = { type: 'stepArriveDestination', floor: 0, segmentId: 2, distanceMeters: 0, coordinates: [upper.at(-1)] };
  const meters = finalStepDistanceMeters(geo, arrival);
  assert.ok(Math.abs(meters - getLineDistanceMeters(upper)) < 0.001);
  assert.ok(Math.abs(meters - 50) < 0.5);
  assert.equal(Math.round(finalStepDistanceMeters(geo, { ...arrival, floor: -1, segmentId: 0 })), 120);
  assert.equal(finalStepDistanceMeters(geo, { ...arrival, floor: -1 }), 0);
  assert.equal(finalStepDistanceMeters(geo, { ...arrival, segmentId: 1 }), 0);
  const context = { nearby: false, name: 'مقصد', distance: String(Math.round(meters)) };
  assert.equal(liveStepInstruction(arrival, rngMessages.fa, context), '50 متر به سمت مقصد حرکت کنید.');
  assert.equal(finalStepDistanceMeters({ properties: {} }, { distanceMeters: 12 }), 12);
});

test('a multifloor final step is measured from the start of the preceding walk step', () => {
  const upper = [[59.615, 36.287], [59.615, 36.287 + 40 / 111195]];
  const lower = [[59.615, 36.286], [59.615, 36.286 + 120 / 111195]];
  const geo = { properties: { multifloor: true, segments: [
    { id: 0, kind: 'walk', floor: -1, geometry: { coordinates: lower } },
    { id: 1, kind: 'lift', floor: -1, fromFloor: -1, toFloor: 0, geometry: null },
    { id: 2, kind: 'walk', floor: 0, geometry: { coordinates: upper } }
  ] } };
  const arrival = { type: 'stepArriveDestination', floor: 0, segmentId: 2, routeM: 1, fromM: 1, distanceMeters: 0 };
  const middle = { type: 'stepGoStraight', floor: 0, segmentId: 2, routeM: 0.75, fromM: 0.75 };
  const measure = previous => Math.round(finalStepDistanceMeters(geo, arrival, previous));
  assert.equal(measure(middle), 10);
  assert.equal(measure({ ...middle, routeM: 0, fromM: 0 }), 40);
  assert.equal(measure(undefined), 40);
  assert.equal(measure({ type: 'stepChangeFloor', floor: -1, segmentId: 1 }), 40);
  assert.equal(measure({ ...middle, segmentId: 0, floor: -1 }), 40);
  assert.equal(measure({ ...middle, floor: -1 }), 40);
  const context = { nearby: false, name: 'مقصد', distance: String(measure(middle)) };
  assert.equal(liveStepInstruction(arrival, rngMessages.fa, context), '10 متر به سمت مقصد حرکت کنید.');
});
