const codeMessages = {
  PHONE_EXISTS: 'این شماره قبلاً ثبت شده است.',
  EMAIL_EXISTS: 'این ایمیل قبلاً ثبت شده است.',
  INVALID_OTP: 'کد تأیید نادرست است.',
  INVALID_TOKEN: 'نشست شما منقضی شده، دوباره وارد شوید.',
  TOKEN_EXPIRED: 'نشست شما منقضی شده، دوباره وارد شوید.',
  ACCOUNT_LOCKED: 'حساب شما موقتاً قفل شده است.',
  PROFILE_INCOMPLETE: 'پروفایل کامل نیست.'
};

const collectFieldErrors = (errorsObj) => {
  if (!errorsObj || typeof errorsObj !== 'object') return [];

  return Object.values(errorsObj)
    .flatMap((val) => {
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object') return Object.values(val);
      if (typeof val === 'string') return [val];
      return [];
    })
    .filter(Boolean);
};

export const mapApiError = (error) => {
  const data = error?.response?.data || {};
  const messageFromCode = data?.code ? codeMessages[data.code] : null;
  const fieldMessages = collectFieldErrors(data?.errors);
  const fallbackMessage = data?.message || 'خطایی رخ داد. لطفاً دوباره تلاش کنید.';

  return {
    message: messageFromCode || fallbackMessage,
    fieldMessages
  };
};

export default mapApiError;
