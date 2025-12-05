import React, { useEffect, useState, useCallback } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import { useIntl } from 'react-intl';
import maplibregl, { mapLibreTransformRequest } from '../../utils/mapLibreConfig';
import 'maplibre-gl/dist/maplibre-gl.css';
import useOfflineMapStyle from '../../hooks/useOfflineMapStyle';
import { useLangStore } from '../../store/langStore';
import { getLocationTitleById } from '../../utils/getLocationTitle';
import { loadGeoJsonData } from '../../utils/loadGeoJsonData.js';
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

const Mprc = ({
  setUserLocation,
  selectedDestination,
  onMapClick,
  isSelectingLocation,
  selectedCategory,
  userLocation,
  isTracking = true,
  onUserMove,
  groups = [],
  areaDoorsData,
  areaDoorsStatus,
  onDoorSelect,
  showImageMarkers = false,
  landmarkPlaces = []
}) => {
  const intl = useIntl();
  const [viewState, setViewState] = useState({
    latitude: 36.2880,  // Original shrine coordinates
    longitude: 59.6157,
    zoom: 18
  });
  const [userCoords, setUserCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [pointFeatures, setPointFeatures] = useState([]);
  const [doorConnectionNodes, setDoorConnectionNodes] = useState([]);
  const [routeCoords, setRouteCoords] = useState(null);
  const language = useLangStore((state) => state.language);
  const { mapStyle, handleMapError, styleKey } = useOfflineMapStyle();
  const areaLineColor = areaDoorsStatus === 'area_too_small' ? '#9e9e9e' : '#ff9800';

  const onMove = useCallback((evt) => {
    setViewState(evt.viewState);
    if (onUserMove && evt.originalEvent) {
      onUserMove();
    }
  }, [onUserMove]);

  const handleDoorClick = useCallback((door, event) => {
    event?.stopPropagation?.();
    if (onDoorSelect) {
      onDoorSelect(door);
    }
  }, [onDoorSelect]);

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
        latitude: coords.lat,
        longitude: coords.lng,
        zoom: 18
      }));
      return; // Skip GPS if QR code exists
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
        latitude: c.lat,
        longitude: c.lng,
        zoom: 18
      }));
    };

    const err = (e) => {
      console.error('Error getting location', e);
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

  // Update user location and optionally center map when it changes
  // In MapComponent.js, update the useEffect that handles userLocation changes:
  useEffect(() => {
    if (userLocation?.coordinates) {
      const [lat, lng] = userLocation.coordinates;
      const coords = { lat, lng };
      setUserCoords(coords);

      // Only center if tracking is enabled or if we're swapping
      if (isTracking || !destCoords) {
        setViewState(v => ({
          ...v,
          latitude: lat,
          longitude: lng,
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

  // Update destination marker and center map when selection changes
  useEffect(() => {
    if (selectedDestination?.coordinates) {
      const [lat, lng] = selectedDestination.coordinates;
      const coords = { lat, lng };
      setDestCoords(coords);

      // Only center map if this is a new destination selection
      if (!destCoords || destCoords.lat !== lat || destCoords.lng !== lng) {
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
    if (isSelectingLocation) {
      const { lng, lat } = e.lngLat;
      const c = { lat, lng };
      setSelectedCoords(c);

      let closestFeature = null;
      if (pointFeatures.length) {
        let minDist = Infinity;
        pointFeatures.forEach((f) => {
          const [flng, flat] = f.geometry.coordinates || [];
          if (typeof flng !== 'number' || typeof flat !== 'number') {
            return;
          }
          const d = Math.hypot(flng - lng, flat - lat);
          if (d < minDist) {
            minDist = d;
            closestFeature = f;
          }
        });
        if (minDist > 0.0005) {
          closestFeature = null;
        }
      }

      if (onMapClick) onMapClick(c, closestFeature);
    }
  };

  const shouldLoadGeoJson = Boolean(
    selectedCategory ||
    (userCoords && destCoords) ||
    isSelectingLocation
  );

  const renderLandmarkMarkers = useCallback(() => {
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
  }, [showImageMarkers, landmarkPlaces, extractPlaceCoordinates, getFirstImage, onMapClick]);

  useEffect(() => {
    if (!shouldLoadGeoJson) {
      setPointFeatures([]);
      setDoorConnectionNodes([]);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    loadGeoJsonData({ language, signal: controller.signal })
      .then(data => {
        if (!isMounted) {
          return;
        }

        const features = Array.isArray(data?.features) ? data.features : [];
        const nextPointFeatures = features.filter((f) => {
          if (f.geometry?.type !== 'Point') {
            return false;
          }
          const nodeFn = f.properties?.nodeFunction;
          return nodeFn !== 'door' && nodeFn !== 'connection';
        });

        const nextDoorNodes = features.filter(
          (f) =>
            f.geometry?.type === 'Point' &&
            ['door', 'connection'].includes(f.properties?.nodeFunction)
        );

        setPointFeatures(nextPointFeatures);
        setDoorConnectionNodes(nextDoorNodes);
      })
      .catch(err => {
        if (err?.name === 'AbortError') return;
        console.error('failed to load geojson', err);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [language, shouldLoadGeoJson]);

  useEffect(() => {
    if (userCoords && destCoords && doorConnectionNodes.length) {
      const points = doorConnectionNodes;
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
  }, [userCoords, destCoords, doorConnectionNodes]);

  return (
    <Map
      key={styleKey}
      mapLib={maplibregl}
      transformRequest={mapLibreTransformRequest}
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

      {/* Destination marker */}
      {destCoords && (
        <Marker longitude={destCoords.lng} latitude={destCoords.lat} anchor="center">
          <div className="map-marker-destination">
            <div className="map-marker-destination-inner" />
          </div>
        </Marker>
      )}

      {/* Temporary selection marker when choosing location */}
      {selectedCoords && isSelectingLocation && (
        <Marker longitude={selectedCoords.lng} latitude={selectedCoords.lat} anchor="center">
          <div className="map-marker-selecting">
            <div className="map-marker-selecting-inner" />
          </div>
        </Marker>
      )}

      {/* Route line */}
      {routeCoords && (
        <Source id="route" type="geojson" data={{ type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords } }}>
          <Layer id="route-line" type="line" paint={{ 'line-color': '#4285F4', 'line-width': 4, 'line-opacity': 0.7 }} />
        </Source>
      )}

      {/* Area outline from area-doors service */}
      {areaDoorsData?.area?.geometry && (
        <Source id="selected-area-outline" type="geojson" data={{ type: 'Feature', geometry: areaDoorsData.area.geometry }}>
          <Layer
            id="selected-area-outline-line"
            type="line"
            paint={{
              'line-color': areaLineColor,
              'line-width': 3,
              'line-dasharray': [2, 1.5]
            }}
          />
        </Source>
      )}

      {/* Door markers */}
      {Array.isArray(areaDoorsData?.doors) && areaDoorsData.doors.map((door) => {
        const [lon, lat] = door?.coord4326 || [];
        if (typeof lon !== 'number' || typeof lat !== 'number') return null;

        return (
          <Marker key={`door-${door?.doorId || door?.doorNo}`} longitude={lon} latitude={lat} anchor="center">
            <div
              className="map-door-marker"
              onClick={(event) => handleDoorClick(door, event)}
            >
              <span className="map-door-marker-number">{door?.doorNo}</span>
            </div>
          </Marker>
        );
      })}

      {renderLandmarkMarkers()}

      {/* Point features (doors, services, etc.) */}
      // Point features (doors, services, etc.) - Only show when a category is selected
      {selectedCategory && pointFeatures.map((feature, idx) => {
        const [lng, lat] = feature.geometry.coordinates;
        const { group, nodeFunction } = feature.properties || {};

        const matchesSelectedCategory = Boolean(
          feature.properties && (
            feature.properties[selectedCategory.property] === selectedCategory.value ||
            feature.properties.group === selectedCategory.value ||
            feature.properties.nodeFunction === selectedCategory.value
          )
        );

        if (!matchesSelectedCategory) {
          return null;
        }

        const rawId = feature.properties?.uniqueId;
        const key = rawId ? `${rawId}-${idx}` : idx;

        return (
          <Marker key={key} longitude={lng} latitude={lat} anchor="center">
            <div style={{ position: 'relative' }}>
              {getCompositeIcon(groups, group, nodeFunction, 40, 1)}
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
            </div>
          </Marker>
        );
      })}
    </Map>
  );
};

export default Mprc;