import React, { useEffect, useState, useCallback } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import { useIntl } from 'react-intl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import useOfflineMapStyle from '../../hooks/useOfflineMapStyle';
import { useLangStore } from '../../store/langStore';
import { loadGeoJsonData } from '../../utils/loadGeoJsonData.js';
import { getLocationTitleById } from '../../utils/getLocationTitle';
import { initHaramVectorLayers } from '../../utils/initVectorLayers';

const groupColors = {
  sahn: '#4caf50',
  eyvan: '#2196f3',
  ravaq: '#9c27b0',
  masjed: '#ff9800',
  madrese: '#3f51b5',
  khadamat: '#607d8b',
  elmi: '#00bcd4',
  cemetery: '#795548',
  qrcode: '#607d8b',
  elevator: '#ffc107',
  other: '#757575'
};

const nodeFunctionColors = {
  door: '#e53935'
};

const getCompositeIcon = (groups = [], group, nodeFunction, size = 35, opacity = 1) => {
  const color = nodeFunctionColors[nodeFunction] || groupColors[group] || '#999';
  let iconData =
    groups.find((g) => g.value === group) ||
    groups.find((g) => g.value === nodeFunction) ||
    groups.find((g) => g.value === 'other') || {
      icon: 'other',
      label: 'icon',
      png: undefined
    };

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        opacity,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      }}
    >
      <div
        className={`map-category-icon ${iconData.icon}`}
        style={{ width: '22px', height: '22px', marginTop: 0 }}
      >
        <img src={iconData.png} alt={iconData.label || 'icon'} width="22" height="22" />
      </div>
    </div>
  );
};

