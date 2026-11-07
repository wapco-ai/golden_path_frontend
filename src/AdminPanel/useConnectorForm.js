import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { getConnector, listConnectors, listFloors, resolveConnectorArea } from '../services/adminConnectorsService';
import { connectorAccessHits, emptyConnector, floorLabel, isSelectedStop, newStop } from '../utils/connectorForm';
import { DOOR_ACCESS_LAYER_ID } from '../config/vectorTiles';

export default function useConnectorForm({ map, mapFloor, setMapFloor, setModalOpen, fillInfo }) {
  const [value, setValue] = useState(emptyConnector);
  const [point, setPoint] = useState(null);
  const [floors, setFloors] = useState([{ floor: 0, label: 'همکف' }, { floor: -1, label: 'منفی ۱' }]);
  const [groups, setGroups] = useState([]);
  const [picking, setPicking] = useState(null);
  const pickRef = useRef(null);
  const generation = useRef(0);
  const joinRequest = useRef(0);
  useEffect(() => { let active = true; listFloors().then(data => { if (active) setFloors(data); }).catch(() => {}); return () => { active = false; }; }, []);
  const reset = () => { generation.current++; setValue(emptyConnector()); setPoint(null); };
  const resolve = async (stop, currentGeneration = generation.current) => {
    try {
      const result = await resolveConnectorArea({ floor: stop.floor, access_id: stop.access_id });
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
      const stop = initialPoint ? newStop(initialPoint.floor) : null;
      if (initialPoint?.access_id) Object.assign(stop, initialPoint, { resolving: true });
      setValue({ ...emptyConnector(), stops: stop ? [stop] : [] });
      if (stop?.access_id) resolve(stop);
    }
    listConnectors().then(setGroups).catch(() => toast.error('دریافت اتصال‌های موجود ناموفق بود.'));
  };
  const join = async (id) => {
    const request = ++joinRequest.current;
    const currentGeneration = generation.current;
    try {
      const connector = await getConnector(id);
      if (request !== joinRequest.current || currentGeneration !== generation.current) return;
      if (point?.access_id && !connector.stops.some(s => isSelectedStop(s, point)) && !connector.stops.some(s => Number(s.floor) === Number(point.floor))) {
        connector.stops.push({ ...newStop(point.floor, connector.kind), ...point, resolving: true });
      } else if (point?.access_id && !connector.stops.some(s => isSelectedStop(s, point))) {
        toast.error('این اتصال در طبقهٔ فعلی نقطهٔ دیگری دارد؛ برای ویرایش آن، همان نقطه را روی نقشه انتخاب کنید.');
        return;
      }
      generation.current++;
      fillInfo({ ...connector.info, connector, point });
      setValue(connector);
      connector.stops.forEach(s => { if (s.resolving) resolve(s); });
    } catch (error) {
      if (request === joinRequest.current && currentGeneration === generation.current) toast.error(error?.response?.data?.message || 'دریافت اتصال ناموفق بود.');
    }
  };
  const cancelPick = () => {
    const current = pickRef.current;
    if (!current) return;
    toast.dismiss('connector-map-pick');
    pickRef.current = null; setPicking(null); setMapFloor(current.previousFloor); setModalOpen(true);
  };
  const pick = (index) => {
    if (!value.stops[index] || isSelectedStop(value.stops[index], point)) return;
    if (!map) { toast.error('نقشه هنوز آماده نیست.'); return; }
    const next = { index, floor: value.stops[index].floor, previousFloor: mapFloor };
    pickRef.current = next; setPicking(next);
    setMapFloor(floorLabel(next.floor)); setModalOpen(false);
    toast.info('یکی از نشانگرهای ورودی همین طبقه را انتخاب کنید. برای لغو Esc را بزنید.', { toastId: 'connector-map-pick', autoClose: false });
  };
  const selectAccess = (index, floor, access) => {
    const stop = { floor: Number(floor), ...access, accessOptions: null, area_id: null, area_name: null, areas: [], resolving: true, error: '' };
    setValue(c => ({ ...c, stops: c.stops.map((s, i) => i === index ? { ...s, ...stop } : s) }));
    resolve(stop);
  };
  useEffect(() => {
    if (!map || !picking) return;
    const click = (event) => {
      const current = pickRef.current;
      if (!current) return;
      const hits = map.getLayer(DOOR_ACCESS_LAYER_ID) ? map.queryRenderedFeatures(event.point, { layers: [DOOR_ACCESS_LAYER_ID] }) : [];
      const options = connectorAccessHits(hits, current.floor);
      if (!options.length) {
        toast.info('یکی از ورودی‌های مشخص‌شدهٔ همین طبقه را انتخاب کنید.', { toastId: 'connector-map-empty-pick' });
        return;
      }
      if (options.length === 1) {
        selectAccess(current.index, current.floor, options[0]);
      } else {
        setValue(c => ({ ...c, stops: c.stops.map((s, i) => i === current.index ? { ...s, accessOptions: options } : s) }));
      }
      // Keep the guard until every click listener has seen this event.
      queueMicrotask(cancelPick);
    };
    const key = e => { if (e.key === 'Escape') cancelPick(); };
    map.on('click', click); window.addEventListener('keydown', key);
    return () => { map.off('click', click); window.removeEventListener('keydown', key); };
  }, [map, picking]);
  const updateValue = next => {
    if (point?.access_id && !next.stops.some(stop => isSelectedStop(stop, point))) return;
    setValue(next);
  };
  return { value, setValue: updateValue, point, floors, groups, picking, pickRef, reset, initialize, join, pick, cancelPick, selectAccess };
}
