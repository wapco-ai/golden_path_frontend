import { getNavigationPolicy } from './navigationPolicy.js';
import { validGeo, validGps, isFresh, HEADING_MAX_AGE } from '../utils/locationQuality.js';
import { haversineMeters } from '../utils/routeSegments.js';

export const DR_MAX_ANCHOR_AGE = 60000;
export const DR_MAX_DISTANCE = 30;
export const DR_MAX_UNCERTAINTY = 10;
// Some browsers emit orientation only when it changes. A short continuation
// requires uninterrupted gyro samples and a small net rotation from the last fix.
const MAX_GYRO_GAP_MS = 250;
const MAX_HEADING_ROTATION_DEG = 12;
const distance = (a, b) => haversineMeters([a.lng, a.lat], [b.lng, b.lat]);

class AdvancedDeadReckoningService {
  constructor() {
    this.policy = getNavigationPolicy();
    this.isActive = false;
    this.stepCount = 0;
    this.heading = null;
    this._headingAt = null;
    this._headingMotion = null;
    this.positionTimestamp = null;
    this._lastGpsAt = null;
    this._lastMotionAt = null;
    this._sensorTimer = null;
    this.geoPosition = null;
    this.geoPath = [];
    this.listeners = new Set();
    this._lastMagnitude = 0;
    this._lastStepAt = 0;
    this._stepArmed = true;
    this._smoothedMagnitude = null;
    this._gravityBaseline = null;
    this._motionMode = null;
    this._sensorRequestId = 0;
    this.stepLengthMeters = 0.7;
    this.calibrated = false;
    this.anchorTimestamp = null;
    this.positionAccuracy = null;
    this.distanceSinceAnchor = 0;
    this._calibration = null;
    this._strideSample = null;
    this._lastGpsFix = null;
    // Thresholds are relative to gravity, not total acceleration (~9.81 m/s²).
    this.stepThresholdHigh = 0.95;
    this.stepThresholdLow = 0.2;
    this.linearStepThresholdHigh = 1.1;
    this.linearStepThresholdLow = 0.4;
    this.minStepIntervalMs = 380;

    this.motionHandler = this._handleMotion.bind(this);
    this.orientationHandler = this._handleOrientation.bind(this);
  }

  _normalizeHeading(value) {
    return ((value % 360) + 360) % 360;
  }

  _getScreenOrientationAngle() {
    if (typeof window === 'undefined') return 0;
    if (window.screen?.orientation?.angle !== undefined) {
      return window.screen.orientation.angle;
    }
    if (typeof window.orientation === 'number') {
      return window.orientation;
    }
    return 0;
  }

  _extractHeading(e) {
    // iOS Safari reports compass heading directly (clockwise from magnetic north).
    if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
      if (Number.isFinite(e.webkitCompassAccuracy) && (e.webkitCompassAccuracy < 0 || e.webkitCompassAccuracy > 30)) return null;
      return this._normalizeHeading(e.webkitCompassHeading);
    }

    // On most Android devices, only absolute events are reliable for true compass heading.
    const isAbsoluteEvent = e.type === 'deviceorientationabsolute' || e.absolute === true;
    if (!isAbsoluteEvent || typeof e.alpha !== 'number' || !Number.isFinite(e.alpha)) {
      return null;
    }

