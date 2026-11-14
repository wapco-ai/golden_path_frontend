import React from 'react';
import { Layer, Source } from 'react-map-gl';
import { circle } from '@turf/turf';
import { getPointFloor, normalizeFloor } from '../../utils/floors';
import { validGeo } from '../../utils/locationQuality';

export default function GpsAccuracyCircle({ id, point, floor }) {
  if (point?.source !== 'gps' || !Number.isFinite(point.accuracy) || point.accuracy <= 0) return null;
  const pointFloor = getPointFloor(point);
  if (pointFloor !== null && pointFloor !== normalizeFloor(floor)) return null;
  const [lat, lng] = point.coordinates ?? [point.lat, point.lng];
  if (!validGeo({ lat, lng })) return null;

  const area = circle([lng, lat], point.accuracy, { units: 'meters', steps: 64 });
  return (
    <Source id={id} type="geojson" data={area}>
      <Layer id={id + '-fill'} type="fill" paint={{ 'fill-color': '#2196f3', 'fill-opacity': 0.13 }} />
      <Layer id={id + '-outline'} type="line" paint={{ 'line-color': '#1676d2', 'line-opacity': 0.43, 'line-width': 1 }} />
    </Source>
  );
}
