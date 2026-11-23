import { getNavigationPolicy } from '../services/navigationPolicy.js';
import { normalizeFloor } from './floors.js';
import { isFresh } from './locationQuality.js';
import { getNavigationProgress, getStepStartRouteM, isNavigationGeo, projectPointOnRoute } from './rngNavigation.js';
import { getLineDistanceMeters, haversineMeters, sliceLineByDistance } from './routeSegments.js';

// Tracks observations on a server-provided line; never builds or edits route geometry.
export class NavigationProgressTracker {
  reset(initialRouteM = null, initialDistance = 0) {
    this.initialRouteM = initialRouteM;
    this.distance = initialDistance;
    this.snappedGeo = null;
    this.routeDistance = null;
    this.context = null;
    this.timestamp = null;
    this.along = null;
    this.routeM = null;
  }

  constructor() { this.reset(); }

  update(input) {
    const { steps, currentStep, coordinates, floor } = input;
    const total = getLineDistanceMeters(coordinates);
    const progress = this.updateObservation({ ...input, total });
    const terminal = steps?.[progress.nextStep];
    const terminalFloor = normalizeFloor(terminal?.floor);
    const arrived = progress.arrived && terminal?.type === 'stepArriveDestination'
      && progress.nextStep === steps.length - 1
      && terminal.segmentId === steps[currentStep]?.segmentId
      && (terminalFloor === null || terminalFloor === normalizeFloor(floor));
    return { ...progress, arrived };
  }

  updateObservation({ measurement, steps, currentStep, coordinates, total, context, mode, now = Date.now() }) {
    const policy = getNavigationPolicy();
    const blind = !policy.gps_enabled;
    const unchanged = { nextStep: currentStep, arrived: false };
    if (this.context !== context) {
      if (this.context !== null) {
        const enteringTransfer = blind && steps?.[currentStep]?.type === 'stepChangeFloor';
        const displayGeo = this.snappedGeo;
        const discrepancy = this.routeDistance;
        this.reset(null, measurement?.distanceSinceAnchor ?? 0);
        if (enteringTransfer) {
          this.snappedGeo = displayGeo;
          this.routeDistance = discrepancy;
        }
      }
      this.context = context;
    }
    const startM = this.initialRouteM ?? getStepStartRouteM(steps?.[currentStep], coordinates) ?? 0;
    if (this.along === null) { this.along = startM * total; this.routeM = startM; }
    if (blind) return this.updateBlind({ measurement, steps, currentStep, coordinates, total, mode, now, policy });
    if (!measurement || !isFresh(measurement.timestamp, now)
      || !Number.isFinite(measurement.accuracy) || measurement.accuracy < 0
      || measurement.accuracy > policy.gps_progress_accuracy_m) return unchanged;
    // React rerenders and the age timer must not count as new observations.
    if (this.timestamp !== null && measurement.timestamp <= this.timestamp) return unchanged;
    const seconds = this.timestamp === null ? 0 : Math.min(5, (measurement.timestamp - this.timestamp) / 1000);
    const speed = ['van', 'electric-car'].includes(mode) ? 10 : 3;
    const window = 6 + seconds * speed;
    this.timestamp = measurement.timestamp;
    const projection = projectPointOnRoute([measurement.lng, measurement.lat], coordinates,
      { minAlong: Math.max(0, this.along - window), maxAlong: this.along + window });
    if (total > 0 && (!projection || projection.lateralDistanceM > policy.gps_progress_accuracy_m)) return unchanged;
    if (projection) {
      this.along = projection.alongDistanceM;
      this.routeM = projection.routeM;
    }
    const progress = getNavigationProgress(measurement, steps, currentStep, coordinates, { projection, arrivalRadius: policy.arrival_radius_m });
    return { ...progress, arrived: projection ? this.along >= total : progress.arrived };
  }

  updateBlind({ measurement, steps, currentStep, coordinates, total, mode, now, policy }) {
    const unchanged = { nextStep: currentStep, arrived: false };
    if (!measurement || measurement.source !== 'dead_reckoning'
      || !isFresh(measurement.timestamp, now, policy.measurement_max_age_ms)
      || !Number.isFinite(measurement.distanceSinceAnchor)) return unchanged;
    if (this.timestamp !== null && measurement.timestamp <= this.timestamp) return unchanged;
    const walked = measurement.distanceSinceAnchor - this.distance;
    this.timestamp = measurement.timestamp;
    this.distance = measurement.distanceSinceAnchor;
    if (walked <= 0 || steps?.[currentStep]?.type === 'stepChangeFloor') return unchanged;

    // Only detected walking distance advances the display along the server line.
    const previousAlong = this.along;
    this.along = Math.min(total, previousAlong + walked);
    const [point] = sliceLineByDistance(coordinates, this.along, this.along);
    if (point) this.snappedGeo = { lng: point[0], lat: point[1] };
    if (total > 0) this.routeM = this.along / total;
    const displayProjection = total > 0
      ? { alongDistanceM: this.along, totalDistanceM: total, lateralDistanceM: 0 } : null;
    const displayProgress = getNavigationProgress(this.snappedGeo, steps, currentStep, coordinates,
      { projection: displayProjection, arrivalRadius: policy.arrival_radius_m });
    const atEnd = Boolean(point) && this.along >= total;
    const approachingEscalator = ['walk', 'walking'].includes(mode) && steps?.[currentStep + 1]?.timedEscalator;
    const nextStep = approachingEscalator ? currentStep + Number(atEnd) : displayProgress.nextStep;
    const next = { nextStep, arrived: atEnd };

    // Raw observations are used for the route discrepancy advisory.
    if (measurement.positionTimestamp !== measurement.timestamp
      || !isNavigationGeo(measurement) || !Number.isFinite(measurement.heading)) {
      return next;
    }
    const rawPoint = [measurement.lng, measurement.lat];
    const projection = projectPointOnRoute(rawPoint, coordinates, {
      minAlong: Math.max(0, previousAlong - policy.route_window_m),
      maxAlong: this.along + policy.route_window_m,
      clipToWindow: true,
    });
    const nearest = projection ? [projection.geo.lng, projection.geo.lat] : point;
    this.routeDistance = nearest ? haversineMeters(rawPoint, nearest) : null;
    return next;
  }
}
