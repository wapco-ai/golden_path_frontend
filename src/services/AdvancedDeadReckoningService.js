import { validGeo, validGps, isFresh, HEADING_MAX_AGE } from '../utils/locationQuality.js';

class AdvancedDeadReckoningService {
  constructor() {
    this.isActive = false;
    this.stepCount = 0;
    this.heading = null;
    this._headingAt = null;
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
    this.stepLengthMeters = 0.38;
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
      heading: isFresh(this._headingAt, Date.now(), HEADING_MAX_AGE) ? this.heading : null
    };
    this.listeners.forEach(cb => cb(data));
  }

  async start(initialPosition) {
    if (!validGeo(initialPosition)) throw new Error('Invalid initial position');
    this._stopSensors();
    this.heading = null;
    this._headingAt = null;
    this.positionTimestamp = null;
    this._lastGpsAt = null;
    this._lastMotionAt = null;
    const requestId = ++this._sensorRequestId;
    this.geoPosition = { ...initialPosition };
    this.geoPath = [this.geoPosition];
    this.stepCount = 0;

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

  reset(position) {
    this.heading = null;
    this._headingAt = null;
    this.positionTimestamp = null;
    this._lastGpsAt = null;
    this.stepCount = 0;
    this._lastStepAt = 0;
    this._stepArmed = true;
    this._smoothedMagnitude = null;
    this._gravityBaseline = null;
    this._motionMode = null;
    if (position) {
      this.geoPosition = { ...position };
      this.geoPath = [this.geoPosition];
    } else {
      this.geoPath = [];
    }
    this._emit('serviceStateChanged');
  }

  async _startSensors(requestId) {
    if (typeof window === 'undefined') { this.isActive = false; return; }
    if (typeof DeviceMotionEvent === 'undefined') {
      this.isActive = false;
      this._emit('sensorsUnsupported');
      return;
    }

    // Both requests must start synchronously within the same user gesture on iOS.
    const requestPermission = (EventType) => {
      if (!EventType || typeof EventType.requestPermission !== 'function') {
        return Promise.resolve('granted');
      }
      try {
        return Promise.resolve(EventType.requestPermission());
      } catch (error) {
        return Promise.reject(error);
      }
    };
    const hasOrientation = typeof DeviceOrientationEvent !== 'undefined';
    const motionPermission = requestPermission(DeviceMotionEvent);
    const orientationPermission = requestPermission(hasOrientation ? DeviceOrientationEvent : null);
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
      this.heading = nextHeading;
      this._headingAt = Date.now();
      this._emit('orientationChanged');
    }
  }

  _processStep() {
    if (!validGeo(this.geoPosition) || !isFresh(this._headingAt, Date.now(), HEADING_MAX_AGE)) {
      this._emit('stepDetected');
      return;
    }
    const stepLength = this.stepLengthMeters; // meters
    const rad = (this.heading * Math.PI) / 180;
    const dLat = (stepLength * Math.cos(rad)) / 111111;
    const dLng = (stepLength * Math.sin(rad)) / (111111 * Math.cos(this.geoPosition.lat * Math.PI / 180));
    this.geoPosition = {
      lat: this.geoPosition.lat + dLat,
      lng: this.geoPosition.lng + dLng
    };
    this.positionTimestamp = Date.now();
    this.geoPath.push({ ...this.geoPosition });
    this._emit('stepDetected');
  }

  processGpsData(position, accuracy, timestamp = Date.now()) {
    if (!this.isActive) return;
    if (validGps(position, accuracy, timestamp)
      && (this._lastGpsAt === null || timestamp >= this._lastGpsAt)) {
      this._lastGpsAt = timestamp;
      this.positionTimestamp = timestamp;
      this.geoPosition = { ...position };
      this.geoPath.push({ ...position });
      this._emit('gpsCorrection');
    }
  }
}

export default new AdvancedDeadReckoningService();
