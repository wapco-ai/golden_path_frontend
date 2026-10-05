import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRouteMSegments,
  getLineDistanceMeters,
  normalizeRouteMSteps,
  sliceLineByFraction
} from '../src/utils/routeSegments.js';

const coordinates = [[59.615, 36.287], [59.6151, 36.287], [59.6151, 36.2872]];
const steps = [
  { type: 'stepStart', routeM: 0, floor: 0, segmentId: 0 },
  { type: 'stepPassDoor', routeM: 0.4, doorId: 7, floor: 0, segmentId: 0 },
  { type: 'stepArriveDestination', floor: 0, segmentId: 0 }
];

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
