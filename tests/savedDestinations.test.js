import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const createStorage = () => {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
};

const sessionStorage = createStorage();
const localStorage = createStorage();

globalThis.sessionStorage = sessionStorage;
globalThis.localStorage = localStorage;
globalThis.window = {
  sessionStorage,
  localStorage,
  dispatchEvent() {}
};

const destinationService = await import('../src/services/destinationService.js');

test('saved locations page wires route, update, and delete to real actions', () => {
  const source = fs.readFileSync(new URL('../src/pages/Pfp.jsx', import.meta.url), 'utf8');

  assert.match(source, /onClick=\{\(\) => handleRoute\(location\)\}/);
  assert.match(source, /convertUtm32640ToLngLat/);
  assert.match(source, /await updateDestination\(editingLocation\.id/);
  assert.match(source, /await deleteDestination\(locationId\)/);
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
  assert.match(modal, /saveLocationTitle/);
  assert.match(modal, /locationNameLabel/);
  assert.match(modal, /locationDescriptionLabel/);
  assert.match(modal, /nameRequiredError/);
});

test('create destination uses the current floor when the selected place has no explicit floor', async () => {
  sessionStorage.setItem('haramCurrentFloor', '-1');

  const calls = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return { destination: { id: 1 } };
      }
    };
  };

  try {
    await destinationService.createDestination({
      title: 'مکان تست',
      coordinates: [36.28, 59.61],
      floor: null
    });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'POST');
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.floor, -1);
  assert.equal(payload.source, 'manual');
  assert.ok(Number.isFinite(payload.x));
  assert.ok(Number.isFinite(payload.y));
});

test('destination service sends update and delete requests to the saved destination resource', async () => {
  const calls = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      async json() {
        return { destination: { id: 42, title: 'ویرایش شده' }, status: 'ok' };
      }
    };
  };

  try {
    await destinationService.updateDestination(42, {
      title: 'ویرایش شده',
      description: 'توضیح'
    });
    await destinationService.deleteDestination(42);
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/42$/);
  assert.equal(calls[0].options.method, 'PUT');
  assert.match(calls[1].url, /\/42$/);
  assert.equal(calls[1].options.method, 'DELETE');
});
