const normalize = (deg) => ((deg % 360) + 360) % 360;

export class HeadingEstimator {
  constructor() {
    this.heading = 0;
  }

  reset(heading = 0) {
    this.heading = normalize(heading);
  }

  updateFromOrientation(event) {
    let incoming = null;
    if (Number.isFinite(event.webkitCompassHeading)) {
      incoming = event.webkitCompassHeading;
    } else if (Number.isFinite(event.alpha)) {
      incoming = event.alpha;
    }
    if (!Number.isFinite(incoming)) return this.heading;

    let diff = normalize(incoming) - this.heading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    this.heading = normalize(this.heading + diff * 0.2);
    return this.heading;
  }
}