const Mpbc = ({
  setUserLocation,
  selectedDestination = null,
  onMapClick,
  selectedCategory,
  userLocation,
  isTracking = true,
  onUserMove,
  showImageMarkers = true,
  isQrCodeEntry = false,
  groups = [],
  subGroups = {},
  landmarkPlaces = []
}) => {
  const intl = useIntl();
  const [viewState, setViewState] = useState({
    latitude: 36.2880,
    longitude: 59.6157,
    zoom: 18
  });
  const [userCoords, setUserCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const language = useLangStore((state) => state.language);
  const [selectedFeatureForBubble, setSelectedFeatureForBubble] = useState(null);
  const { mapStyle, handleMapError, styleKey } = useOfflineMapStyle();

  const onMove = useCallback((evt) => {
    setViewState(evt.viewState);
    if (onUserMove && evt.originalEvent) {
      onUserMove();
    }
  }, [onUserMove]);

  const handleMapLoad = useCallback((event) => {
    initHaramVectorLayers(event?.target || event);
  }, []);

  const extractPlaceCoordinates = useCallback((place = {}) => {
    const lat =
      place.lat ??
      place.latitude ??
      place?.location?.lat ??
      place?.geo?.lat ??
      place?.coordinates?.[0] ??
      place?.geometry?.coordinates?.[1];
    const lng =
      place.lng ??
      place.longitude ??
      place?.location?.lng ??
      place?.geo?.lng ??
      place?.coordinates?.[1] ??
      place?.geometry?.coordinates?.[0];

    if (lat == null || lng == null) return null;
    return { lat: Number(lat), lng: Number(lng) };
  }, []);

  const getFirstImage = useCallback((place) => {
    if (!place) return null;

    if (Array.isArray(place.image) && place.image.length > 0) {
      return place.image[0];
    }

    if (Array.isArray(place.images) && place.images.length > 0) {
      return place.images[0];
    }

    if (typeof place.image === 'string' && place.image.trim()) {
      return place.image;
    }

    if (typeof place.images === 'string' && place.images.trim()) {
      return place.images;
    }

    return null;
  }, []);

  // Initialize map focus and user location based on QR entry or GPS tracking
  useEffect(() => {
    const storedLat = sessionStorage.getItem('qrLat');
    const storedLng = sessionStorage.getItem('qrLng');
    const storedId = sessionStorage.getItem('qrId');

    // Priority 1: QR code location
    if (storedLat && storedLng) {
      const coords = {
        lat: parseFloat(storedLat),
        lng: parseFloat(storedLng)
      };
      setUserCoords(coords);

      (async () => {
        let name = intl.formatMessage({ id: 'mapCurrentLocationName' });
        if (storedId) {
          const title = await getLocationTitleById(storedId);
          if (title) name = title;
        }
        setUserLocation({
          name,
          coordinates: [coords.lat, coords.lng]
        });
      })();

      setViewState(v => ({
        ...v,
        latitude: coords.lat - 0.0004,
        longitude: coords.lng,
        zoom: 18
      }));
      return;
    }

    if (!isTracking) return undefined;

    const success = (pos) => {
      if (sessionStorage.getItem('qrLat') && sessionStorage.getItem('qrLng')) {
        return; // Don't override QR code location
      }

      const c = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      setUserCoords(c);
      setUserLocation({
        name: intl.formatMessage({ id: 'mapCurrentLocationName' }),
        coordinates: [c.lat, c.lng]
      });

      setViewState((v) => ({
        ...v,
        latitude: c.lat - 0.0004,
        longitude: c.lng,
        zoom: 18
      }));
    };

    const err = (e) => {
      console.error('Error getting GPS location', e);
    };

    navigator.geolocation.getCurrentPosition(success, err, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000
    });

    const watchId = navigator.geolocation.watchPosition(success, err, {
      enableHighAccuracy: false,
      maximumAge: 0,
      timeout: 10000
    });

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [setUserLocation, intl, isTracking]);

  useEffect(() => {
    if (userLocation?.coordinates) {
      const [lat, lng] = userLocation.coordinates;
      const coords = { lat, lng };
      setUserCoords(coords);

      // CRITICAL FIX: Only center if tracking is enabled AND we're not handling a map selection
      const isMapSelection = sessionStorage.getItem('mapSelectedLat') &&
        sessionStorage.getItem('mapSelectedLng');

      if (isTracking && !isMapSelection) {
        setViewState(v => ({
          ...v,
          latitude: coords.lat - 0.0004,
          longitude: coords.lng - 0.000,
          zoom: 18
        }));
      }
    }
  }, [userLocation, isTracking]);

  // Update the destination useEffect to handle swapping:
  useEffect(() => {
    if (selectedDestination?.coordinates) {
      const [lat, lng] = selectedDestination.coordinates;
      const coords = { lat, lng };
      setDestCoords(coords);

      // Only center if we don't have user coords or if we're swapping
      if (!userCoords) {
        setViewState(v => ({
          ...v,
          latitude: lat,
          longitude: lng,
          zoom: 18
        }));
      }
    } else {
      setDestCoords(null);
    }
  }, [selectedDestination]);

  const handleClick = (e) => {
    const { lng, lat } = e.lngLat;
    const c = { lat, lng };

    let closestFeature = null;
    if (geoData) {
      let minDist = Infinity;
      geoData.features.forEach((f) => {
        if (f.geometry.type === 'Point') {
          const [flng, flat] = f.geometry.coordinates;
          const d = Math.hypot(flng - lng, flat - lat);

          // CRITICAL FIX: Only consider features that should be selectable
          const { group, subGroupValue } = f.properties || {};
          const subgroup = subGroups[group]?.find(sg => sg.value === subGroupValue);
          const hasImage = subgroup && subgroup.img;

          // When no category is selected, only allow selection of features with images
          if (!selectedCategory && !hasImage) {
            return; // Skip this feature - not selectable
          }

          // When category is selected, only allow selection of features from that category
          if (selectedCategory && group !== selectedCategory.value) {
            return; // Skip this feature - not in selected category
          }

          if (d < minDist) {
            minDist = d;
            closestFeature = f;
          }
        }
      });
      if (minDist > 0.0005) {
        closestFeature = null;
      }
    }

    // Set the selected feature for the bubble
    setSelectedFeatureForBubble(closestFeature);

    if (onMapClick) onMapClick(c, closestFeature);
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    loadGeoJsonData({ language, signal: controller.signal })
      .then(data => {
        if (isMounted) {
          setGeoData(data);
        }
      })
      .catch(err => {
        if (err?.name === 'AbortError') {
          return;
        }
        console.error('failed to load geojson data', err);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [language]);

  useEffect(() => {
    if (userCoords && destCoords && geoData) {
      const points = geoData.features.filter(
        (f) =>
          f.geometry.type === 'Point' &&
          ['door', 'connection'].includes(f.properties?.nodeFunction)
      );

      const nearest = (coords) => {
        let best = null;
        let dmin = Infinity;
        points.forEach((p) => {
          const [lng, lat] = p.geometry.coordinates;
          const d = Math.hypot(lng - coords.lng, lat - coords.lat);
          if (d < dmin) {
            dmin = d;
            best = { lng, lat };
          }
        });
        return best;
      };

      const start = nearest(userCoords);
      const end = nearest(destCoords);
      const coords = [
        [userCoords.lng, userCoords.lat],
        ...(start ? [[start.lng, start.lat]] : []),
        ...(end ? [[end.lng, end.lat]] : []),
        [destCoords.lng, destCoords.lat]
      ];
      setRouteCoords(coords);
    } else {
      setRouteCoords(null);
    }
  }, [userCoords, destCoords, geoData]);

  const pointFeatures = geoData
    ? geoData.features.reduce((acc, feature) => {
      const { properties = {}, geometry } = feature;
      const { group, subGroupValue, nodeFunction } = properties;
      const isDoor = nodeFunction === 'door';
      const isDoorLine = isDoor && geometry?.type &&
        (geometry.type === 'LineString' || geometry.type === 'MultiLineString');

      if (isDoorLine || isDoor) return acc;

      const coordinates = geometry?.type === 'Point'
        ? geometry.coordinates
        : null;

      if (!coordinates) return acc;

      if (!isDoor) {
        const subgroup = subGroups[group]?.find(sg => sg.value === subGroupValue);
        const hasImage = subgroup && subgroup.img;

        // If no category is selected, don't show any icon markers (only image markers)
        if (!selectedCategory) return acc;

        // If a category is selected, only show features from that category
        if (selectedCategory && group !== selectedCategory.value) return acc;

        // Don't show features that have images (they're handled separately)
        if (hasImage) return acc;
      }

      acc.push({
        ...feature,
        geometry: { type: 'Point', coordinates }
      });

      return acc;
    }, [])
    : [];

  const DOOR_SEGMENT_HALF_LENGTH = 0.000015;

  const doorLineFeatures = geoData
    ? geoData.features.reduce((acc, feature) => {
      const isDoor = feature.properties?.nodeFunction === 'door';
      if (!isDoor || !feature.geometry) return acc;

      const { type, coordinates } = feature.geometry;

      if (type === 'LineString' || type === 'MultiLineString') {
        acc.push(feature);
        return acc;
      }

      if (type === 'Point' && Array.isArray(coordinates) && coordinates.length >= 2) {
        const [lng, lat] = coordinates;

        if (typeof lng === 'number' && typeof lat === 'number') {
          const lineCoordinates = [
            [lng - DOOR_SEGMENT_HALF_LENGTH, lat],
            [lng + DOOR_SEGMENT_HALF_LENGTH, lat]
          ];

          acc.push({
            ...feature,
            geometry: {
              type: 'LineString',
              coordinates: lineCoordinates
            }
          });
        }
      }

      return acc;
    }, [])
    : [];

  const polygonFeatures = geoData
    ? geoData.features.filter(
      f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
    )
    : [];

  // Function to render image markers for landmarks with images
  const renderImageMarkers = () => {
    if (!showImageMarkers || !Array.isArray(landmarkPlaces) || landmarkPlaces.length === 0) {
      return null;
    }

    const seenCoords = new Set();

    const markers = landmarkPlaces
      .map((place, idx) => {
        const coords = extractPlaceCoordinates(place);
        const imageUrl = getFirstImage(place);

        if (!coords || !imageUrl) return null;

        const key = place.id ? `landmark-${place.id}` : `landmark-${idx}`;
        const coordKey = `${coords.lng.toFixed(6)}-${coords.lat.toFixed(6)}`;

        if (seenCoords.has(coordKey)) return null;
        seenCoords.add(coordKey);

        return { key, coords, imageUrl, title: place.title || place.name || place.subGroup, place };
      })
      .filter(Boolean);

    const normalizeImages = (place) => {
      if (Array.isArray(place.image)) return place.image;
      if (Array.isArray(place.images)) return place.images;

      const firstImage = getFirstImage(place);
      return firstImage ? [firstImage] : [];
    };

    return markers.map(({ key, coords, imageUrl, title, place }) => (
      <Marker key={key} longitude={coords.lng} latitude={coords.lat} anchor="center">
        <div
          className="image-marker-container"
          onClick={(event) => {
            event?.stopPropagation?.();

            const feature = {
              geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
              properties: {
                ...place,
                name: place.title || place.name || place.subGroup,
                label: place.title || place.name || place.subGroup,
                subGroupValue: place.subGroupValue || place.value || place.id,
                img: normalizeImages(place),
                isLandmark: true,
                distance: place.distance,
                time: place.time,
                description: place.description,
                address: place.address
              }
            };

            // Ensure bubble shows landmark name on selection
            setSelectedFeatureForBubble(feature);

            onMapClick?.({ lat: coords.lat, lng: coords.lng }, feature);
          }}
        >
          <svg width="55" height="63" viewBox="0 0 55 63" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M54.6562 27.3281C54.6562 39.6299 46.5275 50.0319 35.3486 53.459C35.1079 53.8493 34.8535 54.2605 34.585 54.6924L33.1699 56.9687C30.7353 60.8845 29.5175 62.8418 27.7412 62.8418C25.9651 62.8417 24.7479 60.8842 22.3135 56.9687L20.8975 54.6924C20.6938 54.3648 20.4993 54.0485 20.3115 53.7451C8.61859 50.6476 8.59898e-05 39.9953 -1.19455e-06 27.3281C-5.34814e-07 12.2351 12.2351 -1.85429e-06 27.3281 -1.19455e-06C42.4211 0.000106671 54.6562 12.2352 54.6562 27.3281Z" fill="white" />
          </svg>
          <div
            className="image-marker-content"
            style={{ backgroundImage: `url(${imageUrl})` }}
            aria-label={title || 'landmark'}
          />
        </div>
      </Marker>
    ));
  };

  return (
    <Map
      key={styleKey}
      mapLib={maplibregl}
      mapStyle={mapStyle}
      styleDiffing={false}
      style={{ width: '100%', height: '100%' }}
      {...viewState}
      onMove={onMove}
      onLoad={handleMapLoad}
      onClick={handleClick}
      onError={handleMapError}
      interactive={true}
    >
      {/* User location marker */}
      {userCoords && (
        <Marker longitude={userCoords.lng} latitude={userCoords.lat} anchor="center">
          <div className="map-marker-origin">
            <div className="map-marker-origin-inner" />
          </div>
        </Marker>
      )}

      {/* Bubble name*/}
      {selectedFeatureForBubble && selectedFeatureForBubble.geometry.type === 'Point' && (
        <Marker
          longitude={selectedFeatureForBubble.geometry.coordinates[0]}
          latitude={selectedFeatureForBubble.geometry.coordinates[1]}
          anchor="bottom"
          offset={[0, 75]}
        >
          <div className="location-bubble">
            <svg width="140" height="40" viewBox="0 0 140 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0.5" y="0.5" width="139" height="39" rx="19.5" fill="white" />
              <rect x="0.5" y="0.5" width="139" height="39" rx="19.5" stroke="#0F71EF" />
              <text
                x="70"
                y="22"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#0F71EF"
                fontFamily="Vazir, Tahoma, sans-serif"
                fontSize="12"
                fontWeight="600"
              >
                {selectedFeatureForBubble.properties?.name ||
                  selectedFeatureForBubble.properties?.subGroup}
              </text>
            </svg>
          </div>
        </Marker>
      )}

      {/* Destination marker */}
      {destCoords && (
        <Marker longitude={destCoords.lng} latitude={destCoords.lat} anchor="center">
          <div className="map-marker-destination">
            <div className="map-marker-destination-inner" />
          </div>
        </Marker>
      )}

      {/* Route line */}
      {routeCoords && (
        <Source id="route" type="geojson" data={{ type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords } }}>
          <Layer id="route-line" type="line" paint={{ 'line-color': '#4285F4', 'line-width': 4, 'line-opacity': 0.7 }} />
        </Source>
      )}

      {/* Building polygons */}
      {polygonFeatures.length > 0 && (
        <Source id="polygons" type="geojson" data={{ type: 'FeatureCollection', features: polygonFeatures }}>
          <Layer id="polygon-lines" type="line" paint={{ 'line-color': '#333', 'line-width': 2 }} />
        </Source>
      )}

      {/* Door lines */}
      {doorLineFeatures.length > 0 && (
        <Source
          id="door-lines"
          type="geojson"
          data={{ type: 'FeatureCollection', features: doorLineFeatures }}
        >
          <Layer
            id="door-lines-layer"
            type="line"
            paint={{
              'line-color': nodeFunctionColors.door,
              'line-width': 3
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round'
            }}
          />
        </Source>
      )}

      {/* Image markers for subgroups with images */}
      {renderImageMarkers()}

      {/* Point features (doors, services, etc.) - Only show when a category is selected */}
      {pointFeatures.map((feature, idx) => {
        const [lng, lat] = feature.geometry.coordinates;
        const { group, nodeFunction } = feature.properties || {};

        const highlight =
          selectedCategory &&
          feature.properties &&
          feature.properties[selectedCategory.property] === selectedCategory.value;
        const hasFilter = !!selectedCategory;
        const iconSize = hasFilter ? (highlight ? 40 : 25) : 35;
        const iconOpacity = hasFilter ? (highlight ? 1 : 0.4) : 1;
        const rawId = feature.properties?.uniqueId;
        const key = rawId ? `${rawId}-${idx}` : idx;

        return (
          <Marker key={key} longitude={lng} latitude={lat} anchor="center">
            <div style={{ position: 'relative' }}>
              {getCompositeIcon(groups, group, nodeFunction, iconSize, iconOpacity)}
              {highlight && (
                <div
                  style={{
                    position: 'absolute',
                    top: -4,
                    left: -4,
                    right: -4,
                    bottom: -4,
                    border: '2px solid #e53935',
                    borderRadius: '50%'
                  }}
                />
              )}
            </div>
          </Marker>
        );
      })}
    </Map>
  );
};

export default Mpbc; 