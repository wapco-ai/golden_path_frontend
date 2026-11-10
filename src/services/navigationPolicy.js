import appConfig from '../config/appConfig.js';

// Units are explicit. These are conservative offline defaults, not GNSS integrity claims.
export const POLICY_FIELDS = {
  warning_uncertainty_m: [20, 5, 100, 'حد هشدار خطای تجمعی (متر)'],
  snap_distance_m: [20, 1, 100, 'حد فاصله از مسیر (متر)'],
  arrival_radius_m: [3, 1, 5, 'شعاع رسیدن (متر)'],
  qr_accuracy_m: [2, 0.5, 5, 'خطای اولیه QR (متر)'],
  manual_accuracy_m: [5, 1, 10, 'خطای مبدأ انتخابی (متر)'],
  step_length_m: [0.7, 0.35, 1.1, 'طول قدم پیش‌فرض (متر)'],
  drift_per_meter: [0.3, 0.05, 1, 'افزایش خطا به ازای هر متر'],
  heading_max_age_ms: [5000, 500, 10000, 'عمر جهت معتبر (میلی‌ثانیه)'],
  measurement_max_age_ms: [15000, 1000, 30000, 'عمر موقعیت معتبر (میلی‌ثانیه)'],
  route_window_m: [3, 1, 6, 'تلورانس پیشروی روی مسیر (متر)'],
  heading_tolerance_deg: [60, 15, 90, 'حد اختلاف جهت با مسیر (درجه)'],
  arrival_samples: [2, 2, 5, 'تعداد قدم معتبر برای تأیید رسیدن'],
  arrival_dwell_ms: [500, 300, 3000, 'زمان تأیید رسیدن (میلی‌ثانیه)'],
  gps_max_accuracy_m: [25, 3, 50, 'حد خطای دریافت GPS (متر)'],
  gps_progress_accuracy_m: [6, 1, 10, 'حد خطای پیشروی GPS (متر)'],
  gps_arrival_accuracy_m: [3, 1, 5, 'حد خطای رسیدن GPS (متر)'],
};
export const DEFAULT_NAVIGATION_POLICY = Object.freeze({ gps_enabled: false,
  ...Object.fromEntries(Object.entries(POLICY_FIELDS).map(([key, [value]]) => [key, value])) });
const CACHE_KEY = 'navigation-policy-v1';
export function validNavigationPolicy(value) {
  return value && typeof value.gps_enabled === 'boolean'
    && Object.entries(POLICY_FIELDS).every(([key, [, min, max]]) => Number.isFinite(value[key])
      && value[key] >= min && value[key] <= max)
    && Number.isInteger(value.arrival_samples)
    && value.arrival_radius_m < value.warning_uncertainty_m
    && value.snap_distance_m <= value.warning_uncertainty_m
    && value.gps_arrival_accuracy_m <= value.gps_progress_accuracy_m
    && value.gps_progress_accuracy_m <= value.gps_max_accuracy_m;
}
let policy = DEFAULT_NAVIGATION_POLICY;
export const getNavigationPolicy = () => policy;
// Settings are loaded before mounting; a running trip keeps its existing policy.
export function setNavigationPolicy(value) {
  if (!validNavigationPolicy(value)) return false;
  policy = Object.freeze(Object.fromEntries(Object.keys(DEFAULT_NAVIGATION_POLICY).map(k => [k, value[k]])));
  return true;
}
export async function loadNavigationPolicy({ fetcher = globalThis.fetch, storage = globalThis.localStorage } = {}) {
  try {
    const saved = JSON.parse(storage?.getItem(CACHE_KEY) || 'null');
    if (validNavigationPolicy(saved)) setNavigationPolicy(saved);
  } catch { /* Storage can be disabled; keep fail-safe defaults. */ }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetcher(`${appConfig.apiBaseUrl}/api/v1/navigation-settings`,
      { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) return policy;
    const result = await response.json();
    if (setNavigationPolicy(result.policy)) {
      try { storage?.setItem(CACHE_KEY, JSON.stringify(policy)); } catch { /* Optional offline cache. */ }
    }
  } catch { /* Keep the last valid policy; failure never enables GPS. */ }
  finally { clearTimeout(timer); }
  return policy;
}
