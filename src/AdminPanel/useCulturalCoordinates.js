import { useCallback, useState } from 'react';
import { COORDINATE_FIELDS, parseCoordinate, parseCulturalCoordinates } from '../utils/culturalCoordinates.js';

const emptyDraft = () => ({ lat: '', lng: '' });

export default function useCulturalCoordinates() {
  const [state, setState] = useState(() => ({ location: null, draft: emptyDraft(), touched: {}, source: 'selection' }));

  // Map clicks, loading an item and resetting a form update both values together.
  const selectLocation = useCallback(location => {
    const draft = location ? { lat: String(location.lat), lng: String(location.lng) } : emptyDraft();
    setState({ location: parseCulturalCoordinates(draft), draft, touched: {}, source: 'selection' });
  }, []);

  const changeCoordinate = (name, value) => {
    setState(previous => {
      const draft = { ...previous.draft, [name]: value };
      return {
        draft, location: parseCulturalCoordinates(draft), source: 'manual',
        touched: { ...previous.touched, [name]: true }
      };
    });
  };

  const validate = () => {
    setState(previous => ({ ...previous, touched: { lat: true, lng: true } }));
    return state.location !== null;
  };

  const errors = Object.fromEntries(COORDINATE_FIELDS.map(({ name, limit }) => [name,
    state.touched[name] && parseCoordinate(state.draft[name], limit) === null
      ? (state.draft[name].trim() ? `عدد معتبر بین ${-limit} و ${limit} وارد کنید.` : 'این مختصات را وارد کنید.')
      : ''
  ]));

  return { ...state, selectLocation, changeCoordinate, validate, errors };
}
