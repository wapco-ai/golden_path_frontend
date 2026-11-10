import { getNavigationPolicy } from '../services/navigationPolicy.js';
import { isFresh } from './locationQuality.js';
import { getNavigationProgress, getStepStartRouteM, projectPointOnRoute } from './rngNavigation.js';
import { getLineDistanceMeters } from './routeSegments.js';

// Tracks observations on a server-provided line; never builds or edits route geometry.
export class NavigationProgressTracker {
  reset(initialRouteM = null, initialDistance = 0) {
    this.initialRouteM = initialRouteM;
    this.distance = initialDistance;
    this.snappedGeo = null;
    this.warning = null;
    this.blocked = false;
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
        const blocked = this.blocked, warning = this.warning;
        this.reset(null, measurement?.distanceSinceAnchor ?? 0);
        this.blocked = blocked; this.warning = warning;
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
    const fail = (reason, latch = false) => {
      this.arrival = null;
      this.warning = reason;
      this.blocked ||= latch;
      return unchanged;
    };
    if (this.blocked) return unchanged;
    if (Number.isFinite(measurement?.accuracy) && measurement.accuracy > policy.warning_uncertainty_m)
      return fail('uncertainty', true);
    if (!measurement || measurement.source !== 'dead_reckoning'
      || !isFresh(measurement.timestamp, now, policy.measurement_max_age_ms)
      || !Number.isFinite(measurement.accuracy) || measurement.accuracy < 0
      || !Number.isFinite(measurement.distanceSinceAnchor)) return fail('position');
    if (this.timestamp !== null && measurement.timestamp <= this.timestamp) return unchanged;
    if (!Number.isFinite(measurement.heading)) return fail('heading');
    const walked = measurement.distanceSinceAnchor - this.distance;
    if (walked < 0) return fail('position', true);
    const window = policy.route_window_m + walked;
    const projection = projectPointOnRoute([measurement.lng, measurement.lat], coordinates,
      { minAlong: Math.max(0, this.along - window), maxAlong: this.along + window });
    this.timestamp = measurement.timestamp;
    this.distance = measurement.distanceSinceAnchor;
    if (total > 0 && (!projection || projection.lateralDistanceM > policy.snap_distance_m))
      return fail('off_route', true);
    if (projection) {
      const difference = h => Math.abs(((h - measurement.heading + 540) % 360) - 180);
      // No snapping around a corner that the pedestrian has not turned.
      if (walked > 0 && difference(projection.heading) > policy.heading_tolerance_deg)
        return fail('heading');
      const ambiguous = projection.candidates.some(other =>
        Math.abs(other.alongDistanceM - projection.alongDistanceM) > policy.route_window_m * 2
        && other.lateralDistanceM <= projection.lateralDistanceM + Math.min(3, measurement.accuracy)
        && difference(other.heading) <= policy.heading_tolerance_deg);
      if (ambiguous) return fail('ambiguous', true);
      this.along = projection.alongDistanceM;
      this.routeM = projection.routeM;
      this.snappedGeo = projection.geo;
    }
    this.warning = null;
    // Display snapping never becomes an anchor or reduces the uncertainty budget.
    // Arrival also requires the raw estimate to be close to the endpoint.
    const progress = getNavigationProgress(measurement, steps, currentStep, coordinates,
      { projection: projection ? { ...projection, lateralDistanceM: 0 } : null,
        arrivalRadius: policy.arrival_radius_m });
    if (!progress.arrived || walked <= 0) {
      this.arrival = null;
      return { ...progress, arrived: false };
    }
    if (!this.arrival) this.arrival = { since: measurement.timestamp, count: 0 };
    this.arrival.count += 1;
    return { ...progress, arrived: this.arrival.count >= policy.arrival_samples
      && measurement.timestamp - this.arrival.since >= policy.arrival_dwell_ms };
  }

}
