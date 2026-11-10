import { useEffect } from 'react';
import { readQrPoint, resolveQrPoint } from '../services/qrLocationService';
import { getLocationTitleById } from '../utils/getLocationTitle';

export default function useQrOrigin(setOrigin, language, defaultName, enabled = true) {
  useEffect(() => {
    const point = readQrPoint();
    if (!enabled || (!point && !sessionStorage.getItem('qrId'))) return undefined;
    let active = true;
    const apply = value => {
      if (active) setOrigin(previous => !previous || previous.source === 'qr' ? value : previous);
    };
    if (point && (point.verified || !point.qrCode)) apply({ ...point, name: sessionStorage.getItem('qrName') || defaultName });
    const id = sessionStorage.getItem('qrId');
    Promise.all([resolveQrPoint(language), id ? getLocationTitleById(id) : Promise.resolve(null)])
      .then(([resolved, title]) => {
        if (resolved) apply({ ...resolved, name: sessionStorage.getItem('qrName') || title || defaultName });
        else if (active) setOrigin(previous => previous?.source === 'qr' ? null : previous);
      }).catch(() => { /* The endpoint picker can resolve a missing floor. */ });
    return () => { active = false; };
  }, [setOrigin, language, defaultName, enabled]);
}
