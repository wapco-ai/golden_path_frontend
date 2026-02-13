import { useEffect, useMemo, useRef, useState } from 'react';
import HybridNavigationEngine from '../HybridNavigationEngine';
import { hybridNavigationConfig, NAV_STATES } from '../config';
import { computeRouteProgress } from '../route/routeProgress';

const requestSensorPermissionIfNeeded = async () => {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const motion = await DeviceMotionEvent.requestPermission();
      if (motion !== 'granted') return false;
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const orientation = await DeviceOrientationEvent.requestPermission();
      if (orientation !== 'granted') return false;
    }
  } catch (e) {
    return false;
  }
  return true;
};

export const useHybridNavigation = ({ initialFloor = 0, map, routeState, onReroute } = {}) => {
  const [mode, setMode] = useState(NAV_STATES.GNSS_MODE);
  const [fusedPosition, setFusedPosition] = useState(null);
  const [headingDeg, setHeadingDeg] = useState(0);
  const [sensorPermissionGranted, setSensorPermissionGranted] = useState(false);
  const engineRef = useRef(null);
  const lastStepSnapRef = useRef(0);

  const sensorsSupported = useMemo(
    () => typeof window !== 'undefined' && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined',
    []
  );

  useEffect(() => {
    let active = true;

    const initPermissions = async () => {
      if (!sensorsSupported) return;
      const granted = await requestSensorPermissionIfNeeded();
      if (active) setSensorPermissionGranted(granted);
    };

    initPermissions();
    return () => {
      active = false;
    };
  }, [sensorsSupported]);

  useEffect(() => {
    const engine = new HybridNavigationEngine({
      onStateChange: setMode,
      onPosition: (pos) => {
        setFusedPosition(pos);
        if (routeState?.routeGeo && pos?.snapped) {
          const progress = computeRouteProgress(routeState.routeGeo, { lat: pos.snapped.lat, lng: pos.snapped.lng });
          if (progress?.distanceToRouteM > hybridNavigationConfig.rerouteDistanceM && routeState.isNavigating) {
            onReroute?.({ lat: pos.snapped.lat, lng: pos.snapped.lng, floor: pos.floor, reason: 'off_route' });
          }
        }
      },
      onReroute,
      routeState,
      sensorsAvailable: sensorsSupported && sensorPermissionGranted
    });
    engine.setFloor(initialFloor);
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
    };
  }, [initialFloor, onReroute, routeState, sensorPermissionGranted, sensorsSupported]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !navigator?.geolocation) return undefined;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        engine.handleGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp
        });
      },
      (error) => {
        engine.handleGpsUnavailable(error?.code || 'watch_error');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return undefined;

    const intervalId = window.setInterval(() => {
      engine.checkGpsTimeout();
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!sensorsSupported || !sensorPermissionGranted) return undefined;
    const engine = engineRef.current;
    if (!engine) return undefined;

    const onMotion = (e) => {
      const ts = Date.now();
      if (engine.pdr.update(e.accelerationIncludingGravity || e.acceleration, ts)) {
        if (ts - lastStepSnapRef.current > hybridNavigationConfig.snapEveryMs || engine.pdr.stepCount % hybridNavigationConfig.snapEveryNSteps === 0) {
          lastStepSnapRef.current = ts;
        }
        engine.handleStep({ headingDeg: engine.heading.heading || 0 });
      }
    };

    const onOrientation = (e) => {
      const currentHeading = engine.heading.updateFromOrientation(e);
      setHeadingDeg(currentHeading);
    };

    window.addEventListener('devicemotion', onMotion);
    window.addEventListener('deviceorientationabsolute', onOrientation);
    window.addEventListener('deviceorientation', onOrientation);

    return () => {
      window.removeEventListener('devicemotion', onMotion);
      window.removeEventListener('deviceorientationabsolute', onOrientation);
      window.removeEventListener('deviceorientation', onOrientation);
    };
  }, [sensorPermissionGranted, sensorsSupported]);

  useEffect(() => {
    const handler = (e) => {
      const code = e?.detail?.code;
      if (code) engineRef.current?.handleQrScanned(code);
    };
    window.addEventListener('qr-scanned', handler);
    return () => window.removeEventListener('qr-scanned', handler);
  }, []);

  useEffect(() => {
    if (map && fusedPosition?.snapped) {
      map.setCenter([fusedPosition.snapped.lng, fusedPosition.snapped.lat]);
    }
  }, [fusedPosition, map]);

  return {
    fusedPosition,
    mode,
    headingDeg,
    sensorsAvailable: sensorsSupported && sensorPermissionGranted,
    onQrScanned: (code) => engineRef.current?.handleQrScanned(code),
    debugLog: engineRef.current?.debug || []
  };
};

export default useHybridNavigation;
