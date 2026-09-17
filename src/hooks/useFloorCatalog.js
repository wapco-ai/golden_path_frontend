import { useCallback, useEffect, useState } from 'react';
import { fetchFloors } from '../services/floorService.js';

export default function useFloorCatalog() {
  const [state, setState] = useState({ floors: [], loading: true, error: false });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setState(previous => ({ ...previous, loading: true, error: false }));
    fetchFloors().then(floors => {
      if (active) setState({ floors, loading: false, error: false });
    }).catch(() => {
      if (active) setState({ floors: [], loading: false, error: true });
    });
    return () => { active = false; };
  }, [revision]);
  return { ...state, retry };
}
