// A floor is an identifier, not an elevation. Unknown must stay distinct from 0.
export const normalizeFloor = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const floor = Number(value);
  return Number.isInteger(floor) && floor >= -32768 && floor <= 32767 ? floor : null;
};

export const getPointFloor = (point, fallback = null) => {
  for (const candidate of [point?.floor, point?.geo?.floor, point?.properties?.floor]) {
    const floor = normalizeFloor(candidate);
    if (floor !== null) return floor;
  }
  return normalizeFloor(fallback);
};

export const withPointFloor = (point, fallback = null) => point
  ? { ...point, floor: getPointFloor(point, fallback) }
  : null;

export const floorMessages = {
  fa: { map: 'طبقهٔ نقشه', origin: 'طبقهٔ مبدأ', destination: 'طبقهٔ مقصد', choose: 'انتخاب طبقه', ground: 'همکف', floor: 'طبقه', loading: 'در حال دریافت طبقات…', error: 'دریافت طبقات ناموفق بود', retry: 'تلاش دوباره' },
  en: { map: 'Map floor', origin: 'Origin floor', destination: 'Destination floor', choose: 'Choose floor', ground: 'Ground', floor: 'Floor', loading: 'Loading floors…', error: 'Could not load floors', retry: 'Retry' },
  ar: { map: 'طابق الخريطة', origin: 'طابق البداية', destination: 'طابق الوجهة', choose: 'اختيار الطابق', ground: 'الأرضي', floor: 'الطابق', loading: 'جارٍ تحميل الطوابق…', error: 'تعذر تحميل الطوابق', retry: 'إعادة المحاولة' },
  ur: { map: 'نقشے کی منزل', origin: 'آغاز کی منزل', destination: 'منزلِ مقصود کا فلور', choose: 'منزل منتخب کریں', ground: 'گراؤنڈ', floor: 'منزل', loading: 'منزلیں لوڈ ہو رہی ہیں…', error: 'منزلیں لوڈ نہیں ہو سکیں', retry: 'دوبارہ کوشش کریں' }
};

export function floorLabel(value, language = 'fa', catalog = [], short = false) {
  const floor = normalizeFloor(value);
  const text = floorMessages[language] || floorMessages.fa;
  if (floor === null) return text.choose;
  const record = catalog.find(item => item.floor === floor);
  if (!short && language === 'fa' && record?.label) return record.label;
  if (floor === 0) return text.ground;
  const number = new Intl.NumberFormat(language, { useGrouping: false }).format(Math.abs(floor));
  if (language === 'fa' && floor < 0) return short ? `منفی ${number}` : `طبقهٔ منفی ${number}`;
  const signed = new Intl.NumberFormat(language, { useGrouping: false }).format(floor);
  return short ? signed : `${text.floor} ${signed}`;
}

export const normalizeFloorCatalog = (data) => {
  if (!Array.isArray(data)) throw new Error('Invalid floor catalog');
  const seen = new Set();
  return data.flatMap(item => {
    const floor = normalizeFloor(item?.floor);
    if (floor === null || seen.has(floor)) return [];
    seen.add(floor);
    return [{ ...item, floor, sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : floor }];
  }).sort((a, b) => b.sort_order - a.sort_order);
};

export const pointIsOnFloor = (point, floor) => normalizeFloor(floor) !== null && getPointFloor(point) === normalizeFloor(floor);
