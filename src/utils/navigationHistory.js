const PATH_HISTORY_KEY = 'appPathHistory';
const MAX_PATH_HISTORY_LENGTH = 50;

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
