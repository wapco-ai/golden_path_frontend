export function formatRouteDuration(durationSeconds, intl, formatDigits) {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return '—';

  const rounded = Math.round(durationSeconds);
  const secondsLabel = seconds => `${formatDigits(seconds)} ${intl.formatMessage({ id: 'secondsUnit' })}`;
  if (durationSeconds < 60) return secondsLabel(rounded);

  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  const minutesLabel = `${formatDigits(minutes)} ${intl.formatMessage({ id: 'minutesUnit' })}`;
  return seconds ? `${minutesLabel} ${secondsLabel(seconds)}` : minutesLabel;
}

export const serverStepDuration = step => step?.span_duration_s ?? step?.duration_s ?? step?.durationSeconds;

export function elapsedDuration(start, end) {
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : undefined;
}
