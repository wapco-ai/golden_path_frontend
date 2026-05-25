class AdvancedDeadReckoningService {
  constructor() {
    this.isActive = false;
    this.stepCount = 0;
    this.heading = 0; // degrees
    this.geoPosition = null;
    this.geoPath = [];
    this.listeners = new Set();
    this._lastMagnitude = 0;

    this._lastStepAt = 0;
    this._stepArmed = true;
    this._smoothedMagnitude = null;
    this.stepLengthMeters = 0.38;
    this.stepThresholdHigh = 12.2;
    this.stepThresholdLow = 10.8;
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
      heading: this.heading
    };
    this.listeners.forEach(cb => cb(data));
  }

  async start(initialPosition) {
    this.geoPosition = { ...initialPosition };
    this.geoPath = [this.geoPosition];
    this.stepCount = 0;

    this._lastMagnitude = 0;
    this._lastStepAt = 0;
    this._stepArmed = true;
    this._smoothedMagnitude = null;

    this.isActive = true;
    await this._startSensors();
    this._emit('serviceStateChanged');
  }

  stop() {
    this._stopSensors();
    this.isActive = false;
    this._emit('serviceStateChanged');
  }

  reset(position) {
    this.stepCount = 0;
    if (position) {
      this.geoPosition = { ...position };
      this.geoPath = [this.geoPosition];
    } else {
      this.geoPath = [];
    }
    this._emit('serviceStateChanged');
  }

  async _startSensors() {
    if (typeof window === 'undefined') return;
    if (typeof DeviceMotionEvent === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      this._emit('sensorsUnsupported');
      return;
    }
    try {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== 'granted') {
          this._emit('permissionNeeded');
          return;
        }
      }
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') {
          this._emit('permissionNeeded');
          return;
        }
      }
    } catch (e) {
      console.warn('Sensor permission error', e);
    }
    window.addEventListener('devicemotion', this.motionHandler);
    window.addEventListener('deviceorientationabsolute', this.orientationHandler);
    window.addEventListener('deviceorientation', this.orientationHandler);
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

    const x = Number(acc.x);
    const y = Number(acc.y);
    const z = Number(acc.z);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return;
    }

    const rawMagnitude = Math.sqrt(x ** 2 + y ** 2 + z ** 2);

    // Low-pass smoothing برای حذف پرش‌های ریز سنسور
    this._smoothedMagnitude =
      this._smoothedMagnitude == null
        ? rawMagnitude
        : this._smoothedMagnitude * 0.75 + rawMagnitude * 0.25;

    const magnitude = this._smoothedMagnitude;
    const now = e.timeStamp || Date.now();

    // Hysteresis:
    // تا وقتی مقدار دوباره پایین نیامده، آماده ثبت قدم بعدی نشود
    if (magnitude < this.stepThresholdLow) {
      this._stepArmed = true;
    }

    const enoughTimePassed =
      !this._lastStepAt || now - this._lastStepAt >= this.minStepIntervalMs;

    if (
      this._stepArmed &&
      enoughTimePassed &&
      magnitude > this.stepThresholdHigh
    ) {
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
      this._emit('orientationChanged');
    }
  }

  _processStep() {
    if (!this.geoPosition) return;
    const stepLength = this.stepLengthMeters; // meters
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
