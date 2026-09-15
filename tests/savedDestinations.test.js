import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('saved locations page wires route, update, and delete to real actions', () => {
  const source = fs.readFileSync(new URL('../src/pages/Pfp.jsx', import.meta.url), 'utf8');

  assert.match(source, /onClick=\{\(\) => handleRoute\(location\)\}/);
  assert.match(source, /convertUtm32640ToLngLat/);
  assert.match(source, /await updateDestination\(editingLocation\.id/);
  assert.match(source, /await deleteDestination\(locationId\)/);
  assert.match(source, /navigate\('\/fs'\)/);
  assert.doesNotMatch(source, /Frontend-only/);
  assert.doesNotMatch(source, /ref=\{optionsMenuRef\}/);
});

test('final search opens the existing-style details modal before creating a destination', () => {
  const source = fs.readFileSync(new URL('../src/pages/FinalSearch.jsx', import.meta.url), 'utf8');
  const modal = fs.readFileSync(new URL('../src/components/common/SaveDestinationModal.jsx', import.meta.url), 'utf8');

  assert.match(source, /setShowSaveDestinationModal\(true\)/);
  assert.match(source, /<SaveDestinationModal/);
  assert.match(source, /onSave=\{handleConfirmSaveDestination\}/);
  assert.match(source, /handleConfirmSaveDestination = async \(\{ title, description \}\)/);
  assert.match(source, /await createDestination\(\{[\s\S]*?title,[\s\S]*?description,/);
  assert.match(modal, /saveLocationTitle/);
  assert.match(modal, /locationNameLabel/);
  assert.match(modal, /locationDescriptionLabel/);
  assert.match(modal, /nameRequiredError/);
});

test('destination service preserves the current floor when an explicit floor is unavailable', () => {
  const source = fs.readFileSync(new URL('../src/services/destinationService.js', import.meta.url), 'utf8');

  assert.match(source, /floor !== null && floor !== undefined && floor !== ''/);
  assert.match(source, /return Number\(getSessionFloor\(\)\)/);
  assert.match(source, /const resolvedFloor = normalizeFloor\(floor\)/);
  assert.match(source, /floor: resolvedFloor/);
});

test('destination service exposes real PUT and DELETE operations for saved locations', () => {
  const source = fs.readFileSync(new URL('../src/services/destinationService.js', import.meta.url), 'utf8');

  assert.match(source, /export const updateDestination = async/);
  assert.match(source, /method: 'PUT'/);
  assert.match(source, /export const deleteDestination = async/);
  assert.match(source, /method: 'DELETE'/);
  assert.match(source, /\$\{appConfig\.destinationsUrl\}\/\$\{destinationId\}/);
});
