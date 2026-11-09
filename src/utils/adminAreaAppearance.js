// Engineering map appearance. These values describe the map; routing stays server-side.
export const PRIVATE_AREA_COLOR = '#7b8490';
const UNKNOWN_AREA_COLOR = '#c3cbd5';

const adminAreaState = {
  areaPublic: ['feature-state', 'areaPublic'],
  areaCovered: ['feature-state', 'areaCovered'],
  isClosed: ['get', 'is_closed']
};

const restricted = (areaPublic, isClosed) => ['any',
  ['==', areaPublic, false],
  ['==', isClosed, true]
];

export const adminAreaFillPaint = ({ areaPublic, areaCovered, isClosed } = adminAreaState) => ({
  'fill-color': ['case',
    restricted(areaPublic, isClosed), PRIVATE_AREA_COLOR,
    ['!=', areaPublic, true], UNKNOWN_AREA_COLOR,
    ['match', ['to-string', ['get', 'area_type']],
      ['courtyard', 'sahn'], '#e5c275',
      ['riwaq', 'ravaq', 'ravagh'], '#85b9db',
      ['iwan', 'eyvan'], '#dba6a3',
      ['mosque', 'masjed'], '#b4a2d6',
      'madrese', '#aab7d7',
      'stair_area', '#deaa6e',
      'ramp_area', '#6fb49f',
      'elevator_area', '#78aaca',
      ['admin_zone', 'administrative'], '#a4b2c3',
      ['storage_area', 'warehouse_area', 'warehouse'], '#baad9e',
      ['facility_area', 'technical_area'], '#b7b1c6',
      'service_room', '#a5c3cc',
      'functional_area', '#a7cbbd',
      '#bdc9d0'
    ]
  ],
  'fill-opacity': ['case',
    ['==', areaCovered, true], 0.76,
    ['==', areaCovered, false], 0.42,
    0.55
  ]
});

export const adminAreaOutlinePaint = ({ areaPublic, areaCovered, isClosed } = adminAreaState) => ({
  'line-color': ['case',
    restricted(areaPublic, isClosed), '#596471',
    ['!=', areaPublic, true], '#8996a5',
    ['==', areaCovered, true], '#587c94',
    '#7d9277'
  ],
  'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.7, 16, 1.2, 19, 1.8, 22, 2.3],
  'line-opacity': 0.9
});

const objectValue = value => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
};
const bool = value => {
  if ([true, 1, '1', 'true'].includes(value)) return true;
  if ([false, 0, '0', 'false'].includes(value)) return false;
  return null;
};
const text = value => String(value ?? '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();

const publicAccessFromAttrs = attrs => {
  const isPublic = bool(attrs.access_policy?.public_access);
  if (isPublic !== null) return isPublic;

  const source = attrs.source_properties ?? {};
  const owner = text(source.owner ?? source.Noefaali_1 ?? attrs.owner ?? attrs.classification?.access_class);
  return owner ? ['عمومی', 'public'].includes(owner) : null;
};

export const getAreaPublicAccess = area => publicAccessFromAttrs(objectValue(area.attrs_raw ?? area.attrs));

export const getAreaAppearance = area => {
  const attrs = objectValue(area.attrs_raw ?? area.attrs);
  const operational = area.operational ?? attrs.operational ?? {};
  const source = attrs.source_properties ?? {};
  const isClosed = bool(area.is_closed ?? area.meta?.is_closed) === true;
  const covered = bool(operational.is_covered);
  return {
    areaPublic: isClosed ? false : publicAccessFromAttrs(attrs),
    areaCovered: covered ?? ({ 'سرپوشیده': true, 'روباز': false }[text(source.indoor)] ?? null)
  };
};

// The existing protected API exposes ownership/coverage, unlike the vector tile.
// Cache only per map instance, never persist administrator data or credentials.
export const createAreaAppearanceLoader = (fetchPage, now = Date.now) => {
  const cache = new Map();
  return (floor, { force = false } = {}) => {
    const previous = cache.get(floor);
    if (!force && previous && now() - previous.createdAt < 30000) return previous.promise;
    const entry = { createdAt: now() };
    entry.promise = (async () => {
      const params = { floor, per_page: 500, page: 1 };
      const first = await fetchPage(params);
      if (!Array.isArray(first?.data)) throw new Error('Invalid area metadata response');
      const lastPage = Number(first.last_page ?? 1);
      if (!Number.isInteger(lastPage) || lastPage < 1 || lastPage > 100) throw new Error('Invalid area metadata pagination');
      const rows = [...first.data];
      // Limit concurrent geometry-bearing responses from this existing API.
      for (let page = 2; page <= lastPage; page += 2) {
        const pages = await Promise.all([page, page + 1].filter(n => n <= lastPage)
          .map(n => fetchPage({ ...params, page: n })));
        for (const response of pages) {
          if (!Array.isArray(response?.data)) throw new Error('Invalid area metadata page');
          rows.push(...response.data);
        }
      }
      return new Map(rows.filter(row => row.id != null && row.floor != null && String(row.floor).trim() !== '' && Number(row.floor) === floor)
        .map(row => [String(row.id), getAreaAppearance(row)]));
    })().catch(error => {
      if (cache.get(floor) === entry) cache.delete(floor);
      throw error;
    });
    cache.set(floor, entry);
    return entry.promise;
  };
};
