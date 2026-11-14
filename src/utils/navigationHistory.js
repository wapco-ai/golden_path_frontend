const PATH_HISTORY_KEY = 'appPathHistory';
const MAX_PATH_HISTORY_LENGTH = 50;
const ENDED_TRIP_KEY = 'endedTripHistory';
const tripPaths = new Set(['/fs', '/rop', '/rng']);

const readEndedTrip = () => {
  try {
    return JSON.parse(sessionStorage.getItem(ENDED_TRIP_KEY));
  } catch {
    return null;
  }
};

export function finishTripHistory(position) {
  sessionStorage.setItem(ENDED_TRIP_KEY, JSON.stringify({ index: window.history.state?.idx, position }));
  writePathHistory(readPathHistory().filter(path => !tripPaths.has(path)));
}

export function endedTripForLocation(location, navigationType) {
  const ended = readEndedTrip();
  const index = window.history.state?.idx;
  if (!Number.isInteger(ended?.index) || !Number.isInteger(index) || index > ended.index) return null;
  if (navigationType === 'PUSH') return null;
  const path = location.state?.guidanceBackground?.pathname ?? location.pathname;
  return tripPaths.has(path) ? ended : null;
}

export function discardReplacedTripHistory(navigationType) {
  if (navigationType !== 'PUSH') return;
  const ended = readEndedTrip();
  const index = window.history.state?.idx;
  // A push from an older entry removes the forward entries, including the ended trip.
  if (Number.isInteger(index) && index <= ended?.index) {
    sessionStorage.setItem(ENDED_TRIP_KEY, JSON.stringify({ ...ended, index: index - 1 }));
  }
}

const readPathHistory = () => {
  try {
    const raw = sessionStorage.getItem(PATH_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePathHistory = (history) => {
  sessionStorage.setItem(PATH_HISTORY_KEY, JSON.stringify(history.slice(-MAX_PATH_HISTORY_LENGTH)));
};

export const recordPathInHistory = (pathname) => {
  if (!pathname) {
    return;
  }

  const history = readPathHistory();
  const lastPath = history[history.length - 1];

  if (lastPath === pathname) {
    return;
  }

  history.push(pathname);
  writePathHistory(history);
};

export const navigateToPreviousPage = (navigate, fallbackPath = '/profile') => {
  const history = readPathHistory();

  if (history.length > 1) {
    history.pop();
    const previousPath = history[history.length - 1];
    writePathHistory(history);
    navigate(previousPath, { replace: true });
    return;
  }

  navigate(fallbackPath, { replace: true });
};
