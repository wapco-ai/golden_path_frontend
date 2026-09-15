import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouteStore } from '../store/routeStore.js';
import { requestRouting } from '../services/routingService.js';
import {
  fetchRouteHistory,
  historyModeMessageId,
  historyModeToTransportMode,
  normalizeHistoryRoute
} from '../services/routeHistoryService.js';

const formatPointName = (point, fallback) => {
  if (point?.name) return point.name;
  if (Array.isArray(point?.coordinates) && point.coordinates.length >= 2) {
    const [lat, lon] = point.coordinates;
    return `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}`;
  }
  return fallback;
};

const normalizeLocale = (locale) => locale || 'fa-IR';

const formatTimestamp = (timestamp, locale) => {
  const date = timestamp ? new Date(timestamp) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return { date: '', time: '' };
  }

  const resolvedLocale = normalizeLocale(locale);
  return {
    date: new Intl.DateTimeFormat(resolvedLocale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date),
    time: new Intl.DateTimeFormat(resolvedLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date)
  };
};

const persistSessionRoute = ({ origin, destination, route, transportMode, gender }) => {
  if (typeof sessionStorage === 'undefined') return;

  const values = {
    origin,
    destination,
    routeGeo: route.geo,
    routeSteps: route.steps,
    alternativeRoutes: route.alternatives,
    transportMode,
    gender
  };

  Object.entries(values).forEach(([key, value]) => {
    sessionStorage.setItem(key, JSON.stringify(value));
  });
};

export const useRouteHistoryActions = ({ navigate, locale = 'fa-IR' }) => {
  const [history, setHistory] = useState([]);
  const busyRouteId = useRef(null);

  const {
    setOrigin,
    setDestination,
    setRouteGeo,
    setRouteSteps,
    setAlternativeRoutes,
    setTransportMode,
    setGender
  } = useRouteStore();

  useEffect(() => {
    const controller = new AbortController();

    fetchRouteHistory({ limit: 50, signal: controller.signal })
      .then(setHistory)
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error('Failed to load route history', error);
          setHistory([]);
        }
      });

    return () => controller.abort();
  }, []);

  const applyRoute = useCallback((item, normalizedRoute) => {
    if (!item?.origin || !item?.destination || !normalizedRoute) return false;

    const transportMode = historyModeToTransportMode(item.mode);
    const gender = item.gender || 'both';

    setOrigin(item.origin);
    setDestination(item.destination);
    setRouteGeo(normalizedRoute.geo);
    setRouteSteps(normalizedRoute.steps);
    setAlternativeRoutes(normalizedRoute.alternatives || []);
    setTransportMode(transportMode);
    setGender(gender);

    persistSessionRoute({
      origin: item.origin,
      destination: item.destination,
      route: normalizedRoute,
      transportMode,
      gender
    });

    return true;
  }, [setAlternativeRoutes, setDestination, setGender, setOrigin, setRouteGeo, setRouteSteps, setTransportMode]);

  const showPreviousRoute = useCallback((item) => {
    const normalizedRoute = normalizeHistoryRoute(item);
    if (applyRoute(item, normalizedRoute)) {
      navigate('/rop');
    }
  }, [applyRoute, navigate]);

  const repeatRoute = useCallback(async (item) => {
    if (!item?.origin || !item?.destination || busyRouteId.current !== null) return;

    busyRouteId.current = item.id;
    try {
      const transportMode = historyModeToTransportMode(item.mode);
      const result = await requestRouting({
        origin: item.origin,
        destination: item.destination,
        mode: transportMode,
        gender: item.gender || 'both',
        lang: String(locale || 'fa').split(/[-_]/)[0],
        maxAlternatives: 2,
        floor: item.floor ?? item.origin?.floor ?? 0
      });

      if (applyRoute(item, result)) {
        navigate('/rop');
      }
    } catch (error) {
      console.error('Failed to repeat route', error);
    } finally {
      busyRouteId.current = null;
    }
  }, [applyRoute, locale, navigate]);

  const displayRoutes = useMemo(() => history.map((item) => {
    const formatted = formatTimestamp(item.timestamp, locale);
    return {
      ...item,
      date: formatted.date,
      time: formatted.time,
      type: historyModeToTransportMode(item.mode),
      transportMessageId: historyModeMessageId(item.mode),
      distance: item.distanceMeters == null ? '' : Math.round(Number(item.distanceMeters)),
      originLabel: formatPointName(item.origin, ''),
      destinationLabel: formatPointName(item.destination, '')
    };
  }), [history, locale]);

  return {
    displayRoutes,
    repeatRoute,
    showPreviousRoute
  };
};

export default useRouteHistoryActions;
