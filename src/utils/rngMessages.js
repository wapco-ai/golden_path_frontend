import { getLineDistanceMeters, sliceLineByFraction } from './routeSegments.js';

// Accessible icon names and live arrival instructions.
export const rngMessages = {
  fa: { next: 'نمایش گام بعدی در دمو', nextLive: 'رفتن به گام بعدی', approach: 'به مسیر تا مقصد ادامه دهید.', arrived: 'شما به مقصد رسیدید.',
    toward: '{distance} متر به سمت {name} حرکت کنید.', towardNoDistance: 'به سمت {name} حرکت کنید.',
    towardEnd: '{distance} متر تا انتهای مسیر ادامه دهید.', toEnd: 'تا انتهای مسیر ادامه دهید.' },
  en: { next: 'Preview next demo step', nextLive: 'Go to the next step', approach: 'Continue along the route to your destination.', arrived: 'You have arrived at your destination.',
    toward: 'Walk {distance} meters toward {name}.', towardNoDistance: 'Walk toward {name}.',
    towardEnd: 'Continue {distance} meters to the end of the route.', toEnd: 'Continue to the end of the route.' },
  ar: { next: 'معاينة الخطوة التجريبية التالية', nextLive: 'الانتقال إلى الخطوة التالية', approach: 'تابع المسار إلى وجهتك.', arrived: 'لقد وصلت إلى وجهتك.',
    toward: 'سر {distance} مترًا باتجاه {name}.', towardNoDistance: 'سر باتجاه {name}.',
    towardEnd: 'تابع {distance} مترًا حتى نهاية المسار.', toEnd: 'تابع حتى نهاية المسار.' },
  ur: { next: 'ڈیمو کا اگلا مرحلہ دکھائیں', nextLive: 'اگلے مرحلے پر جائیں', approach: 'منزل تک راستے پر چلتے رہیں۔', arrived: 'آپ منزل پر پہنچ گئے ہیں۔',
    toward: '{name} کی طرف {distance} میٹر چلیں۔', towardNoDistance: '{name} کی طرف چلیں۔',
    towardEnd: 'راستے کے اختتام تک {distance} میٹر چلتے رہیں۔', toEnd: 'راستے کے اختتام تک چلتے رہیں۔' }
};

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key]);
const clean = value => typeof value === 'string' ? value.trim() : '';

// context: { nearby, name, distance } for the terminal step. `name` is the requested
// destination, or the nearby endpoint's own label for a nearby route; `distance` is the
// already localized length of the final segment, or null when it is unknown.
export const liveStepInstruction = (step, messages, context = {}) => {
  if (step?.type !== 'stepArriveDestination') return step?.instruction;
  const name = clean(context.name);
  const distance = context.distance ?? null;
  if (name) return fill(distance === null ? messages.towardNoDistance : messages.toward, { name, distance });
  if (!context.nearby) return messages.approach;
  return distance !== null ? fill(messages.towardEnd, { distance }) : messages.toEnd;
};

