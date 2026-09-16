import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { normalizeUserProfile } from '../src/services/userProfileMapper.js';
import {
  DEFAULT_MAP_PATH,
  PROFILE_ORIGIN_KEY,
  resolvePostLoginDestination
} from '../src/utils/authNavigation.js';

const createStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
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

test('keeps multi-part first and last names without guessing boundaries', () => {
  const profile = normalizeUserProfile({
    firstName: 'محمد رضا',
    lastName: 'حسینی سادات',
    fullName: 'محمد رضا حسینی سادات',
    phone: '09121234567',
    address: { province: 'خراسان رضوی', city: 'مشهد' },
    avatarUrl: '/storage/avatars/profile.jpg'
  });

  assert.equal(profile.firstName, 'محمد رضا');
  assert.equal(profile.lastName, 'حسینی سادات');
  assert.equal(profile.phoneNumber, '09121234567');
  assert.equal(profile.province, 'خراسان رضوی');
  assert.equal(profile.city, 'مشهد');
  assert.equal(profile.avatar, '/storage/avatars/profile.jpg');
});

test('legacy fullName fallback never splits an ambiguous name', () => {
  const profile = normalizeUserProfile({
    fullName: 'سید محمد رضا موسوی نژاد'
  });

  assert.equal(profile.firstName, 'سید محمد رضا موسوی نژاد');
  assert.equal(profile.lastName, '');
});

test('pinfo submits canonical names, keeps OTP phone read-only, and persists avatar', () => {
  const source = fs.readFileSync(new URL('../src/pages/ProfileInfo.jsx', import.meta.url), 'utf8');

  assert.match(source, /firstName,\s*\n\s*lastName,\s*\n\s*fullName,/);
  assert.doesNotMatch(source, /payload\.phone\s*=/);
  assert.match(source, /value=\{userData\.phoneNumber\}[\s\S]*?readOnly/);
  assert.match(source, /await uploadUserAvatar\(avatarFile\)/);
  assert.doesNotMatch(source, /&& userData\.province\s*\n\s*&& userData\.city/);
});

test('direct completed login enters the map instead of trapping the user in profile', () => {
  const storage = createStorage();

  const destination = resolvePostLoginDestination({
    profileCompleted: true,
    storage
  });

  assert.equal(destination, DEFAULT_MAP_PATH);
  assert.equal(storage.getItem(PROFILE_ORIGIN_KEY), null);
});

test('login requested from a map page still opens profile and preserves its back origin', () => {
  const storage = createStorage({
    [PROFILE_ORIGIN_KEY]: '/mpr'
  });

  const destination = resolvePostLoginDestination({
    profileCompleted: true,
    storage
  });

  assert.equal(destination, '/profile');
  assert.equal(storage.getItem(PROFILE_ORIGIN_KEY), '/mpr');
});

test('direct login with incomplete profile seeds map as the eventual profile back target', () => {
  const storage = createStorage();

  const destination = resolvePostLoginDestination({
    profileCompleted: false,
    storage
  });

  assert.equal(destination, '/pinfo');
  assert.equal(storage.getItem(PROFILE_ORIGIN_KEY), DEFAULT_MAP_PATH);
});

test('incomplete profile flow preserves a valid page that originally requested profile', () => {
  const storage = createStorage({
    [PROFILE_ORIGIN_KEY]: '/rng'
  });

  const destination = resolvePostLoginDestination({
    profileCompleted: false,
    storage
  });

  assert.equal(destination, '/pinfo');
  assert.equal(storage.getItem(PROFILE_ORIGIN_KEY), '/rng');
});

test('stale profile origins cannot create profile or external redirect loops', () => {
  for (const invalidOrigin of ['/profile', '/pinfo', '/login', '/', '//example.com']) {
    const storage = createStorage({
      [PROFILE_ORIGIN_KEY]: invalidOrigin
    });

    const destination = resolvePostLoginDestination({
      profileCompleted: true,
      storage
    });

    assert.equal(destination, DEFAULT_MAP_PATH);
    assert.equal(storage.getItem(PROFILE_ORIGIN_KEY), null);
  }
});
