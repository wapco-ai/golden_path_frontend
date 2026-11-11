import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { acceptLinkedQrPoint } from '../services/qrLocationService';

export default function useHomeQrEntry(language) {
  const location = useLocation();
  const navigate = useNavigate();
  const previousPage = useRef(location);
  const [confirmedLink, setConfirmedLink] = useState(null);
  const home = previousPage.current.pathname === '/mpb' ? previousPage.current : null;
  const query = new URLSearchParams(location.search.replace(/&amp;/g, '&'));
  const isQrLink = home && location.pathname === '/location' && !location.state?.location
    && query.has('lat') && query.has('lng') && query.has('id');
  const qrId = isQrLink ? query.get('id') : null;
  const pendingQr = isQrLink && confirmedLink !== location;

  useEffect(() => {
    if (!pendingQr) {
      previousPage.current = location;
      return;
    }

    // A fragment-only QR link can arrive without reloading the document.
    // Keep the home map and its GPS watch mounted until the server accepts it.
    const controller = new AbortController();
    const restoreHome = () => navigate(
      { pathname: home.pathname, search: home.search, hash: home.hash },
      { replace: true, state: home.state }
    );
    const timer = window.setTimeout(() => {
      controller.abort();
      restoreHome();
    }, 5000);

    acceptLinkedQrPoint(qrId, language, controller.signal).then(point => {
      if (controller.signal.aborted) return;
      if (!point) {
        restoreHome();
        return;
      }
      for (const key of ['mapSelectedLat', 'mapSelectedLng', 'mapSelectedId']) sessionStorage.removeItem(key);
      setConfirmedLink(location);
    }).catch(() => {
      if (!controller.signal.aborted) restoreHome();
    }).finally(() => window.clearTimeout(timer));

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [pendingQr, qrId, home, location, language, navigate]);

  return pendingQr ? home : location;
}
