import assert from 'assert';
import { enqueueRefresh } from '../../src/services/publicAuth/refreshQueue.ts';

const results = [];
let calls = 0;

const refreshFn = () => {
  calls += 1;
  return new Promise((resolve) => {
    setTimeout(() => resolve({ accessToken: `token-${calls}` }), 50);
  });
};

const p1 = enqueueRefresh(refreshFn).then((value) => results.push(value.accessToken));
const p2 = enqueueRefresh(refreshFn).then((value) => results.push(value.accessToken));

Promise.all([p1, p2])
  .then(() => {
    assert.strictEqual(calls, 1, 'refresh should only run once');
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0], 'token-1');
    assert.strictEqual(results[1], 'token-1');
    console.log('refreshQueue tests passed');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
