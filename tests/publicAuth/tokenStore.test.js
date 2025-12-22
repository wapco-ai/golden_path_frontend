import assert from 'assert';
import {
  clearTokens,
  getAccessToken,
  getExpiresAt,
  getRefreshToken,
  isExpired,
  setTokens
} from '../../src/services/publicAuth/tokenStore.ts';

const originalNow = Date.now;

try {
  clearTokens();
  Date.now = () => 0;
  setTokens({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 10 });

  assert.strictEqual(getAccessToken(), 'access');
  assert.strictEqual(getRefreshToken(), 'refresh');
  assert.strictEqual(typeof getExpiresAt(), 'number');
  assert.strictEqual(isExpired(), false);

  Date.now = () => 11 * 1000;
  assert.strictEqual(isExpired(), true);

  clearTokens();
  assert.strictEqual(getAccessToken(), null);
  assert.strictEqual(getRefreshToken(), null);
  assert.strictEqual(getExpiresAt(), null);

  console.log('tokenStore tests passed');
} finally {
  Date.now = originalNow;
  clearTokens();
}
