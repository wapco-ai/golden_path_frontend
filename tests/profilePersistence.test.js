import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { normalizeUserProfile } from '../src/services/userProfileMapper.js';

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
