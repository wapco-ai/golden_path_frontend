import { getLineDistanceMeters, haversineMeters, sliceLineByDistance } from './routeSegments.js';

const genericEntrance = /^(?:(?:در|درب|درگاه|ورودی|اتصال|door(?:way)?|entrance|gate|باب|بوابة|مدخل|دروازہ)(?:\s+(?:شماره[ٔ‌ی]?|نمبر|no\.?))?[\s#:-]*)?[\p{Nd}]*$/iu;
const genericArea = /^(?:(?:area|محدوده|منطقة)[\s#:-]*)?[\p{Nd}]+$/iu;
const label = value => typeof value === 'string' ? value.trim() : '';

function turnAtStep(line, routeM) {
  if (!Number.isFinite(routeM)) return null;
  const length = getLineDistanceMeters(line);
  const position = routeM * length;
  const window = Math.min(5, position, length - position);
  if (window < 2) return null;

  const incoming = sliceLineByDistance(line, position - window, position);
  const outgoing = sliceLineByDistance(line, position, position + window);
  const before = incoming[0], at = incoming.at(-1), after = outgoing.at(-1);
  if (haversineMeters(before, at) < 2 || haversineMeters(at, after) < 2) return null;

  const longitudeScale = Math.cos(at[1] * Math.PI / 180);
  const eastIn = (at[0] - before[0]) * longitudeScale;
  const northIn = at[1] - before[1];
  const eastOut = (after[0] - at[0]) * longitudeScale;
  const northOut = after[1] - at[1];
  const angle = Math.atan2(eastIn * northOut - northIn * eastOut, eastIn * eastOut + northIn * northOut) * 180 / Math.PI;
  if (Math.abs(angle) < 30) return 'up';
  if (Math.abs(angle) > 150) return 'down';
  return angle > 0 ? 'left' : 'right';
}

const turnMessage = { left: 'stepTurnLeft', right: 'stepTurnRight', down: 'stepTurnBack' };
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

export function withDoorStepInstructions(steps, intl, geo) {
  return (steps || []).reduce((display, step, index, original) => {
    if (step?.type !== 'stepPassDoor') {
      display.push(step);
      return display;
    }

    const areaName = label(step.toAreaName);
    const entrance = (label(step.doorName) || label(step.name) || label(step.originalTitle) || (!areaName ? label(step.title) : ''))
      .replace(/^عبور از\s+/, '')
      .replace(/^اتصال\s+(?=باب(?:\s|[‌-]|$))/u, '');
    const hasEntrance = !genericEntrance.test(entrance) && entrance !== areaName;
    const previous = original[index - 1];
    const repeatedArea = previous?.type === 'stepPassDoor'
      && sameId(previous.floor, step.floor) && previous.segmentId === step.segmentId
      && (
        (sameId(previous.toAreaId, step.toAreaId)
          && (step.fromAreaId == null || sameId(step.fromAreaId, step.toAreaId) || sameId(step.fromAreaId, previous.fromAreaId)))
        || (sameId(previous.toAreaId, step.fromAreaId) && areaName && label(previous.toAreaName) === areaName)
      );
    const sameArea = sameId(step.fromAreaId, step.toAreaId)
      || (step.fromAreaId == null && step.toAreaId == null && areaName && label(step.fromAreaName) === areaName);
    const stayingInArea = sameArea || repeatedArea;
    const hasArea = areaName && !genericArea.test(areaName);
    const area = intl.locale === 'fa' ? areaName.replace(/^راهرو\s+/, 'راهروی ') : areaName;
    const line = geo?.properties?.multifloor
      ? geo.properties.segments?.find(segment => segment.kind === 'walk'
        && sameId(segment.id, step.segmentId) && sameId(segment.floor, step.floor))?.geometry?.coordinates
      : geo?.geometry?.type === 'LineString' ? geo.geometry.coordinates : undefined;
    const turn = stayingInArea && !hasEntrance ? turnAtStep(line, step.routeM) : null;
    if (repeatedArea && turn === 'up' && !step.landmark
        && Number.isFinite(previous.routeM) && previous.routeM > 0
        && previous.routeM < step.routeM && step.routeM < 1) return display;

    let id = hasEntrance ? 'stepUseNamedEntrance' : 'stepContinueOnRoute';
    if (turnMessage[turn]) id = turnMessage[turn];
    else if (hasArea && stayingInArea && !hasEntrance) id = 'stepContinueInArea';
    else if (hasArea && !stayingInArea) {
      const courtyard = step.toAreaType === 'courtyard' || /^صحن(?:\s|$)/u.test(areaName);
      if (courtyard) id = hasEntrance ? 'stepGoToAreaViaEntrance' : 'stepGoToArea';
      else id = hasEntrance ? 'stepEnterAreaViaEntrance' : 'stepEnterArea';
    }

    display.push({ ...step, ...(turnMessage[turn] ? { maneuver: turn } : {}),
      instruction: intl.formatMessage({ id }, { area, entrance }) });
    return display;
  }, []);
}
