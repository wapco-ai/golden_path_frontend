// Accessible icon names and live arrival instructions.
export const rngMessages = {
  fa: { next: 'نمایش گام بعدی در دمو', nextLive: 'رفتن به گام بعدی', approach: 'به مسیر تا مقصد ادامه دهید.', arrived: 'به مقصد رسیدید.' },
  en: { next: 'Preview next demo step', nextLive: 'Go to the next step', approach: 'Continue along the route to your destination.', arrived: 'You have arrived at your destination.' },
  ar: { next: 'معاينة الخطوة التجريبية التالية', nextLive: 'الانتقال إلى الخطوة التالية', approach: 'تابع المسار إلى وجهتك.', arrived: 'لقد وصلت إلى وجهتك.' },
  ur: { next: 'ڈیمو کا اگلا مرحلہ دکھائیں', nextLive: 'اگلے مرحلے پر جائیں', approach: 'منزل تک راستے پر چلتے رہیں۔', arrived: 'آپ منزل پر پہنچ گئے ہیں۔' }
};

export const liveStepInstruction = (step, messages) =>
  step?.type === 'stepArriveDestination' ? messages.approach : step?.instruction;

export const rngPauseMessages = {
  fa: { pause: 'توقف موقت', resume: 'ادامه مسیر', paused: 'راهنمای مسیر متوقف است',
    checking: 'در حال بررسی موقعیت…', location: 'موقعیت تازه در دسترس نیست. GPS را فعال کنید یا موقعیت را با QR اصلاح کنید.',
    failed: 'ادامه مسیر ممکن نشد. دوباره تلاش کنید یا موقعیت را با QR اصلاح کنید.' },
  en: { pause: 'Pause navigation', resume: 'Resume navigation', paused: 'Navigation paused',
    checking: 'Checking your location…', location: 'No fresh location. Enable GPS or correct your location with QR.',
    failed: 'Could not resume. Try again or correct your location with QR.' },
  ar: { pause: 'إيقاف مؤقت', resume: 'متابعة المسار', paused: 'تم إيقاف الإرشاد مؤقتًا',
    checking: 'جارٍ التحقق من الموقع…', location: 'الموقع الحديث غير متاح. فعّل GPS أو صحح موقعك برمز QR.',
    failed: 'تعذرت المتابعة. حاول مجددًا أو صحح موقعك برمز QR.' },
  ur: { pause: 'عارضی توقف', resume: 'راستہ جاری رکھیں', paused: 'رہنمائی رکی ہوئی ہے',
    checking: 'مقام کی جانچ جاری ہے…', location: 'تازہ مقام دستیاب نہیں۔ GPS فعال کریں یا QR سے مقام درست کریں۔',
    failed: 'راستہ جاری نہیں ہو سکا۔ دوبارہ کوشش کریں یا QR سے مقام درست کریں۔' }
};

export const rngQrMessages = {
  fa: {
    scan: 'اصلاح مسیر با QR', loading: 'در حال محاسبهٔ مسیر از موقعیت جدید…',
    invalid: 'این کد QR برای مسیریابی ثبت نشده یا غیرفعال است.', floor: 'طبقهٔ این کد QR مشخص نیست.',
    camera: 'دوربین باز نشد. دسترسی دوربین را بررسی کنید.', noRoute: 'از این موقعیت مسیری به مقصد پیدا نشد.',
    connection: 'به‌روزرسانی مسیر ناموفق بود. اتصال اینترنت را بررسی کنید.',
    retry: 'تلاش دوباره', continue: 'ادامهٔ مسیر فعلی', updated: 'مسیر از {place} به‌روز شد.'
  },
  en: {
    scan: 'Correct route with QR', loading: 'Calculating the route from your new location…',
    invalid: 'This QR code is inactive or unregistered for routing.', floor: 'The floor for this QR code is unknown.',
    camera: 'Could not open the camera. Check camera permissions.', noRoute: 'No route to your destination was found from this location.',
    connection: 'Could not update the route. Check your internet connection.',
    retry: 'Try again', continue: 'Continue current route', updated: 'Route updated from {place}.'
  },
  ar: {
    scan: 'تصحيح المسار برمز QR', loading: 'جارٍ حساب المسار من موقعك الجديد…',
    invalid: 'رمز QR غير نشط أو غير مسجل للملاحة.', floor: 'طابق رمز QR غير معروف.',
    camera: 'تعذر فتح الكاميرا. تحقق من إذن الوصول إليها.', noRoute: 'تعذر العثور على مسار إلى وجهتك من هذا الموقع.',
    connection: 'تعذر تحديث المسار. تحقق من اتصال الإنترنت.',
    retry: 'إعادة المحاولة', continue: 'متابعة المسار الحالي', updated: 'تم تحديث المسار من {place}.'
  },
  ur: {
    scan: 'QR سے راستہ درست کریں', loading: 'نئی جگہ سے راستہ تلاش کیا جا رہا ہے…',
    invalid: 'یہ QR کوڈ غیر فعال ہے یا راستے کے لیے رجسٹرڈ نہیں ہے۔', floor: 'اس QR کوڈ کی منزل معلوم نہیں۔',
    camera: 'کیمرہ نہیں کھلا۔ کیمرے کی اجازت چیک کریں۔', noRoute: 'اس جگہ سے منزل تک کوئی راستہ نہیں ملا۔',
    connection: 'راستہ اپ ڈیٹ نہیں ہوا۔ انٹرنیٹ کنکشن چیک کریں۔',
    retry: 'دوبارہ کوشش کریں', continue: 'موجودہ راستہ جاری رکھیں', updated: '{place} سے راستہ اپ ڈیٹ ہو گیا۔'
  }
};
