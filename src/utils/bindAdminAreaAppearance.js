const bindings = new WeakMap();
const mapFloors = new WeakMap();
export const getAdminAppearanceFloor = map => mapFloors.get(map) ?? 0;
const sourceState = (map, sourceId) => {
  const source = map.getSource(sourceId);
  const tileUrl = source?.tiles?.[0] ?? source?.serialize?.()?.tiles?.[0];
  if (!tileUrl) return null;
  const url = new URL(tileUrl, 'http://localhost');
  const value = url.searchParams.get('p_floor');
  const floor = value === null || value.trim() === '' ? NaN : Number(value);
  if (!Number.isInteger(floor)) return null;
  return { source, tileUrl, floor, refresh: url.searchParams.get('cacheBust') };
};

export const bindAdminAreaAppearance = (map, sourceId, load) => {
  let mapBindings = bindings.get(map);
  if (!mapBindings) { mapBindings = new Map(); bindings.set(map, mapBindings); }
  if (mapBindings.has(sourceId)) return;
  let current = null;
  let requestVersion = 0;
  let disposed = false;
  let timer;
  const update = () => {
    if (disposed) return;
    const next = sourceState(map, sourceId);
    if (!next || (current?.source === next.source && current?.tileUrl === next.tileUrl)) return;
    const force = current?.refresh !== next.refresh && next.refresh !== null;
    mapFloors.set(map, next.floor);
    current = next;
    const version = ++requestVersion;
    load(next.floor, { force }).then(rows => {
      const actual = sourceState(map, sourceId);
      if (disposed || version !== requestVersion || actual?.source !== next.source || actual?.tileUrl !== next.tileUrl) return;
      for (const [id, appearance] of rows) {
        map.setFeatureState({ source: sourceId, sourceLayer: 'areas', id }, appearance);
      }
    }).catch(error => {
      if (!disposed && version === requestVersion) {
        // Unknown ownership remains neutral; never infer public access from type.
        console.warn('Area appearance metadata could not be loaded', error?.message);
        if (![401, 403].includes(error?.response?.status)) current = null;
      }
    });
  };
  const schedule = event => {
    if (event?.sourceId && event.sourceId !== sourceId) return;
    clearTimeout(timer);
    timer = setTimeout(update, 30);
  };
  const dispose = () => {
    disposed = true;
    requestVersion++;
    clearTimeout(timer);
    map.off('sourcedata', schedule);
    map.off('styledata', schedule);
    mapBindings.delete(sourceId);
  };
  mapBindings.set(sourceId, dispose);
  map.on('sourcedata', schedule);
  map.on('styledata', schedule);
  map.once('remove', dispose);
  schedule();
};