    // Alpha is clockwise around device Z-axis; convert to bearing clockwise from north.
    // Also account for screen rotation so heading follows the phone's "top" direction.
    const orientationOffset = this._getScreenOrientationAngle();
    return this._normalizeHeading(360 - e.alpha + orientationOffset);
  }

  getHeading(now = Date.now()) {
    if (!this.isActive || !Number.isFinite(this.heading)) return null;
    const maxAge = this.policy.heading_max_age_ms;
    if (isFresh(this._headingAt, now, maxAge)) return this.heading;
    if (!this.policy.gps_enabled && this._headingMotion
      && isFresh(this._headingAt, now, maxAge * 3)
      && isFresh(this._headingMotion.at, now, MAX_GYRO_GAP_MS)) return this.heading;
    return null;
  }

  _trackHeadingRotation(rotationRate, now) {
    const motion = this._headingMotion;
    if (!motion) return;
    const elapsed = now - motion.at;
    const rate = [rotationRate?.alpha, rotationRate?.beta, rotationRate?.gamma];
    if (elapsed < 0 || elapsed > MAX_GYRO_GAP_MS
      || !rate.every(Number.isFinite) || motion.screenAngle !== this._getScreenOrientationAngle()) {
      this._headingMotion = null;
      return;
    }
    const rotation = motion.rotation.map((degrees, i) => degrees + rate[i] * elapsed / 1000);
    if (Math.hypot(...rotation) > MAX_HEADING_ROTATION_DEG) {
      this._headingAt = null;
      this._headingMotion = null;
      return;
    }
    this._headingMotion = { ...motion, at: now, rotation };
  }

  addListener(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(type) {
    const data = {
      type,
      isActive: this.isActive,
      stepCount: this.stepCount,
      geoPosition: this.geoPosition,
      geoPath: this.geoPath.slice(),
      positionTimestamp: this.positionTimestamp,
      positionAccuracy: this.positionAccuracy,
      anchorTimestamp: this.anchorTimestamp,
      distanceSinceAnchor: this.distanceSinceAnchor,
      heading: this.getHeading()
    };
    this.listeners.forEach(cb => cb(data));
  }

  async start(initialPosition, quality = {}) {
    if (!validGeo(initialPosition)) throw new Error('Invalid initial position');
    this._stopSensors();
    this.policy = getNavigationPolicy();
    if (!this.policy.gps_enabled) {
      this.stepLengthMeters = this.policy.step_length_m;
      this.calibrated = false;
      this._strideSample = null;
    }
    this.heading = null;
    this._headingAt = null;
    this._headingMotion = null;
    this.positionTimestamp = null;
    this._lastGpsAt = null;
    this._lastMotionAt = null;
    const requestId = ++this._sensorRequestId;
    this.geoPosition = { ...initialPosition };
    this.geoPath = [this.geoPosition];
    this.stepCount = 0;
    this._setAnchor(quality);
    this._calibration = null;

    this._lastMagnitude = 0;
    this._lastStepAt = 0;
    this._stepArmed = true;
    this._smoothedMagnitude = null;
    this._gravityBaseline = null;
    this._motionMode = null;

    this.isActive = true;
    await this._startSensors(requestId);
    if (requestId === this._sensorRequestId) this._emit('serviceStateChanged');
  }

  stop() {
    ++this._sensorRequestId;
    this._stopSensors();
    this.isActive = false;
    this._emit('serviceStateChanged');
  }

  reset(position, quality = {}) {
    this.heading = null;
    this._headingAt = null;
    this._headingMotion = null;
    this.positionTimestamp = null;
    this._lastGpsAt = null;
    this.stepCount = 0;
    this._lastStepAt = 0;
    this._stepArmed = true;
    this._smoothedMagnitude = null;
    this._gravityBaseline = null;
    this._motionMode = null;
    this._setAnchor(position ? quality : { trusted: false });
    this._calibration = null;
    if (position) {
      this.geoPosition = { ...position };
      this.geoPath = [this.geoPosition];
    } else {
      this.geoPath = [];
    }
    this._emit('serviceStateChanged');
  }

  _setAnchor({ timestamp = Date.now(), accuracy = 5, trusted = true, mode = 'walk', distanceSinceAnchor = 0 } = {}) {
    this.walking = !['wheelchair', 'van', 'electric-car'].includes(mode);
    this.maxSpeed = ['van', 'electric-car'].includes(mode) ? 10 : 3;
    this.anchorTimestamp = trusted && isFresh(timestamp, Date.now(), DR_MAX_ANCHOR_AGE) ? timestamp : null;
    this.positionAccuracy = Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null;
    this.distanceSinceAnchor = Math.max(0, distanceSinceAnchor);
    this._lastGpsFix = null;
  }

  async _startSensors(requestId) {
    if (typeof window === 'undefined') { this.isActive = false; return; }
    if (typeof DeviceMotionEvent === 'undefined') {
      this.isActive = false;
      this._emit('sensorsUnsupported');
      return;
    }

    // Both requests must start synchronously within the same user gesture on iOS.
    const requestPermission = (EventType, ...args) => {
      if (!EventType || typeof EventType.requestPermission !== 'function') {
        return Promise.resolve('granted');
      }
      try {
        return Promise.resolve(EventType.requestPermission(...args));
      } catch (error) {
        return Promise.reject(error);
      }
    };
    const hasOrientation = typeof DeviceOrientationEvent !== 'undefined';
    const motionPermission = requestPermission(DeviceMotionEvent);
    const orientationPermission = requestPermission(hasOrientation ? DeviceOrientationEvent : null, true);
    const [motionResult, orientationResult] = await Promise.allSettled([
      motionPermission, orientationPermission
    ]);

    // A stopped or superseded session must never attach new listeners.
    if (!this.isActive || requestId !== this._sensorRequestId) return;
    if (motionResult.status !== 'fulfilled' || motionResult.value !== 'granted') {
      this.isActive = false;
      this._emit('permissionNeeded');
      return;
    }

    window.addEventListener('devicemotion', this.motionHandler);
    const startedAt = Date.now();
    this._sensorTimer = setInterval(() => {
      if (this.policy.gps_enabled && !isFresh(this.anchorTimestamp, Date.now(), DR_MAX_ANCHOR_AGE) && this.positionTimestamp !== null) {
        this.positionTimestamp = null;
        this._emit('anchorNeeded');
      }
      if (Date.now() - (this._lastMotionAt ?? startedAt) >= 5000) {
        this.stop();
        this._emit('sensorsUnsupported');
      }
    }, 5000);
    this._sensorTimer?.unref?.();
    // Compass permission must not prevent step tracking.
    if (hasOrientation && orientationResult.status === 'fulfilled' && orientationResult.value === 'granted') {
      window.addEventListener('deviceorientationabsolute', this.orientationHandler);
      window.addEventListener('deviceorientation', this.orientationHandler);
    }
  }

  _stopSensors() {
    clearInterval(this._sensorTimer);
    this._sensorTimer = null;
    if (typeof window === 'undefined') return;
    window.removeEventListener('devicemotion', this.motionHandler);
    window.removeEventListener('deviceorientationabsolute', this.orientationHandler);
    window.removeEventListener('deviceorientation', this.orientationHandler);
  }

  _handleMotion(e) {
    if (!this.isActive) return;

    const magnitudeOf = (acc) => acc
      && [acc.x, acc.y, acc.z].every(v => typeof v === 'number' && Number.isFinite(v))
      ? Math.hypot(acc.x, acc.y, acc.z)
      : null;
    const withGravity = magnitudeOf(e.accelerationIncludingGravity);
    const linear = magnitudeOf(e.acceleration);
    if (withGravity === null && linear === null) return;
    this._lastMotionAt = Date.now();
    if (!this.policy.gps_enabled) this._trackHeadingRotation(e.rotationRate, this._lastMotionAt);

    const mode = withGravity !== null ? 'gravity' : 'linear';
    if (mode !== this._motionMode) {
      this._motionMode = mode;
      this._gravityBaseline = null;
      this._smoothedMagnitude = null;
      this._stepArmed = true;
    }

    const rawMagnitude = withGravity ?? linear;
    if (mode === 'gravity') {
      // Slowly track the gravity baseline; short walking peaks must not be smoothed away.
      this._gravityBaseline = this._gravityBaseline === null
        ? rawMagnitude
        : this._gravityBaseline * 0.98 + rawMagnitude * 0.02;
    }
    const motionMagnitude = mode === 'gravity'
      ? rawMagnitude - this._gravityBaseline
      : rawMagnitude;
    this._smoothedMagnitude = this._smoothedMagnitude === null
      ? motionMagnitude
      : this._smoothedMagnitude * 0.45 + motionMagnitude * 0.55;

    const magnitude = this._smoothedMagnitude;
    const low = mode === 'gravity' ? this.stepThresholdLow : this.linearStepThresholdLow;
    const high = mode === 'gravity' ? this.stepThresholdHigh : this.linearStepThresholdHigh;
    const now = Number.isFinite(e.timeStamp) ? e.timeStamp : Date.now();

    if (magnitude < low) this._stepArmed = true;
    const enoughTimePassed =
      !this._lastStepAt || now - this._lastStepAt >= this.minStepIntervalMs;
    if (this._stepArmed && enoughTimePassed && magnitude > high) {
      this._stepArmed = false;
      this._lastStepAt = now;
      this.stepCount += 1;
      this._processStep();
    }

    this._lastMagnitude = magnitude;
  }

  _handleOrientation(e) {
    if (!this.isActive) return;
    const nextHeading = this._extractHeading(e);
    if (nextHeading !== null) {
      if (this._calibration && Math.abs(((nextHeading - this._calibration.heading + 540) % 360) - 180) > 15) {
        this._calibration = null;
      }
      this.heading = nextHeading;
      this._headingAt = Date.now();
      this._headingMotion = { at: this._headingAt, rotation: [0, 0, 0], screenAngle: this._getScreenOrientationAngle() };
      this._emit('orientationChanged');
    } else if (e.type === 'deviceorientationabsolute' || e.absolute === true
      || Number.isFinite(e.webkitCompassHeading)) {
      // An explicitly unavailable absolute reading invalidates the old one.
      this.heading = null;
      this._headingAt = null;
      this._headingMotion = null;
      this._emit('orientationChanged');
    }
  }

  _processStep() {
    if (!this.walking) return;
    const now = Date.now();
    if (!Number.isFinite(this.anchorTimestamp) || !Number.isFinite(this.positionAccuracy)
      || (this.policy.gps_enabled && (!isFresh(this.anchorTimestamp, now, DR_MAX_ANCHOR_AGE)
        || this.distanceSinceAnchor + this.stepLengthMeters > DR_MAX_DISTANCE
        || this.positionAccuracy > DR_MAX_UNCERTAINTY))) {
      this.positionTimestamp = null;
      this._emit('anchorNeeded');
      return;
    }
    const heading = this.getHeading(now);
    if (!validGeo(this.geoPosition) || heading === null) {
      // Unobserved steps cannot disappear from the error budget.
      this.positionAccuracy += this.stepLengthMeters;
      this.positionTimestamp = null;
      this._emit('stepDetected');
      return;
    }
    const stepLength = this.stepLengthMeters; // meters
    const rad = (heading * Math.PI) / 180;
    const dLat = (stepLength * Math.cos(rad)) / 111111;
    const dLng = (stepLength * Math.sin(rad)) / (111111 * Math.cos(this.geoPosition.lat * Math.PI / 180));
    this.geoPosition = {
      lat: this.geoPosition.lat + dLat,
      lng: this.geoPosition.lng + dLng
    };
    this.positionTimestamp = Date.now();
    this.distanceSinceAnchor += stepLength;
    // An uncertainty allowance, not a measured statistical confidence interval.
    this.positionAccuracy += stepLength * (this.policy.gps_enabled && this.calibrated ? 0.15 : this.policy.drift_per_meter);
    if (this.policy.gps_enabled && this.positionAccuracy > DR_MAX_UNCERTAINTY) this.positionTimestamp = null;
    this.geoPath.push({ ...this.geoPosition });
    this._emit('stepDetected');
  }

  processGpsData(position, accuracy, timestamp = Date.now()) {
    if (!getNavigationPolicy().gps_enabled) return false;
    if (!this.isActive) return true;
    if (validGps(position, accuracy, timestamp)
      && (this._lastGpsAt === null || timestamp > this._lastGpsAt)) {
      const anchored = isFresh(this.anchorTimestamp, Date.now(), DR_MAX_ANCHOR_AGE);
      if (anchored && this._lastGpsFix) {
        const seconds = Math.max(0, (timestamp - this._lastGpsFix.timestamp) / 1000);
        if (distance(position, this._lastGpsFix) > this.maxSpeed * seconds + accuracy + this._lastGpsFix.accuracy) return false;
      }
      if (anchored && this.positionAccuracy !== null && this.positionAccuracy < accuracy
        && (accuracy > Math.max(6, this.positionAccuracy * 1.5)
          || distance(position, this.geoPosition) > accuracy + this.positionAccuracy)) return false;
      this._calibrateStride(position, accuracy, timestamp);
      this._lastGpsAt = timestamp;
      this._lastGpsFix = { ...position, accuracy, timestamp };
      this.anchorTimestamp = timestamp;
      this.positionAccuracy = accuracy;
      this.distanceSinceAnchor = 0;
      this.positionTimestamp = timestamp;
      this.geoPosition = { ...position };
      this.geoPath.push({ ...position });
      this._emit('gpsCorrection');
      return true;
    }
    return false;
  }

  _calibrateStride(position, accuracy, timestamp) {
    if (!getNavigationPolicy().gps_enabled || accuracy > 3 || !isFresh(this._headingAt, Date.now(), HEADING_MAX_AGE)) {
      this._calibration = null;
      return;
    }
    const baseline = this._calibration;
    const current = { ...position, accuracy, timestamp, steps: this.stepCount, heading: this.heading };
    if (!baseline) { this._calibration = current; return; }
    const headingChange = Math.abs(((this.heading - baseline.heading + 540) % 360) - 180);
    if (headingChange > 15 || timestamp - baseline.timestamp > DR_MAX_ANCHOR_AGE) {
      this._calibration = current;
      return;
    }
    const steps = this.stepCount - baseline.steps;
    const meters = distance(position, baseline);
    if (steps < 20 || meters < 20 || accuracy + baseline.accuracy > meters * 0.15) return;
    const stride = meters / steps;
    if (stride >= 0.35 && stride <= 1.1 && timestamp - baseline.timestamp >= 8000) {
      if (this._strideSample && Math.abs(stride - this._strideSample) <= this._strideSample * 0.15) {
        this.stepLengthMeters = (stride + this._strideSample) / 2;
        this.calibrated = true;
      }
      this._strideSample = stride;
    }
    this._calibration = current;
  }
}

export default new AdvancedDeadReckoningService();
