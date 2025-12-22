import { AuthTokensDTO } from './types';

let refreshPromise: Promise<AuthTokensDTO> | null = null;

export const enqueueRefresh = (refreshFn: () => Promise<AuthTokensDTO>) => {
  if (!refreshPromise) {
    refreshPromise = refreshFn().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export default enqueueRefresh;
