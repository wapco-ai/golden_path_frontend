import { useEffect, useState } from 'react';
import appConfig from '../config/appConfig';
import { getPointFloor } from '../utils/floors';

export function formatEndpointLabel(intl, label) {
  if (!label?.name) return null;
  return label.nearby
    ? intl.formatMessage({ id: 'nearbyEndpointName' }, { name: label.name })
    : label.name;
}

export default function useRouteEndpointLabel(point, language) {
  const [lat, lon] = point?.coordinates ?? [];
  const floor = getPointFloor(point);
  const key = (point?.fromMapSelection || point?.source === 'gps')
    && Number.isFinite(lat) && Number.isFinite(lon) && floor !== null
    ? new URLSearchParams({ lat, lon, floor, lang: language }).toString()
    : null;
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!key) return;
    const request = new AbortController();
    let active = true;
    const timeout = setTimeout(() => request.abort(), 2500);
    fetch(`${appConfig.apiBaseUrl}/api/v1/route-endpoint-label?${key}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: request.signal
    })
      .then(response => response.ok ? response.json() : null)
      .catch(() => null)
      .then(data => {
        if (active) setResult({ key, label: data?.label ?? null });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      request.abort();
    };
  }, [key]);

  const resolved = Boolean(key && result?.key === key);
  return { pending: Boolean(key && !resolved), label: resolved ? result.label : null };
}
