export const errorCodeMessages = {
  PHONE_EXISTS: 'این شماره قبلا ثبت شده است.',
  EMAIL_EXISTS: 'این ایمیل قبلا ثبت شده است.',
  INVALID_TOKEN: 'نشست شما منقضی شده است.',
  ACCOUNT_LOCKED: 'حساب شما قفل شده است.',
  PROFILE_INCOMPLETE: 'پروفایل کامل نیست.',
  VALIDATION_ERROR: 'ورودی‌ها نیاز به بررسی دارند.'
};

export const mapApiErrorToMessage = (error) => {
  const code = error?.response?.data?.code;
  return errorCodeMessages[code] || error?.response?.data?.message || 'خطایی رخ داده است.';
};

export const mapApiErrorToFields = (error) => {
  const errors = error?.response?.data?.errors || {};
  return Object.keys(errors).reduce((acc, key) => {
    acc[key] = Array.isArray(errors[key]) ? errors[key][0] : errors[key];
    return acc;
  }, {});
};

export default { mapApiErrorToMessage, mapApiErrorToFields, errorCodeMessages };
