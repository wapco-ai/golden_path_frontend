import { useCallback, useState } from 'react';
import { getPointFloor } from '../utils/floors';
import { readQrPoint } from '../services/qrLocationService';

// Keep unknown endpoint floors unknown until the user explicitly confirms one.
export default function useEndpointFloor() {
  const [floorRequest, setFloorRequest] = useState(null);
  const askFloor = useCallback((point, target, apply) => {
    if (getPointFloor(point) !== null) { apply(point); return; }
    setFloorRequest(previous => previous || {
      target,
      onSelect: floor => {
        const qr = readQrPoint();
        if (point.source === 'qr' && qr?.coordinates?.every((value, i) => value === point.coordinates?.[i])) {
          sessionStorage.setItem('qrFloor', String(floor));
        }
        apply({ ...point, floor });
        setFloorRequest(null);
      },
    });
  }, []);
  return { floorRequest, askFloor, clearFloorRequest: useCallback(() => setFloorRequest(null), []) };
}
