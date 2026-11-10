import { isFresh, PROGRESS_MAX_ACCURACY, ARRIVAL_MAX_ACCURACY } from './locationQuality.js';
import { getNavigationProgress, getStepStartRouteM, projectPointOnRoute } from './rngNavigation.js';
import { getLineDistanceMeters } from './routeSegments.js';

// Tracks observations on a server-provided line; never builds or edits route geometry.
export class NavigationProgressTracker {
  reset(initialRouteM = null) {
    this.initialRouteM = initialRouteM;
    this.context = null;
    this.timestamp = null;
    this.along = null;
    this.routeM = null;
    this.arrival = null;
  }

  constructor() { this.reset(); }

  update({ measurement, steps, currentStep, coordinates, context, mode, now = Date.now() }) {
    const unchanged = { nextStep: currentStep, arrived: false };
    if (this.context !== context) {
      this.reset(this.context === null ? this.initialRouteM : null);
      this.context = context;
    }
    const total = getLineDistanceMeters(coordinates);
    const startM = this.initialRouteM ?? getStepStartRouteM(steps?.[currentStep], coordinates) ?? 0;
    if (this.along === null) { this.along = startM * total; this.routeM = startM; }
    if (!measurement || !isFresh(measurement.timestamp, now)
      || !Number.isFinite(measurement.accuracy) || measurement.accuracy < 0
      || measurement.accuracy > PROGRESS_MAX_ACCURACY) {
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
    if (total > 0 && (!projection || projection.lateralDistanceM > 6)) {
      this.arrival = null;
      return unchanged;
    }
    if (projection) {
      this.along = projection.alongDistanceM;
      this.routeM = projection.routeM;
    }
    const progress = getNavigationProgress(measurement, steps, currentStep, coordinates, { projection });
    if (!progress.arrived || measurement.accuracy > ARRIVAL_MAX_ACCURACY) {
      this.arrival = null;
      return { ...progress, arrived: false };
    }
    if (!this.arrival) this.arrival = { since: measurement.timestamp, count: 0 };
    this.arrival.count += 1;
    return { ...progress, arrived: this.arrival.count >= 3 && measurement.timestamp - this.arrival.since >= 2000 };
  }
}
