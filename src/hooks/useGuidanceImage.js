import { useEffect, useRef, useState } from 'react';
import { fetchLandmarkViewImage } from '../services/landmarkViewImageService.js';
import { startGuidanceImagePolling } from '../services/guidanceImagePolling.js';
import { isNavigationGeo } from '../utils/rngNavigation.js';

export default function useGuidanceImage(request, contextKey) {
  const latest = useRef(request);
  latest.current = request;
  const enabled = isNavigationGeo(request?.geo) && Number.isFinite(request?.heading);
  const [state, setState] = useState({ key: null, data: null, error: null, loading: false });
  useEffect(() => {
    setState({ key: contextKey, data: null, error: null, loading: enabled });
    if (!enabled) return undefined;
    return startGuidanceImagePolling({
      readRequest: () => latest.current,
      fetchImage: fetchLandmarkViewImage,
      onResult: (data) => setState((previous) => ({ ...previous, data, error: null })),
      onError: (error) => setState((previous) => ({ ...previous, data: null, error })),
      onLoading: (loading) => setState((previous) => ({ ...previous, loading }))
    });
  }, [contextKey, enabled]);
  // Do not render even one frame of the previous step/floor's image.
  return state.key === contextKey ? state : { data: null, error: null, loading: enabled };
}
