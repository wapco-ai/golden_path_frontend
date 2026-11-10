import SearchPlaceIcon from '../components/SearchPlaceIcon';
import useQrOrigin from '../hooks/useQrOrigin';
import useEndpointFloor from '../hooks/useEndpointFloor';
import FloorControl from '../components/map/FloorControl';
import FloorTag from '../components/map/FloorTag';
import useMapFloor from '../hooks/useMapFloor';
import { getPointFloor, pointIsOnFloor, floorLabel } from '../utils/floors';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserAuthStore } from '../auth/user/userAuthStore';
import { FormattedMessage, useIntl } from 'react-intl';
import Mprc from '../components/map/Mprc';
import { useRouteStore } from '../store/routeStore';
import { useLangStore } from '../store/langStore';
import { useSearchStore } from '../store/searchStore';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/MapRouting.css';
import { loadGeoJsonData } from '../utils/loadGeoJsonData.js';
import { normalizeGroupMetadata, normalizeSubGroupMetadata } from '../utils/groupMetadata';
import { fetchGroupMetadata, fetchSubGroups } from '../services/groupService';
import { fetchAreaDoors } from '../services/areaDoorsService';
import { getSessionFloor, setSessionFloor } from '../utils/sessionFloor';
import { fetchLandmarkPlaces, localizedPlaceAddress } from '../services/landmarkService';
import mode1 from '../assets/images/mode1.png';
import mode2 from '../assets/images/mode2.png';
import mode3 from '../assets/images/mode3.png';

const isAreaResult = destination => destination.kind === 'area'
  && (destination.areaGroupId != null || destination.areaId != null);

const getEntryDestinationName = (entry, area) => {
  if (entry.otherAreaName) return entry.otherAreaName;
  const memberIds = area?.memberAreaIds ?? [area?.id];
  if (entry.toAreaId != null && memberIds.some(id => String(id) === String(entry.toAreaId))) {
    return entry.fromAreaName;
  }
  return entry.toAreaName;
};

