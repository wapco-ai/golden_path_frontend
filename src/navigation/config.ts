export const hybridNavigationConfig = {
  gpsBadAccuracyM: 20,
  gpsBadDurationMs: 3000,
  gpsNoUpdateTimeoutMs: 10000,
  gpsJumpDistanceM: 30,
  gpsJumpWindowMs: 1000,
  stepLengthM: 0.7,
  stepThreshold: 11.2,
  stepRefractoryMs: 300,
  snapMinIntervalMs: 1000,
  snapEveryNSteps: 2,
  snapEveryMs: 2000,
  snapHardCorrectionDistanceM: 5,
  rerouteDistanceM: 10,
  ringBufferSize: 200
};

export const NAV_STATES = {
  GNSS_MODE: 'GNSS_MODE',
  DR_MODE: 'DR_MODE',
  QR_CORRECTION: 'QR_CORRECTION'
};
