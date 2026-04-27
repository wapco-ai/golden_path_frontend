// src/components/map/RouteMap.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import useOfflineMapStyle from '../../hooks/useOfflineMapStyle';
import advancedDeadReckoningService from '../../services/AdvancedDeadReckoningService';
import ArrowMarker from './ArrowMarker';
import { initHaramVectorLayers } from '../../utils/initVectorLayers';
import appConfig from '../../config/appConfig';
import { useLangStore } from '../../store/langStore';
import { createHaramVectorTileConfig } from '../../config/vectorTiles';
import voyagerBaseMapStyle from '../../services/osmMapStyle';
import { MBTILES_SATELLITE_STYLE } from '../../services/mbtilesMapStyle';

import { forwardRef, useImperativeHandle } from 'react';

const TERRAIN_PROBE_URL = appConfig.terrainProbeUrl;
const HIDDEN_VECTOR_LAYER_IDS = new Set([
  'areas-outline',
  'areas-fill',
  'areas-label',
  'doorsAccessPoint',
  'doors'
]);

const RouteMap = forwardRef(({ 
  userLocation,
  userHeading,
  routeSteps,
  currentStep,
  isInfoModalOpen,
  isMapModalOpen,
  is3DView,
  routeGeo,
  alternativeRoutes = [],
  onSelectAlternativeRoute,
  showAlternativeRoutes = false
}, ref) => {
  const mapRef = useRef(null);
  const lastHeading = useRef(null);
  const language = useLangStore((state) => state.language);
  const isValidUserLocation = Array.isArray(userLocation)
    && userLocation.length === 2
    && Number.isFinite(userLocation[0])
    && Number.isFinite(userLocation[1]);

  const isRtl = ["fa", "ar", "ur"].includes(language);
  const baseMapStyle = voyagerBaseMapStyle;
  const { mapStyle: offlineMapStyle, handleMapError, styleKey } = useOfflineMapStyle(baseMapStyle);
  const mapStyle = MBTILES_SATELLITE_STYLE;
  const mapRenderKey = `mbtiles-satellite-${styleKey}-${isRtl ? 'rtl' : 'en'}`;

  const center = isValidUserLocation
    ? userLocation
    : [36.297, 59.606];

  const isValidStepCoordinates = (step) => Array.isArray(step?.coordinates)
    && step.coordinates.length === 2
    && Number.isFinite(step.coordinates[0])
    && Number.isFinite(step.coordinates[1]);

  const getStepCoordinate = (step) => {
    if (!step?.coordinates) return null;

    if (Array.isArray(step.coordinates[0])) {
      const point = step.coordinates[Math.max(step.coordinates.length - 1, 0)];
      if (Array.isArray(point) && point.length >= 2) {
        return point;
      }
      return null;
    }

    if (Array.isArray(step.coordinates) && step.coordinates.length >= 2) {
      return [step.coordinates[1], step.coordinates[0]];
    }

    return null;
  };

  const getStepLandmark = (step) => {
    const landmarkCandidate =
      step?.landmark
      || step?.landmarkName
      || step?.landmark_name
      || step?.poi
      || step?.poiName
      || step?.poi_name
      || step?.referenceLandmark
      || step?.reference_landmark
      || null;

    if (!landmarkCandidate) return null;
    if (typeof landmarkCandidate === 'string') {
      const trimmed = landmarkCandidate.trim();
      return trimmed || null;
    }

    if (typeof landmarkCandidate === 'object') {
      const name =
        landmarkCandidate.name
        || landmarkCandidate.title
        || landmarkCandidate.label
        || null;
      if (typeof name === 'string') {
        const trimmed = name.trim();
        return trimmed || null;
      }
    }

    return null;
  };

  const [drPosition, setDrPosition] = useState(null);
  const [drGeoPath, setDrGeoPath] = useState([]);
  const [isDrActive, setIsDrActive] = useState(advancedDeadReckoningService.isActive);
  const [heading, setHeading] = useState(userHeading ?? 0);
  const [terrainAvailable, setTerrainAvailable] = useState(false);
  const [traveledRouteGeo, setTraveledRouteGeo] = useState(null);
  const [remainingRouteGeo, setRemainingRouteGeo] = useState(null);

  const vectorTileConfig = React.useMemo(() => {
    return createHaramVectorTileConfig(language).filter(
      (layerCfg) => !HIDDEN_VECTOR_LAYER_IDS.has(layerCfg.id)
    );
  }, [language]);

  const handleMapLoad = useCallback((event) => {
    initHaramVectorLayers(event?.target || event, vectorTileConfig);
  }, [vectorTileConfig]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const verifyTerrainAvailability = async () => {
      try {
        const response = await fetch(TERRAIN_PROBE_URL, { signal: controller.signal });
        if (cancelled) return;

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('image/png') || contentType.includes('image/jpeg')) {
            setTerrainAvailable(true);
          } else {
            console.warn('Unexpected terrain tile content type. Disabling terrain.', contentType);
            setTerrainAvailable(false);
          }
        } else {
          console.warn('Terrain tile request failed with status', response.status);
          setTerrainAvailable(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to verify terrain tiles. Disabling terrain.', error);
          setTerrainAvailable(false);
        }
      }
    };

    verifyTerrainAvailability();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const altLayerIds = !isDrActive
    ? alternativeRoutes.flatMap((_, idx) => [
      `alt-route-line-${idx}`,
      `alt-route-border-${idx}`
    ])
    : [];

  useEffect(() => {
    const remove = advancedDeadReckoningService.addListener(data => {
      setIsDrActive(data.isActive);
      if (data.geoPosition) setDrPosition(data.geoPosition);
      if (data.geoPath) setDrGeoPath(data.geoPath);
      if (data.heading !== undefined && data.heading !== null) {
        setHeading(data.heading);
      }
    });
    return remove;
  }, []);

  useEffect(() => {
    if (!isDrActive && Number.isFinite(userHeading)) {
      setHeading(userHeading);
      lastHeading.current = userHeading;
      if (mapRef.current) {
        mapRef.current.setBearing(userHeading);
      }
    }
  }, [isDrActive, userHeading]);

  // Split route into traveled and remaining parts based on currentStep
  useEffect(() => {
    if (!routeGeo || !routeSteps || routeSteps.length === 0) {
      setTraveledRouteGeo(null);
      setRemainingRouteGeo(routeGeo);
      return;
    }

    const coords = routeGeo.geometry?.coordinates || [];
    if (coords.length === 0) {
      setTraveledRouteGeo(null);
      setRemainingRouteGeo(routeGeo);
      return;
    }

    // Simple approach: each step corresponds to moving forward in the coordinates
    let traveledIndex = currentStep + 1;
    
    // Make sure we don't go out of bounds
    traveledIndex = Math.max(1, Math.min(traveledIndex, coords.length));
    
    const traveledCoords = coords.slice(0, traveledIndex);
    const remainingCoords = coords.slice(traveledIndex - 1);

    if (traveledCoords.length >= 2) {
      setTraveledRouteGeo({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: traveledCoords
        }
      });
    } else {
      setTraveledRouteGeo(null);
    }

    if (remainingCoords.length >= 2) {
      setRemainingRouteGeo({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: remainingCoords
        }
      });
    } else {
      setRemainingRouteGeo(null);
    }
  }, [routeGeo, routeSteps, currentStep]);

  // Handle map resize when modal opens/closes
  useEffect(() => {
    if (mapRef.current) {
      const timeout = setTimeout(() => {
        mapRef.current.resize();
        if (isValidUserLocation) {
          mapRef.current.flyTo({
            center: [userLocation[1], userLocation[0]],
            zoom: is3DView ? 17 : 18,
            pitch: is3DView ? 60 : 0
          });
        }
      }, 400);

      return () => clearTimeout(timeout);
    }
  }, [isMapModalOpen, userLocation, is3DView]);

  // Toggle 3D view effect
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setPitch(is3DView ? 60 : 0);
      mapRef.current.easeTo({ zoom: is3DView ? 17 : 18 });
    }
  }, [is3DView]);

  // Restore pitch when the WebGL context resets
  const savedPitchRef = useRef(0);
  useEffect(() => {
    if (mapRef.current) {
      savedPitchRef.current = mapRef.current.getPitch();
    }
  }, [is3DView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();

    const handleContextLost = e => {
      e.preventDefault();
      savedPitchRef.current = map.getPitch();
    };
    const handleContextRestored = () => {
      map.setPitch(savedPitchRef.current);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost, false);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored, false);
    };
  }, []);

  // Rotate map based on user heading with smoothing to avoid sudden jumps
  useEffect(() => {
    if (!mapRef.current) return;

    if (lastHeading.current === null) {
      lastHeading.current = heading;
      mapRef.current.setBearing(heading);
      return;
    }

    let diff = heading - lastHeading.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    lastHeading.current = (lastHeading.current + diff * 0.2 + 360) % 360;
    mapRef.current.easeTo({ bearing: lastHeading.current, duration: 200 });
  }, [heading]);

  // Keep map centered on the user's location
  useEffect(() => {
    if (!mapRef.current) return;
    if (isDrActive && drPosition) {
      mapRef.current.setCenter([drPosition.lng, drPosition.lat]);
    } else if (!isDrActive && isValidUserLocation) {
      mapRef.current.setCenter([userLocation[1], userLocation[0]]);
    }
  }, [drPosition, userLocation, isDrActive, isValidUserLocation]);

  // Zoom to current segment when step changes
  useEffect(() => {
    if (
      mapRef.current &&
      routeGeo &&
      currentStep < routeGeo.geometry.coordinates.length - 1
    ) {
      const start = routeGeo.geometry.coordinates[currentStep];
      const end = routeGeo.geometry.coordinates[currentStep + 1];
      const bounds = new maplibregl.LngLatBounds(
        [start[0], start[1]],
        [start[0], start[1]]
      );
      bounds.extend([end[0], end[1]]);
      const dist = Math.hypot(end[0] - start[0], end[1] - start[1]) * 100000;
      const options = { padding: 80, duration: 700 };
      if (dist < 50) options.maxZoom = 17;
      mapRef.current.fitBounds(bounds, options);
    }
  }, [currentStep, routeGeo]);

  // Fit map to the full route when a new route is loaded
  useEffect(() => {
    if (mapRef.current && routeGeo) {
      const coords = routeGeo.geometry?.coordinates || [];
      if (coords.length > 0) {
        const bounds = new maplibregl.LngLatBounds(
          [coords[0][0], coords[0][1]],
          [coords[0][0], coords[0][1]]
        );
        coords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
        mapRef.current.fitBounds(bounds, { padding: 80, duration: 700 });
      }
    }
  }, [routeGeo]);

  // Ensure the main route layers stay above alternative routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer('traveled-route-line')) {
      map.moveLayer('traveled-route-line');
    }
    if (map.getLayer('remaining-route-line')) {
      map.moveLayer('remaining-route-line');
    }
    if (map.getLayer('remaining-route-border')) {
      map.moveLayer('remaining-route-border');
    }
  }, [routeGeo, alternativeRoutes, showAlternativeRoutes]);
  
  // Expose a method to parent components for fitting bounds
  const fitRouteBounds = () => {
    if (mapRef.current && routeGeo) {
      const coords = routeGeo.geometry?.coordinates || [];
      if (coords.length > 0) {
        const bounds = new maplibregl.LngLatBounds(
          [coords[0][0], coords[0][1]],
          [coords[0][0], coords[0][1]]
        );
        coords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
        mapRef.current.fitBounds(bounds, { padding: 80, duration: 700, maxZoom: 16 });
      }
    }
  };

  useImperativeHandle(ref, () => ({
    fitRouteBounds,
    getMap: () => mapRef.current
  }));

  const DestinationPin = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="#ff0000"
      stroke="white"
      strokeWidth="1"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18.364 4.636a9 9 0 0 1 .203 12.519l-.203 .21l-4.243 4.242a3 3 0 0 1 -4.097 .135l-.144 -.135l-4.244 -4.243a9 9 0 0 1 12.728 -12.728zm-6.364 3.364a3 3 0 1 0 0 6a3 3 0 0 0 0 -6z" />
    </svg>
  );

  return (
    <Map
      key={mapRenderKey}
      ref={mapRef}
      mapLib={maplibregl}
      mapStyle={mapStyle}
      styleDiffing={false}
      interactiveLayerIds={altLayerIds}
      onLoad={handleMapLoad}
      onClick={(e) => {
        const feature = e.features && e.features[0];
        if (
          feature &&
          feature.layer &&
          (feature.layer.id.startsWith('alt-route-line-') ||
            feature.layer.id.startsWith('alt-route-border-'))
        ) {
          const idx = parseInt(
            feature.layer.id.replace(/alt-route-(?:line|border)-/, '')
          );
          if (!Number.isNaN(idx) && alternativeRoutes[idx] && onSelectAlternativeRoute) {
            onSelectAlternativeRoute(alternativeRoutes[idx]);
          }
        }
      }}
      initialViewState={{
        longitude: center[1],
        latitude: center[0],
        zoom: is3DView ? 17 : 18,
        pitch: 0
      }}
      attributionControl={false}
      terrain={is3DView && terrainAvailable ? { source: 'terrain', exaggeration: 1.5 } : undefined}
      onError={handleMapError}
    >
      {/* User location marker */}
      {!isDrActive && isValidUserLocation && (
        <Marker longitude={userLocation[1]} latitude={userLocation[0]} anchor="center">
          <ArrowMarker />
        </Marker>
      )}

      {isDrActive && drPosition && Number.isFinite(drPosition.lng) && Number.isFinite(drPosition.lat) && (
        <Marker longitude={drPosition.lng} latitude={drPosition.lat} anchor="center">
          <ArrowMarker />
        </Marker>
      )}

      {isDrActive && drGeoPath.length > 1 && (
        <Source
          id="dr-path"
          type="geojson"
          data={{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: drGeoPath.map(p => [p.lng, p.lat])
            }
          }}
        >
          <Layer id="dr-line" type="line" paint={{ 'line-color': '#e53935', 'line-width': 3, 'line-opacity': 0.7 }} />
        </Source>
      )}

      {/* Destination marker */}
      {routeSteps && routeSteps.length > 0 && isValidStepCoordinates(routeSteps[routeSteps.length - 1]) && (
        <Marker
          longitude={routeSteps[routeSteps.length - 1].coordinates[1]}
          latitude={routeSteps[routeSteps.length - 1].coordinates[0]}
          anchor="bottom"
        >
          <DestinationPin />
        </Marker>
      )}

      {is3DView && routeSteps && routeSteps.map((step) => {
        const landmarkLabel = getStepLandmark(step);
        if (!landmarkLabel) return null;
        const coord = getStepCoordinate(step);
        if (!coord) return null;

        return (
          <Marker
            key={`landmark-bubble-${step.id}-${landmarkLabel}`}
            longitude={coord[0]}
            latitude={coord[1]}
            anchor="bottom"
          >
            <div className="rng-landmark-bubble-3d" title={landmarkLabel}>
              <div className="rng-landmark-bubble-core" />
              <div className="rng-landmark-bubble-label">{landmarkLabel}</div>
            </div>
          </Marker>
        );
      })}

      {!isDrActive && showAlternativeRoutes &&
        alternativeRoutes.map((alt, idx) => (
          <Source key={idx} id={`alt-route-${idx}`} type="geojson" data={alt.geo}>
            <Layer
              id={`alt-route-border-${idx}`}
              type="line"
              paint={{
                'line-color': '#d5dada',
                'line-width': 8
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id={`alt-route-line-${idx}`}
              type="line"
              paint={{
                'line-color': 'grey',
                'line-width': 8,
                'line-dasharray': [0, 2]
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </Source>
        ))}

      {/* Traveled route portion - RED */}
      {traveledRouteGeo && traveledRouteGeo.geometry.coordinates.length >= 2 && (
        <Source id="traveled-route" type="geojson" data={traveledRouteGeo}>
          <Layer
            id="traveled-route-line"
            type="line"
            paint={{
              'line-color': '#e74c3c',
              'line-width': 8
            }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </Source>
      )}

      {/* Remaining route portion - Original style (white + blue dots) */}
      {remainingRouteGeo && remainingRouteGeo.geometry.coordinates.length >= 2 && (
        <Source id="remaining-route" type="geojson" data={remainingRouteGeo}>
          <Layer
            id="remaining-route-line"
            type="line"
            paint={{
              'line-color': 'white',
              'line-width': 8
            }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
          <Layer
            id="remaining-route-border"
            type="line"
            paint={{
              'line-color': '#0F71EF',
              'line-width': 8,
              'line-dasharray': [0, 2]
            }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </Source>
      )}

    </Map>
  );
});
export default RouteMap;