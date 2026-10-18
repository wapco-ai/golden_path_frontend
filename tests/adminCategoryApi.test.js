import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryApiErrorMessage, createCategoryApiError } from '../src/utils/categoryApiError.js';

const duplicate = 'این عنوان قبلاً در این دسته بندی ثبت شده است.';
const fallback = 'خطا در ایجاد دسته بندی';

test('shows the Persian title validation error instead of a generic validation message', () => {
  assert.equal(categoryApiErrorMessage({
    message: 'The given data was invalid.',
    errors: { title: [duplicate] }
  }, fallback), duplicate);
  assert.equal(categoryApiErrorMessage({ errors: { title: duplicate } }, fallback), duplicate);
});

test('retains useful nested child errors when creating a category and its subcategories', () => {
  assert.equal(categoryApiErrorMessage({
    message: 'Validation failed.',
    errors: { 'subcategories.1.title': [duplicate] }
  }, fallback), duplicate);
  assert.equal(categoryApiErrorMessage({
    message: 'Validation failed.',
    errors: { subcategories: [{ title: [duplicate] }] }
  }, fallback), duplicate);
});

test('prefers the title failure while retaining other field and server messages as fallbacks', () => {
  assert.equal(categoryApiErrorMessage({ errors: { icon: ['تصویر نامعتبر است'], title: [duplicate] } }, fallback), duplicate);
  assert.equal(categoryApiErrorMessage({ errors: { icon: ['تصویر نامعتبر است'] } }, fallback), 'تصویر نامعتبر است');
  assert.equal(categoryApiErrorMessage({ message: 'دسترسی مجاز نیست' }, fallback), 'دسترسی مجاز نیست');
  for (const data of [null, {}, { message: '' }, { errors: { title: [] } }]) {
    assert.equal(categoryApiErrorMessage(data, fallback), fallback);
  }
});

test('turns a failed JSON response into the Error message consumed by the existing alert handler', async () => {
  const error = await createCategoryApiError({ json: async () => ({ message: 'Validation failed.', errors: { title: [duplicate] } }) }, fallback);
  assert.ok(error instanceof Error);
  assert.equal(error.message, duplicate);
  const malformed = await createCategoryApiError({ json: async () => { throw new SyntaxError('Invalid JSON'); } }, fallback);
  assert.equal(malformed.message, fallback);
});
