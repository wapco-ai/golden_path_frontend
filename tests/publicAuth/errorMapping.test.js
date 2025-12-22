import assert from 'assert';
import { mapApiErrorToFields, mapApiErrorToMessage, errorCodeMessages } from '../../src/services/publicAuth/errorMapping.ts';

const sampleError = {
  response: {
    data: {
      code: 'EMAIL_EXISTS',
      message: 'Email exists',
      errors: {
        email: ['The email has already been taken.']
      }
    }
  }
};

assert.strictEqual(mapApiErrorToMessage(sampleError), errorCodeMessages.EMAIL_EXISTS);
const mapped = mapApiErrorToFields(sampleError);
assert.strictEqual(mapped.email, 'The email has already been taken.');

const validationFallback = mapApiErrorToMessage({ response: { data: { code: 'UNKNOWN', message: 'Custom message' } } });
assert.strictEqual(validationFallback, 'Custom message');

console.log('errorMapping tests passed');
