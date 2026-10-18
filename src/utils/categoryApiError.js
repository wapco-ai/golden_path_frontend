const firstMessage = (value) => {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) return value.map(firstMessage).find(Boolean) || null;
  if (value && typeof value === 'object') return Object.values(value).map(firstMessage).find(Boolean) || null;
  return null;
};

export function categoryApiErrorMessage(data, fallbackMessage) {
  const errors = data?.errors;
  const titleError = firstMessage(errors?.title);
  const childTitleError = errors && typeof errors === 'object'
    ? Object.entries(errors)
      .filter(([field]) => field === 'subcategories' || /^subcategories\.\d+\.title$/.test(field))
      .map(([, messages]) => firstMessage(messages))
      .find(Boolean)
    : null;
  return titleError || childTitleError || firstMessage(errors) || firstMessage(data?.message) || fallbackMessage;
}

export async function createCategoryApiError(response, fallbackMessage) {
  const data = await response.json().catch(() => null);
  return new Error(categoryApiErrorMessage(data, fallbackMessage));
}
