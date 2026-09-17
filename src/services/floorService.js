import appConfig from '../config/appConfig.js';
import { normalizeFloorCatalog } from '../utils/floors.js';

let cached = null;
let expiresAt = 0;
let pending = null;

// Public data: no admin client, login or authorization header is required.
export async function fetchFloors() {
  if (cached && Date.now() < expiresAt) return cached;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(`${appConfig.apiBaseUrl}/api/v1/floors`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Could not load floors');
    const floors = normalizeFloorCatalog(await response.json());
    if (!floors.length) throw new Error('Empty floor catalog');
    cached = floors;
    expiresAt = Date.now() + 5 * 60 * 1000;
    return floors;
  })();
  try { return await pending; } finally { pending = null; }
}