const MapRoutingPage = () => {
  const navigate = useNavigate();
  const intl = useIntl();
  const mapFloor = useMapFloor();
  const { floorRequest, askFloor, clearFloorRequest } = useEndpointFloor();
  const location = useLocation()
  const { accessToken, user } = useUserAuthStore();
  const language = useLangStore(state => state.language);
  const getCategoryLabel = (label) => intl.messages?.[label] ?? label;
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [showOriginModal, setShowOriginModal] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryTarget, setEntryTarget] = useState('destination');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [tempDestination, setTempDestination] = useState(null);
  const [mapTapCount, setMapTapCount] = useState(0);
  const [lastTapInput, setLastTapInput] = useState(null);

  // New states for recent search options menu
  const [activeRecentMenuIndex, setActiveRecentMenuIndex] = useState(null);

  const storedLat = sessionStorage.getItem('qrLat');
  const storedLng = sessionStorage.getItem('qrLng');
  const storedId = sessionStorage.getItem('qrId');
  const storedQrName = sessionStorage.getItem('qrName');
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeInput, setActiveInput] = useState(null);
  const [isGPSEnabled, setIsGPSEnabled] = useState(false);
  const [isSelectingFromMap, setIsSelectingFromMap] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [mapSelectedLocation, setMapSelectedLocation] = useState(null);
  const [showRouteInfoModal, setShowRouteInfoModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState({});
  const [areaDoorsData, setAreaDoorsData] = useState(null);
  const [areaDoorsStatus, setAreaDoorsStatus] = useState(null);
  const [mapEntryDoors, setMapEntryDoors] = useState([]);
  const [landmarkPlaces, setLandmarkPlaces] = useState([]);
  const [showImageMarkers] = useState(true);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState(null);
  const [showMapStyleMenu, setShowMapStyleMenu] = useState(false);
  const [mapZoomLevel, setMapZoomLevel] = useState(15);
  const isFeaturedZoom = mapZoomLevel === 15 || mapZoomLevel === 16;
  const handleMapZoomChange = useCallback((zoom) => {
    const roundedZoom = Math.round(zoom);
    setMapZoomLevel((prev) => (prev === roundedZoom ? prev : roundedZoom));
  }, []);
  const [selectedMapType, setSelectedMapType] = useState(() => {
    if (typeof window === 'undefined') {
      return 'satellite';
    }
    return sessionStorage.getItem('selectedMapType') || 'satellite';
  });
  const [isChoosingFromMap, setIsChoosingFromMap] = useState(false);


  // Separate state for map categories and modal categories
  const [mapSelectedCategory, setMapSelectedCategory] = useState(null);
  const [mapSelectedSubGroups, setMapSelectedSubGroups] = useState([]);
  const [modalSelectedCategory, setModalSelectedCategory] = useState(null);
  const [modalFilteredSubGroups, setModalFilteredSubGroups] = useState([]);

  const [isCategorySelected, setIsCategorySelected] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [landmarkSearchResults, setLandmarkSearchResults] = useState(null);

  useQrOrigin(setUserLocation, language, intl.formatMessage({ id: 'mapCurrentLocationName' }), !location.state?.fromFinalSearch && !location.state?.showOriginModal && !location.state?.showDestinationModal && !sessionStorage.getItem('locationFromPage'));


  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    sessionStorage.setItem('selectedMapType', selectedMapType);
  }, [selectedMapType]);

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

        console.log('Initial groups loaded:', normalizedGroups.length);
        console.log('Initial subgroups loaded for all categories');

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

  useEffect(() => {
    const loadLandmarkPlaces = async () => {
      const geoCoordinates = userLocation?.coordinates;
      const geo = Array.isArray(geoCoordinates) && geoCoordinates.length >= 2
        ? { lat: geoCoordinates[0], lng: geoCoordinates[1] }
        : null;

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
        const data = await fetchLandmarkPlaces({
          language,
          geo,
          featured: isFeaturedZoom ? 1 : undefined
        });

        const apiLandmarks = Array.isArray(data?.places?.landmarkPlaces)
          ? data.places.landmarkPlaces
          : [];

        const landmarksWithImages = apiLandmarks
          .map(place => {
            const image = getFirstImage(place);
            if (!image) return null;
            return { ...place, image };
          })
          .filter(Boolean);

        setLandmarkPlaces(landmarksWithImages);
      } catch (error) {
        console.error('Failed to load landmark places', error);
        toast.error(intl.formatMessage({ id: 'generalErrorMessage' }));
        setLandmarkPlaces([]);
      }
    };

    loadLandmarkPlaces();
  }, [language, userLocation, intl, isFeaturedZoom]);



  const setOriginStore = useRouteStore(state => state.setOrigin);
  const setDestinationStore = useRouteStore(state => state.setDestination);
  const recentSearches = useSearchStore(state => state.recentSearches);
  const addSearch = useSearchStore(state => state.addSearch);
  const removeSearch = useSearchStore(state => state.removeSearch);
  const updateRecentAddress = useSearchStore(state => state.updateRecentAddress);

  const destinationInputRef = useRef(null);
  const originInputRef = useRef(null);
  const modalRef = useRef(null);
  const entryPanelRef = useRef(null);
  const searchInputRef = useRef(null);
  const swapButtonRef = useRef(null);
  const endpointSelectionRequest = useRef(null);

  const cancelEndpointSelection = useCallback(() => {
    endpointSelectionRequest.current?.abort();
    endpointSelectionRequest.current = null;
  }, []);

  useEffect(() => cancelEndpointSelection, [cancelEndpointSelection]);

  // Lazy loaded geojson data for destination search
  const [geoData, setGeoData] = useState(null);

  const getDoorCoordinates = (door) => {
    if (!Array.isArray(door?.coord4326)) return null;
    const [lon, lat] = door.coord4326;

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return [lat, lon];
    }

    return null;
  };

  const extractLandmarkCoordinates = (place = {}) => {
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
  };

  const getPolygonCenter = (coords) => {
    const pts = [];
    const collect = (c) => {
      if (typeof c[0] === 'number') {
        pts.push(c);
      } else {
        c.forEach(collect);
      }
    };
    collect(coords);
    const lats = pts.map((p) => p[1]);
    const lngs = pts.map((p) => p[0]);
    return [
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2,
    ];
  };

  const getCategoryCenterCoordinates = (category) => {
    if (!category) return null;

    if (geoData?.features?.length) {
      const matchedFeature = geoData.features.find(
        (feature) => feature?.properties?.[category.property] === category.value
      );

      const center = getFeatureCenter(matchedFeature);
      if (center && Array.isArray(center) && center.length >= 2) {
        return [center[1], center[0]];
      }
    }

    if (Array.isArray(category.coordinates) && category.coordinates.length >= 2) {
      return category.coordinates;
    }

    return null;
  };


  const handleDetailsInfo = (subGroup) => {
    console.log('DEBUG - subGroup clicked:', subGroup);
    console.log('subGroup.value:', subGroup.value);
    console.log('subGroup.label:', subGroup.label);
    console.log('subGroup.id:', subGroup.id);



    const params = new URLSearchParams();

    if (subGroup.coordinates && subGroup.coordinates.length >= 2) {
      const [lat, lng] = subGroup.coordinates;
      if (lat && lng) {
        params.set('lat', lat);
        params.set('lng', lng);
        sessionStorage.setItem('mapSelectedLat', lat.toString());
        sessionStorage.setItem('mapSelectedLng', lng.toString());
      }
    }


    if (subGroup.label) {
      params.set('title', encodeURIComponent(subGroup.label));
    }


    sessionStorage.removeItem('mapSelectedId');

    const queryString = params.toString();
    const target = queryString ? `/location?${queryString}` : '/location';

    navigate(target, {
      state: {
        location: {

          title: subGroup.label,
          name: subGroup.label,
          label: subGroup.label,
          location: subGroup.address || '',
          address: subGroup.address || '',
          description: subGroup.description || '',
          about: {
            short: subGroup.description || subGroup.label,
            full: subGroup.description || subGroup.label
          },
          images: Array.isArray(subGroup.img) ? subGroup.img : (subGroup.img ? [subGroup.img] : []),
          views: subGroup.views || 0,
          rating: subGroup.rating || 0,
          averageRating: subGroup.rating || 0,
          openingHours: '',
          coordinates: subGroup.coordinates,
          geo: subGroup.geo,
          floor: getPointFloor(subGroup),
          category: mapSelectedCategory?.label,
          categoryIcon: mapSelectedCategory?.png,
          fromMPR: true,
          contents: [],
          comments: []
        }
      }
    });
  };

  const handleLandmarkSelect = useCallback((landmarkData) => {
    console.log('=== LANDMARK SELECT DEBUG ===');
    console.log('Full landmark data:', landmarkData);

    // Get coordinates for comparison
    const getCoordinates = (data) => {
      if (!data) return null;

      const coords = data.coordinates ||
        (data.geo ? [data.geo.lat, data.geo.lng] : null) ||
        (data.lat && data.lng ? [data.lat, data.lng] : null) ||
        (data.latitude && data.longitude ? [data.latitude, data.longitude] : null);

      if (Array.isArray(coords) && coords.length >= 2) {
        return {
          lat: Number(coords[0]).toFixed(6),
          lng: Number(coords[1]).toFixed(6)
        };
      }
      return null;
    };

    const currentCoords = getCoordinates(landmarkData);

    // Check if this is the same landmark that's already selected
    if (selectedLandmarkId && currentCoords) {
      const [selectedLat, selectedLng] = selectedLandmarkId.split(',');
      if (selectedLat === currentCoords.lat && selectedLng === currentCoords.lng) {
        // Same landmark clicked again - deselect it
        console.log('Deselecting landmark');
        setSelectedLandmarkId(null);
        return;
      }
    }

    // Select the new landmark using coordinates as ID
    if (currentCoords) {
      const newId = `${currentCoords.lat},${currentCoords.lng}`;
      console.log('Selecting new landmark with ID:', newId);
      setSelectedLandmarkId(newId);
    }
  }, [selectedLandmarkId]);

  const getFeatureCenter = (feature) => {
    if (!feature) return null;
    const { geometry } = feature;
    if (geometry.type === 'Point') return geometry.coordinates;
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      return getPolygonCenter(geometry.coordinates);
    }
    return null;
  };

  const handleCategoryClickInModal = async (category) => {
    setModalSelectedCategory(category);
    setSearchQuery('');
    setIsSearching(true);

    try {
      const response = await fetchSubGroups({ language, groups: category.value, withImages: true });
      const normalizedSubGroups = normalizeSubGroupMetadata(response?.subGroups, language);

      setSubGroups((prev) => ({
        ...prev,
        ...normalizedSubGroups
      }));

      const localized = normalizedSubGroups[category.value] || [];

      setModalFilteredSubGroups(localized);
    } catch (err) {
      console.error('failed to fetch sub groups for modal category', err);
      setModalFilteredSubGroups([]);
    }
  };

  const resolveLocationId = (location) => {
    const rawId = location?.id || location?.value;
    if (!rawId) return null;

    const normalizedId = rawId.toLowerCase();

    return idMappings[normalizedId] || rawId;
  };

  const handleClearCategorySearch = () => {
    cancelEndpointSelection();
    setModalSelectedCategory(null);
    setModalFilteredSubGroups([]);
    setSearchQuery('');
    setIsSearching(false);
  };

  useEffect(() => {
    const returnToFinalSearch = sessionStorage.getItem('returnToFinalSearch');
    const activeInput = sessionStorage.getItem('activeInput');

    if (returnToFinalSearch === 'true') {
      if (activeInput === 'origin') {
        const storedDest = sessionStorage.getItem('currentDestination');
        const storedOrig = sessionStorage.getItem('currentOrigin');
        if (storedDest) {
          try {
            setSelectedDestination(JSON.parse(storedDest));
          } catch (err) {
            console.error('failed to parse currentDestination', err);
          }
        }
        if (storedOrig) {
          try {
            setUserLocation(JSON.parse(storedOrig));
          } catch (err) {
            console.error('failed to parse currentOrigin', err);
          }
        }
        setShowOriginModal(true);
        setActiveInput('origin');
      } else if (activeInput === 'destination') {
        const storedOrig = sessionStorage.getItem('currentOrigin');
        if (storedOrig) {
          try {
            setUserLocation(JSON.parse(storedOrig));
          } catch (err) {
            console.error('failed to parse currentOrigin', err);
          }
        }
        setShowDestinationModal(true);
        setActiveInput('destination');

        setIsTracking(false);
      }

      // Clear the flags
      sessionStorage.removeItem('returnToFinalSearch');
      sessionStorage.removeItem('activeInput');
    }
  }, []);

  const handleClearCategorySelection = () => {
    setMapSelectedCategory(null);
    setMapSelectedSubGroups([]);
  };

  const handleBackFromCategory = () => {
    setModalSelectedCategory(null);
    setModalFilteredSubGroups([]);
    setIsCategorySelected(false);
    setSearchQuery('');
  };

  const handlePageBack = () => {
    if (location.state?.fromFinalSearch) {
      navigate('/fs', { replace: true });
      return;
    }
    navigate(-1);
  };

  const getRecentAddress = (entry) => {
    if (entry.address && typeof entry.address === 'object') return localizedPlaceAddress(entry.address, language);
    if (entry.addressLanguage && entry.addressLanguage !== language) return '';
    return entry.location || '';
  };

  const displaySearchAddress = (name, address) => {
    const normalize = (text) => typeof text === 'string'
      ? text.normalize('NFKC').replace(/[يك]/g, (letter) => ({ 'ي': 'ی', 'ك': 'ک' }[letter]))
        .replace(/[\s\u200c]+/g, ' ').trim().toLowerCase()
      : '';
    return normalize(address) && normalize(address) !== normalize(name) ? address : '';
  };

  const renderSearchLocation = (destination, address) => {
    const displayAddress = displaySearchAddress(destination.name, address);
    const isArea = isAreaResult(destination);
    const locationLabel = isArea ? intl.formatMessage({ id: 'mapAreaResult' }) : displayAddress;
    return <>{locationLabel}<FloorTag point={destination} separator={Boolean(locationLabel)} /></>;
  };

  const toSearchDestination = (place) => {
    const coords = extractLandmarkCoordinates(place);
    const id = place.id ?? place.poi_id ?? place.poiId ?? null;
    const area = place.areaGroupId != null
      ? { areaGroupId: place.areaGroupId, memberAreaIds: place.memberAreaIds }
      : { areaId: place.areaId };
    return {
      id,
      ...(isAreaResult(place) ? {
        kind: 'area', ...area, source: 'area', sourceId: place.areaGroupId ?? place.areaId
      } : { poiId: id }),
      name: place.title || place.name || '',
      location: localizedPlaceAddress(place.address, language),
      floor: getPointFloor(place),
      coordinates: coords ? [coords.lat, coords.lng] : null,
      address: place.address,
      addressLanguage: language,
      description: place.description || place?.content?.body || ''
    };
  };

  const trimmedSearchQuery = searchQuery.trim();
  const searchKey = JSON.stringify([trimmedSearchQuery, language]);
  const filteredDestinations = landmarkSearchResults?.key === searchKey
    ? landmarkSearchResults.places.map(toSearchDestination)
    : [];

  useEffect(() => {
    let active = true;
    const pending = recentSearches.filter((entry) => entry.poiId != null
      && /^\d+$/.test(String(entry.poiId)) && entry.addressLanguage !== language);
    pending.forEach(async (entry) => {
      try {
        const response = await fetchLandmarkPlaces({ language, poiId: entry.poiId, limit: 1 });
        const place = response?.places?.landmarkPlaces?.find((item) => String(item.id) === String(entry.poiId));
        if (active && place) updateRecentAddress(entry.poiId, place.address ?? '', language);
      } catch (error) {
        console.error('Failed to refresh recent place address', error);
      }
    });
    return () => { active = false; };
  }, [recentSearches, language, updateRecentAddress]);

  // FIXED: Remove the auto-navigation useEffect that was causing the issue
  useEffect(() => {
    // Only navigate when we have both locations AND no modals are open AND we're not selecting from map
    if (userLocation?.coordinates &&
      selectedDestination?.coordinates &&
      !showDestinationModal &&
      !showOriginModal &&
      !isSelectingFromMap &&
      !showEntryModal) {

      if (getPointFloor(userLocation) === null) {
        askFloor(userLocation, 'origin', point => setUserLocation(previous => ({ ...previous, floor: point.floor })));
        return;
      }
      if (getPointFloor(selectedDestination) === null) {
        askFloor(selectedDestination, 'destination', setSelectedDestination);
        return;
      }

      clearFloorRequest();
      setOriginStore({
        ...userLocation,
        name: userLocation.name,
        floor: getPointFloor(userLocation),
        coordinates: userLocation.coordinates
      });
      setDestinationStore({
        ...selectedDestination,
        name: selectedDestination.name,
        floor: getPointFloor(selectedDestination),
        coordinates: selectedDestination.coordinates
      });
      navigate('/fs', { replace: Boolean(location.state?.fromFinalSearch) });
    }
  }, [
    userLocation,
    selectedDestination,
    navigate,
    setOriginStore,
    setDestinationStore,
    showDestinationModal,
    showOriginModal,
    isSelectingFromMap,
    showEntryModal,
    location.state?.fromFinalSearch, askFloor, clearFloorRequest
  ]);

  useEffect(() => {

    if (userLocation && userLocation.name !== intl.formatMessage({ id: 'mapCurrentLocationName' })) {
      setIsTracking(false);
    }
  }, [userLocation, intl]);

  const handleSubgroupSelect = async (subgroup) => {
    cancelEndpointSelection();
    setActiveInput('destination');
    setShowDestinationModal(false);

    let coordinates = subgroup.coordinates || (subgroup.geo ? [subgroup.geo.lat, subgroup.geo.lng] : null);

    // Try to get coordinates from geoData first
    if (!coordinates && geoData) {
      const feature = geoData.features.find(
        f => f.properties?.subGroupValue === subgroup.value && pointIsOnFloor(f, getPointFloor(subgroup))
      );

      if (feature) {
        const center = getFeatureCenter(feature);
        if (center) {
          coordinates = [center[1], center[0]];
        }
      }
    }

    // If no coordinates from geoData, check if subgroup has its own coordinates
    if (!coordinates && subgroup.coordinates) {
      coordinates = subgroup.coordinates;
    }

    // If still no coordinates, try the subgroup's geo field
    if (!coordinates && subgroup.geo) {
      const { lat, lng } = subgroup.geo;
      if (typeof lat === 'number' && typeof lng === 'number') {
        coordinates = [lat, lng];
      }
    }

    // If still no coordinates, try to find any feature with this subgroup value for coordinates
    if (!coordinates && geoData) {
      const anyFeature = geoData.features.find(
        f => f.properties?.subGroupValue === subgroup.value && pointIsOnFloor(f, getPointFloor(subgroup))
      );
      if (anyFeature) {
        const center = getFeatureCenter(anyFeature);
        if (center) {
          coordinates = [center[1], center[0]];
        }
      }
    }

    const destination = {
      id: subgroup.value,
      floor: getPointFloor(subgroup),
      name: subgroup.label,
      location: localizedPlaceAddress(subgroup.address, language),
      address: subgroup.address,
      addressLanguage: language,
      coordinates: coordinates
    };

    console.log('Subgroup selected:', subgroup.label, 'Coordinates:', coordinates);

    // Check if we're in origin modal or destination modal
    const isOriginSelection = showOriginModal && !showDestinationModal;

    if (isOriginSelection) {
      // For origin: Set directly without entry modal
      setIsTracking(false);
      setUserLocation({ name: destination.name, floor: getPointFloor(destination), coordinates: destination.coordinates });
      setShowOriginModal(false);
      setSearchQuery('');
    } else {
      // For destination: Show entry modal
      handleDestinationSelect(destination, { forceDestination: true });
    }
    handleClearCategorySelection();
  };

  const handleSubgroupSelectWithModal = (subgroup) => {
    console.log('Selected subgroup:', subgroup.value, 'Has image:', !!subgroup.img);

    handleSubgroupSelect(subgroup);
  };

  const resetLocationPage = () => {
    setShowRouteInfoModal(false);
    setSelectedOption(null);
  };


  const selectOrigin = ({ name, floor, coordinates }) => {
    const origin = { name, floor, coordinates };
    setIsTracking(false);
    setUserLocation(origin);
    setShowOriginModal(false);

    if (location.state?.showOriginModal) {
      sessionStorage.setItem('updatedOrigin', JSON.stringify(origin));
      navigate('/fs', { replace: true });
    }
  };

  const handleDestinationSelect = (destination, options = {}) => {
    const { forceDestination = false } = options;
    const target = activeInput === 'destination' || forceDestination ? 'destination' : 'origin';
    cancelEndpointSelection();
    const floor = getPointFloor(destination);
    if (floor === null) {
      setShowDestinationModal(false);
      setShowOriginModal(false);
      askFloor(destination, target, point => handleDestinationSelect(point, options));
      return;
    }

    setAreaDoorsData(null);
    setAreaDoorsStatus(null);
    setMapEntryDoors([]);
    setSelectedEntry(null);

    if (target === 'destination') {
      setShowDestinationModal(false);
      if (!destination.fromMapSelection) {
        addSearch(destination);
      }
    }

    if (isAreaResult(destination)) {
      setShowOriginModal(false);
      setSessionFloor(floor);
      setTempDestination(destination);
      setEntryTarget(target);
      setShowEntryModal(true);
      requestAreaDoors({ areaGroupId: destination.areaGroupId, areaId: destination.areaId, floor, destination, target });
    } else if (target === 'destination') {
      setTempDestination(null);
      setShowEntryModal(false);
      setSelectedDestination(destination);
      sessionStorage.setItem('currentDestination', JSON.stringify(destination));
    } else {
      selectOrigin({ ...destination, floor });
    }
    setSearchQuery('');
  };

  const handleRecentSelection = async (destination) => {
    if (destination.kind === 'area' || (destination.entry == null && destination.door == null)) {
      handleDestinationSelect(destination);
      return;
    }

    // Earlier versions saved the selected door in place of the original POI.
    cancelEndpointSelection();
    const selection = new AbortController();
    endpointSelectionRequest.current = selection;
    try {
      const poiId = destination.poiId ?? destination.id;
      if (!/^\d+$/.test(String(poiId))) throw new Error('Missing recent POI identifier');
      const response = await fetchLandmarkPlaces({ language, poiId, limit: 1, signal: selection.signal });
      if (selection.signal.aborted) return;
      const place = response?.places?.landmarkPlaces?.find((item) => String(item.id) === String(poiId));
      if (!place) throw new Error('Recent POI no longer found');
      const restored = toSearchDestination(place);
      removeSearch(destination);
      handleDestinationSelect(restored);
      if (activeInput !== 'destination') addSearch(restored);
    } catch (error) {
      if (!selection.signal.aborted) {
        console.error('Failed to restore recent destination', error);
        toast.error(intl.formatMessage({ id: 'generalErrorMessage' }));
      }
    }
  };


  useEffect(() => {
    const locationSelectionType = sessionStorage.getItem('locationSelectionType');
    const locationFromPage = sessionStorage.getItem('locationFromPage');

    if (locationSelectionType && locationFromPage) {
      try {
        const locationData = JSON.parse(locationFromPage);

        if (locationSelectionType === 'origin') {

          setIsTracking(false);
          setUserLocation({
            name: locationData.name,
            floor: getPointFloor(locationData),
            coordinates: locationData.coordinates
          });
          sessionStorage.setItem('currentOrigin', JSON.stringify(locationData));
        } else if (locationSelectionType === 'destination') {

          setSelectedDestination({
            name: locationData.name,
            location: locationData.location || locationData.name,
            floor: getPointFloor(locationData),
            coordinates: locationData.coordinates
          });
          sessionStorage.setItem('currentDestination', JSON.stringify(locationData));
        }


        sessionStorage.removeItem('locationSelectionType');
        sessionStorage.removeItem('locationFromPage');

      } catch (err) {
        console.error('Failed to parse location data from session', err);
        sessionStorage.removeItem('locationSelectionType');
        sessionStorage.removeItem('locationFromPage');
      }
    }
  }, []);

  // NEW: Handle entry selection
  const handleEntrySelect = (entryNumber) => {
    setSelectedEntry(entryNumber);
  };

  const handleBackFromEntry = () => {
    cancelEndpointSelection();
    setShowEntryModal(false);
    setTempDestination(null);
    setSelectedEntry(null);
    setAreaDoorsData(null);
    setAreaDoorsStatus(null);
    setMapEntryDoors([]);
    setActiveInput(entryTarget);
    setSearchQuery(tempDestination?.name || '');
    setShowDestinationModal(entryTarget === 'destination');
    setShowOriginModal(entryTarget === 'origin');
  };

  const handleConfirmEntry = () => {
    if (tempDestination && selectedEntry != null) {
      const selectedDoor = mapEntryDoors.find((door) => door?.doorNo === selectedEntry);
      const doorCoordinates = getDoorCoordinates(selectedDoor);
      if (!doorCoordinates) return;
      const finalDestination = {
        ...tempDestination,
        entry: selectedEntry,
        door: selectedDoor,
        coordinates: doorCoordinates
      };

      if (entryTarget === 'origin') {
        selectOrigin({ ...finalDestination, floor: getPointFloor(finalDestination) });
      } else {
        setSelectedDestination(finalDestination);
        sessionStorage.setItem('currentDestination', JSON.stringify(finalDestination));
      }

      setShowEntryModal(false);
      setTempDestination(null);
      setSelectedEntry(null);
      setAreaDoorsData(null);

      setShowDestinationModal(false);
      setShowOriginModal(false);
      setIsSelectingFromMap(false);

      handleClearCategorySelection();
    }
  };

  const handleInputChange = (e) => {
    cancelEndpointSelection();
    setSearchQuery(e.target.value);
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    setGeoData(null);
    loadGeoJsonData({ floor: mapFloor, signal: controller.signal })
      .then(data => {
        if (isMounted) {
          setGeoData(data);
        }
      })
      .catch(err => {
        if (err?.name === 'AbortError') return;
        console.error('failed to load geojson', err);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [language, mapFloor]);

  useEffect(() => {
    if (trimmedSearchQuery.length < 2) {
      setLandmarkSearchResults(null);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    const geoCoordinates = userLocation?.coordinates;
    const geo = Array.isArray(geoCoordinates) && geoCoordinates.length >= 2
      ? { lat: geoCoordinates[0], lng: geoCoordinates[1] }
      : null;

    const timer = setTimeout(() => {
      fetchLandmarkPlaces({
        language,
        geo,
        search: trimmedSearchQuery,
        includeExactAreas: true,
        limit: 30,
        signal: controller.signal
      })
        .then((data) => {
          if (!isMounted) return;
          const apiLandmarks = Array.isArray(data?.places?.landmarkPlaces)
            ? data.places.landmarkPlaces
            : [];
          setLandmarkSearchResults({ key: searchKey, places: apiLandmarks });
        })
        .catch((error) => {
          if (error?.name === 'AbortError') return;
          console.error('Failed to search landmark places', error);
          if (isMounted) setLandmarkSearchResults(null);
        });
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedSearchQuery, language, userLocation, searchKey]);

  const handleRouteFromSubgroup = (subgroup) => {
    console.log('Routing from main page subgroup:', subgroup);

    let coordinates = subgroup.coordinates || (subgroup.geo ? [subgroup.geo.lat, subgroup.geo.lng] : null);

    if (!coordinates && geoData) {
      const feature = geoData.features.find(
        f => f.properties?.subGroupValue === subgroup.value && pointIsOnFloor(f, getPointFloor(subgroup))
      );

      if (feature) {
        const center = getFeatureCenter(feature);
        if (center) {
          coordinates = [center[1], center[0]];
        }
      }
    }

    if (!coordinates && subgroup.coordinates) {
      coordinates = subgroup.coordinates;
    }

    if (!coordinates && geoData) {
      const anyFeature = geoData.features.find(
        f => f.properties?.subGroupValue === subgroup.value && pointIsOnFloor(f, getPointFloor(subgroup))
      );
      if (anyFeature) {
        const center = getFeatureCenter(anyFeature);
        if (center) {
          coordinates = [center[1], center[0]];
        }
      }
    }

    const destination = {
      id: subgroup.value,
      floor: getPointFloor(subgroup),
      name: subgroup.label,
      location: localizedPlaceAddress(subgroup.address, language),
      address: subgroup.address,
      addressLanguage: language,
      coordinates: coordinates,
      fromMapSelection: false
    };

    console.log('Setting destination from main page:', destination);

    handleDestinationSelect(destination, { forceDestination: true });

    handleClearCategorySelection();
  };

  const handleSwapLocations = () => {

    setMapTapCount(0);
    setLastTapInput(null);


    if (!selectedDestination && userLocation) {
      const destData = {
        name: userLocation.name,
        location: userLocation.location || userLocation.name,
        floor: getPointFloor(userLocation),
        coordinates: userLocation.coordinates
      };

      setSelectedDestination(destData);
      sessionStorage.setItem('currentDestination', JSON.stringify(destData));

      setUserLocation(null);
      sessionStorage.removeItem('currentOrigin');

      setIsTracking(false);
    }
    // Case 2: Only destination exists (after first swap)
    else if (!userLocation && selectedDestination) {
      const originData = {
        name: selectedDestination.name,
        floor: getPointFloor(selectedDestination),
        coordinates: selectedDestination.coordinates,
        location: selectedDestination.location || selectedDestination.name
      };

      setUserLocation(originData);
      sessionStorage.setItem('currentOrigin', JSON.stringify(originData));

      setSelectedDestination(null);
      sessionStorage.removeItem('currentDestination');

      setIsTracking(false);
    }
    // Case 3: Both origin and destination exist (normal swap)
    else if (userLocation && selectedDestination) {
      const newOrigin = {
        name: selectedDestination.name,
        floor: getPointFloor(selectedDestination),
        coordinates: selectedDestination.coordinates,
        location: selectedDestination.location || selectedDestination.name
      };

      const newDestination = {
        name: userLocation.name,
        floor: getPointFloor(userLocation),
        coordinates: userLocation.coordinates,
        location: userLocation.location || userLocation.name
      };

      setUserLocation(newOrigin);
      setSelectedDestination(newDestination);

      sessionStorage.setItem('currentOrigin', JSON.stringify(newOrigin));
      sessionStorage.setItem('currentDestination', JSON.stringify(newDestination));

      setIsTracking(false);
      setTimeout(() => setIsTracking(true), 100);
    }
    // Case 4: Neither exists (do nothing)
    else {
      return;
    }

    // Rotation animation
    if (swapButtonRef.current) {
      swapButtonRef.current.classList.add('rotate');
      setTimeout(() => {
        if (swapButtonRef.current) {
          swapButtonRef.current.classList.remove('rotate');
        }
      }, 500);
    }
  };

  const handleCategoryClick = async (category) => {
    const isSameCategory = mapSelectedCategory && mapSelectedCategory.value === category.value;

    if (isSameCategory) {
      setMapSelectedCategory(null);
      setMapSelectedSubGroups([]);
      setAreaDoorsData(null);
      setAreaDoorsStatus(null);
      setMapEntryDoors([]);
      return;
    }

    // Set loading state
    setMapSelectedCategory(category);
    setMapSelectedSubGroups([]); // Clear while loading

    try {
      // Fetch FRESH subgroups for this category (same as modal does)
      const response = await fetchSubGroups({
        language,
        groups: category.value,
        withImages: true
      });

      const normalizedSubGroups = normalizeSubGroupMetadata(response?.subGroups, language);

      // Update the main subGroups state (for consistency)
      setSubGroups((prev) => ({
        ...prev,
        [category.value]: normalizedSubGroups[category.value] || []
      }));

      // Get subgroups for this specific category
      const categorySubGroups = normalizedSubGroups[category.value] || [];

      console.log('Fresh fetch for category:', category.label);
      console.log('Subgroups found:', categorySubGroups);
      console.log('Subgroups with images:', categorySubGroups.filter(sub => sub.img));

      // Filter to get ONLY subgroups with images
      const imageSubGroups = categorySubGroups.filter(subGroup => {
        const hasImage = Array.isArray(subGroup.img) ?
          subGroup.img.length > 0 :
          Boolean(subGroup.img);
        return hasImage;
      });

      console.log('Image subgroups to display:', imageSubGroups.length);

      // Set the image subgroups to display
      setMapSelectedSubGroups(imageSubGroups);

    } catch (err) {
      console.error('Failed to fetch subgroups for category', category.label, err);

      // Fallback to existing data in subGroups state
      const categorySubGroups = subGroups[category.value] || [];
      const imageSubGroups = categorySubGroups.filter(subGroup => {
        const hasImage = Array.isArray(subGroup.img) ?
          subGroup.img.length > 0 :
          Boolean(subGroup.img);
        return hasImage;
      });

      setMapSelectedSubGroups(imageSubGroups);
    }

    // Clear any previous area doors data
    setAreaDoorsData(null);
    setAreaDoorsStatus(null);
    setMapEntryDoors([]);
    setTempDestination(null);
  };

  const handleSubGroupClick = (subGroup) => {
    console.log('Selected subgroup:', subGroup);
  };

  const handleInputClick = (inputType) => {
    if (showEntryModal) return;
    cancelEndpointSelection();
    clearFloorRequest();
    setActiveInput(inputType);
    if (inputType === 'destination') {
      setShowDestinationModal(true);
    } else {
      setShowOriginModal(true);
    }
  };

  useEffect(() => {
    if (!showOriginModal) return undefined;
    let active = true;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => { if (active) setIsGPSEnabled(true); },
        () => { if (active) setIsGPSEnabled(false); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } else setIsGPSEnabled(false);
    return () => { active = false; };
  }, [showOriginModal]);

  useEffect(() => {
    const fromLandmarkCard = sessionStorage.getItem('fromLandmarkCard');
    const destinationData = sessionStorage.getItem('landmarkCardDestination');

    if (fromLandmarkCard === 'true' && destinationData) {
      try {
        const parsedDestination = JSON.parse(destinationData);

        setSelectedDestination(parsedDestination);


        sessionStorage.setItem('currentDestination', destinationData);

        sessionStorage.removeItem('fromLandmarkCard');
        sessionStorage.removeItem('landmarkCardDestination');


        console.log('Destination set from landmark card:', parsedDestination.name);

      } catch (error) {
        console.error('Failed to parse landmark card destination', error);
        sessionStorage.removeItem('fromLandmarkCard');
        sessionStorage.removeItem('landmarkCardDestination');
      }
    }
  }, []);

  const handleCurrentLocationSelect = () => {
    cancelEndpointSelection();
    for (const key of ['qrLat', 'qrLng', 'qrId', 'qrFloor', 'qrName']) sessionStorage.removeItem(key);
    // Wait for fresh coordinates before the completed-endpoints effect can route.
    setUserLocation(previous => previous?.source === 'gps' ? { ...previous, coordinates: null } : null);
    setIsTracking(true);
    setShowOriginModal(false);
  };

  const requestAreaDoors = useCallback(async ({ areaGroupId, areaId, lat, lon, floor = getSessionFloor(), destination, target = 'destination' }) => {
    endpointSelectionRequest.current?.abort();
    const selection = new AbortController();
    endpointSelectionRequest.current = selection;
    setAreaDoorsStatus('loading');
    setMapEntryDoors([]);
    setAreaDoorsData(null);

    try {
      const response = await fetchAreaDoors({ areaGroupId, areaId, lat, lon, floor, lang: language, signal: selection.signal });
      if (selection.signal.aborted) return;
      const area = response?.data?.area;
      const nextDoors = Array.isArray(response?.data?.doors)
        ? response.data.doors.map(door => ({ ...door, otherAreaName: getEntryDestinationName(door, area) }))
        : [];

      if (destination?.areaId != null && area?.areaGroupId != null) {
        const { areaId: legacyAreaId, ...previousDestination } = destination;
        const canonicalDestination = {
          ...previousDestination,
          id: area.id,
          name: area.name || destination.name,
          areaGroupId: area.areaGroupId,
          memberAreaIds: area.memberAreaIds ?? [legacyAreaId],
          sourceId: area.areaGroupId
        };
        setTempDestination(canonicalDestination);
        if (target === 'destination') addSearch(canonicalDestination);
      }

      setAreaDoorsStatus(response?.status || 'ok');
      setAreaDoorsData(response?.status === 'ok' || response?.status === 'area_too_small'
        ? {
          area,
          doors: nextDoors
        }
        : null);
      setMapEntryDoors(nextDoors);
    } catch (error) {
      if (selection.signal.aborted) return;
      console.error('failed to fetch area doors', error);
      setAreaDoorsStatus('error');
      setAreaDoorsData(null);
      setMapEntryDoors([]);
    }
  }, [addSearch, language]);

  useEffect(() => {
    if (!showEntryModal && areaDoorsStatus && areaDoorsStatus !== 'loading' && !mapEntryDoors.length && tempDestination) {
      if (tempDestination.fromMapSelection && tempDestination.coordinates) {
        setSelectedDestination(tempDestination);
        sessionStorage.setItem('currentDestination', JSON.stringify(tempDestination));
      }

      setTempDestination(null);
      setSelectedEntry(null);
    }
  }, [areaDoorsStatus, mapEntryDoors.length, showEntryModal, tempDestination]);

  const handleDoorSelect = (door) => {
    if (showEntryModal && door?.doorNo != null) {
      handleEntrySelect(door.doorNo);
    }
  };


  const handleMapSelection = () => {
    cancelEndpointSelection();
    clearFloorRequest();
    setIsChoosingFromMap(true);
    setIsSelectingFromMap(true);
    setIsTracking(false);
    setShowDestinationModal(false);
    setShowOriginModal(false);
    setAreaDoorsData(null);
    setAreaDoorsStatus(null);
    setMapEntryDoors([]);
  };

  const handleMapClick = (latlng, feature) => {
    if (showEntryModal) return;
    if (isSelectingFromMap) {
      setIsChoosingFromMap(false);

      if (activeInput === 'destination') {
        // For destination
        const locName = feature?.properties?.name || intl.formatMessage({ id: 'mapSelectedLocation' });
        const destination = {
          name: locName,
          location: intl.formatMessage({ id: 'mapSelectedLocation' }),
          coordinates: [latlng.lat, latlng.lng],
          floor: mapFloor,
          fromMapSelection: true
        };

        setSelectedDestination(destination);
        sessionStorage.setItem('currentDestination', JSON.stringify(destination));
        setShowEntryModal(false);
        setTempDestination(null);
      } else {
        // For origin
        const locName = feature?.properties?.name || intl.formatMessage({ id: 'mapSelectedLocationFromMap' });
        const origin = {
          name: locName,
          location: intl.formatMessage({ id: 'mapSelectedLocationFromMap' }),
          coordinates: [latlng.lat, latlng.lng],
          floor: mapFloor,
          fromMapSelection: true
        };

        setAreaDoorsData(null);
        setAreaDoorsStatus(null);
        setMapEntryDoors([]);
        setUserLocation(origin);
        sessionStorage.setItem('currentOrigin', JSON.stringify(origin));
      }
      setIsSelectingFromMap(false);
      return; // Return early for modal-based map selection
    }

    // Handle landmark clicks
    if (!isSelectingFromMap && feature?.properties?.isLandmark) {
      handleLandmarkSelect(feature.properties);
      return;
    }

    // NEW: Direct map tap functionality
    if (!isSelectingFromMap) {
      // Determine which input to fill
      let inputToFill = null;

      if (mapTapCount === 0) {
        // First tap - determine which is empty
        if (!userLocation && !selectedDestination) {
          // Both empty - fill origin first
          inputToFill = 'origin';
        } else if (!userLocation && selectedDestination) {
          // Only origin empty
          inputToFill = 'origin';
        } else if (userLocation && !selectedDestination) {
          // Only destination empty
          inputToFill = 'destination';
        } else {
          // Both already filled - do nothing
          return;
        }
      } else if (mapTapCount === 1) {
        // Second tap - fill the other input
        if (lastTapInput === 'origin' && !selectedDestination) {
          inputToFill = 'destination';
        } else if (lastTapInput === 'destination' && !userLocation) {
          inputToFill = 'origin';
        } else {
          // Both already filled or invalid state
          return;
        }
      } else {
        // Already tapped twice - no more taps
        return;
      }

      // Get proper location name based on which input we're filling
      const locName = inputToFill === 'origin'
        ? intl.formatMessage({ id: 'mapSelectedLocationFromMap' })
        : intl.formatMessage({ id: 'mapSelectedLocation' });

      // Create location object
      const locationData = {
        floor: mapFloor,
        name: locName,
        location: locName, // Use same name for location field
        coordinates: [latlng.lat, latlng.lng],
        fromMapSelection: true
      };

      // Fill the appropriate input
      if (inputToFill === 'origin') {
        setUserLocation(locationData);
        sessionStorage.setItem('currentOrigin', JSON.stringify(locationData));
        setLastTapInput('origin');
        setMapTapCount(prev => prev + 1);
      } else if (inputToFill === 'destination') {
        // For destination, also trigger area doors check
        setTempDestination(locationData);
        requestAreaDoors({ lat: latlng.lat, lon: latlng.lng });

        setSelectedDestination(locationData);
        sessionStorage.setItem('currentDestination', JSON.stringify(locationData));
        setLastTapInput('destination');
        setMapTapCount(prev => prev + 1);
      }
    }
  };

  const handleClearSearch = () => {
    cancelEndpointSelection();
    setSearchQuery('');
  };

  const handleCancelMapSelection = () => {
    setIsChoosingFromMap(false);
    setIsSelectingFromMap(false);
    if (activeInput === 'destination') {
      setShowDestinationModal(true);
    } else {
      setShowOriginModal(true);
    }
  };

  useEffect(() => {

    setMapTapCount(0);
    setLastTapInput(null);
  }, [userLocation, selectedDestination]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        cancelEndpointSelection();
        setShowDestinationModal(false);
        setShowOriginModal(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [cancelEndpointSelection]);

  useEffect(() => {
    if ((showDestinationModal || showOriginModal) && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showDestinationModal, showOriginModal]);

  const renderSVG = (svgString) => {
    return <div dangerouslySetInnerHTML={{ __html: svgString }} />;
  };

  return (
    <div className="map-routing-page gp-public-map-page gp-maprouting">
      {/* Header */}
      <header className="map-routing-header">
        {isSelectingFromMap ? (
          <button className="map-back-button" onClick={handleCancelMapSelection}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M11.2244 4.55806C11.4685 4.31398 11.8642 4.31398 12.1083 4.55806L17.1083 9.55806C17.3524 9.80214 17.3524 10.1979 17.1083 10.4419L12.1083 15.4419C11.8642 15.686 11.4685 15.686 11.2244 15.4419C10.9803 15.1979 10.9803 14.8021 11.2244 14.5581L15.1575 10.625H3.33301C2.98783 10.625 2.70801 10.3452 2.70801 10C2.70801 9.65482 2.98783 9.375 3.33301 9.375H15.1575L11.2244 5.44194C10.9803 5.19786 10.9803 4.80214 11.2244 4.55806Z" fill="#1E2023" />
            </svg>
          </button>
        ) : (
          <button className="map-back-button" onClick={handlePageBack}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M11.2244 4.55806C11.4685 4.31398 11.8642 4.31398 12.1083 4.55806L17.1083 9.55806C17.3524 9.80214 17.3524 10.1979 17.1083 10.4419L12.1083 15.4419C11.8642 15.686 11.4685 15.686 11.2244 15.4419C10.9803 15.1979 10.9803 14.8021 11.2244 14.5581L15.1575 10.625H3.33301C2.98783 10.625 2.70801 10.3452 2.70801 10C2.70801 9.65482 2.98783 9.375 3.33301 9.375H15.1575L11.2244 5.44194C10.9803 5.19786 10.9803 4.80214 11.2244 4.55806Z" fill="#1E2023" />
            </svg>
          </button>
        )}
        <h1 className="map-header-title">
          {isSelectingFromMap
            ? intl.formatMessage({ id: 'mapSelectFromMap' })
            : intl.formatMessage({ id: 'mapRoutingTitle' })}
        </h1>
        <button className="map-profile-button" onClick={() => {
          if (accessToken && user) {
            navigate('/profile');
          } else {
            localStorage.setItem('profile_origin_page', location.pathname);
            navigate('/login');
          }
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9.99984" cy="5" r="3.33333" fill="#1E2023" />
            <ellipse cx="9.99984" cy="14.1667" rx="5.83333" ry="3.33333" fill="#1E2023" />
          </svg>
        </button>
      </header>

      {/* Categories Scroll - Hidden when selecting from map */}
      {!isSelectingFromMap && (
        <div className="map-categories-scroll">
          <div className="map-categories-list">
            {groups.map((category, index) => (
              <div
                key={`${category.value}-${index}`}
                className={`map-category-item ${mapSelectedCategory && mapSelectedCategory.value === category.value ? 'active' : ''}`}
                onClick={() => handleCategoryClick(category)}
              >
                <div className={`map-category-icon ${category.icon} ${mapSelectedCategory && mapSelectedCategory.value === category.value ? 'active' : ''}`}>
                  <img src={category.png} alt={category.label} width="22" height="22" />
                </div>
                <span className={`map-category-name ${mapSelectedCategory && mapSelectedCategory.value === category.value ? 'active' : ''}`}>
                  {getCategoryLabel(category.label)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className={`map-routing-container ${isSelectingFromMap ? 'hide-attribution' : ''}`}>
        <Mprc
          setUserLocation={setUserLocation}
          selectedDestination={selectedDestination}
          onMapClick={handleMapClick}
          isSelectingLocation={isSelectingFromMap}
          selectedCategory={mapSelectedCategory}
          userLocation={userLocation}
          mapSelectedLocation={mapSelectedLocation}
          isTracking={isTracking && !showEntryModal}
          onUserMove={() => setIsTracking(false)}
          groups={groups}
          areaDoorsData={areaDoorsData}
          showAreaDoors={showEntryModal}
          selectedEntry={selectedEntry}
          entryPanelRef={entryPanelRef}
          onDoorSelect={handleDoorSelect}
          landmarkPlaces={landmarkPlaces}
          showImageMarkers={showImageMarkers}
          isChoosingFromMap={isChoosingFromMap}
          selectedMapType={selectedMapType}
          onZoomChange={handleMapZoomChange}
          selectedLandmarkId={selectedLandmarkId}
          onLandmarkSelect={handleLandmarkSelect}
        />
        {!isSelectingFromMap && (
          <button
            className={`map-gps-button ${isTracking ? 'active' : 'inactive'}`}
            onClick={() => setIsTracking((t) => !t)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
              <path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0" />
              <path d="M12 2l0 2" />
              <path d="M12 20l0 2" />
              <path d="M20 12l2 0" />
              <path d="M2 12l2 0" />
            </svg>
          </button>
        )}
        {(
          <>
            <button
              className={`map-style-button-mpr ${showMapStyleMenu ? 'active' : ''}`}
              onClick={() => setShowMapStyleMenu(!showMapStyleMenu)}
              onBlur={() => {
                setTimeout(() => setShowMapStyleMenu(false), 200);
              }}
            >
              <div className="map-button-preview">
                <img
                  src={selectedMapType === 'satellite' ? mode2 : selectedMapType === 'simple' ? mode3 : mode1}
                  alt={selectedMapType === 'satellite' ? 'Satellite view' : selectedMapType === 'simple' ? 'Offline OSMH view' : 'Default view'}
                  className="map-preview-thumbnail"
                />
              </div>
            </button>

            {showMapStyleMenu && (
              <div className="map-style-menu-mpr">

                <div
                  className={`map-style-option ${selectedMapType === 'satellite' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMapType('satellite');
                    setShowMapStyleMenu(false);
                  }}
                  title={intl.formatMessage({ id: 'satelliteMap' })}
                >
                  <div className="map-preview-container">
                    <img
                      src={mode2}
                      alt="Satellite map view"
                      className="map-preview-image"
                    />
                  </div>
                </div>
                <div
                  className={`map-style-option ${selectedMapType === 'base' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMapType('base');
                    setShowMapStyleMenu(false);
                  }}
                  title={intl.formatMessage({ id: 'baseMap' })}
                >
                  <div className="map-preview-container">
                    <img
                      src={mode1}
                      alt="Default map view"
                      className="map-preview-image"
                    />
                  </div>
                </div>
                <div
                  className={`map-style-option ${selectedMapType === 'simple' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMapType('simple');
                    setShowMapStyleMenu(false);
                  }}
                  title={intl.formatMessage({ id: 'simpleMap' })}
                >
                  <div className="map-preview-container">
                    <img
                      src={mode3}
                      alt="Simple map view"
                      className="map-preview-image"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <FloorControl hidden={showOriginModal || showDestinationModal} otherMenuOpen={showMapStyleMenu} onOpen={() => setShowMapStyleMenu(false)} request={floorRequest} onChange={() => { setSelectedLandmarkId(null); }} style={{
          position: 'absolute',
          bottom: '160px',
          zIndex: 1000,
        }} />
      </div>

      {/* Subgroups Container - Only shown when a category is selected and has image subgroups */}
      {mapSelectedCategory && mapSelectedSubGroups.length > 0 && (
        <div className="map-subgroups-container">
          <div className="map-subgroups-scroll">
            {/* Sort subgroups: selected first, then others */}
            {(() => {
              // Create a sorted copy of the array
              const sortedSubGroups = mapSelectedSubGroups.filter(item => pointIsOnFloor(item, mapFloor)).sort((a, b) => {
                // Function to get coordinates ID from a subgroup
                const getCoordinatesIdFromSubGroup = (item) => {
                  if (!item) return null;

                  // Try coordinates field first
                  if (Array.isArray(item.coordinates) && item.coordinates.length >= 2) {
                    const lat = Number(item.coordinates[0]).toFixed(6);
                    const lng = Number(item.coordinates[1]).toFixed(6);
                    return `${lat},${lng}`;
                  }

                  // Try geo field
                  if (item.geo && typeof item.geo.lat === 'number' && typeof item.geo.lng === 'number') {
                    const lat = Number(item.geo.lat).toFixed(6);
                    const lng = Number(item.geo.lng).toFixed(6);
                    return `${lat},${lng}`;
                  }

                  // Fallback to label
                  return item.label ? `label:${item.label}` : null;
                };

                const aId = getCoordinatesIdFromSubGroup(a);
                const bId = getCoordinatesIdFromSubGroup(b);

                // If 'a' is selected, it should come first (-1)
                if (aId === selectedLandmarkId) return -1;
                // If 'b' is selected, it should come first
                if (bId === selectedLandmarkId) return 1;
                // Otherwise maintain original order
                return 0;
              });

              return sortedSubGroups.map((subGroup, index) => {
                // Get unique ID based on coordinates
                const getSubGroupId = (item) => {
                  if (!item) return null;

                  // Try coordinates field first
                  if (Array.isArray(item.coordinates) && item.coordinates.length >= 2) {
                    const lat = Number(item.coordinates[0]).toFixed(6);
                    const lng = Number(item.coordinates[1]).toFixed(6);
                    return `${lat},${lng}`;
                  }

                  // Try geo field
                  if (item.geo && typeof item.geo.lat === 'number' && typeof item.geo.lng === 'number') {
                    const lat = Number(item.geo.lat).toFixed(6);
                    const lng = Number(item.geo.lng).toFixed(6);
                    return `${lat},${lng}`;
                  }

                  // Fallback to label
                  return item.label ? `label:${item.label}` : null;
                };

                const subGroupId = getSubGroupId(subGroup);
                const isSelected = subGroupId === selectedLandmarkId;

                // Debug log
                if (isSelected) {
                  console.log('Found selected card:', {
                    label: subGroup.label,
                    subGroupId,
                    coordinates: subGroup.coordinates,
                    geo: subGroup.geo
                  });
                }

                // Get image URL
                const imageUrl = Array.isArray(subGroup.img) ? subGroup.img[0] : subGroup.img;

                if (!imageUrl) {
                  console.log(`Skipping ${subGroup.label} - no image URL`);
                  return null;
                }

                return (
                  <div
                    key={`${subGroupId}-${index}`}
                    className={`map-subgroup-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      console.log('Card clicked - coordinates:', {
                        label: subGroup.label,
                        coordinates: subGroup.coordinates,
                        geo: subGroup.geo,
                        subGroupId
                      });
                      handleLandmarkSelect(subGroup);
                    }}
                  >
                    <div className="map-subgroup-main">
                      <div className="map-subgroup-content">
                        <div className="map-subgroup-top">
                          <div className="subgroup-search-icon">
                            <img src={mapSelectedCategory.png} alt={mapSelectedCategory.label || 'category icon'} width="22" height="22" />
                          </div>
                          <h3 className="map-subgroup-title">{subGroup.label}</h3>
                          {isSelected && (
                            <div className="selected-indicator-badge">
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="#0F71EF">
                                <path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8S12.42 0 8 0zm3.707 6.293a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414L7 9.586l3.293-3.293a1 1 0 0 1 1.414 0z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <p className="map-subgroup-address">{subGroup.address}</p>
                        <div className="subgroup-rating-section">
                          <div className="subgroup-rating-stars">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg
                                key={star}
                                className={star <= Math.round(subGroup.rating) ? 'filled' : ''}
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" />
                              </svg>
                            ))}
                          </div>
                          <span className="subgroup-views">( {subGroup.views} {intl.formatMessage({ id: 'commentsLabel' })})</span>
                        </div>
                      </div>
                      <div className="map-subgroup-image">
                        <img
                          src={imageUrl}
                          alt={subGroup.label}
                          onError={(e) => {
                            console.error(`Failed to load image for ${subGroup.label}:`, imageUrl);
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                    <div className="map-subgroup-actions">
                      <button
                        className="map-subgroup-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRouteFromSubgroup(subGroup);
                        }}
                      >
                        <svg width="19" height="16" viewBox="0 0 19 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M16.2851 14.6752C16.7753 14.2188 16.9902 13.4967 16.6398 12.7983L11.1179 1.7918C10.4769 0.514157 8.52263 0.514157 7.88165 1.7918L2.35977 12.7983C2.00936 13.4967 2.2243 14.2188 2.71445 14.6752C3.20874 15.1354 4.01591 15.348 4.78988 14.9806L4.52496 14.5396L4.78988 14.9806L9.21767 12.8793L8.95274 12.4382L9.21767 12.8793C9.39648 12.7944 9.60309 12.7944 9.7819 12.8793L14.2097 14.9806L14.4746 14.5396L14.2097 14.9806C14.9837 15.348 15.7908 15.1354 16.2851 14.6752ZM14.7395 14.0985L14.4766 14.5364L14.7395 14.0985L10.3118 11.9971C9.80183 11.7551 9.19774 11.7551 8.68781 11.9971L4.26003 14.0985C3.99319 14.2251 3.72448 14.1675 3.52817 13.9847C3.32773 13.798 3.23735 13.5043 3.38724 13.2056L8.90911 2.19909C9.15361 1.71173 9.84595 1.71173 10.0905 2.19909L15.6123 13.2056C15.7622 13.5043 15.6718 13.7981 15.4714 13.9847C15.2751 14.1675 15.0064 14.2251 14.7395 14.0985Z" fill="#0F71EF" />
                        </svg>
                        <FormattedMessage id="navigate" />
                      </button>
                      <button className="map-subgroup-btn" onClick={(e) => e.stopPropagation()}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 3.50016C5.72386 3.50016 5.5 3.72402 5.5 4.00016C5.5 4.27631 5.72386 4.50016 6 4.50016H10C10.2761 4.50016 10.5 4.27631 10.5 4.00016C10.5 3.72402 10.2761 3.50016 10 3.50016H6Z" fill="#0F71EF" />
                          <path fillRule="evenodd" clipRule="evenodd" d="M7.96167 0.833496H9.20341C10.1151 0.833483 11.85 0.833472 11.428 0.911179C12.0281 0.991856 12.5333 1.16445 12.9346 1.56573C13.1336 1.76471 13.2763 1.98925 13.3795 2.23825C14.0009 2.31608 14.5226 2.48705 14.9346 2.8991C15.3359 3.30038 15.5085 3.80563 15.5891 4.4057C15.6669 4.98368 15.6668 5.71856 15.6668 6.63028V9.37011C15.6668 10.2818 15.6669 11.0167 15.5891 11.5947C15.5085 12.1948 15.3359 12.7 14.9346 13.1013C14.5225 13.5133 14.0009 13.6843 13.3795 13.7622C13.2763 14.0111 13.1336 14.2356 12.9346 14.4346C12.5333 14.8359 12.0281 15.0085 11.428 15.0891C10.85 15.1669 10.1151 15.1668 9.20341 15.1668H7.79692C6.88519 15.1668 6.15031 15.1669 5.57233 15.0891C4.97226 15.0085 4.46701 14.8359 4.06573 14.4346C3.86677 14.2356 3.72403 14.0111 3.62083 13.7622C2.99946 13.6843 2.47778 13.5133 2.06573 13.1013C1.66445 12.7 1.49186 12.1948 1.41118 11.5947C1.33347 11.0167 1.33348 10.2818 1.3335 9.37011V6.63028C1.33348 5.71856 1.33347 4.98368 1.41118 4.4057C1.49186 3.80563 1.66445 3.30038 2.06573 2.8991C2.47777 2.48705 2.99944 2.31608 3.6208 2.23824C3.724 1.98925 3.86675 1.76471 4.06573 1.56573C4.46701 1.16445 4.97226 0.991856 5.57233 0.911179C6.15031 0.833472 6.88519 0.833483 7.79691 0.833496ZM3.23413 2.57334C3.56531 2.23857 4.01501 2.04332 4.77552 1.93997C5.55097 1.83458 6.5715 1.8335 8 1.8335C9.4285 1.8335 10.449 1.83458 11.2245 1.93997C11.985 2.04332 12.4347 2.23857 12.7659 2.57334C13.0978 2.90885 13.2919 3.36562 13.3945 4.13695C13.499 4.92211 13.5 5.95498 13.5 7.39851V10.7274C13.5 11.7716 13.4993 12.5136 13.4417 13.0531C13.3826 13.606 13.2736 13.8135 13.1718 13.9074C13.0159 14.051 12.8199 14.1406 12.6119 14.1644C12.4788 14.1797 12.2557 14.1281 11.8056 13.8093C11.3665 13.4983 10.8141 13.0106 10.0365 12.3229L10.019 12.3074C9.6942 12.0201 9.42479 12.7818 9.18693 11.6079C8.93828 11.426 8.68749 11.2863 8.39188 11.2267C8.13318 11.1746 7.86682 11.1746 7.60812 11.2267C7.31251 11.2863 7.06172 11.426 6.81307 11.6079C6.57522 11.7818 6.30581 12.0201 5.98097 12.3074L5.96351 12.3229C5.18592 13.0106 4.63351 13.4983 4.19443 13.8093C3.7443 14.1281 3.52121 14.1797 3.38812 14.1644C3.18012 14.1406 2.98412 14.051 2.82825 13.9074C2.72642 13.8135 2.61743 13.606 2.55835 13.0531C2.50069 12.5136 2.5 11.7716 2.5 10.7274V7.39851C2.5 5.95498 2.50104 4.92211 2.60547 4.13695C2.70806 3.36562 2.90222 2.90885 3.23413 2.57334Z" fill="#0F71EF" />
                        </svg>
                        <FormattedMessage id="savePlace" />
                      </button>
                      <button
                        className="map-subgroup-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDetailsInfo(subGroup);
                        }}
                      >
                        <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M7.79691 0.833496H9.20341C10.1151 0.833483 11.85 0.833472 11.428 0.911179C12.0281 0.991856 12.5333 1.16445 12.9346 1.56573C13.1336 1.76471 13.2763 1.98925 13.3795 2.23825C14.0009 2.31608 14.5226 2.48705 14.9346 2.8991C15.3359 3.30038 15.5085 3.80563 15.5891 4.4057C15.6669 4.98368 15.6668 5.71856 15.6668 6.63028V9.37011C15.6668 10.2818 15.6669 11.0167 15.5891 11.5947C15.5085 12.1948 15.3359 12.7 14.9346 13.1013C14.5225 13.5133 14.0009 13.6843 13.3795 13.7622C13.2763 14.0111 13.1336 14.2356 12.9346 14.4346C12.5333 14.8359 12.0281 15.0085 11.428 15.0891C10.85 15.1669 10.1151 15.1668 9.20341 15.1668H7.79692C6.88519 15.1668 6.15031 15.1669 5.57233 15.0891C4.97226 15.0085 4.46701 14.8359 4.06573 14.4346C3.86677 14.2356 3.72403 14.0111 3.62083 13.7622C2.99946 13.6843 2.47778 13.5133 2.06573 13.1013C1.66445 12.7 1.49186 12.1948 1.41118 11.5947C1.33347 11.0167 1.33348 10.2818 1.3335 9.37011V6.63028C1.33348 5.71856 1.33347 4.98368 1.41118 4.4057C1.49186 3.80563 1.66445 3.30038 2.06573 2.8991C2.47777 2.48705 2.99944 2.31608 3.6208 2.23824C3.724 1.98925 3.86675 1.76471 4.06573 1.56573C4.46701 1.16445 4.97226 0.991856 5.57233 0.911179C6.15031 0.833472 6.88519 0.833483 7.79691 0.833496ZM3.23413 2.57334C3.56531 2.23857 4.01501 2.04332 4.77552 1.93997C5.55097 1.83458 6.5715 1.8335 8 1.8335C9.4285 1.8335 10.449 1.83458 11.2245 1.93997C11.985 2.04332 12.4347 2.23857 12.7659 2.57334C13.0978 2.90885 13.2919 3.36562 13.3945 4.13695C13.499 4.92211 13.5 5.95498 13.5 7.39851V10.7274C13.5 11.7716 13.4993 12.5136 13.4417 13.0531C13.3826 13.606 13.2736 13.8135 13.1718 13.9074C13.0159 14.051 12.8199 14.1406 12.6119 14.1644C12.4788 14.1797 12.2557 14.1281 11.8056 13.8093C11.3665 13.4983 10.8141 13.0106 10.0365 12.3229L10.019 12.3074C9.6942 12.0201 9.42479 12.7818 9.18693 11.6079C8.93828 11.426 8.68749 11.2863 8.39188 11.2267C8.13318 11.1746 7.86682 11.1746 7.60812 11.2267C7.31251 11.2863 7.06172 11.426 6.81307 11.6079C6.57522 11.7818 6.30581 12.0201 5.98097 12.3074L5.96351 12.3229C5.18592 13.0106 4.63351 13.4983 4.19443 13.8093C3.7443 14.1281 3.52121 14.1797 3.38812 14.1644C3.18012 14.1406 2.98412 14.051 2.82825 13.9074C2.72642 13.8135 2.61743 13.606 2.55835 13.0531C2.50069 12.5136 2.5 11.7716 2.5 10.7274V7.39851C2.5 5.95498 2.50104 4.92211 2.60547 4.13695C2.70806 3.36562 2.90222 2.90885 3.23413 2.57334Z" fill="#0F71EF" />
                          <path d="M6.00016 6.00016C6.00016 5.72402 6.22402 5.50016 6.50016 5.50016H10.5002C10.7763 5.50016 11.0002 5.72402 11.0002 6.00016C11.0002 6.27631 10.7763 6.50016 10.5002 6.50016H6.50016C6.22402 6.50016 6.00016 6.27631 6.00016 6.00016ZM6.00016 8.66683C6.00016 8.39069 6.22402 8.16683 6.50016 8.16683H10.5002C10.7763 8.16683 11.0002 8.39069 11.0002 8.66683C11.0002 8.94297 10.7763 9.16683 10.5002 9.16683H6.50016C6.22402 9.16683 6.00016 8.94297 6.00016 8.66683ZM6.00016 11.3335C6.00016 11.0574 6.22402 10.8335 6.50016 10.8335H8.50016C8.77631 10.8335 9.00016 11.0574 9.00016 11.3335C9.00016 11.6096 8.77631 11.8335 8.50016 11.8335H6.50016C6.22402 11.8335 6.00016 11.6096 6.00016 11.3335Z" fill="#0F71EF" />
                        </svg>
                        <FormattedMessage id="detailsButton" />
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
      {/* Destination Input - Only shown when modal is NOT open and not selecting from map and no subgroups are selected */}
      {!showDestinationModal && !showOriginModal && !isSelectingFromMap && mapSelectedSubGroups.length === 0 && (
        <>
          <div className="map-destination-input-container" ref={modalRef}>
            <div className="location-icons-container">
              <div className="location-icon origin-icon">
                <div className="n-circle"></div>
              </div>
              <div className="tdots">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#e0e0e0"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-dots-vertical"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                  <path d="M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                  <path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                </svg>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#e0e0e0"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-dots-vertical"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                  <path d="M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                  <path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                </svg>
              </div>
              <div className="location-icon destination-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#F44336">
                  <path d="M18.364 4.636a9 9 0 0 1 .203 12.519l-.203 .21l-4.243 4.242a3 3 0 0 1 -4.097 .135l-.144 -.135l-4.244 -4.243a9 9 0 0 1 12.728 -12.728zm-6.364 3.364a3 3 0 1 0 0 6a3 3 0 1 0 0 -6z" />
                </svg>
              </div>
            </div>
            <div className="map-location-inputs-container">
              {/* Fixed divider line */}
              <div className="map-inputs-divider"></div>

              {/* Origin Input */}
              <div className="map-current-location" onClick={() => handleInputClick('origin')}>
                <input
                  type="text"
                  placeholder={intl.formatMessage({ id: 'originPlaceholder' })}
                  value={userLocation ? `${userLocation.name}${getPointFloor(userLocation) === null ? '' : ` · ${floorLabel(getPointFloor(userLocation), language)}`}` : ''}
                  readOnly
                />
              </div>

              <button
                className="map-swap-button"
                onClick={handleSwapLocations}
                ref={swapButtonRef}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-arrows-sort">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M3 9l4 -4l4 4m-4 -4v14" />
                  <path d="M21 15l-4 4l-4 -4m4 4v-14" />
                </svg>
              </button>

              {/* Destination Input */}
              <div className="map-destination-input-wrapper" onClick={() => handleInputClick('destination')}>
                <input
                  type="text"
                  placeholder={intl.formatMessage({ id: 'destinationPlaceholder' })}
                  value={selectedDestination ? `${selectedDestination.name}${getPointFloor(selectedDestination) === null ? '' : ` · ${floorLabel(getPointFloor(selectedDestination), language)}`}` : ''}
                  readOnly
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Destination Modal */}
      {(showDestinationModal || showOriginModal) && (
        <div className={`map-search-modal ${showDestinationModal || showOriginModal ? 'fade-in' : ''}`} ref={modalRef}>
          <div className="map-search-header">
            <form className="map-search-form">
              {/* Conditionally render the back button */}
              {!modalSelectedCategory && (
                <button
                  type="button"
                  className="map-modal-back-button"
                  onClick={() => {
                    cancelEndpointSelection();
                    activeInput === 'destination' ? setShowDestinationModal(false) : setShowOriginModal(false);
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.2244 4.55806C11.4685 4.31398 11.8642 4.31398 12.1083 4.55806L17.1083 9.55806C17.3524 9.80214 17.3524 10.1979 17.1083 10.4419L12.1083 15.4419C11.8642 15.686 11.4685 15.686 11.2244 15.4419C10.9803 15.1979 10.9803 14.8021 11.2244 14.5581L15.1575 10.625H3.33301C2.98783 10.625 2.70801 10.3452 2.70801 10C2.70801 9.65482 2.98783 9.375 3.33301 9.375H15.1575L11.2244 5.44194C10.9803 5.19786 10.9803 4.80214 11.2244 4.55806Z" fill="#1E2023" />
                  </svg>
                </button>
              )}

              {modalSelectedCategory ? (
                <div className="selected-category-header">
                  <div className="selected-category-icon">
                    <img src={modalSelectedCategory.png} alt={modalSelectedCategory.label || 'category icon'} width="22" height="22" />
                  </div>
                  <span>{intl.formatMessage({ id: modalSelectedCategory.label })}</span>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={
                    activeInput === 'destination'
                      ? intl.formatMessage({ id: 'destinationSearchPlaceholder' })
                      : intl.formatMessage({ id: 'originSearchPlaceholder' })
                  }
                  value={searchQuery}
                  onChange={handleInputChange}
                  autoFocus
                  ref={searchInputRef}
                />
              )}

              {(searchQuery || modalSelectedCategory) && (
                <button type="button" className="map-clear-search" onClick={() => {
                  if (modalSelectedCategory) {
                    handleClearCategorySearch();
                  } else {
                    handleClearSearch();
                  }
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M18 6l-12 12" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              )}
            </form>

            {!modalSelectedCategory && (
              <div className="map-categories-scroll2">
                <div className="map-categories-list2">
                  {groups.map((category, index) => (
                    <div
                      key={`${category.value}-${index}`}
                      className={`map-category-item2 ${modalSelectedCategory && modalSelectedCategory.value === category.value ? 'active' : ''}`}
                      onClick={() => handleCategoryClickInModal(category)}
                    >
                      <div className={`map-category-icon ${category.icon} ${modalSelectedCategory && modalSelectedCategory.value === category.value ? 'active' : ''}`}>
                        <img src={category.png} width="22" height="22" />
                      </div>
                      <span className={`map-category-name ${modalSelectedCategory && modalSelectedCategory.value === category.value ? 'active' : ''}`}>
                        {getCategoryLabel(category.label)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Show subgroups when a category is selected */}
          {modalSelectedCategory && (
            <div className="map-subgroups-search-results">
              <div className="subgroups-container">
                {/* Subgroups with images - 2 column grid */}
                <div className="subgroups-with-images">
                  <div className="subgroups-grid">
                    {modalFilteredSubGroups
                      .filter(subgroup => subgroup.img)
                      .map((subgroup, index) => (
                        <div
                          key={index}
                          className="subgroup-item with-image"
                          onClick={() => {
                            handleSubgroupSelectWithModal(subgroup);

                            if (selectedOption === 'route') setShowRouteInfoModal(false);
                          }}
                          style={{
                            backgroundImage: subgroup.img ? `url(${Array.isArray(subgroup.img) ? subgroup.img[0] : subgroup.img})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundColor: 'rgba(255,255,255,0.7)',
                            backgroundBlendMode: 'lighten'
                          }}
                        >
                          <div className="subgroup-info">
                            <h4>{subgroup.label}</h4>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Subgroups without images - default list */}
                <div className="subgroups-without-images">
                  {modalFilteredSubGroups
                    .filter(subgroup => !subgroup.img)
                    .map((subgroup, index) => (
                      <div
                        key={index}
                        className="subgroup-search-item"
                        onClick={() => handleSubgroupSelect(subgroup)}
                      >
                        <div className="subgroup-search-box">
                          <div className="subgroup-search-info">
                            <div className="subgroup-search-icon">
                              <img src={modalSelectedCategory.png} alt={modalSelectedCategory.label || 'category icon'} width="22" height="22" />
                            </div>
                            <span className="subgroup-search-name">{subgroup.label}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* Original content when no category is selected */}
          {!modalSelectedCategory && (
            <>
              {!searchQuery && (
                <div className="map-options-section">
                  <div className="map-option-item" onClick={handleMapSelection}>
                    <div className="map-option-icon">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M13.4885 1.43864C12.4052 1.29299 10.9817 1.29166 8.99984 1.29166C7.01798 1.29166 5.59447 1.29299 4.51115 1.43864C3.44582 1.58187 2.80355 1.85428 2.32883 2.32899C1.85412 2.80371 1.58171 3.44598 1.43848 4.51131C1.29283 5.59463 1.2915 7.01814 1.2915 9C1.2915 10.9819 1.29283 12.4054 1.43848 13.4887C1.58171 14.554 1.85412 15.1963 2.32883 15.671C2.71852 16.0607 3.22112 16.3141 3.97797 16.4715L16.4714 3.97813C16.3139 3.22128 16.0605 2.71868 15.6708 2.32899C15.1961 1.85428 14.5539 1.58187 13.4885 1.43864ZM16.6559 5.56137L11.5508 10.6665L16.0568 15.1726C16.3023 14.7565 16.4624 14.2232 16.5612 13.4887C16.7068 12.4054 16.7082 10.9819 16.7082 9C16.7082 7.60122 16.7075 6.48057 16.6559 5.56137ZM15.173 16.0566L10.6669 11.5504L5.56121 16.6561C6.48041 16.7077 7.60106 16.7083 8.99984 16.7083C10.9817 16.7083 12.4052 16.707 13.4885 16.5614C14.2234 16.4626 14.7569 16.3023 15.173 16.0566ZM13.6551 0.199786C14.859 0.361652 15.809 0.699436 16.5547 1.44511C17.3004 2.19079 17.6382 3.14081 17.8 4.34475C17.9582 5.52099 17.9582 7.02852 17.9582 8.95219V9.04781C17.9582 10.9715 17.9582 12.479 17.8 13.6552C17.6382 14.8592 17.3004 15.8092 16.5547 16.5549C15.809 17.3006 14.859 17.6383 13.6551 17.8002C12.4788 17.9583 10.9713 17.9583 9.04765 17.9583H8.95203C7.02836 17.9583 5.52083 17.9583 4.34459 17.8002C3.14065 17.6383 2.19063 17.3006 1.44495 16.5549C0.699276 15.8092 0.361493 14.8592 0.199626 13.6552C0.0414851 12.479 0.0414935 10.9715 0.0415041 9.04781V8.95218C0.0414933 7.02852 0.0414847 5.52099 0.199626 4.34475C0.361492 3.14081 0.699276 2.19079 1.44495 1.44511C2.19063 0.699437 3.14065 0.361653 4.34459 0.199786C5.52083 0.0416453 7.02836 0.0416537 8.95202 0.0416643H9.04765C10.9713 0.0416535 12.4788 0.0416449 13.6551 0.199786ZM2.95817 6.29768C2.95817 4.41182 4.58689 2.95825 6.49984 2.95825C8.41279 2.95825 10.0415 4.41182 10.0415 6.29768C10.0415 7.98624 9.00333 9.97915 7.2788 10.7161C6.78335 10.9278 6.21633 10.9278 5.72087 10.7161C3.99634 9.97915 2.95817 7.98624 2.95817 6.29768ZM6.49984 4.20825C5.19113 4.20825 4.20817 5.18526 4.20817 6.29768C4.20817 7.5839 5.0318 9.06229 6.21208 9.56668C6.39379 9.64433 6.60589 9.64433 6.78759 9.56668C7.96788 9.06229 8.7915 7.5839 8.7915 6.29768C8.7915 5.18526 7.80855 4.20825 6.49984 4.20825Z" fill="#0F71EF" />
                        <path d="M7.33317 6.5C7.33317 6.96024 6.96007 7.33333 6.49984 7.33333C6.0396 7.33333 5.6665 6.96024 5.6665 6.5C5.6665 6.03976 6.0396 5.66666 6.49984 5.66666C6.96007 5.66666 7.33317 6.03976 7.33317 6.5Z" fill="#0F71EF" />
                      </svg>
                    </div>
                    <span className="map-option-text">
                      <FormattedMessage id="chooseFromMap" />
                    </span>
                  </div>
                  {isGPSEnabled && activeInput === 'origin' && (
                    <div className="map-option-item" onClick={handleCurrentLocationSelect}>
                      <div className="map-option-icon">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M13.4885 1.43864C12.4052 1.29299 10.9817 1.29166 8.99984 1.29166C7.01798 1.29166 5.59447 1.29299 4.51115 1.43864C3.44582 1.58187 2.80355 1.85428 2.32883 2.32899C1.85412 2.80371 1.58171 3.44598 1.43848 4.51131C1.29283 5.59463 1.2915 7.01814 1.2915 9C1.2915 10.9819 1.29283 12.4054 1.43848 13.4887C1.58171 14.554 1.85412 15.1963 2.32883 15.671C2.71852 16.0607 3.22112 16.3141 3.97797 16.4715L16.4714 3.97813C16.3139 3.22128 16.0605 2.71868 15.6708 2.32899C15.1961 1.85428 14.5539 1.58187 13.4885 1.43864ZM16.6559 5.56137L11.5508 10.6665L16.0568 15.1726C16.3023 14.7565 16.4624 14.2232 16.5612 13.4887C16.7068 12.4054 16.7082 10.9819 16.7082 9C16.7082 7.60122 16.7075 6.48057 16.6559 5.56137ZM15.173 16.0566L10.6669 11.5504L5.56121 16.6561C6.48041 16.7077 7.60106 16.7083 8.99984 16.7083C10.9817 16.7083 12.4052 16.707 13.4885 16.5614C14.2234 16.4626 14.7569 16.3023 15.173 16.0566ZM13.6551 0.199786C14.859 0.361652 15.809 0.699436 16.5547 1.44511C17.3004 2.19079 17.6382 3.14081 17.8 4.34475C17.9582 5.52099 17.9582 7.02852 17.9582 8.95219V9.04781C17.9582 10.9715 17.9582 12.479 17.8 13.6552C17.6382 14.8592 17.3004 15.8092 16.5547 16.5549C15.809 17.3006 14.859 17.6383 13.6551 17.8002C12.4788 17.9583 10.9713 17.9583 9.04765 17.9583H8.95203C7.02836 17.9583 5.52083 17.9583 4.34459 17.8002C3.14065 17.6383 2.19063 17.3006 1.44495 16.5549C0.699276 15.8092 0.361493 14.8592 0.199626 13.6552C0.0414851 12.479 0.0414935 10.9715 0.0415041 9.04781V8.95218C0.0414933 7.02852 0.0414847 5.52099 0.199626 4.34475C0.361492 3.14081 0.699276 2.19079 1.44495 1.44511C2.19063 0.699437 3.14065 0.361653 4.34459 0.199786C5.52083 0.0416453 7.02836 0.0416537 8.95202 0.0416643H9.04765C10.9713 0.0416535 12.4788 0.0416449 13.6551 0.199786ZM2.95817 6.29768C2.95817 4.41182 4.58689 2.95825 6.49984 2.95825C8.41279 2.95825 10.0415 4.41182 10.0415 6.29768C10.0415 7.98624 9.00333 9.97915 7.2788 10.7161C6.78335 10.9278 6.21633 10.9278 5.72087 10.7161C3.99634 9.97915 2.95817 7.98624 2.95817 6.29768ZM6.49984 4.20825C5.19113 4.20825 4.20817 5.18526 4.20817 6.29768C4.20817 7.5839 5.0318 9.06229 6.21208 9.56668C6.39379 9.64433 6.60589 9.64433 6.78759 9.56668C7.96788 9.06229 8.7915 7.5839 8.7915 6.29768C8.7915 5.18526 7.80855 4.20825 6.49984 4.20825Z" fill="#0F71EF" />
                          <path d="M7.33317 6.5C7.33317 6.96024 6.96007 7.33333 6.49984 7.33333C6.0396 7.33333 5.6665 6.96024 5.6665 6.5C5.6665 6.03976 6.0396 5.66666 6.49984 5.66666C6.96007 5.66666 7.33317 6.03976 7.33317 6.5Z" fill="#0F71EF" />
                        </svg>
                      </div>
                      <span className="map-option-text">
                        {intl.formatMessage({ id: 'mapCurrentLocation' }, { loc: userLocation?.name || '' })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!searchQuery && (
                <>
                  <h2 className="map-recent-title">
                    {intl.formatMessage({ id: 'mapRecentSearches' })}
                  </h2>
                  {recentSearches.length === 0 ? (
                    <p className="map-no-recent">
                      {intl.formatMessage({ id: 'mapNoRecentSearches' })}
                    </p>
                  ) : (
                    <ul className="map-destination-list">
                      {recentSearches.map((destination, index) => (
                        <li key={`${destination.id || 'destination'}-${index}`} style={{ position: 'relative' }} onClick={() => handleRecentSelection(destination)}>
                          <div className="map-recent-icon">
                            <SearchPlaceIcon area={isAreaResult(destination)} />
                          </div>
                          <div className="map-destination-info">
                            <span className="map-destination-name">{destination.name}</span>
                            <span className="map-destination-location">{renderSearchLocation(destination, getRecentAddress(destination))}</span>
                          </div>
                          <button
                            className="map-recent-option"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRecentMenuIndex(activeRecentMenuIndex === index ? null : index);
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-dots-vertical"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
                          </button>
                          {activeRecentMenuIndex === index && (
                            <div className="recent-search-menu">
                              <button
                                className="recent-search-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSearch(destination);
                                  setActiveRecentMenuIndex(null);
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18" />
                                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                                <span>{intl.formatMessage({ id: 'remove' })}</span>
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {searchQuery && filteredDestinations.length > 0 && (
                <ul className="map-destination-list">
                  {filteredDestinations.map((destination, index) => (
                    <li key={`${destination.id || 'destination'}-${index}`} onClick={() => handleDestinationSelect(destination)}>
                      <div className="map-recent-icon">
                        <SearchPlaceIcon area={isAreaResult(destination)} />
                      </div>
                      <div className="map-destination-info">
                        <span className="map-destination-name">{destination.name}</span>
                        <span className="map-destination-location">{renderSearchLocation(destination, destination.location)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {/* Entry Selection Modal */}
      {showEntryModal && tempDestination && (
        <div className="map-entry-modal-overlay">
          <div className="map-entry-modal" ref={entryPanelRef} role="dialog" aria-label={tempDestination.name}>

            <div className="map-entry-search-section">
              <div className="map-entry-search-box">
                <div className="map-entry-location-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#F44336">
                    <path d="M18.364 4.636a9 9 0 0 1 .203 12.519l-.203 .21l-4.243 4.242a3 3 0 0 1 -4.097 .135l-.144 -.135l-4.244 -4.243a9 9 0 0 1 12.728 -12.728zm-6.364 3.364a3 3 0 1 0 0 6a3 3 0 1 0 0 -6z" />
                  </svg>
                </div>
                <span className="map-entry-location-name">{tempDestination.name}</span>
                <button
                  type="button"
                  className="map-modal-back-button map-entry-back-button"
                  aria-label={intl.formatMessage({ id: 'back' })}
                  onClick={handleBackFromEntry}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M3 10h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="map-entries-section">
              {!mapEntryDoors.length && (
                <div className="map-entry-message" role="status">
                  <FormattedMessage id={
                    areaDoorsStatus === 'loading' ? 'loading'
                      : areaDoorsStatus === 'error' ? 'generalErrorMessage'
                        : 'mapNoAreaEntries'
                  } />
                </div>
              )}
              <div className="map-entries-grid">
                {mapEntryDoors.map((entry) => {
                  const entryNumber = entry.doorNo;
                  const destinationName = entry.otherAreaName || entry.label
                    || intl.formatMessage({ id: 'mapEntryUnknownDestination' });

                  return (
                    <button
                      type="button"
                      key={entry.accessId ?? entryNumber}
                      className={`map-entry-item ${selectedEntry === entryNumber ? 'selected' : ''}`}
                      aria-pressed={selectedEntry === entryNumber}
                      onClick={() => handleEntrySelect(entryNumber)}
                    >
                      <span className="map-entry-number">
                        <FormattedMessage id="entry" /> {entryNumber}
                      </span>
                      <span className="map-entry-destination">{destinationName}</span>
                      {selectedEntry === entryNumber && (
                        <span className="map-entry-selected-indicator" aria-hidden="true">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            shapeRendering="geometricPrecision"
                            textRendering="geometricPrecision"
                            imageRendering="optimizeQuality"
                            fillRule="evenodd"
                            clipRule="evenodd"
                            viewBox="0 0 512 512"
                          >
                            <path
                              fill="#3AAF3C"
                              d="M256 0c141.39 0 256 114.61 256 256S397.39 512 256 512 0 397.39 0 256 114.61 0 256 0z"
                            />
                            <path
                              fill="#0DA10D"
                              fillRule="nonzero"
                              d="M391.27 143.23h19.23c-81.87 90.92-145.34 165.89-202.18 275.52-29.59-63.26-55.96-106.93-114.96-147.42l22.03-4.98c44.09 36.07 67.31 76.16 92.93 130.95 52.31-100.9 110.24-172.44 182.95-254.07z"
                            />
                            <path
                              fill="#fff"
                              fillRule="nonzero"
                              d="M158.04 235.26c19.67 11.33 32.46 20.75 47.71 37.55 39.53-63.63 82.44-98.89 138.24-148.93l5.45-2.11h61.06c-81.87 90.93-145.34 165.9-202.18 275.53-29.59-63.26-55.96-106.93-114.96-147.43l64.68-14.61z"
                            />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="footer-gradient"></div>

            <button
              type="button"
              className={`map-confirm-entry-button ${selectedEntry ? 'active' : ''}`}
              disabled={selectedEntry == null}
              onClick={handleConfirmEntry}
            >
              <FormattedMessage id="confirmEntry" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapRoutingPage;
