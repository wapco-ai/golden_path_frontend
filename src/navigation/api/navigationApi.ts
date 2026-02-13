import appConfig from '../../config/appConfig';

const apiBase = appConfig.apiBaseUrl;

export const resolveQr = async (code) => {
  if (import.meta.env.DEV && import.meta.env.VITE_NAV_MOCK === '1') {
    return { floor: 0, lng: 59.6156, lat: 36.2879, bearing_hint: 90 };
  }
  const res = await fetch(`${apiBase}/api/v1/navigation/qr/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`QR resolve failed: ${res.status}`);
  return res.json();
};

export const snapToNavigationEdge = async ({ floor, lng, lat }) => {
  if (import.meta.env.DEV && import.meta.env.VITE_NAV_MOCK === '1') {
    return {
      snapped_lng: lng,
      snapped_lat: lat,
      edge_id: 'mock-edge',
      distance_to_edge_m: 0
    };
  }
  const res = await fetch(`${apiBase}/api/v1/navigation/snap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ floor, lng, lat })
  });
  if (!res.ok) throw new Error(`Snap failed: ${res.status}`);
  return res.json();
};
