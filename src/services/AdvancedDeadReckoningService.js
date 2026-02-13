class AdvancedDeadReckoningService {
  constructor() {
    this.isActive = false;
    this.stepCount = 0;
    this.heading = 0; // degrees
    this.geoPosition = null;
    this.geoPath = [];
    this.listeners = new Set();
    this._lastMagnitude = 0;
    this.motionHandler = this._handleMotion.bind(this);
    this.orientationHandler = this._handleOrientation.bind(this);
    this._headingSmoothing = 0.35;
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
      heading: this.heading
    };
    this.listeners.forEach(cb => cb(data));
  }

  async start(initialPosition) {
    if (!initialPosition || !Number.isFinite(initialPosition.lat) || !Number.isFinite(initialPosition.lng)) {
      this._emit('invalidInitialPosition');
      return;
    }

    this.geoPosition = { ...initialPosition };
    this.geoPath = [this.geoPosition];
    this.stepCount = 0;
    this._lastMagnitude = 0;

    const sensorsStarted = await this._startSensors();
    this.isActive = sensorsStarted;
    this._emit('serviceStateChanged');
  }

  stop() {
    this._stopSensors();
    this.isActive = false;
    this._lastMagnitude = 0;
    this._emit('serviceStateChanged');
  }

  reset(position) {
    this.stepCount = 0;
    if (position) {
      this.geoPosition = { ...position };
      this.geoPath = [this.geoPosition];
    } else {
      this.geoPosition = null;
      this.geoPath = [];
    }
    this._emit('serviceStateChanged');
  }

  async _startSensors() {
    if (typeof window === 'undefined') return false;
    if (typeof DeviceMotionEvent === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      this._emit('sensorsUnsupported');
      return false;
    }
    try {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== 'granted') {
          this._emit('permissionNeeded');
          return false;
        }
      }
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') {
          this._emit('permissionNeeded');
          return false;
        }
      }
    } catch (e) {
      console.warn('Sensor permission error', e);
      this._emit('permissionNeeded');
      return false;
    }

    window.addEventListener('devicemotion', this.motionHandler);
    window.addEventListener('deviceorientationabsolute', this.orientationHandler);
    window.addEventListener('deviceorientation', this.orientationHandler);
    return true;
  }

  _stopSensors() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('devicemotion', this.motionHandler);
    window.removeEventListener('deviceorientationabsolute', this.orientationHandler);
    window.removeEventListener('deviceorientation', this.orientationHandler);
  }

  _handleMotion(e) {
    if (!this.isActive) return;
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc) return;
    const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    const threshold = 12;
    if (magnitude > threshold && this._lastMagnitude <= threshold) {
      this.stepCount += 1;
      this._processStep();
    }
    this._lastMagnitude = magnitude;
  }

  _normalizeHeading(value) {
    return ((value % 360) + 360) % 360;
  }

  _getScreenOrientationAngle() {
    if (typeof window === 'undefined') return 0;

    if (window.screen?.orientation && Number.isFinite(window.screen.orientation.angle)) {
      return window.screen.orientation.angle;
    }

    if (Number.isFinite(window.orientation)) {
      return window.orientation;
    }

    return 0;
  }

  _smoothHeading(nextHeading) {
    if (!Number.isFinite(this.heading)) {
      return this._normalizeHeading(nextHeading);
    }

    let diff = nextHeading - this.heading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    return this._normalizeHeading(this.heading + diff * this._headingSmoothing);
  }

  _handleOrientation(e) {
    if (!this.isActive) return;

    let headingFromNorth;

    if (Number.isFinite(e.webkitCompassHeading)) {
      // iOS Safari provides true heading directly (clockwise from north).
      headingFromNorth = e.webkitCompassHeading;
    } else if (Number.isFinite(e.alpha)) {
      // Most modern browsers expose alpha as heading clockwise from north when absolute is available.
      // In practice this is more reliable than inverting with (360 - alpha).
      headingFromNorth = e.alpha;
    } else {
      return;
    }

    const screenAngle = this._getScreenOrientationAngle();
    const correctedHeading = this._normalizeHeading(headingFromNorth + screenAngle);
    this.heading = this._smoothHeading(correctedHeading);
    this._emit('orientationChanged');
  }

  _processStep() {
    if (!this.geoPosition) return;
    const stepLength = 0.7; // meters
    const rad = (this.heading * Math.PI) / 180;
    const dLat = (stepLength * Math.cos(rad)) / 111111;
    const dLng = (stepLength * Math.sin(rad)) / (111111 * Math.cos(this.geoPosition.lat * Math.PI / 180));
    this.geoPosition = {
      lat: this.geoPosition.lat + dLat,
      lng: this.geoPosition.lng + dLng
    };
    this.geoPath.push({ ...this.geoPosition });
    this._emit('stepDetected');
  }

  processGpsData(position, accuracy) {
    if (!this.isActive) return;
    if (accuracy !== undefined && accuracy !== null && accuracy < 8) {
      this.geoPosition = { ...position };
      this.geoPath.push({ ...position });
      this._emit('gpsCorrection');
    }
  }
}

export default new AdvancedDeadReckoningService();
