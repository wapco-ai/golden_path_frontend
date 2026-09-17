import { useCallback, useRef, useState } from 'react';
import { getPointFloor } from '../utils/floors';
import { readQrPoint } from '../services/qrLocationService';

// Keep unknown endpoint floors unknown until the user explicitly confirms one.
export default function useEndpointFloor() {
  const [floorRequest, setFloorRequest] = useState(null);
  const pending = useRef(null);
  const clearFloorRequest = useCallback(() => { pending.current = null; setFloorRequest(null); }, []);
  const askFloor = useCallback((point, target, apply) => {
    if (getPointFloor(point) !== null) { clearFloorRequest(); apply(point); return; }
    const key = JSON.stringify([target, point.id ?? point.value, point.source, point.coordinates, point.name]);
    pending.current = { key, point, apply };
    setFloorRequest(previous => previous?.key === key ? previous : {
      key,
      target,
      onSelect: floor => {
        const current = pending.current;
        if (!current || current.key !== key) return;
        const { point, apply } = current;
        const qr = readQrPoint();
        if (point.source === 'qr' && qr?.coordinates?.every((value, i) => value === point.coordinates?.[i])) {
          sessionStorage.setItem('qrFloor', String(floor));
        }
        clearFloorRequest();
        apply({ ...point, floor });
      },
    });
  }, [clearFloorRequest]);
  return { floorRequest, askFloor, clearFloorRequest };
}
