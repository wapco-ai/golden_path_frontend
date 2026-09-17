import { useCallback, useEffect, useState } from 'react';
import { fetchFloors } from '../services/floorService.js';

export default function useFloorCatalog({ enabled = true } = {}) {
  const [state, setState] = useState({ floors: [], loading: Boolean(enabled), error: false });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    if (enabled) setRevision(value => value + 1);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setState({ floors: [], loading: false, error: false });
      return undefined;
    }

    let active = true;
    setState(previous => ({ ...previous, loading: true, error: false }));
    fetchFloors().then(floors => {
      if (active) setState({ floors, loading: false, error: false });
    }).catch(() => {
      if (active) setState({ floors: [], loading: false, error: true });
    });
    return () => { active = false; };
  }, [enabled, revision]);

  return { ...state, retry };
}
