import { useEffect, useMemo, useRef, useState } from 'react';
import HybridNavigationEngine from '../HybridNavigationEngine';
import { hybridNavigationConfig, NAV_STATES } from '../config';
import { computeRouteProgress } from '../route/routeProgress';

export const useHybridNavigation = ({ initialFloor = 0, map, routeState, onReroute } = {}) => {
  const [mode, setMode] = useState(NAV_STATES.GNSS_MODE);
  const [fusedPosition, setFusedPosition] = useState(null);
  const engineRef = useRef(null);
  const lastStepSnapRef = useRef(0);

  const sensorsAvailable = useMemo(
    () => typeof window !== 'undefined' && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined',
    []
  );

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
      sensorsAvailable
    });
    engine.setFloor(initialFloor);
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
    };
  }, [initialFloor, onReroute, routeState, sensorsAvailable]);

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
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!sensorsAvailable) return undefined;
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
      engine.heading.updateFromOrientation(e);
    };

    window.addEventListener('devicemotion', onMotion);
    window.addEventListener('deviceorientationabsolute', onOrientation);
    window.addEventListener('deviceorientation', onOrientation);

    return () => {
      window.removeEventListener('devicemotion', onMotion);
      window.removeEventListener('deviceorientationabsolute', onOrientation);
      window.removeEventListener('deviceorientation', onOrientation);
    };
  }, [sensorsAvailable]);

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
    sensorsAvailable,
    onQrScanned: (code) => engineRef.current?.handleQrScanned(code),
    debugLog: engineRef.current?.debug || []
  };
};

export default useHybridNavigation;