// Length of the final walk. A multifloor arrival step has no length of its own, so
// measure the route geometry of the destination-floor walk segment: from the start of
// the preceding walk step in that segment (or the segment start) to the arrival point.
export const finalStepDistanceMeters = (geo, step, previousStep) => {
  if (geo?.properties?.multifloor === true) {
    const segment = (geo.properties.segments || []).find(item => item.kind === 'walk'
      && String(item.id) === String(step?.segmentId)
      && (step?.floor == null || Number(item.floor) === Number(step.floor)));
    const coordinates = segment?.geometry?.coordinates;
    const sameWalk = previousStep && previousStep.type !== 'stepChangeFloor'
      && previousStep.type !== 'stepArriveDestination'
      && String(previousStep.segmentId) === String(step?.segmentId)
      && (previousStep.floor == null || step?.floor == null || Number(previousStep.floor) === Number(step.floor));
    const from = sameWalk ? Number(previousStep.fromM ?? previousStep.routeM) : NaN;
    if (!Number.isFinite(from)) return getLineDistanceMeters(coordinates);
    return getLineDistanceMeters(sliceLineByFraction(coordinates, from, Number.isFinite(step?.routeM) ? step.routeM : 1));
  }
  return Number.isFinite(step?.distanceMeters) ? step.distanceMeters : getLineDistanceMeters(step?.coordinates);
};

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
    scan: 'اصلاح مسیر با QR', distanceWarningLabel: 'نمایش هشدار فاصله از مسیر',
    distanceWarning: 'فاصله از مسیر زیاد است. QR نزدیک را اسکن کنید.',
    loading: 'در حال محاسبهٔ مسیر از موقعیت جدید…',
    invalid: 'این کد QR برای مسیریابی ثبت نشده یا غیرفعال است.', floor: 'طبقهٔ این کد QR مشخص نیست.',
    camera: 'دوربین باز نشد. دسترسی دوربین را بررسی کنید.', noRoute: 'از این موقعیت مسیری به مقصد پیدا نشد.',
    connection: 'به‌روزرسانی مسیر ناموفق بود. اتصال اینترنت را بررسی کنید.',
    retry: 'تلاش دوباره', continue: 'ادامهٔ مسیر فعلی', updated: 'مسیر از {place} به‌روز شد.'
  },
  en: {
    scan: 'Correct route with QR', distanceWarningLabel: 'Show route distance warning',
    distanceWarning: 'You may be off route. Scan a nearby QR to correct.',
    loading: 'Calculating the route from your new location…',
    invalid: 'This QR code is inactive or unregistered for routing.', floor: 'The floor for this QR code is unknown.',
    camera: 'Could not open the camera. Check camera permissions.', noRoute: 'No route to your destination was found from this location.',
    connection: 'Could not update the route. Check your internet connection.',
    retry: 'Try again', continue: 'Continue current route', updated: 'Route updated from {place}.'
  },
  ar: {
    scan: 'تصحيح المسار برمز QR', distanceWarningLabel: 'عرض تنبيه البعد عن المسار',
    distanceWarning: 'قد تكون بعيدًا عن المسار. امسح رمز QR قريبًا للتصحيح.',
    loading: 'جارٍ حساب المسار من موقعك الجديد…',
    invalid: 'رمز QR غير نشط أو غير مسجل للملاحة.', floor: 'طابق رمز QR غير معروف.',
    camera: 'تعذر فتح الكاميرا. تحقق من إذن الوصول إليها.', noRoute: 'تعذر العثور على مسار إلى وجهتك من هذا الموقع.',
    connection: 'تعذر تحديث المسار. تحقق من اتصال الإنترنت.',
    retry: 'إعادة المحاولة', continue: 'متابعة المسار الحالي', updated: 'تم تحديث المسار من {place}.'
  },
  ur: {
    scan: 'QR سے راستہ درست کریں', distanceWarningLabel: 'راستے سے فاصلے کا انتباہ دکھائیں',
    distanceWarning: 'آپ راستے سے دور ہو سکتے ہیں۔ درستگی کے لیے قریبی QR اسکین کریں۔',
    loading: 'نئی جگہ سے راستہ تلاش کیا جا رہا ہے…',
    invalid: 'یہ QR کوڈ غیر فعال ہے یا راستے کے لیے رجسٹرڈ نہیں ہے۔', floor: 'اس QR کوڈ کی منزل معلوم نہیں۔',
    camera: 'کیمرہ نہیں کھلا۔ کیمرے کی اجازت چیک کریں۔', noRoute: 'اس جگہ سے منزل تک کوئی راستہ نہیں ملا۔',
    connection: 'راستہ اپ ڈیٹ نہیں ہوا۔ انٹرنیٹ کنکشن چیک کریں۔',
    retry: 'دوبارہ کوشش کریں', continue: 'موجودہ راستہ جاری رکھیں', updated: '{place} سے راستہ اپ ڈیٹ ہو گیا۔'
  }
};
