import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { getConnector, listConnectors, listFloors, resolveConnectorArea } from '../services/adminConnectorsService';
import { emptyConnector, floorLabel, newStop } from '../utils/connectorForm';
import { DOOR_ACCESS_LAYER_ID } from '../config/vectorTiles';

export default function useConnectorForm({ map, mapFloor, setMapFloor, setModalOpen, fillInfo }) {
  const [value, setValue] = useState(emptyConnector);
  const [point, setPoint] = useState(null);
  const [floors, setFloors] = useState([{ floor: 0, label: 'همکف' }, { floor: -1, label: 'منفی ۱' }]);
  const [groups, setGroups] = useState([]);
  const [picking, setPicking] = useState(null);
  const pickRef = useRef(null);
  const generation = useRef(0);
  useEffect(() => { let active = true; listFloors().then(data => { if (active) setFloors(data); }).catch(() => {}); return () => { active = false; }; }, []);
  const reset = () => { generation.current++; setValue(emptyConnector()); setPoint(null); };
  const resolve = async (stop, index, currentGeneration = generation.current) => {
    try {
      const result = await resolveConnectorArea({ floor: stop.floor, access_id: stop.access_id, lat: stop.lat, lon: stop.lon });
      if (generation.current !== currentGeneration) return;
      setValue(c => ({ ...c, stops: c.stops.map((s, i) => Number(s.floor) === Number(stop.floor) && s.access_id === stop.access_id && s.lat === stop.lat && s.lon === stop.lon ? { ...s, ...result, resolving: false, error: result.areas.length ? '' : 'فضای قابل‌تردد پیدا نشد؛ نقطه را دوباره انتخاب کنید.' } : s) }));
    } catch (error) {
      if (generation.current !== currentGeneration) return;
      setValue(c => ({ ...c, stops: c.stops.map((s, i) => Number(s.floor) === Number(stop.floor) && s.access_id === stop.access_id && s.lat === stop.lat && s.lon === stop.lon ? { ...s, resolving: false, error: error?.response?.data?.message || 'تشخیص فضای دسترسی ناموفق بود؛ نقطه را دوباره انتخاب کنید.' } : s) }));
    }
  };
  const initialize = (info, fallbackPoint = null) => {
    generation.current++;
    const initialPoint = info?.point || fallbackPoint;
    setPoint(initialPoint);
    if (info?.connector) {
      setValue(info.connector);
    } else {
      const stop = initialPoint ? { ...newStop(initialPoint.floor), ...initialPoint, resolving: true } : null;
      setValue({ ...emptyConnector(), stops: stop ? [stop] : [] });
      if (stop) resolve(stop, 0);
    }
    listConnectors().then(setGroups).catch(() => toast.error('دریافت اتصال‌های موجود ناموفق بود.'));
  };
  const join = async (id) => {
    try {
      const connector = await getConnector(id);
      if (point && !connector.stops.some(s => Number(s.floor) === Number(point.floor))) {
        connector.stops.push({ ...newStop(point.floor, connector.kind), ...point, resolving: true });
      } else if (point && !connector.stops.some(s => Number(s.access_id) === Number(point.access_id))) {
        toast.error('این اتصال در طبقهٔ فعلی توقف دارد؛ آن توقف را از همین فرم ویرایش کنید.');
      }
      generation.current++;
      fillInfo({ ...connector.info, connector });
      setValue(connector);
      connector.stops.forEach((s, i) => { if (s.resolving) resolve(s, i); });
    } catch (error) { toast.error(error?.response?.data?.message || 'دریافت اتصال ناموفق بود.'); }
  };
  const cancelPick = () => {
    const current = pickRef.current;
    if (!current) return;
    toast.dismiss('connector-map-pick');
    pickRef.current = null; setPicking(null); setMapFloor(current.previousFloor); setModalOpen(true);
  };
  const pick = (index) => {
    if (!map) { toast.error('نقشه هنوز آماده نیست.'); return; }
    const next = { index, floor: value.stops[index].floor, previousFloor: mapFloor };
    pickRef.current = next; setPicking(next);
    setMapFloor(floorLabel(next.floor)); setModalOpen(false);
    toast.info('نقطهٔ دسترسی این توقف را روی نقشه انتخاب کنید. برای لغو Esc را بزنید.', { toastId: 'connector-map-pick', autoClose: false });
  };
  useEffect(() => {
    if (!map || !picking) return;
    const click = (event) => {
      const current = pickRef.current;
      if (!current) return;
      // Only an actual hit on an access point can reuse its identity. Never use doors.geom.
      const hits = map.getLayer(DOOR_ACCESS_LAYER_ID) ? map.queryRenderedFeatures(event.point, { layers: [DOOR_ACCESS_LAYER_ID] }) : [];
      const hit = hits.find(f => f.geometry?.type === 'Point' && Number(f.properties.floor) === Number(current.floor));
      const coords = hit?.geometry.coordinates || [event.lngLat.lng, event.lngLat.lat];
      const stop = { floor: Number(current.floor), lat: coords[1], lon: coords[0], access_id: hit ? Number(hit.properties.access_id || hit.properties.id) : null, area_id: null, areas: [], resolving: true, error: '' };
      setValue(c => ({ ...c, stops: c.stops.map((s, i) => i === current.index ? { ...s, ...stop } : s) }));
      // Keep the guard until every click listener has seen this event.
      queueMicrotask(cancelPick);
      resolve(stop, current.index);
    };
    const key = e => { if (e.key === 'Escape') cancelPick(); };
    map.on('click', click); window.addEventListener('keydown', key);
    return () => { map.off('click', click); window.removeEventListener('keydown', key); };
  }, [map, picking]);
  return { value, setValue, point, floors, groups, picking, pickRef, reset, initialize, join, pick, cancelPick };
}
