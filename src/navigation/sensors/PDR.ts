export class PDR {
  constructor(config) {
    this.config = config;
    this.lastMag = 9.81;
    this.lastStepTs = 0;
    this.stepCount = 0;
  }

  reset() {
    this.lastMag = 9.81;
    this.lastStepTs = 0;
    this.stepCount = 0;
  }

  update(acc, ts) {
    if (!acc) return false;
    const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
    const filtered = this.lastMag * 0.8 + mag * 0.2;
    const crossed = filtered > this.config.stepThreshold && this.lastMag <= this.config.stepThreshold;
    const refractoryOk = (ts - this.lastStepTs) >= this.config.stepRefractoryMs;
    this.lastMag = filtered;

    if (crossed && refractoryOk) {
      this.lastStepTs = ts;
      this.stepCount += 1;
      return true;
    }

    return false;
  }
}
