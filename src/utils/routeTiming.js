export function formatRouteDuration(seconds, intl) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const wholeSeconds = Math.trunc(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remaining = wholeSeconds % 60;
  const secondsText = `${remaining} ${intl.formatMessage({ id: 'secondsUnit' })}`;
  if (!minutes) return secondsText;
  const minutesText = `${minutes} ${intl.formatMessage({ id: 'minutesUnit' })}`;
  return remaining ? `${minutesText} ${secondsText}` : minutesText;
}

export function routeSpanDuration(segment, totalSeconds) {
  const { fromStep, step, fromM, toM } = segment;
  const start = fromStep?.end_elapsed_s ?? fromStep?.elapsed_s;
  const end = step?.end_elapsed_s ?? step?.elapsed_s;
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return Math.max(0, end - start);
  }
  return Number.isFinite(totalSeconds) ? totalSeconds * Math.max(0, toM - fromM) : null;
}


export function routeGeoWithTiming({ geo, durationSeconds, distanceMeters }) {
  if (!geo || !Number.isFinite(durationSeconds)) return geo;
  return {
    ...geo,
    properties: {
      ...geo.properties,
      durationSeconds,
      distanceMeters: distanceMeters ?? geo.properties?.distanceMeters
    }
  };
}
