export const COORDINATE_FIELDS = [
  { name: 'lat', label: 'عرض جغرافیایی (Latitude)', limit: 90, placeholder: '36.290800' },
  { name: 'lng', label: 'طول جغرافیایی (Longitude)', limit: 180, placeholder: '59.616100' }
];

export function parseCoordinate(value, limit) {
  const text = String(value ?? '').trim()
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/٫/g, '.').replace(/−/g, '-');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function parseCulturalCoordinates(draft) {
  const lat = parseCoordinate(draft.lat, 90);
  const lng = parseCoordinate(draft.lng, 180);
  return lat === null || lng === null ? null : { lat, lng };
}
