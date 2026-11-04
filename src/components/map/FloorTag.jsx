import React from 'react';
import { useLangStore } from '../../store/langStore';
import { floorLabel, getPointFloor } from '../../utils/floors';

export default function FloorTag({ point, separator = true }) {
  const language = useLangStore(state => state.language);
  const floor = getPointFloor(point);
  if (floor === null) return null;
  return <span className="gp-endpoint-floor">{separator ? ' · ' : ''}{floorLabel(floor, language)}</span>;
}
