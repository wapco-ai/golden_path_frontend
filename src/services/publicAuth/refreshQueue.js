let refreshPromise = null;

export const enqueueRefresh = (refreshFn) => {
  if (!refreshPromise) {
    refreshPromise = refreshFn().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export default enqueueRefresh;
