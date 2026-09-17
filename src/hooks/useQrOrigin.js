import { useEffect } from 'react';
import { readQrPoint, resolveQrPoint } from '../services/qrLocationService';
import { getLocationTitleById } from '../utils/getLocationTitle';

export default function useQrOrigin(setOrigin, language, defaultName, enabled = true) {
  useEffect(() => {
    const point = readQrPoint();
    if (!enabled || !point) return undefined;
    let active = true;
    const apply = value => {
      if (active) setOrigin(previous => !previous || previous.source === 'qr' ? value : previous);
    };
    apply({ ...point, name: sessionStorage.getItem('qrName') || defaultName });
    const id = sessionStorage.getItem('qrId');
    Promise.all([resolveQrPoint(language), id ? getLocationTitleById(id) : Promise.resolve(null)])
      .then(([resolved, title]) => {
        if (resolved) apply({ ...resolved, name: title || sessionStorage.getItem('qrName') || defaultName });
      }).catch(() => { /* The endpoint picker can resolve a missing floor. */ });
    return () => { active = false; };
  }, [setOrigin, language, defaultName, enabled]);
}
