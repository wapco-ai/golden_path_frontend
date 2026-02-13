import { NAV_STATES, hybridNavigationConfig } from './config';
import { isGpsJump } from './sensors/GNSS';
import { PDR } from './sensors/PDR';
import { HeadingEstimator } from './sensors/Heading';
import { resolveQr, snapToNavigationEdge } from './api/navigationApi';

const R = 6378137;
const toXY = ({ lat, lng }) => {
  const x = (lng * Math.PI * R) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R;
  return { x, y };
};
const toLatLng = ({ x, y }) => {
  const lng = (x / R) * (180 / Math.PI);
  const lat = (Math.atan(Math.exp(y / R)) * 360) / Math.PI - 90;
  return { lat, lng };
};

export class HybridNavigationEngine {
  constructor({ config = hybridNavigationConfig, onStateChange, onPosition, onReroute, routeState, sensorsAvailable = false } = {}) {
    this.config = config;
    this.state = NAV_STATES.GNSS_MODE;
    this.floor = 0;
    this.lastGps = null;
    this.lastGoodGpsAt = 0;
    this.lastGpsAt = 0;
    this.lastSnapAt = 0;
    this.lastSnap = null;
    this.lastRaw = null;
    this.onStateChange = onStateChange;
    this.onPosition = onPosition;
    this.onReroute = onReroute;
    this.routeState = routeState;
    this.sensorsAvailable = sensorsAvailable;
    this.pdr = new PDR(config);
    this.heading = new HeadingEstimator();
    this.debug = [];
  }

  log(event, payload = {}) {
    this.debug.push({ t: Date.now(), event, ...payload });
    if (this.debug.length > this.config.ringBufferSize) this.debug.shift();
    console.debug('[HybridNav]', event, payload);
  }

  setRouteState(routeState) {
    this.routeState = routeState;
  }

  setFloor(floor) {
    this.floor = floor;
  }

  setSensorsAvailable(v) {
    this.sensorsAvailable = v;
  }

  transition(next) {
    if (next === this.state) return;
    this.state = next;
    this.log('mode_change', { mode: next });
    this.onStateChange?.(next);
  }

  async snapPosition(rawPos, force = false) {
    const now = Date.now();
    if (!force && now - this.lastSnapAt < this.config.snapMinIntervalMs) return this.lastSnap;

    this.lastSnapAt = now;
    try {
      const snap = await snapToNavigationEdge({ floor: this.floor, lng: rawPos.lng, lat: rawPos.lat });
      const snapped = {
        lng: snap.snapped_lng,
        lat: snap.snapped_lat,
        edge_id: snap.edge_id,
        distance_m: snap.distance_to_edge_m
      };
      this.lastSnap = snapped;
      return snapped;
    } catch (e) {
      this.log('snap_error', { message: e.message });
      return this.lastSnap;
    }
  }

  emitPosition({ floor, lng, lat, accuracy_m, source, confidence, snapped }) {
    const payload = { floor, lng, lat, accuracy_m, source, confidence, snapped };
    this.onPosition?.(payload);
  }

  async handleGps(gps) {
    const now = gps.timestamp || Date.now();
    const point = { lat: gps.lat, lng: gps.lng, timestamp: now };
    const jump = isGpsJump(this.lastGps, point, this.config.gpsJumpDistanceM, this.config.gpsJumpWindowMs);
    this.lastGps = point;
    this.lastGpsAt = now;

    const badAccuracy = gps.accuracy > this.config.gpsBadAccuracyM;
    if (!badAccuracy) this.lastGoodGpsAt = now;

    const badForLong = badAccuracy && now - this.lastGoodGpsAt > this.config.gpsBadDurationMs;
    const stale = now - this.lastGpsAt > this.config.gpsNoUpdateTimeoutMs;

    if ((badForLong || stale || jump) && this.sensorsAvailable) {
      this.transition(NAV_STATES.DR_MODE);
    } else if (!badForLong && !jump) {
      this.transition(NAV_STATES.GNSS_MODE);
    }

    if (this.state !== NAV_STATES.GNSS_MODE) return;

    const snapped = await this.snapPosition({ lat: gps.lat, lng: gps.lng }, true);
    if (!snapped) return;

    this.lastRaw = { lat: gps.lat, lng: gps.lng };
    this.emitPosition({
      floor: this.floor,
      lng: snapped.lng,
      lat: snapped.lat,
      accuracy_m: gps.accuracy,
      source: 'GNSS',
      confidence: Math.max(0.2, Math.min(1, 1 - gps.accuracy / 50)),
      snapped
    });
  }

  async handleStep({ headingDeg }) {
    if (this.state !== NAV_STATES.DR_MODE || !this.lastRaw) return;
    const origin = toXY(this.lastRaw);
    const rad = (headingDeg * Math.PI) / 180;
    const next = { x: origin.x + this.config.stepLengthM * Math.cos(rad), y: origin.y + this.config.stepLengthM * Math.sin(rad) };
    const ll = toLatLng(next);
    this.lastRaw = ll;

    const snapped = await this.snapPosition(ll, false);
    if (!snapped) return;

    const corrected = snapped.distance_m > this.config.snapHardCorrectionDistanceM ? { lat: snapped.lat, lng: snapped.lng } : ll;
    this.lastRaw = corrected;

    this.emitPosition({
      floor: this.floor,
      lng: snapped.lng,
      lat: snapped.lat,
      accuracy_m: 8,
      source: 'DR',
      confidence: 0.65,
      snapped
    });
  }

  async handleQrScanned(code) {
    const qr = await resolveQr(code);
    this.transition(NAV_STATES.QR_CORRECTION);
    this.floor = qr.floor ?? this.floor;

    const snapped = await this.snapPosition({ lat: qr.lat, lng: qr.lng }, true);
    if (!snapped) return;

    this.lastRaw = { lat: snapped.lat, lng: snapped.lng };
    this.pdr.reset();
    this.heading.reset(qr.bearing_hint || 0);

    this.emitPosition({
      floor: this.floor,
      lng: snapped.lng,
      lat: snapped.lat,
      accuracy_m: 2,
      source: 'QR',
      confidence: 1,
      snapped
    });

    if (this.routeState?.isNavigating) {
      this.onReroute?.({ lat: snapped.lat, lng: snapped.lng, floor: this.floor, reason: 'qr_anchor' });
    }

    this.transition(NAV_STATES.GNSS_MODE);
  }
}

export default HybridNavigationEngine;
