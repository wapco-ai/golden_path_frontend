const codeMessages = {
  PHONE_EXISTS: 'این شماره قبلاً ثبت شده است.',
  EMAIL_EXISTS: 'این ایمیل قبلاً ثبت شده است.',
  INVALID_OTP: 'کد تأیید نادرست است.',
  INVALID_TOKEN: 'نشست شما منقضی شده، دوباره وارد شوید.',
  TOKEN_EXPIRED: 'نشست شما منقضی شده، دوباره وارد شوید.',
  ACCOUNT_LOCKED: 'حساب شما موقتاً قفل شده است.',
  PROFILE_INCOMPLETE: 'پروفایل کامل نیست.'
};

const collectErrorsByField = (errors, prefix = '', result = {}) => {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return result;
  for (const [key, value] of Object.entries(errors)) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result[field] = [value];
    else if (Array.isArray(value)) result[field] = value.filter((item) => typeof item === 'string');
    else if (value && typeof value === 'object') collectErrorsByField(value, field, result);
  }
  return result;
};

export const mapApiError = (error) => {
  const data = error?.response?.data || {};
  const messageFromCode = data?.code ? codeMessages[data.code] : null;
  const fieldErrors = collectErrorsByField(data?.errors);
  const fieldMessages = Object.values(fieldErrors).flat();
  const fallbackMessage = data?.message || 'خطایی رخ داد. لطفاً دوباره تلاش کنید.';

  return {
    message: messageFromCode || fallbackMessage,
    fieldMessages,
    fieldErrors
  };
};

export default mapApiError;
