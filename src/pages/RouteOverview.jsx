import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import Map, { Marker, Source, Layer, Popup } from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/RouteOverview.css';
import useOfflineMapStyle from '../hooks/useOfflineMapStyle';
import { useRouteStore } from '../store/routeStore';
import useLocaleDigits from '../utils/useLocaleDigits';
import { initHaramVectorLayers } from '../utils/initVectorLayers';
import { useLangStore } from '../store/langStore';
import { fetchGroupMetadata, fetchSubGroups } from '../services/groupService';
import { fetchLandmarkPlaces } from '../services/landmarkService';
import { normalizeGroupMetadata, normalizeSubGroupMetadata } from '../utils/groupMetadata';
import { requestRouting } from '../services/routingService';
import { loadGeoJsonData } from '../utils/loadGeoJsonData';
import { analyzeRoute } from '../utils/routeAnalysis';

const RouteOverview = () => {
  const navigate = useNavigate();
  const intl = useIntl();
  const language = useLangStore(state => state.language);
  const formatDigits = useLocaleDigits();

  const mapRef = useRef(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [directionArrow, setDirectionArrow] = useState('right');
  const [distance, setDistance] = useState('');
  const [time, setTime] = useState('');
  const [popupCoord, setPopupCoord] = useState(null);
  const [selectedSubgroup, setSelectedSubgroup] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState({});
  const [nearbyLandmarks, setNearbyLandmarks] = useState([]);

  const handleMapLoad = useCallback((event) => {
    initHaramVectorLayers(event?.target || event);
  }, []);

  const toRad = deg => (deg * Math.PI) / 180;
  const toDeg = rad => (rad * 180) / Math.PI;
  const bearing = (from, to) => {
    if (!Array.isArray(from) || !Array.isArray(to)) return null;
    const [lng1, lat1] = from;
    const [lng2, lat2] = to;
    const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  const computeTurn = (b1, b2) => {
    // Compute turn relative to the user's current heading (b1)
    // Positive diff should mean a left turn and negative diff a right turn
    // so we reverse the subtraction order.
    const diff = ((b1 - b2 + 540) % 360) - 180; // [-180, 180]
    const ad = Math.abs(diff);
    if (ad < 30) return 'up';
    if (ad > 150) return 'down';
    if (ad < 100) return diff > 0 ? 'left' : 'right';
    return diff > 0 ? 'bend-left' : 'bend-right';
  };

  const toMeters = useCallback((coord1, coord2) => {
    if (!Array.isArray(coord1) || !Array.isArray(coord2)) return Infinity;
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;
    const R = 6371000;
    const toRadVal = (deg) => (deg * Math.PI) / 180;
    const dLat = toRadVal(lat2 - lat1);
    const dLng = toRadVal(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadVal(lat1)) * Math.cos(toRadVal(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const {
    routeGeo,
    routeSteps,
    origin,
    destination,
    transportMode,
    gender,
    setRouteGeo,
    setRouteSteps,
    setAlternativeRoutes
  } = useRouteStore();
  const routeCoordinates = routeGeo?.geometry?.coordinates || [];
  const { mapStyle, handleMapError, styleKey } = useOfflineMapStyle();

  const handleSubgroupClick = (subgroup) => {
    setSelectedSubgroup(subgroup);
    setSelectedImageIndex(0);
  };

  const handleCloseModal = () => {
    setSelectedSubgroup(null);
    setSelectedImageIndex(0);
  };

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchGroupMetadata({ language, withPng: true }),
      fetchSubGroups({ language, withImages: true })
    ])
      .then(([groupData, subGroupData]) => {
        if (!isMounted) return;

        const normalizedGroups = normalizeGroupMetadata(groupData?.groups, language);
        const normalizedSubGroups = normalizeSubGroupMetadata(subGroupData?.subGroups, language);

        setGroups(normalizedGroups);
        setSubGroups(normalizedSubGroups);
      })
      .catch((err) => {
        console.error('failed to fetch group metadata', err);
      });

    return () => {
      isMounted = false;
    };
  }, [language]);

  const extractPlaceCoordinates = useCallback((place = {}) => {
    const lat =
      place.lat ??
      place.latitude ??
      place?.location?.lat ??
      place?.geo?.lat ??
      place?.coordinates?.[1] ??
      place?.geometry?.coordinates?.[1];
    const lng =
      place.lng ??
      place.longitude ??
      place?.location?.lng ??
      place?.geo?.lng ??
      place?.coordinates?.[0] ??
      place?.geometry?.coordinates?.[0];

    if (lat == null || lng == null) return null;
    return [Number(lng), Number(lat)];
  }, []);

  const findClosestRoutePoint = useCallback((targetCoord) => {
    if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
      return { distance: Infinity, index: -1 };
    }

    let bestDistance = Infinity;
    let bestIndex = -1;

    routeCoordinates.forEach((coord, idx) => {
      const dist = toMeters(targetCoord, coord);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIndex = idx;
      }
    });

    return { distance: bestDistance, index: bestIndex };
  }, [routeCoordinates, toMeters]);

  useEffect(() => {
    let isMounted = true;

    const fetchNearbyLandmarks = async () => {
      if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
        setNearbyLandmarks([]);
        return;
      }

      const middleCoord = routeCoordinates[Math.floor(routeCoordinates.length / 2)];
      const geo = middleCoord ? { lat: middleCoord[1], lng: middleCoord[0] } : undefined;

      const getFirstImage = (place) => {
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
      };

      try {
        const data = await fetchLandmarkPlaces({ language, geo });
        const places = Array.isArray(data?.places?.landmarkPlaces)
          ? data.places.landmarkPlaces
          : [];

        const placesWithImages = places
          .map((place) => {
            const image = getFirstImage(place);
            if (!image) return null;
            return { ...place, image };
          })
          .filter(Boolean);

        const annotated = placesWithImages
          .map((place, idx) => {
            const coord = extractPlaceCoordinates(place);
            if (!coord) return null;
            const { distance, index } = findClosestRoutePoint(coord);
            return distance <= 30
              ? { place, coord, distance, index, originalIndex: idx }
              : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.index - b.index || a.distance - b.distance || a.originalIndex - b.originalIndex);

        const uniqueByPoint = [];
        const usedIndices = new Set();
        annotated.forEach((item) => {
          if (item.index >= 0 && !usedIndices.has(item.index)) {
            usedIndices.add(item.index);
            uniqueByPoint.push(item);
          }
        });

        if (isMounted) {
          setNearbyLandmarks(uniqueByPoint.slice(0, 6));
        }
      } catch (err) {
        console.error('failed to fetch nearby landmarks for route overview', err);
        if (isMounted) {
          setNearbyLandmarks([]);
        }
      }
    };

    fetchNearbyLandmarks();

    return () => {
      isMounted = false;
    };
  }, [language, routeCoordinates, extractPlaceCoordinates, findClosestRoutePoint]);

  useEffect(() => {
    const hasRouteData =
      (routeGeo?.geometry?.coordinates?.length || 0) > 0 ||
      (routeSteps?.length || 0) > 0;

    if (hasRouteData) {
      return undefined;
    }

    const controller = new AbortController();

    const persistRouteData = (geo, steps, alternatives = []) => {
      setRouteGeo(geo);
      setRouteSteps(steps);
      setAlternativeRoutes(alternatives);
      sessionStorage.setItem('routeGeo', JSON.stringify(geo));
      sessionStorage.setItem('routeSteps', JSON.stringify(steps));
      sessionStorage.setItem('alternativeRoutes', JSON.stringify(alternatives));
    };

    const hydrateFromSession = () => {
      const sessGeo = sessionStorage.getItem('routeGeo');
      const sessSteps = sessionStorage.getItem('routeSteps');
      const sessAlts = sessionStorage.getItem('alternativeRoutes');

      if (sessGeo && sessSteps) {
        persistRouteData(
          JSON.parse(sessGeo),
          JSON.parse(sessSteps),
          sessAlts ? JSON.parse(sessAlts) : []
        );
        return true;
      }
      return false;
    };

    if (hydrateFromSession()) {
      return undefined;
    }

    if (!origin || !destination) {
      return undefined;
    }

    const rebuildRoute = async () => {
      try {
        const result = await requestRouting({
          origin,
          destination,
          mode: transportMode,
          gender,
          lang: language,
          maxAlternatives: 2,
          signal: controller.signal
        });

        if (result?.geo && result?.steps) {
          persistRouteData(result.geo, result.steps, result.alternatives || []);
          return;
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error('failed to fetch route overview from routing service', err);
        }
      }

      try {
        const geoData = await loadGeoJsonData({ language, signal: controller.signal });
        const analysis = analyzeRoute(origin, destination, geoData, transportMode, gender);

        if (analysis?.geo && analysis?.steps) {
          persistRouteData(analysis.geo, analysis.steps, analysis.alternatives || []);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error('failed to rebuild route overview locally', err);
        }
      }
    };

    rebuildRoute();

    return () => controller.abort();
  }, [
    routeGeo,
    routeSteps,
    origin,
    destination,
    transportMode,
    gender,
    language,
    setRouteGeo,
    setRouteSteps,
    setAlternativeRoutes
  ]);



  // Function to render image markers for subgroups or nearby landmarks along the route
  // Function to render limited subgroup markers along the route
  const renderImageMarkers = () => {
    if (!routeCoordinates || routeCoordinates.length === 0) return null;

    // Get a limited selection of subgroups (max 2 per group)
    const getLimitedSubgroups = () => {
      const limitedSubgroups = [];

      const groupOrder = groups?.length
        ? groups.map((group) => group.value).filter(Boolean)
        : Object.keys(subGroups || {});

      groupOrder.forEach((groupValue) => {
        const groupSubGroups = subGroups?.[groupValue];
        if (groupSubGroups && groupSubGroups.length > 0) {
          const selected = groupSubGroups.slice(0, 2);
          limitedSubgroups.push(...selected);
        }
      });

      return limitedSubgroups;
    };

    const limitedSubgroups = getLimitedSubgroups();

    // Only show markers at specific points along the route (not everywhere)
    const markerPositions = [];

    // Prioritize landmarks that are close to the route
    if (nearbyLandmarks.length > 0) {
      nearbyLandmarks.forEach((item) => {
        markerPositions.push({
          coord: item.coord,
          landmark: item.place
        });
      });
    }

    // If we don't have enough landmarks, fill remaining slots with subgroup data
    if (markerPositions.length < 4 && routeCoordinates.length >= 4 && limitedSubgroups.length > 0) {
      const positions = [
        0, // start
        Math.floor(routeCoordinates.length / 3),
        Math.floor(routeCoordinates.length * 2 / 3),
        routeCoordinates.length - 1 // end
      ];

      positions.forEach((position, index) => {
        if (markerPositions.length >= 4) return;
        if (limitedSubgroups[index] && routeCoordinates[position]) {
          markerPositions.push({
            subgroup: limitedSubgroups[index],
            coord: routeCoordinates[position]
          });
        }
      });
    }

    return markerPositions.map((item, idx) => {
      const [lng, lat] = item.coord;
      const subgroup = item.subgroup;
      const hasSubgroupImages = subgroup?.img && (Array.isArray(subgroup.img) ? subgroup.img.length > 0 : true);
      const landmarkImage = Array.isArray(item.landmark?.image) ? item.landmark?.image[0] : item.landmark?.image;
      const shouldShowLandmarkInIcon = Boolean(item.landmark);

      const markerKey = item.landmark?.id
        ? `landmark-${item.landmark.id}`
        : subgroup?.value
          ? `marker-${idx}-${subgroup.value}`
          : `marker-${idx}`;

      return (
        <Marker
          key={markerKey}
          longitude={lng}
          latitude={lat}
          anchor="center"
          onClick={(e) => {
            if (subgroup) {
              e.originalEvent.stopPropagation();
              handleSubgroupClick(subgroup);
            }
          }}
        >
          {shouldShowLandmarkInIcon ? (
            <div className="icon-marker-container">
              <div className="icon-marker-background">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="19" fill="white" stroke="#0f71ef" strokeWidth="2" />
                </svg>
              </div>
              <div className="icon-marker-content">
                {landmarkImage ? (
                  <div
                    className="landmark-image"
                    style={{ backgroundImage: `url(${landmarkImage})` }}
                    aria-label={item.landmark?.title || item.landmark?.name || 'landmark'}
                  />
                ) : (
                  <div className="subgroup-default-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#0f71ef">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <circle cx="12" cy="12" r="9" fill="none" stroke="#0f71ef" strokeWidth="2" />
                      <circle cx="12" cy="9" r="1" fill="#0f71ef" />
                      <path d="M12 15l0 3" stroke="#0f71ef" strokeWidth="2" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : hasSubgroupImages ? (
            <div className="image-marker-container2">
              <svg width="55" height="63" viewBox="0 0 55 63" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M54.6562 27.3281C54.6562 39.6299 46.5275 50.0319 35.3486 53.459C35.1079 53.8493 34.8535 54.2605 34.585 54.6924L33.1699 56.9687C30.7353 60.8845 29.5175 62.8418 27.7412 62.8418C25.9651 62.8417 24.7479 60.8842 22.3135 56.9687L20.8975 54.6924C20.6938 54.3648 20.4993 54.0485 20.3115 53.7451C8.61859 50.6476 8.59898e-05 39.9953 -1.19455e-06 27.3281C-5.34814e-07 12.2351 12.2351 -1.85429e-06 27.3281 -1.19455e-06C42.4211 0.000106671 54.6562 12.2352 54.6562 27.3281Z" fill="white" />
              </svg>
              <div
                className="image-marker-content2"
                style={{
                  backgroundImage: `url(${Array.isArray(subgroup.img) ? subgroup.img[0] : subgroup.img})`
                }}
              />
            </div>
          ) : (
            <div className="icon-marker-container">
              <div className="icon-marker-background">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="19" fill="white" stroke="#0f71ef" strokeWidth="2" />
                </svg>
              </div>
              <div className="icon-marker-content">
                <div className="subgroup-default-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#0f71ef">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <circle cx="12" cy="12" r="9" fill="none" stroke="#0f71ef" strokeWidth="2" />
                    <circle cx="12" cy="9" r="1" fill="#0f71ef" />
                    <path d="M12 15l0 3" stroke="#0f71ef" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </Marker>
      );
    });
  };
  const routeData = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return [];

    const computeDistance = (coords = []) => {
      if (!coords || coords.length < 2) return 0;
      return coords.slice(1).reduce((acc, point, index) => {
        const prev = coords[index];
        return acc + (Math.hypot(point[0] - prev[0], point[1] - prev[1]) * 100000);
      }, 0);
    };

    const toLngLat = (coord) => Array.isArray(coord) && coord.length >= 2
      ? [coord[1], coord[0]]
      : null;

    const normalizeStepCoords = (step, idx) => {
      const mappedCoords = Array.isArray(step?.coordinates?.[0])
        ? step.coordinates.map(toLngLat).filter(Boolean)
        : [];

      if (mappedCoords.length >= 2) return mappedCoords;

      const start = routeCoordinates[idx];
      const end = routeCoordinates[idx + 1];
      return [start, end].filter(Boolean);
    };

    const buildFromSteps = () => (routeSteps || [])
      .map((step, idx) => {
        const coords = normalizeStepCoords(step, idx);

        if (!coords || coords.length < 2) return null;

        const stepName = step?.name || step?.title;
        const stepTitle = step?.title || stepName || '';
        const base = step && step.type
          ? intl.formatMessage(
            { id: step.type },
            { name: stepName, title: stepTitle, num: idx + 1 }
          )
          : step?.instruction
            ? step.instruction
            : intl.formatMessage({ id: 'stepArriveDestination' }, { name: step?.name || intl.formatMessage({ id: 'destination' }) });

        const dist = computeDistance(coords);
        const instruction = step?.landmark
          ? `${base}، ${intl.formatMessage({ id: 'landmarkSuffix' }, { name: step.landmark, distance: Math.round(dist) })}`
          : base;

        return {
          id: idx + 1,
          coordinates: coords,
          instruction,
          services: step?.services || {},
          distance: dist,
          doorNames: step?.type === 'stepPassDoor' ? [stepName].filter(Boolean) : []
        };
      })
      .filter(Boolean);

    const segments = routeSteps?.length ? buildFromSteps() : routeCoordinates.slice(1).map((c, idx) => {
      const step = routeSteps?.[idx];
      const stepName = step?.name || step?.title;
      const stepTitle = step?.title || stepName || '';
      const base = step && step.type
        ? intl.formatMessage(
          { id: step.type },
          { name: stepName, title: stepTitle, num: idx + 1 }
        )
        : step?.instruction
          ? step.instruction
          : intl.formatMessage({ id: 'stepArriveDestination' }, { name: step?.name || intl.formatMessage({ id: 'destination' }) });

      const dist = Math.hypot(
        c[0] - routeCoordinates[idx][0],
        c[1] - routeCoordinates[idx][1]
      ) * 100000;
      const instruction = step?.landmark
        ? `${base}، ${intl.formatMessage({ id: 'landmarkSuffix' }, { name: step.landmark, distance: Math.round(dist) })}`
        : base;
      return {
        id: idx + 1,
        coordinates: [routeCoordinates[idx], c],
        instruction,
        services: step?.services || {},
        distance: dist,
        doorNames: step?.type === 'stepPassDoor' ? [stepName].filter(Boolean) : []
      };
    }).filter(seg => Array.isArray(seg.coordinates) && seg.coordinates.length >= 2);

    return segments
      .filter(seg => seg?.coordinates && seg.coordinates.length >= 2)
      .map((seg, idx) => {
        const instr =
          seg.doorNames && seg.doorNames.length > 1
            ? intl.formatMessage(
              { id: 'doorToDoor' },
              { from: seg.doorNames[0], to: seg.doorNames[seg.doorNames.length - 1] }
            )
            : seg.instruction;

        return {
          id: idx + 1,
          coordinates: seg.coordinates,
          instruction: instr,
          services: seg.services,
          distance: seg.distance
        };
      });
  }, [routeCoordinates, routeSteps, intl]);

  const [viewState, setViewState] = useState({
    latitude: routeCoordinates[0]?.[1] || 0,
    longitude: routeCoordinates[0]?.[0] || 0,
    zoom: 16
  });

  // Scroll to top on component mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const highlightGeo = useMemo(() => {
    const seg = routeData[currentSlide]?.coordinates;
    return seg ? { type: 'Feature', geometry: { type: 'LineString', coordinates: seg } } : null;
  }, [currentSlide, routeData]);

  useEffect(() => {
    if (routeData[currentSlide]) {
      const segObj = routeData[currentSlide];
      const coords = segObj.coordinates;

      if (
        !Array.isArray(coords) ||
        coords.length < 2 ||
        !Array.isArray(coords[0]) ||
        !Array.isArray(coords[coords.length - 1])
      ) {
        return;
      }

      const [lng1, lat1] = coords[0];
      const [lng2, lat2] = coords[coords.length - 1];
      const d = segObj.distance;
      setDistance(
        `${formatDigits(Math.round(d))} ${intl.formatMessage({ id: 'meters' })}`
      );
      setTime(
        `${formatDigits(Math.max(1, Math.round(d / 60)))} ${intl.formatMessage({ id: 'minutesUnit' })}`
      );

      if (currentSlide === routeData.length - 1) {
        setDirectionArrow('arrived');
      } else {
        const nextCoords = routeData[currentSlide + 1]?.coordinates;
        const b1 = bearing(coords[0], coords[coords.length - 1]);
        const b2 = Array.isArray(nextCoords)
          ? bearing(nextCoords[0], nextCoords[nextCoords.length - 1])
          : null;
        setDirectionArrow(b1 != null && b2 != null ? computeTurn(b1, b2) : 'up');
      }

      const isShort = d < 50;
      setViewState({
        latitude: (lat1 + lat2) / 2,
        longitude: (lng1 + lng2) / 2,
        zoom: isShort ? 17 : 18
      });
      setPopupCoord([(lng1 + lng2) / 2, (lat1 + lat2) / 2]);
      if (mapRef.current) {
        const bounds = new maplibregl.LngLatBounds([lng1, lat1], [lng2, lat2]);
        const options = { padding: 50, duration: 700 };
        if (isShort) options.maxZoom = 17;
        mapRef.current.fitBounds(bounds, options);
      }
    }
  }, [currentSlide, routeData]);

  // Clear popup when no route data is available
  useEffect(() => {
    if (!routeCoordinates || routeCoordinates.length === 0) {
      setPopupCoord(null);
    }
  }, [routeCoordinates]);

  const allGeo = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: routeCoordinates }
  };

  const nextSlide = () => {
    if (currentSlide < routeData.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };
  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const getDirectionIcon = () => {
    switch (directionArrow) {
      case 'right':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-narrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M5 12l14 0" /><path d="M15 16l4 -4" /><path d="M15 8l4 4" /></svg>;
      case 'left':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-narrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M5 12l14 0" /><path d="M5 12l4 4" /><path d="M5 12l4 -4" /></svg>;
      case 'up':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-narrow-up"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 5l0 14" /><path d="M16 9l-4 -4" /><path d="M8 9l4 -4" /></svg>;
      case 'down':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-narrow-down"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 5l0 14" /><path d="M16 15l-4 4" /><path d="M8 15l4 4" /></svg>;
      case 'bend-right':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-merge-alt-left"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M8 7l4 -4l4 4" /><path d="M18 21v.01" /><path d="M18 18.01v.01" /><path d="M17 15.02v.01" /><path d="M14 13.03v.01" /><path d="M12 3v5.394a6.737 6.737 0 0 1 -3 5.606a6.737 6.737 0 0 0 -3 5.606v1.394" /></svg>;
      case 'bend-left':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-merge-alt-right"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M16 7l-4 -4l-4 4" /><path d="M6 21v.01" /><path d="M6 18.01v.01" /><path d="M7 15.02v.01" /><path d="M10 13.03v.01" /><path d="M12 3v5.394a6.737 6.737 0 0 0 3 5.606a6.737 6.737 0 0 1 3 5.606v1.394" /></svg>;
      case 'arrived':
        return <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="#e74c3c" className="icon icon-tabler icons-tabler-filled icon-tabler-map-pin"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18.364 4.636a9 9 0 0 1 .203 12.519l-.203 .21l-4.243 4.242a3 3 0 0 1 -4.097 .135l-.144 -.135l-4.244 -4.243a9 9 0 0 1 12.728 -12.728zm-6.364 3.364a3 3 0 1 0 0 6a3 3 0 0 0 0 -6z" /></svg>;
      default:
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-narrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M5 12l14 0" /><path d="M15 16l4 -4" /><path d="M15 8l4 4" /></svg>;
    }
  };

  const renderServiceIcons = (services = {}) => (
    <div className="step-services">
      {services.wheelchair && (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-wheelchair">
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M11 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
          <path d="M11 7l0 8l4 0l4 5" />
          <path d="M11 11l5 0" />
          <path d="M7 11.5a5 5 0 1 0 6 7.5" />
        </svg>
      )}
      {services.electricVan && (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-car">
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M14 5a1 1 0 0 1 .694 .28l.087 .095l3.699 4.625h.52a3 3 0 0 1 2.995 2.824l.005 .176v4a1 1 0 0 1 -1 1h-1.171a3.001 3.001 0 0 1 -5.658 0h-4.342a3.001 3.001 0 0 1 -5.658 0h-1.171a1 1 0 0 1 -1 -1v-6l.007 -.117l.008 -.056l.017 -.078l.012 -.036l.014 -.05l2.014 -5.034a1 1 0 0 1 .928 -.629zm-7 11a1 1 0 1 0 0 2a1 1 0 0 0 0 -2m10 0a1 1 0 1 0 0 2a1 1 0 0 0 0 -2m-6 -9h-5.324l-1.2 3h6.524zm2.52 0h-.52v3h2.92z" />
        </svg>
      )}
      {services.walking && (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-walk">
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
          <path d="M7 21l3 -4" />
          <path d="M16 21l-2 -4l-3 -3l1 -6" />
          <path d="M6 12l2 -3l4 -1l3 3l3 1" />
        </svg>
      )}
    </div>
  );

  return (
    <div className="route-overview-container fade-in">
      <div className="header-container">
        <header className="route-overview-header">
          <button className="route-back-button" onClick={() => navigate(-1)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-x"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
          </button>
          <h1 className="route-header-title">
            {intl.formatMessage({ id: 'routeOverview' })}
          </h1>
          <button className="map-profile-button" onClick={() => navigate('/Profile')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9.99984" cy="5" r="3.33333" fill="#1E2023" />
              <ellipse cx="9.99984" cy="14.1667" rx="5.83333" ry="3.33333" fill="#1E2023" />
            </svg>
          </button>
        </header>
        <div className="header-gradient"></div>
      </div>

      <div className="route-map-container">
        <Map
          key={styleKey}
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={mapStyle}
          styleDiffing={false}
          initialViewState={viewState}
          attributionControl={false}
          style={{ width: '100%', height: '100%' }}
          onLoad={handleMapLoad}
          onError={handleMapError}
        >
          <Marker longitude={routeCoordinates[0]?.[0]} latitude={routeCoordinates[0]?.[1]} anchor="bottom">
            <div className="c-circle"></div>
          </Marker>
          <Marker
            longitude={routeCoordinates[routeCoordinates.length - 1]?.[0]}
            latitude={routeCoordinates[routeCoordinates.length - 1]?.[1]}
            anchor="bottom"
          >
            <div className="des-marker">
              <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="#e74c3c" className="icon icon-tabler icons-tabler-filled icon-tabler-map-pin"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18.364 4.636a9 9 0 0 1 .203 12.519l-.203 .21l-4.243 4.242a3 3 0 0 1 -4.097 .135l-.144 -.135l-4.244 -4.243a9 9 0 0 1 12.728 -12.728zm-6.364 3.364a3 3 0 1 0 0 6a3 3 0 0 0 0 -6z" /></svg>
            </div>
          </Marker>

          {/* Image markers for subgroups with images */}
          {renderImageMarkers()}

          <Source id="route" type="geojson" data={allGeo}>
            <Layer id="route-line" type="line" paint={{ 'line-color': '#0f71ef', 'line-width': 10 }} />
          </Source>
          {highlightGeo && (
            <Source id="highlight" type="geojson" data={highlightGeo}>
              <Layer id="highlight-line" type="line" paint={{ 'line-color': '#e74c3c', 'line-width': 8 }} />
            </Source>
          )}
          {popupCoord && (
            <Popup
              className="main-popup-container"
              longitude={popupCoord[0]}
              latitude={popupCoord[1]}
              closeButton={false}
              closeOnClick={false}
              anchor="bottom"
            >
              <div className="time-popup main-popup">{time}</div>
            </Popup>
          )}
        </Map>
      </div>

      <button className="start-routing-btn" onClick={() => navigate('/rng')}>
        <svg xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M11.092 2.581a1 1 0 0 1 1.754 -.116l.062 .116l8.005 17.365c.198 .566 .05 1.196 -.378 1.615a1.53 1.53 0 0 1 -1.459 .393l-7.077 -2.398l-6.899 2.338a1.535 1.535 0 0 1 -1.52 -.231l-.112 -.1c-.398 -.386 -.556 -.954 -.393 -1.556l.047 -.15l7.97 -17.276z" />
        </svg>
        {intl.formatMessage({ id: 'startRouting' })}
      </button>

      <div className="route-info-container">
        <div className="route-stats">
          <div className="route-distance">
            <span className="direction-icon">{getDirectionIcon()}</span>
            <span className="distance-value">{distance}</span>
          </div>
          <div className="route-time">
            <span className="time-value">{time}</span>
          </div>
        </div>

        <div className="route-instruction-container">
          <div className="route-instruction">
            <p className="instruction-text">
              {routeData[currentSlide]?.instruction}
            </p>
            {/* {renderServiceIcons(routeData[currentSlide]?.services)} */}
          </div>

          <div className="carousel-controls">
            <button
              className="carousel-prev"
              onClick={prevSlide}
              disabled={currentSlide === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path d="M9 6l6 6l-6 6" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
              {intl.formatMessage({ id: 'previous' })}
            </button>

            <div className="mid-controls">

              <div className="step-counter">
                {intl.formatMessage({ id: 'stepPrefix' }, {
                  num: currentSlide + 1,
                  total: routeData.length
                })}
              </div>

              <div className={`carousel-dots4 ${routeData.length > 10 ? 'has-very-many-dots' :
                routeData.length > 5 ? 'has-many-dots' : ''
                }`}>
                {routeData.map((_, index) => (
                  <span
                    key={index}
                    className={`dot4 ${index === currentSlide ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(index)}
                  ></span>
                ))}
              </div>

            </div>

            <button
              className="carousel-next"
              onClick={nextSlide}
              disabled={currentSlide === routeData.length - 1}
            >
              {intl.formatMessage({ id: 'next' })}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path d="M15 6l-6 6l6 6" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {selectedSubgroup && (
        <div className="subgroup-modal-overlay" onClick={handleCloseModal}>
          <div className="subgroup-modal-content" onClick={(e) => e.stopPropagation()}>

            <div className="modal-image-section">
              <div
                className="main-image2"
                style={{
                  backgroundImage: `url(${Array.isArray(selectedSubgroup.img)
                    ? selectedSubgroup.img[selectedImageIndex]
                    : selectedSubgroup.img
                    })`
                }}
              >
                {selectedSubgroup.img && Array.isArray(selectedSubgroup.img) && selectedSubgroup.img.length > 1 && (
                  <div className="image-thumbnails2">
                    {selectedSubgroup.img.slice(0, 3).map((img, index) => (
                      <div
                        key={index}
                        className={`thumbnail2 ${index === selectedImageIndex ? 'active' : ''}`}
                        style={{ backgroundImage: `url(${img})` }}
                        onClick={() => setSelectedImageIndex(index)}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="image-fade3"></div>
            </div>

            {/* <div className="modal-description">
              <p>{selectedSubgroup.description}</p>
            </div> */}

            <div className="btn-box3">

              <button className="continue-route-btn" onClick={handleCloseModal}>
                {intl.formatMessage({ id: 'closeAndContinue' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteOverview;