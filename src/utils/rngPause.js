import { getNavigationPolicy } from '../services/navigationPolicy.js';
import { validGps, PROGRESS_MAX_ACCURACY } from './locationQuality.js';
import { getNavigationProgress, projectPointOnRoute } from './rngNavigation.js';

const KEY = 'rngPausedNavigation';
export const pauseRouteKey = (route, destination, mode, gender) => JSON.stringify([route, destination, mode, gender]);

export function readPausedNavigation(key) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY));
    return saved?.key === key && Number.isInteger(saved.step) && saved.step >= 0 && saved.frame
      ? saved : null;
  } catch { return null; }
}

export function savePausedNavigation(value) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch { /* Navigation still works when storage is unavailable. */ }
}

// A resume must obtain a new measurement, never the cached marker from before a break.
export function getResumePosition(signal, geolocation = navigator.geolocation) {
  if (!getNavigationPolicy().gps_enabled) return Promise.reject(new Error('location'));
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (error, value) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value);
    };
    const abort = () => finish(new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    const startedAt = Date.now();
    timer = setTimeout(() => finish(new Error('location')), 11000);
    if (!geolocation) return finish(new Error('location'));
    geolocation.getCurrentPosition(position => {
      const geo = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (position.timestamp < startedAt || position.coords.accuracy > getNavigationPolicy().gps_progress_accuracy_m || !validGps(geo, position.coords.accuracy, position.timestamp)) {
        return finish(new Error('location'));
      }
      finish(null, { ...geo, accuracy: position.coords.accuracy, timestamp: position.timestamp });
    }, () => finish(new Error('location')), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  });
}

export function resumeStepAt(geo, steps, currentStep, coordinates) {
  const projection = projectPointOnRoute([geo.lng, geo.lat], coordinates);
  if (!projection || projection.lateralDistanceM > 10) return null;
  const accuracy = geo.fromQr ? 2 : geo.accuracy ?? 3;
  if (accuracy > getNavigationPolicy().gps_progress_accuracy_m) throw new Error('location');
  // Nearby parallel or crossing legs cannot be disambiguated by one GPS fix.
  const alternatives = [
    projectPointOnRoute([geo.lng, geo.lat], coordinates, { maxAlong: projection.alongDistanceM - 15 }),
    projectPointOnRoute([geo.lng, geo.lat], coordinates, { minAlong: projection.alongDistanceM + 15 })
  ];
  if (alternatives.some(p => p && p.lateralDistanceM <= projection.lateralDistanceM + accuracy * 2)) {
    throw new Error('location');
  }
  // Re-evaluate progress within this floor/segment without skipping a floor confirmation.
  const segmentId = steps[currentStep]?.segmentId;
  let index = currentStep;
  while (index > 0 && steps[index - 1].type !== 'stepChangeFloor'
    && steps[index - 1].segmentId === segmentId) index -= 1;
  for (; index < steps.length;) {
    const progress = getNavigationProgress(geo, steps, index, coordinates);
    if (progress.nextStep === index) return index;
    index = progress.nextStep;
  }
  return currentStep;
}
