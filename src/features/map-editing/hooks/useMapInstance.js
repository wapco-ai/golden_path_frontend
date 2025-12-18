import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initHaramVectorLayers } from '../../../utils/initVectorLayers';
import { haramAdminVectorTileConfig } from '../../../config/vectorTiles';
import { getSessionFloor, setSessionFloor, subscribeToSessionFloor } from '../../../utils/sessionFloor';

export const useMapInstance = ({
  activeMenu,
  floorLabelToValue,
  floorValueToLabel,
  onMapRemoved,
  resetMapCursor,
  locationMarker,
  setLocationMarker,
  mapRef: providedMapRef,
}) => {
  const internalMapRef = useRef(null);
  const mapRef = providedMapRef || internalMapRef;

  const [map, setMap] = useState(null);

  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  const [mapViewState, setMapViewState] = useState({
    longitude: 59.6161,
    latitude: 36.2908,
    center: [59.6159, 36.2875],
    zoom: 16
  });

  const buildInitialLayerVisibility = useCallback(() => haramAdminVectorTileConfig.reduce((acc, layer) => {
    acc[layer.id] = !!layer.visibleByDefault;
    return acc;
  }, {}), []);

  const [layerVisibility, setLayerVisibility] = useState(buildInitialLayerVisibility);

  const applyLayerVisibility = useCallback((mapInstance, visibilityState = layerVisibility) => {
    const targetMap = mapInstance || map;
    if (!targetMap) return;

    haramAdminVectorTileConfig.forEach((layer) => {
      if (targetMap.getLayer(layer.id)) {
        targetMap.setLayoutProperty(layer.id, 'visibility', visibilityState?.[layer.id] ? 'visible' : 'none');
      }
    });
  }, [layerVisibility, map]);

  const [mapFloor, setMapFloor] = useState('همکف');
  const [isLayerListOpen, setIsLayerListOpen] = useState(false);
  const [isMapFloorOpen, setIsMapFloorOpen] = useState(false);

  const refreshLayerTiles = useCallback((layerId) => {
    if (!map || !layerId) return;

    const layerConfig = haramAdminVectorTileConfig.find((layer) => layer.id === layerId);
    if (!layerConfig) return;

    const source = map.getSource(layerConfig.sourceId);
    const tileUrlFactory = typeof layerConfig.tileUrlFactory === 'function'
      ? layerConfig.tileUrlFactory
      : null;

    const baseTileUrl = tileUrlFactory
      ? tileUrlFactory({ floor: floorLabelToValue(mapFloor) })
      : layerConfig.tileUrl;

    if (!source || typeof source.setTiles !== 'function' || !baseTileUrl) return;

    const cacheBustedUrl = `${baseTileUrl}${baseTileUrl.includes('?') ? '&' : '?'}cacheBust=${Date.now()}`;

    source.setTiles([cacheBustedUrl]);

    if (typeof map.triggerRepaint === 'function') {
      map.triggerRepaint();
    }
  }, [map, mapFloor, floorLabelToValue]);

  useEffect(() => {
    const initialFloor = getSessionFloor();
    setMapFloor(floorValueToLabel(initialFloor));

    const unsubscribe = subscribeToSessionFloor((floor) => {
      setMapFloor(floorValueToLabel(floor));
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [floorValueToLabel]);

  useEffect(() => {
    setSessionFloor(floorLabelToValue(mapFloor));
  }, [mapFloor, floorLabelToValue]);

  useEffect(() => {
    if (activeMenu === 'mapmanage') {
      const initializeMap = () => {
        const mapInstance = new maplibregl.Map({
          container: 'map-container',
          style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
          center: [59.6161, 36.2888],
          zoom: 16,
        });

        mapInstance.addControl(new maplibregl.NavigationControl());
        mapInstance.on('load', (event) => {
          initHaramVectorLayers(event, haramAdminVectorTileConfig);
          applyLayerVisibility(mapInstance);
        });
        setMap(mapInstance);

        return () => {
          mapInstance.remove();
        };
      };

      if (document.getElementById('map-container')) {
        initializeMap();
      }
    } else {
      if (map) {
        map.remove();
        setMap(null);

        if (locationMarker) {
          locationMarker.remove();
          setLocationMarker(null);
        }
      }

      if (typeof onMapRemoved === 'function') {
        onMapRemoved();
      }

      resetMapCursor?.();
    }
  }, [activeMenu, applyLayerVisibility, locationMarker, map, onMapRemoved, resetMapCursor, setLocationMarker]);

  return useMemo(() => ({
    map,
    mapRef,
    setMap,
    mapViewState,
    setMapViewState,
    layerVisibility,
    setLayerVisibility,
    applyLayerVisibility,
    mapFloor,
    setMapFloor,
    isLayerListOpen,
    setIsLayerListOpen,
    isMapFloorOpen,
    setIsMapFloorOpen,
    refreshLayerTiles,
  }), [
    map,
    mapViewState,
    layerVisibility,
    applyLayerVisibility,
    mapFloor,
    isLayerListOpen,
    isMapFloorOpen,
    refreshLayerTiles,
  ]);
};
