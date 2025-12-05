import React, { useEffect, useState, useCallback } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import maplibregl, { mapLibreTransformRequest } from '../../utils/mapLibreConfig';
import 'maplibre-gl/dist/maplibre-gl.css';
import useOfflineMapStyle from '../../hooks/useOfflineMapStyle';
import useLocaleDigits from '../../utils/useLocaleDigits';
import { initHaramVectorLayers } from '../../utils/initVectorLayers';


const Routing = ({ userLocation, routeSteps, currentStep }) => {
  const formatDigits = useLocaleDigits();
  const { mapStyle, handleMapError, styleKey } = useOfflineMapStyle();
  const initialPoint = routeSteps && routeSteps.length > 0
    ? (Array.isArray(routeSteps[0]?.coordinates?.[0])
      ? routeSteps[0].coordinates[0]
      : routeSteps[0].coordinates)
    : [36.2880, 59.6157];
  const [viewState, setViewState] = useState({ latitude: initialPoint[0], longitude: initialPoint[1], zoom: 18 });

  useEffect(() => {
    if (currentStep != null && routeSteps && routeSteps[currentStep]) {
      const coord = Array.isArray(routeSteps[currentStep].coordinates?.[0])
        ? routeSteps[currentStep].coordinates[0]
        : routeSteps[currentStep].coordinates;
      if (Array.isArray(coord) && coord.length >= 2) {
        setViewState(v => ({ ...v, latitude: coord[0], longitude: coord[1] }));
      }
    }
  }, [currentStep, routeSteps]);

  const routePath = routeSteps
    ? routeSteps.map((s) => {
      const coord = Array.isArray(s.coordinates?.[0])
        ? s.coordinates[s.coordinates.length - 1]
        : s.coordinates;
      return Array.isArray(coord) && coord.length >= 2 ? [coord[1], coord[0]] : null;
    }).filter(Boolean)
    : [];

  const currentSegment =
    routeSteps && routeSteps[currentStep]
      ? (() => {
          const rawCoords = Array.isArray(routeSteps[currentStep].coordinates?.[0])
            ? routeSteps[currentStep].coordinates
            : [routeSteps[currentStep].coordinates].filter(Boolean);
          const coords = rawCoords
            .map((p) => (Array.isArray(p) && p.length >= 2 ? [p[1], p[0]] : null))
            .filter(Boolean);
          return coords.length >= 2
            ? { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
            : null;
        })()
      : null;

  const fullGeo = { type: 'Feature', geometry: { type: 'LineString', coordinates: routePath } };

  const handleMapLoad = useCallback((event) => {
    initHaramVectorLayers(event?.target || event);
  }, []);

  return (
    <div ref={null} className="route-map">
      <Map
        key={styleKey}
        mapLib={maplibregl}
        transformRequest={mapLibreTransformRequest}
        mapStyle={mapStyle}
        styleDiffing={false}
        style={{ width: '100%', height: '100%' }}
        viewState={viewState}
        onLoad={handleMapLoad}
        onError={handleMapError}
      >
        {userLocation && (
          <Marker longitude={userLocation[1]} latitude={userLocation[0]} anchor="bottom">
            <div>👤</div>
          </Marker>
        )}
        {routeSteps &&
          routeSteps.map((step, idx) => {
            const coord = Array.isArray(step.coordinates?.[0])
              ? step.coordinates[0]
              : step.coordinates;
            if (!Array.isArray(coord) || coord.length < 2) return null;
            return (
              <Marker key={idx} longitude={coord[1]} latitude={coord[0]} anchor="bottom">
                <div className={`custom-marker ${idx === currentStep ? 'active' : ''}`}>{formatDigits(idx + 1)}</div>
              </Marker>
            );
          })}
        {routeSteps && (
          <Source id="route" type="geojson" data={fullGeo}>
            <Layer id="route-line" type="line" paint={{ 'line-color': '#3498db', 'line-width': 4, 'line-dasharray': [10, 10] }} />
          </Source>
        )}
        {currentSegment && (
          <Source id="segment" type="geojson" data={currentSegment}>
            <Layer id="segment-line" type="line" paint={{ 'line-color': '#e74c3c', 'line-width': 6 }} />
          </Source>
        )}
      </Map>
    </div>
  );
};

export default Routing;
