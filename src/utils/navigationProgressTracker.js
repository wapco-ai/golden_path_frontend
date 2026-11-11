import { getNavigationPolicy } from '../services/navigationPolicy.js';
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
    this.arrival = null;
  }

  constructor() { this.reset(); }

  update({ measurement, steps, currentStep, coordinates, context, mode, now = Date.now() }) {
    const policy = getNavigationPolicy();
    const blind = !policy.gps_enabled;
    const unchanged = { nextStep: currentStep, arrived: false };
    if (this.context !== context) {
      if (this.context !== null) {
        this.reset(null, measurement?.distanceSinceAnchor ?? 0);
      }
      this.context = context;
    }
    const total = getLineDistanceMeters(coordinates);
    const startM = this.initialRouteM ?? getStepStartRouteM(steps?.[currentStep], coordinates) ?? 0;
    if (this.along === null) { this.along = startM * total; this.routeM = startM; }
    if (blind) return this.updateBlind({ measurement, steps, currentStep, coordinates, total, now, policy });
    if (!measurement || !isFresh(measurement.timestamp, now)
      || !Number.isFinite(measurement.accuracy) || measurement.accuracy < 0
      || measurement.accuracy > policy.gps_progress_accuracy_m) {
      this.arrival = null;
      return unchanged;
    }
    // React rerenders and the age timer must not count as new observations.
    if (this.timestamp !== null && measurement.timestamp <= this.timestamp) return unchanged;
    const seconds = this.timestamp === null ? 0 : Math.min(5, (measurement.timestamp - this.timestamp) / 1000);
    const speed = ['van', 'electric-car'].includes(mode) ? 10 : 3;
    const window = 6 + seconds * speed;
    this.timestamp = measurement.timestamp;
    const projection = projectPointOnRoute([measurement.lng, measurement.lat], coordinates,
      { minAlong: Math.max(0, this.along - window), maxAlong: this.along + window });
    if (total > 0 && (!projection || projection.lateralDistanceM > policy.gps_progress_accuracy_m)) {
      this.arrival = null;
      return unchanged;
    }
    if (projection) {
      this.along = projection.alongDistanceM;
      this.routeM = projection.routeM;
    }
    const progress = getNavigationProgress(measurement, steps, currentStep, coordinates, { projection, arrivalRadius: policy.arrival_radius_m });
    if (!progress.arrived || measurement.accuracy > policy.gps_arrival_accuracy_m) {
      this.arrival = null;
      return { ...progress, arrived: false };
    }
    if (!this.arrival) this.arrival = { since: measurement.timestamp, count: 0 };
    this.arrival.count += 1;
    return { ...progress, arrived: this.arrival.count >= 3 && measurement.timestamp - this.arrival.since >= 2000 };
  }

  updateBlind({ measurement, steps, currentStep, coordinates, total, now, policy }) {
    const unchanged = { nextStep: currentStep, arrived: false };
    if (!measurement || measurement.source !== 'dead_reckoning'
      || !isFresh(measurement.timestamp, now, policy.measurement_max_age_ms)
      || !Number.isFinite(measurement.distanceSinceAnchor)) {
      this.arrival = null;
      return unchanged;
    }
    if (this.timestamp !== null && measurement.timestamp <= this.timestamp) return unchanged;
    const walked = measurement.distanceSinceAnchor - this.distance;
    this.timestamp = measurement.timestamp;
    this.distance = measurement.distanceSinceAnchor;
    if (walked <= 0 || steps?.[currentStep]?.type === 'stepChangeFloor') {
      this.arrival = null;
      return unchanged;
    }

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
    const next = { ...displayProgress, arrived: false };

    // Only a fresh raw observation may update the discrepancy or confirm arrival.
    if (measurement.positionTimestamp !== measurement.timestamp
      || !isNavigationGeo(measurement) || !Number.isFinite(measurement.heading)) {
      this.arrival = null;
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
    const headingMatches = !projection
      || Math.abs(((projection.heading - measurement.heading + 540) % 360) - 180) <= policy.heading_tolerance_deg;
    const rawProgress = getNavigationProgress(measurement, steps, currentStep, coordinates,
      { projection, arrivalRadius: policy.arrival_radius_m });
    if (!headingMatches || !displayProgress.arrived || !rawProgress.arrived) {
      this.arrival = null;
      return next;
    }

    if (!this.arrival) this.arrival = { since: measurement.timestamp, count: 0 };
    this.arrival.count += 1;
    return { ...next, arrived: this.arrival.count >= policy.arrival_samples
      && measurement.timestamp - this.arrival.since >= policy.arrival_dwell_ms };
  }

}
