import { useCallback, useEffect, useState } from 'react';

export default function useAdminTablePreferences(table, sortColumns) {
  const storageKey = `gp_admin_table_${table}`;
  const [preferences, setPreferences] = useState(() => {
    const defaults = { page: 1, search: '', sort: 'id:desc' };
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storageKey));
      if (!saved) return defaults;

      const [column, direction, extra] = typeof saved.sort === 'string' ? saved.sort.split(':') : [];
      return {
        page: Number.isSafeInteger(saved.page) && saved.page > 0 ? saved.page : defaults.page,
        search: typeof saved.search === 'string' ? saved.search : defaults.search,
        sort: sortColumns.includes(column) && ['asc', 'desc'].includes(direction) && extra === undefined
          ? saved.sort : defaults.sort
      };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      // The table still works if session storage is unavailable.
    }
  }, [storageKey, preferences]);

  const setPage = useCallback((page) => {
    setPreferences((current) => current.page === page ? current : { ...current, page });
  }, []);

  const setSearch = (search) => setPreferences((current) => ({ ...current, search, page: 1 }));
  const setSort = (column) => setPreferences((current) => ({
    ...current,
    sort: `${column}:${current.sort === `${column}:asc` ? 'desc' : 'asc'}`,
    page: 1
  }));

  return { ...preferences, setPage, setSearch, setSort };
}
