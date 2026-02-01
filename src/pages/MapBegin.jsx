import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useIntl } from 'react-intl';
import axios from 'axios';
import { toJalaali } from 'jalaali-js';
import Mpbc from '../components/map/Mpbc';
import { useRouteStore } from '../store/routeStore';
import { useLangStore } from '../store/langStore';
import { getLocationTitleById } from '../utils/getLocationTitle';
import '../styles/MapBegin.css';
import appConfig from '../config/appConfig';
import { fetchLandmarkPlaces } from '../services/landmarkService';
import { fetchGroupMetadata, fetchSubGroups } from '../services/groupService';
import { normalizeGroupMetadata, normalizeSubGroupMetadata } from '../utils/groupMetadata';
import { useUserAuthStore } from '../auth/user/userAuthStore';
import { useNavigate, useLocation } from 'react-router-dom';

const MapBeginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const intl = useIntl();
  const language = useLangStore(state => state.language);
  const getCategoryLabel = (label) => intl.messages?.[label] ?? label;
  const { accessToken, user } = useUserAuthStore();
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const storedLat = sessionStorage.getItem('qrLat');
  const storedLng = sessionStorage.getItem('qrLng');
  const storedId = sessionStorage.getItem('qrId');
  const initialUserLocation = storedLat && storedLng
    ? {
      name: intl.formatMessage({ id: 'mapCurrentLocationName' }),
      coordinates: [parseFloat(storedLat), parseFloat(storedLng)]
    }
    : null;
  const [userLocation, setUserLocation] = useState(initialUserLocation);
  const [isTracking, setIsTracking] = useState(false);
  const [mapSelectedLocation, setMapSelectedLocation] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showRouting, setShowRouting] = useState(false);
  const [searchClose, setSearchClose] = useState(false);
  const searchInputRef = useRef(null);
  const [routingData, setRoutingData] = useState(null);
  const [shrineEvents, setShrineEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('mostVisited');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMapTypeOpen, setIsMapTypeOpen] = useState(false);
  const [selectedMapType, setSelectedMapType] = useState('satellite');
  const [showImageMarkers] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  const [expandedSearch, setExpandedSearch] = useState(false);
  const [isQrCodeEntry, setIsQrCodeEntry] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartHeight, setDragStartHeight] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [lastTouchY, setLastTouchY] = useState(0);
  const [lastTouchTime, setLastTouchTime] = useState(0);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState(null);
  const [currentHeight, setCurrentHeight] = useState(140);
  const [isAutoExpanding, setIsAutoExpanding] = useState(false);
  const [modalDragStartY, setModalDragStartY] = useState(0);
  const [modalDragStartHeight, setModalDragStartHeight] = useState(0);
  const [isModalDragging, setIsModalDragging] = useState(false);
  const [modalVelocity, setModalVelocity] = useState(0);
  const [modalLastTouchY, setModalLastTouchY] = useState(0);
  const [showMapStyleMenu, setShowMapStyleMenu] = useState(false);
  const [modalLastTouchTime, setModalLastTouchTime] = useState(0);
  const [preventScroll, setPreventScroll] = useState(false);
  const [scrollStartY, setScrollStartY] = useState(0);
  const [scrollStartScrollTop, setScrollStartScrollTop] = useState(0);
  const [preventMapCentering, setPreventMapCentering] = useState(false);
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState({});
  const [landmarkPlaces, setLandmarkPlaces] = useState([]);
  const [visibleCounts, setVisibleCounts] = useState({
    landmarkPlaces: 6,
    mostVisited: 6,
    nearest: 6,
    shrineEvents: 6
  });

  const [showAllShrineEvents, setShowAllShrineEvents] = useState(false);
  const isScannedQrLocation = isQrCodeEntry &&
    userLocation &&
    selectedLocation?.coordinates &&
    userLocation.coordinates &&
    selectedLocation.coordinates[0] === userLocation.coordinates[0] &&
    selectedLocation.coordinates[1] === userLocation.coordinates[1];
  const clearMapSelection = () => {
    sessionStorage.removeItem('mapSelectedLat');
    sessionStorage.removeItem('mapSelectedLng');
    sessionStorage.removeItem('mapSelectedId');
  };

  useEffect(() => {
    if (storedLat && storedLng && storedId) {
      getLocationTitleById(storedId).then((title) => {
        if (title) {
          sessionStorage.setItem('qrName', title);
          setUserLocation({
            name: title,
            coordinates: [parseFloat(storedLat), parseFloat(storedLng)]
          });
        }
      });
    }
  }, [storedLat, storedLng, storedId, language]);

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

  const setOriginStore = useRouteStore(state => state.setOrigin);

  const handleSearchToggle = () => {
    if (isModalDragging || isDragging) return;

    if (isQrCodeEntry && showLocationDetails && showRouting) {
      if (expandedSearch) {
        setExpandedSearch(false);
        setCurrentHeight(window.innerHeight * 0.3);
      } else if (currentHeight <= window.innerHeight * 0.3) {
        setCurrentHeight(140);
        setShowRouting(false);
        setExpandedSearch(false);
        setIsQrCodeEntry(false);
      } else {
        setExpandedSearch(true);
        setCurrentHeight(window.innerHeight);
      }
    } else if (showRouting) {
      if (expandedSearch) {
        setExpandedSearch(false);
        setCurrentHeight(window.innerHeight * 0.41);
      } else {
        setCurrentHeight(140);
        setShowRouting(false);
        setExpandedSearch(false);
      }
    } else {
      setShowRouting(true);
      if (showLocationDetails) {
        setCurrentHeight(window.innerHeight * 0.41);
        setExpandedSearch(false);
      } else {
        setCurrentHeight(window.innerHeight);
        setExpandedSearch(true);
      }
    }
  };

  const resolveLocationId = (location) => {
    const rawId = location?.id || location?.value;
    if (!rawId) return null;

    const normalizedId = rawId.toLowerCase();
    const idMappings = {
    };

    return idMappings[normalizedId] || rawId;
  };

  useEffect(() => {
    if (isSidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }

    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.body.classList.remove('sidebar-open');
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isSidebarOpen]);

  const handleCulturalInfo = () => {
    setSelectedLandmarkId(null);

    const locationId = resolveLocationId(selectedLocation);
    const params = new URLSearchParams();

    const normalizedId = locationId ? locationId.replace(/\/+$/, '').trim() : locationId;

    if (selectedLocation?.coordinates) {
      const [lat, lng] = selectedLocation.coordinates;
      if (lat && lng) {
        params.set('lat', lat);
        params.set('lng', lng);
        sessionStorage.setItem('mapSelectedLat', lat.toString());
        sessionStorage.setItem('mapSelectedLng', lng.toString());
      }
    }

    if (normalizedId) {
      params.set('id', normalizedId);
      sessionStorage.setItem('mapSelectedId', normalizedId);
    }

    const queryString = params.toString();
    const target = queryString ? `/location?${queryString}` : '/location';

    navigate(target, { state: { location: selectedLocation } });
  };

  const handleModalTouchStart = (e) => {
    const target = e.target;

    const interactiveSelectors = 'button, input, a, .cultural-info-btn, .place-action-btn, .view-all-btn5, .view-all-events, .close-modal-btn, .transparent-save-btn';

    if (target.closest(interactiveSelectors)) {
      setPreventScroll(false);
      setIsModalDragging(false);
      return;
    }

    if (isModalDragging || isDragging) return;

    const touchY = e.touches[0].clientY;
    const modalContent = e.currentTarget;

    const isAtTop = modalContent.scrollTop <= 0;
    const isAtBottom = modalContent.scrollHeight - modalContent.scrollTop <= modalContent.clientHeight + 1;

    if (isAtTop || !expandedSearch) {
      setPreventScroll(true);
      setIsModalDragging(true);
      setModalDragStartY(touchY);
      setModalDragStartHeight(currentHeight);
      setModalLastTouchY(touchY);
      setModalLastTouchTime(Date.now());
      setModalVelocity(0);

      setScrollStartY(touchY);
      setScrollStartScrollTop(modalContent.scrollTop);
    } else {
      setPreventScroll(false);
    }
  };

  const handleModalTouchMove = (e) => {
    if (!isModalDragging) return;

    const touchY = e.touches[0].clientY;

    // Prevent default to stop page reload/pull-to-refresh
    e.preventDefault();

    // If we're in fully expanded mode and trying to scroll down, allow scrolling
    if (expandedSearch && !preventScroll) {
      return;
    }

    const currentTime = Date.now();
    const deltaTime = currentTime - modalLastTouchTime;

    if (deltaTime > 0) {
      const deltaY = modalLastTouchY - touchY;
      const newVelocity = deltaY / deltaTime;
      setModalVelocity(newVelocity);
    }

    const deltaY = modalDragStartY - touchY;
    const newHeight = modalDragStartHeight + deltaY;

    let resistance = 1;
    if (newHeight < 140) {
      resistance = 0.3 + (0.7 * (newHeight / 140));
    } else if (newHeight > window.innerHeight) {
      resistance = 0.3 + (0.7 * (window.innerHeight / newHeight));
    }

    const clampedHeight = Math.max(80, Math.min(newHeight * resistance, window.innerHeight * 1.1));
    setCurrentHeight(clampedHeight);

    setModalLastTouchY(touchY);
    setModalLastTouchTime(currentTime);
  };

  const handleModalTouchEnd = () => {
    if (!isModalDragging) return;
    setIsModalDragging(false);
    setPreventScroll(false);

    const screenHeight = window.innerHeight;
    const snapThreshold = 50;
    const velocityThreshold = 0.5;

    let targetHeight;

    if (Math.abs(modalVelocity) > velocityThreshold) {
      if (modalVelocity > 0) {
        // Swiping up
        targetHeight = window.innerHeight;
      } else {
        // Swiping down
        if (currentHeight < screenHeight * 0.3) {
          targetHeight = 140;
        } else {
          targetHeight = window.innerHeight * 0.41;
        }
      }
    } else {
      // No significant velocity - use position-based snapping
      if (currentHeight < 140 + snapThreshold) {
        targetHeight = 140;
      } else if (currentHeight < screenHeight * 0.35) {
        targetHeight = window.innerHeight * 0.41;
      } else if (currentHeight < screenHeight * 0.7) {
        targetHeight = window.innerHeight * 0.41;
      } else {
        targetHeight = screenHeight;
      }
    }

    // Smooth animation to target height
    setCurrentHeight(targetHeight);

    // Update UI state based on final height
    if (targetHeight <= 140) {
      setShowRouting(false);
      setExpandedSearch(false);
    } else if (targetHeight <= screenHeight * 0.41) {
      setExpandedSearch(false);
      setShowRouting(true);
    } else {
      setExpandedSearch(true);
      setShowRouting(true);
    }

    setModalVelocity(0);
  };

  useEffect(() => {
    if (!showLocationDetails && selectedLandmarkId) {
      setSelectedLandmarkId(null);
    }
  }, [showLocationDetails, selectedLandmarkId]);


  const handleMapClick = (latlng, feature) => {
    const isLandmarkSelection = feature?.properties?.isLandmark;

    if (isLandmarkSelection) {
      const landmark = feature.properties || {};

      setSelectedLandmarkId(null);

      const landmarkId = landmark.id || landmark.value || landmark.subGroupValue ||
        `landmark-${latlng.lat}-${latlng.lng}`;
      setSelectedLandmarkId(landmarkId);

      const images = Array.isArray(landmark.img)
        ? landmark.img
        : landmark.img
          ? [landmark.img]
          : [];

      setSelectedLocation({
        label: landmark.label || landmark.name || intl.formatMessage({ id: 'mapSelectedLocation' }),
        img: images,
        address: landmark.address,
        distance: landmark.distance,
        time: landmark.time,
        description: landmark.content?.body || landmark.description || '',
        value: landmark.value || landmark.id || landmark.subGroupValue,
        coordinates: [latlng.lat, latlng.lng]
      });

      setShowLocationDetails(true);
      setShowRouting(true);
      setExpandedSearch(false);
      return;
    }

    if (selectedLandmarkId) {
      setSelectedLandmarkId(null);
    }

    const locName = feature?.properties?.name || intl.formatMessage({ id: 'mapSelectedLocation' });
    const origin = {
      name: locName,
      coordinates: [latlng.lat, latlng.lng]
    };

    setSelectedOrigin(origin);

    sessionStorage.setItem('mapSelectedLat', latlng.lat.toString());
    sessionStorage.setItem('mapSelectedLng', latlng.lng.toString());
    if (feature?.properties?.uniqueId) {
      sessionStorage.setItem('mapSelectedId', feature.properties.uniqueId);
    }

    setPreventMapCentering(true);

    const isQrEntry = sessionStorage.getItem('qrLat') && sessionStorage.getItem('qrLng');

    if (!isQrEntry) {
      setOriginStore({
        name: origin.name,
        coordinates: origin.coordinates
      });
    } else if (userLocation) {
      setOriginStore({
        name: userLocation.name,
        coordinates: userLocation.coordinates
      });
    }

    if (feature?.properties?.subGroupValue) {
      const subgroup = Object.values(subGroups)
        .flat()
        .find(sg => sg.value === feature.properties.subGroupValue);

      if (subgroup && subgroup.img) {
        setSelectedLocation({
          ...subgroup,
          coordinates: [latlng.lat, latlng.lng]
        });
        setShowLocationDetails(true);
        setShowRouting(true);
        setExpandedSearch(false);
      } else {
      }
    } else {
    }
  };

  // Add this useEffect after your existing QR code useEffect
  useEffect(() => {
    // Check if this is a QR code entry for Bab ol Reza (sahn-payambar-azam)
    if (storedId === 'sahn-payambar-azam_2658' && storedLat && storedLng) {
      // Find the Sahne Enghelab cultural info from subGroups
      const sahneEnghelabInfo = subGroups.sahn.find(
        item => item.value === 'sahn-payambar-azam'
      );

      if (sahneEnghelabInfo) {
        // Set the selected location with coordinates from QR code
        setSelectedLocation({
          ...sahneEnghelabInfo,
          coordinates: [parseFloat(storedLat), parseFloat(storedLng)]
        });

        // Show location details and routing panel
        setShowLocationDetails(true);
        setShowRouting(true);
        setExpandedSearch(false);

        // Set height to 30vh equivalent for the modal
        const thirtyVhHeight = window.innerHeight * 0.3;
        setCurrentHeight(thirtyVhHeight);

        // Set flag to indicate this is a QR code entry
        setIsQrCodeEntry(true);
      }
    }
  }, [storedId, storedLat, storedLng, language]);

  const handleTouchStart = (e) => {
    const touchY = e.touches[0].clientY;
    setIsDragging(true);
    setDragStartY(touchY);
    setDragStartHeight(currentHeight);
    setLastTouchY(touchY);
    setLastTouchTime(Date.now());
    setVelocity(0);
  };


  const handleTouchMove = (e) => {
    if (!isDragging) return;

    e.preventDefault();

    const touchY = e.touches[0].clientY;
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTouchTime;

    if (deltaTime > 0) {
      const deltaY = lastTouchY - touchY;
      const newVelocity = deltaY / deltaTime;
      setVelocity(newVelocity);
    }

    const deltaY = dragStartY - touchY;
    const newHeight = dragStartHeight + deltaY;

    let resistance = 1;
    if (newHeight < 140) {
      resistance = 0.3 + (0.7 * (newHeight / 140));
    } else if (newHeight > window.innerHeight) {
      resistance = 0.3 + (0.7 * (window.innerHeight / newHeight));
    }

    const clampedHeight = Math.max(80, Math.min(newHeight * resistance, window.innerHeight * 1.1));
    setCurrentHeight(clampedHeight);

    setLastTouchY(touchY);
    setLastTouchTime(currentTime);
  };

  useEffect(() => {
    const handleTouchMove = (e) => {
      if (preventScroll || isModalDragging) {
        e.preventDefault();
      }
    };

    const handleScroll = (e) => {
      if (preventScroll || isModalDragging) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    if (preventScroll || isModalDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('scroll', handleScroll, { passive: false });
    }

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [preventScroll, isModalDragging]);

  useEffect(() => {
    const handleResize = () => {
      if (expandedSearch) {
        setCurrentHeight(window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [expandedSearch]);

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const screenHeight = window.innerHeight;
    const snapThreshold = 50;
    const velocityThreshold = 0.5;

    let targetHeight;

    if (Math.abs(velocity) > velocityThreshold) {

      if (velocity > 0) {

        targetHeight = window.innerHeight;
      } else {

        if (currentHeight < screenHeight * 0.3) {
          targetHeight = 140;
        } else {
          targetHeight = window.innerHeight * 0.41;
        }
      }
    } else {
      // No significant velocity - use position-based snapping
      if (currentHeight < 140 + snapThreshold) {
        targetHeight = 140;
      } else if (currentHeight < screenHeight * 0.35) {
        targetHeight = window.innerHeight * 0.41;
      } else if (currentHeight < screenHeight * 0.7) {
        targetHeight = window.innerHeight * 0.41;
      } else {
        targetHeight = screenHeight;
      }
    }

    // Smooth animation to target height
    setCurrentHeight(targetHeight);

    // Update UI state based on final height
    if (targetHeight <= 140) {
      setShowRouting(false);
      setExpandedSearch(false);
    } else if (targetHeight <= screenHeight * 0.41) {
      setExpandedSearch(false);
      setShowRouting(true);
    } else {
      setExpandedSearch(true);
      setShowRouting(true);
    }

    setVelocity(0);
  };

  const handleCategoryClick = (category) => {
    const isSameCategory = selectedCategory && selectedCategory.value === category.value;
    setSelectedCategory(isSameCategory ? null : category);
  }


  const handleSearchBlur = () => {
    setIsSearchFocused(false);
  };

  // Fetch routingData.json from public folder
  useEffect(() => {
    fetch(`./data/routing-data.json`)
      .then(res => res.json())
      .then(data => {
        setRoutingData(prev => {
          const mergedPlaces = {
            ...(data.places || {}),
            ...(prev?.places || {}),
            landmarkPlaces: prev?.places?.landmarkPlaces ?? data.places?.landmarkPlaces ?? []
          };

          return {
            ...data,
            ...prev,
            places: mergedPlaces
          };
        });
        setShrineEvents(data.places?.shrineEvents || []);
      })
      .catch(err => console.error('Failed to load routing-data.json', err));
  }, []);

  useEffect(() => {
    const loadLandmarkPlaces = async () => {
      const geoCoordinates = userLocation?.coordinates;
      const geo = Array.isArray(geoCoordinates) && geoCoordinates.length >= 2
        ? { lat: geoCoordinates[0], lng: geoCoordinates[1] }
        : null;

      const parseNumber = (value, fallback = 0) => {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : fallback;
      };

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
          geo
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

        const topRatedLandmarks = apiLandmarks
          .filter(place => place?.rate != null || place?.rating != null)
          .sort((a, b) => parseNumber(b.rate ?? b.rating) - parseNumber(a.rate ?? a.rating))
          .slice(0, 10);

        const nearestLandmarks = apiLandmarks
          .filter(place => place?.distance != null)
          .sort((a, b) => parseNumber(a.distance, Number.POSITIVE_INFINITY) - parseNumber(b.distance, Number.POSITIVE_INFINITY))
          .slice(0, 10);

        setLandmarkPlaces(landmarksWithImages);

        setRoutingData(prev => {
          const mergedPlaces = {
            ...(prev?.places || {}),
            landmarkPlaces: landmarksWithImages.length ? landmarksWithImages : prev?.places?.landmarkPlaces || [],
            mostVisited: topRatedLandmarks.length ? topRatedLandmarks : prev?.places?.mostVisited || [],
            nearest: nearestLandmarks.length ? nearestLandmarks : prev?.places?.nearest || []
          };

          return {
            ...prev,
            language: data?.language || language,
            generatedAt: data?.generatedAt || prev?.generatedAt,
            places: mergedPlaces
          };
        });
      } catch (error) {
        console.error('Failed to load landmark places', error);
        toast.error(intl.formatMessage({ id: 'generalErrorMessage' }));

        setLandmarkPlaces([]);

        setRoutingData(prev => ({
          ...prev,
          places: {
            ...(prev?.places || {}),
            landmarkPlaces: [],
            mostVisited: prev?.places?.mostVisited || [],
            nearest: prev?.places?.nearest || []
          }
        }));
      }
    };

    loadLandmarkPlaces();
  }, [language, userLocation, intl]);

  useEffect(() => {
    const fetchShrineEvents = async () => {
      try {
        const today = new Date();
        const { jy, jm, jd } = toJalaali(
          today.getFullYear(),
          today.getMonth() + 1,
          today.getDate()
        );

        const formattedDate = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
        const shrineEventsBaseUrl = appConfig.shrineEventsBaseUrl.replace(/\/$/, '');
        const { data } = await axios.get(`${shrineEventsBaseUrl}/${formattedDate}`);

        if (data?.status_code === 200 && Array.isArray(data.data)) {
          const mappedEvents = data.data.map(item => {
            const speakerName = [item.prefix, item.first_name, item.last_name]
              .filter(Boolean)
              .join(' ')
              .trim();

            const descriptionParts = [item.format_title, item.title].filter(Boolean);
            if (speakerName) descriptionParts.push(speakerName);

            const formattedTime = item.start_time && item.end_time
              ? `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}`
              : item.start_time?.slice(0, 5) || '';

            return {
              title: item.title || item.format_title || '',
              description: descriptionParts.join(' - '),
              location: item.title_place || '',
              time: formattedTime,
              image: item.image_url
            };
          });

          setShrineEvents(mappedEvents);
        }
      } catch (error) {
        console.error('Failed to fetch shrine events', error);
      }
    };

    fetchShrineEvents();
  }, []);


  useEffect(() => {
    // Check if this is a QR code entry and if it's a landmark
    if (storedId && storedLat && storedLng) {
      const findLandmarkById = () => {
        if (!landmarkPlaces || landmarkPlaces.length === 0) return null;
        return landmarkPlaces.find(landmark => {
          const landmarkId = landmark.id || landmark.value || landmark.subGroupValue;
          return landmarkId && storedId.includes(landmarkId);
        });
      };

      const foundLandmark = findLandmarkById();

      if (foundLandmark) {
        // Use the same getFirstImage function logic from your fetchLandmarkPlaces useEffect
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

        const primaryImage = getFirstImage(foundLandmark);

        const images = primaryImage ? [primaryImage] : [];


        setSelectedLocation({
          label: foundLandmark.label || foundLandmark.name || foundLandmark.title || intl.formatMessage({ id: 'mapSelectedLocation' }),
          img: images,
          address: foundLandmark.address,
          distance: foundLandmark.distance,
          time: foundLandmark.time,
          description: foundLandmark.content?.body || foundLandmark.description || '',
          value: foundLandmark.value || foundLandmark.id || foundLandmark.subGroupValue,
          coordinates: [parseFloat(storedLat), parseFloat(storedLng)]
        });

        // Show location details and routing panel
        setShowLocationDetails(true);
        setShowRouting(true);
        setExpandedSearch(false);

        // Set height to 41vh for the modal
        const modalHeight = window.innerHeight * 0.41;
        setCurrentHeight(modalHeight);

        // Set flag to indicate this is a QR code entry
        setIsQrCodeEntry(true);
      }
    }
  }, [storedId, storedLat, storedLng, landmarkPlaces, intl]);


  const handlePlaceClick = (placeTitle, groupValue, subGroupValue) => {
    if (!geoData) return;

    let feature = geoData.features.find(
      f =>
        f.properties?.name === placeTitle ||
        f.properties?.subGroup === placeTitle ||
        (subGroupValue && f.properties?.subGroupValue === subGroupValue) ||
        f.properties?.subGroupValue === labelToValueMap[placeTitle]
    );

    if (!feature && groupValue) {
      feature = geoData.features.find(f => f.properties?.group === groupValue);
    }

    toast.error(intl.formatMessage({ id: 'noDataFound' }));
  };


  const eventsToShow = shrineEvents.length > 0
    ? shrineEvents
    : routingData?.places?.shrineEvents || [];

  const [isEventsModalOpen, setIsEventsModalOpen] = useState(false);
  const [activePlacesModal, setActivePlacesModal] = useState(null);

  const openEventsModal = () => {
    if (eventsToShow.length > 0) {
      setIsEventsModalOpen(true);
    }
  };

  const closeEventsModal = () => {
    setIsEventsModalOpen(false);
  };

  const openPlacesModal = (type) => {
    const places = routingData?.places?.[type];

    if (Array.isArray(places) && places.length > 0) {
      setActivePlacesModal(type);
    }
  };

  const closePlacesModal = () => {
    setActivePlacesModal(null);
  };

  const getPlacesForModal = () => {
    if (!routingData?.places) return [];

    switch (activePlacesModal) {
      case 'landmarkPlaces':
        return routingData.places.landmarkPlaces || [];
      case 'mostVisited':
        return routingData.places.mostVisited || [];
      case 'nearest':
        return routingData.places.nearest || [];
      default:
        return [];
    }
  };

  const getPlacesModalTitle = () => {
    switch (activePlacesModal) {
      case 'landmarkPlaces':
        return intl.formatMessage({ id: 'landmarkPlaces' });
      case 'mostVisited':
        return intl.formatMessage({ id: 'mostVisited' });
      case 'nearest':
        return intl.formatMessage({ id: 'nearMe' });
      default:
        return '';
    }
  };

  const handlePlaceNavigation = (place) => {
    navigate('/fs', { state: { place } });
  };

  const handleProfileClick = () => {
    if (accessToken && user) {
      navigate('/profile');
      return;
    }

    localStorage.setItem('profile_origin_page', location.pathname);
    navigate('/login');
  };

  return (
    <div className="map-routing-page">
      {/* Header */}
      <header className="map-routing-header">
        <button
          className="map-menu-button"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="icon icon-tabler icons-tabler-outline icon-tabler-menu-2"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M4 6l16 0" />
            <path d="M4 12l16 0" />
            <path d="M4 18l16 0" />
          </svg>
        </button>
        <h1 className="map-header-title">
          {intl.formatMessage({ id: 'mapRoutingTitle' })}
        </h1>
        <button className="map-profile-button" onClick={handleProfileClick}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9.99984" cy="5" r="3.33333" fill="#1E2023" />
            <ellipse cx="9.99984" cy="14.1667" rx="5.83333" ry="3.33333" fill="#1E2023" />
          </svg>
        </button>
      </header>

      {/* Categories Scroll */}
      <div className="map-categories-scroll">
        <div className="map-categories-list">
          {groups.map((category) => (
            <div
              key={category.value}
              className={`map-category-item ${selectedCategory && selectedCategory.value === category.value ? 'active' : ''}`}
              onClick={() => handleCategoryClick(category)}
            >
              <div className={`map-category-icon ${category.icon} ${selectedCategory && selectedCategory.value === category.value ? 'active' : ''}`}>
                <img src={category.png} alt={category.label} width="22" height="22" />
              </div>
              <span className={`map-category-name ${selectedCategory && selectedCategory.value === category.value ? 'active' : ''}`}>
                {getCategoryLabel(category.label)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className="map-routing-container">
        <Mpbc
          setUserLocation={setUserLocation}
          selectedDestination={null}
          onMapClick={handleMapClick}
          selectedCategory={selectedCategory}
          userLocation={userLocation}
          mapSelectedLocation={mapSelectedLocation}
          isTracking={isTracking}
          onUserMove={() => setIsTracking(false)}
          showImageMarkers={showImageMarkers}
          isQrCodeEntry={isQrCodeEntry}
          groups={groups}
          subGroups={subGroups}
          landmarkPlaces={landmarkPlaces}
          showMapStyleMenu={showMapStyleMenu}
          setShowMapStyleMenu={setShowMapStyleMenu}
          selectedMapType={selectedMapType}
          setSelectedMapType={setSelectedMapType}
        />
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
        <button
          className={`map-style-button-mpr ${showMapStyleMenu ? 'active' : ''}`}
          onClick={() => setShowMapStyleMenu(!showMapStyleMenu)}
          onBlur={() => {
            setTimeout(() => setShowMapStyleMenu(false), 200);
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13" />
            <path d="M9 4v13" />
            <path d="M15 7v13" />
          </svg>
        </button>

        {showMapStyleMenu && (
          <div className="map-style-menu-mpr">
            <div
              className={`map-style-option ${selectedMapType === 'base' ? 'active' : ''}`}
              onClick={() => {
                setSelectedMapType('base');
                setShowMapStyleMenu(false);
                console.log('Base map selected from map button');
              }}
            >
              <div className="map-style-radio">
                {selectedMapType === 'base' && <div className="map-radio-inner"></div>}
              </div>
              <span>{intl.formatMessage({ id: 'baseMap' })}</span>
            </div>

            <div
              className={`map-style-option ${selectedMapType === 'satellite' ? 'active' : ''}`}
              onClick={() => {
                setSelectedMapType('satellite');
                setShowMapStyleMenu(false);
                console.log('Satellite map selected from map button');
              }}
            >
              <div className="map-style-radio">
                {selectedMapType === 'satellite' && <div className="map-radio-inner"></div>}
              </div>
              <span>{intl.formatMessage({ id: 'satelliteMap' })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar with Integrated Routing */}
      <div
        className={`search-bar-container ${showRouting ? 'expanded' : ''} ${expandedSearch ? 'fully-expanded' : ''} ${isDragging ? 'dragging' : ''} ${isQrCodeEntry ? 'qr-code-entry' : ''}`}
        style={isDragging || isAutoExpanding ? { height: `${currentHeight}px`, transform: 'translateY(0)' } : {}}
      >
        <div
          className="search-bar-toggle"
          onClick={handleSearchToggle}
          onTouchStart={(e) => {
            // Prevent modal content drag when dragging the handle
            e.stopPropagation();
            handleTouchStart(e);
          }}
          onTouchMove={(e) => {
            e.stopPropagation();
            handleTouchMove(e);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleTouchEnd(e);
          }}
        >
          <div className="toggle-handle"></div>
        </div>
        <div
          className="modal-content-wrapper"
          onTouchStart={handleModalTouchStart}
          onTouchMove={handleModalTouchMove}
          onTouchEnd={handleModalTouchEnd}
        >
          <form className={`search-bar ${showRouting ? 'expanded' : ''}`}>
            <input
              type="text"
              placeholder={intl.formatMessage({ id: 'searchPlaceholder' })}
              onClick={(e) => {
                e.stopPropagation();
                navigate('/mpr');
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onBlur={handleSearchBlur}
              ref={searchInputRef}
            />
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M9.58342 2.29163C5.55634 2.29163 2.29175 5.55622 2.29175 9.58329C2.29175 13.6104 5.55634 16.875 9.58342 16.875C13.6105 16.875 16.8751 13.6104 16.8751 9.58329C16.8751 5.55622 13.6105 2.29163 9.58342 2.29163ZM1.04175 9.58329C1.04175 4.86586 4.86598 1.04163 9.58342 1.04163C14.3008 1.04163 18.1251 4.86586 18.1251 9.58329C18.1251 11.7171 17.3427 13.6681 16.0491 15.1651L18.7754 17.8914C19.0194 18.1354 19.0194 18.5312 18.7754 18.7752C18.5313 19.0193 18.1356 19.0193 17.8915 18.7752L15.1653 16.049C13.6682 17.3426 11.7172 18.125 9.58342 18.125C4.86598 18.125 1.04175 14.3007 1.04175 9.58329Z" fill="#1E2023" />
            </svg>


          </form>


          {showRouting && showLocationDetails && selectedLocation && (
            <div className="selected-location-section">
              <div className="selected-location-images">
                <div className="location-image-scroll">
                  {/* Handle both single image and multiple images */}
                  {Array.isArray(selectedLocation.img) ? (
                    // Multiple images - create scrollable list
                    selectedLocation.img.map((image, index) => (
                      <div
                        key={index}
                        className="location-main-image"
                        style={{ backgroundImage: `url(${image})` }}
                      ></div>
                    ))
                  ) : (
                    // Single image
                    <div
                      className="location-main-image"
                      style={{ backgroundImage: `url(${selectedLocation.img})` }}
                    ></div>
                  )}
                </div>
              </div>

              <div className="selected-location-info">
                <div className="location-details7">
                  <h2 className="selected-location-title">
                    {selectedLocation.label}
                  </h2>
                  {(isScannedQrLocation || selectedLocation.distance || selectedLocation.time) && (
                    <div className="location-meta7">
                      {isScannedQrLocation ? (
                        <span className="place-distance">{intl.formatMessage({ id: 'youAreHere' })}</span>
                      ) : (
                        <>
                          {selectedLocation.distance && (
                            <>
                              <span className="place-distance">{selectedLocation.distance} {intl.formatMessage({ id: 'meter' })}</span>
                              {selectedLocation.time && <span className="place-meta-separator">|</span>}
                            </>
                          )}
                          {selectedLocation.time && (
                            <span className="place-time">{selectedLocation.time} {intl.formatMessage({ id: 'walking' })}</span>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <div className="location-description">
                    <p>
                      {selectedLocation.description && selectedLocation.description.split(' ').length > 3
                        ? `${selectedLocation.description.split(' ').slice(0, 3).join(' ')} ...`
                        : selectedLocation.description
                      }
                    </p>
                    <button
                      className="cultural-info-btn"
                      onClick={handleCulturalInfo}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {intl.formatMessage({ id: 'moreCulturalInfo' })}
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M7.0203 3.64645C7.21556 3.84171 7.21556 4.15829 7.0203 4.35355L3.87385 7.5H13.3334C13.6096 7.5 13.8334 7.72386 13.8334 8C13.8334 8.27614 13.6096 8.5 13.3334 8.5H3.87385L7.0203 11.6464C7.21556 11.8417 7.21556 12.1583 7.0203 12.3536C6.82504 12.5488 6.50846 12.5488 6.31319 12.3536L2.31319 8.35355C2.11793 8.15829 2.11793 7.84171 2.31319 7.64645L6.31319 3.64645C6.50846 3.45118 6.82504 3.45118 7.0203 3.64645Z" fill="#0F71EF" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shrine Events */}
          {routingData && eventsToShow.length > 0 && (
            <div className="shrine-events-section">
              <div className="shrine-events-header">
                <h2 className="shrine-events-title">
                  {intl.formatMessage({ id: 'shrineEventsTitle' })}
                </h2>
                <button className="view-all-events" onClick={openEventsModal}>
                  {intl.formatMessage({ id: 'viewAll' })}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M15 6l-6 6l6 6" />
                  </svg>
                </button>
              </div>
              <div className="shrine-events-list">
                {eventsToShow.slice(0, 6).map((event, index) => (
                  <div key={index} className="shrine-event-item">
                    <div
                      className="place-image-placeholder"
                      style={{ backgroundImage: `url(${event.image})` }}
                    ></div>
                    <div className="place-info">
                      <h3 className="place-title">{event.title}</h3>
                      <p className="place-description">{event.description}</p>
                      <div className="place-info2">
                        <span className="place-address">
                          <svg width="24" height="24" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M10.2073 2.9087C9.5 3.53569 9.5 4.68259 9.5 6.9764V18.0236C9.5 20.3174 9.5 21.4643 10.2073 22.0913C10.9145 22.7183 11.9955 22.5297 14.1576 22.1526L16.4864 21.7465C18.8809 21.3288 20.0781 21.12 20.7891 20.2417C21.5 19.3635 21.5 18.0933 21.5 15.5529V9.44711C21.5 6.90671 21.5 5.63652 20.7891 4.75826C20.0781 3.87999 18.8809 3.67118 16.4864 3.25354L14.1576 2.84736C11.9955 2.47026 10.9145 2.28171 10.2073 2.9087ZM12.5 10.6686C12.9142 10.6686 13.25 11.02 13.25 11.4535V13.5465C13.25 13.98 12.9142 14.3314 12.5 14.3314C12.0858 14.3314 11.75 13.98 11.75 13.5465V11.4535C11.75 11.02 12.0858 10.6686 12.5 10.6686Z" fill="#1E2023" />
                            <path d="M8.04717 5C5.98889 5.003 4.91599 5.04826 4.23223 5.73202C3.5 6.46425 3.5 7.64276 3.5 9.99979V14.9998C3.5 17.3568 3.5 18.5353 4.23223 19.2676C4.91599 19.9513 5.98889 19.9966 8.04717 19.9996C7.99985 19.3763 7.99992 18.6557 8.00001 17.8768V7.1227C7.99992 6.34388 7.99985 5.6233 8.04717 5Z" fill="#1E2023" />
                          </svg>
                          {event.location}
                        </span>
                        <div className="place-meta">
                          <span className="shrine-event-time">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="black">
                              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                              <path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-5 2.66a1 1 0 0 0 -.993 .883l-.007 .117v5l.009 .131a1 1 0 0 0 .197 .477l.087 .1l3 3l.094 .082a1 1 0 0 0 1.226 0l.094 -.083l.083 -.094a1 1 0 0 0 0 -1.226l-.083 -.094l-2.707 -2.708v-4.585l-.007 -.117a1 1 0 0 0 -.993 -.883z" />
                            </svg>
                            {event.time}
                          </span>
                        </div>
                      </div>

                      <div className="place-actions">
                        <button className="place-action-btn" onClick={() => navigate('/fs')}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M11.092 2.581a1 1 0 0 1 1.754 -.116l.062 .116l8.005 17.365c.198 .566 .05 1.196 -.378 1.615a1.53 1.53 0 0 1 -1.459 .393l-7.077 -2.398l-6.899 2.338a1.535 1.535 0 0 1 -1.52 -.231l-.112 -.1c-.398 -.386 -.556 -.954 -.393 -1.556l.047 -.15l7.97 -17.276z" />
                          </svg>
                          {intl.formatMessage({ id: 'navigate' })}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {eventsToShow.length > 6 && (
                  <div className="view-more-places-container" onClick={openEventsModal}>
                    <div className="view-more-places">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M9 6l6 6l-6 6" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {isEventsModalOpen && (
            <div className="events-modal-overlay" onClick={closeEventsModal}>
              <div className="events-modal" onClick={(e) => e.stopPropagation()}>
                <div className="events-modal-header">
                  <h3>{intl.formatMessage({ id: 'shrineEventsTitle' })}</h3>
                  <button className="close-modal-btn" onClick={closeEventsModal}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-x"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="events-modal-content">
                  {eventsToShow.map((event, index) => (
                    <div key={index} className="events-modal-item">
                      <div className="events-modal-image" style={{ backgroundImage: `url(${event.image})` }} />
                      <div className="events-modal-info">
                        <h4>{event.title}</h4>
                        <p>{event.description}</p>
                        <div className="events-modal-meta">
                          <span>{event.location}</span>
                          <span className="modal-meta-divider">•</span>
                          <span>{event.time}</span>
                        </div>
                        <div className="events-modal-actions">
                          <button
                            className="place-action-btn events-modal-nav-btn"
                            onClick={() => navigate('/fs')}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                              <path d="M11.092 2.581a1 1 0 0 1 1.754 -.116l.062 .116l8.005 17.365c.198 .566 .05 1.196 -.378 1.615a1.53 1.53 0 0 1 -1.459 .393l-7.077 -2.398l-6.899 2.338a1.535 1.535 0 0 1 -1.52 -.231l-.112 -.1c-.398 -.386 -.556 -.954 -.393 -1.556l.047 -.15l7.97 -17.276z" />
                            </svg>
                            {intl.formatMessage({ id: 'navigate' })}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activePlacesModal && (
            <div className="events-modal-overlay" onClick={closePlacesModal}>
              <div className="events-modal" onClick={(e) => e.stopPropagation()}>
                <div className="events-modal-header">
                  <h3>{getPlacesModalTitle()}</h3>
                  <button className="close-modal-btn-mpb" onClick={closePlacesModal}>
                    &times;
                  </button>
                </div>
                <div className="events-modal-content">
                  {getPlacesForModal().map((place, index) => (
                    <div key={`${activePlacesModal}-${index}`} className="events-modal-item">
                      <div
                        className="events-modal-image"
                        style={place.image ? { backgroundImage: `url(${place.image})` } : {}}
                      />
                      <div className="events-modal-info">
                        <h4>{place.title}</h4>
                        {place.description && <p>{place.description}</p>}
                        {(place.distance != null || place.time != null) && (
                          <div className="events-modal-meta">
                            {place.distance != null && (
                              <span>
                                {place.distance} {intl.formatMessage({ id: 'meter' })}
                              </span>
                            )}
                            {place.distance != null && place.time != null && (
                              <span className="modal-meta-divider">•</span>
                            )}
                            {place.time != null && (
                              <span>
                                {place.time} {intl.formatMessage({ id: 'walking' })}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="events-modal-actions">
                          <button
                            className="place-action-btn events-modal-nav-btn"
                            onClick={() => handlePlaceNavigation(place)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                              <path d="M11.092 2.581a1 1 0 0 1 1.754 -.116l.062 .116l8.005 17.365c.198 .566 .05 1.196 -.378 1.615a1.53 1.53 0 0 1 -1.459 .393l-7.077 -2.398l-6.899 2.338a1.535 1.535 0 0 1 -1.52 -.231l-.112 -.1c-.398 -.386 -.556 -.954 -.393 -1.556l.047 -.15l7.97 -17.276z" />
                            </svg>
                            {intl.formatMessage({ id: 'navigate' })}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Landmarks */}
          {routingData && (
            <div className="routing-places-section">
              <div className="section-header">
                <h2 className="section-title6">
                  {intl.formatMessage({ id: 'landmarkPlaces' })}
                </h2>
                <button className="view-all-btn5" onClick={() => openPlacesModal('landmarkPlaces')}>
                  {intl.formatMessage({ id: 'viewAll' })}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M15 6l-6 6l6 6" />
                  </svg>
                </button>
              </div>
              <div className="places-horizontal-list">
                {routingData.places.landmarkPlaces.slice(0, 6).map((place, index) => (
                  <div key={index} className="place-card">
                    <div className="image-container">
                      <div
                        className="place-image"
                        style={place.image ? { backgroundImage: `url(${place.image})` } : {}}
                      ></div>
                      <button className="transparent-save-btn">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7.5 4.37508C7.15482 4.37508 6.875 4.6549 6.875 5.00008C6.875 5.34526 7.15482 5.62508 7.5 5.62508H12.5C12.8452 5.62508 13.125 5.34526 13.125 5.00008C13.125 4.6549 12.8452 4.37508 12.5 4.37508H7.5Z" fill="black" />
                          <path fillRule="evenodd" clipRule="evenodd" d="M9.95209 1.04175C8.22495 1.04174 6.8643 1.04173 5.80107 1.18622C4.70935 1.33459 3.83841 1.64565 3.15403 2.33745C2.47058 3.02831 2.1641 3.90593 2.01775 5.00626C1.87498 6.07967 1.87499 7.45393 1.875 9.20097V13.4493C1.87499 14.7056 1.87498 15.7002 1.95501 16.4491C2.03409 17.1891 2.20373 17.8568 2.6882 18.3033C3.07688 18.6615 3.56842 18.8873 4.09304 18.9473C4.74927 19.0224 5.36199 18.7091 5.96557 18.2815C6.57636 17.8489 7.3173 17.1935 8.25212 16.3667L8.28254 16.3398C8.71593 15.9564 9.00935 15.6978 9.25416 15.5187C9.49076 15.3457 9.63522 15.2832 9.75698 15.2587C9.91743 15.2263 10.0826 15.2263 10.243 15.2587C10.3648 15.2832 10.5092 15.3457 10.7458 15.5187C10.9906 15.6978 11.2841 15.9564 11.7175 16.3398L11.7479 16.3667C12.6827 17.1935 13.4237 17.8489 14.0344 18.2815C14.638 18.7091 15.2507 19.0224 15.907 18.9473C16.4316 18.8873 16.9231 18.6615 17.3118 18.3033C17.7963 17.8568 17.9659 17.1891 18.045 16.4491C18.125 15.7002 18.125 14.7056 18.125 13.4493V9.20095C18.125 7.45393 18.125 6.07966 17.9823 5.00626C17.8359 3.90593 17.5294 3.02831 16.846 2.33745C16.1616 1.64565 15.2907 1.33459 14.1989 1.18622C13.1357 1.04173 11.7751 1.04174 10.0479 1.04175H9.95209ZM4.04267 3.21655C4.45664 2.7981 5.01876 2.55403 5.9694 2.42484C6.93871 2.2931 8.21438 2.29175 10 2.29175C11.7856 2.29175 13.0613 2.2931 14.0306 2.42484C14.9812 2.55403 15.5434 2.7981 15.9573 3.21655C16.3722 3.63594 16.6149 4.20691 16.7432 5.17106C16.8737 6.15251 16.875 7.44361 16.875 9.24801V13.4092C16.875 14.7144 16.8741 15.6419 16.8021 16.3163C16.7282 17.0074 16.592 17.2668 16.4647 17.3841C16.2699 17.5636 16.0248 17.6757 15.7649 17.7054C15.5985 17.7245 15.3196 17.66 14.757 17.2615C14.2081 16.8727 13.5176 16.2632 12.5456 15.4035L12.5238 15.3842C12.1177 15.025 11.781 14.7271 11.4837 14.5097C11.1728 14.2824 10.8594 14.1077 10.4899 14.0333C10.1665 13.9681 9.83352 13.9681 9.51015 14.0333C9.14064 14.1077 8.82715 14.2824 8.51633 14.5097C8.21902 14.7271 7.88226 15.025 7.47621 15.3842L7.45439 15.4035C6.48239 16.2632 5.79189 16.8727 5.24304 17.2615C4.68038 17.66 4.40151 17.7245 4.23515 17.7054C3.97516 17.6757 3.73014 17.5636 3.53531 17.3841C3.40803 17.2668 3.27179 17.0074 3.19793 16.3163C3.12587 15.6419 3.125 14.7144 3.125 13.4092V9.24801C3.125 7.44361 3.1263 6.15251 3.25684 5.17106C3.38508 4.20691 3.62777 3.63594 4.04267 3.21655Z" fill="black" />
                        </svg>
                      </button>
                    </div>
                    <div className="place-details">
                      <h4 className="place-name">{place.title}</h4>
                      {(place.distance != null || place.time != null) && (
                        <div className="place-meta">
                          {place.distance != null && (
                            <span className="place-distance">{place.distance} {intl.formatMessage({ id: 'meter' })}</span>
                          )}
                          {place.distance != null && place.time != null && (
                            <span className="place-meta-separator">|</span>
                          )}
                          {place.time != null && (
                            <span className="place-time">{place.time} {intl.formatMessage({ id: 'walking' })}</span>
                          )}
                        </div>
                      )}
                      <div className="place-rating-section">
                        <div className="place-rating-stars">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={star <= Math.round(place.rating) ? 'filled' : ''}
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
                        <span className="place-views">( {place.views} {intl.formatMessage({ id: 'commentsLabel' })})</span>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Show scroll arrow button if there are more than 6 landmarks */}
                {routingData.places.landmarkPlaces.length > 6 && (
                  <div className="view-more-places-container" onClick={() => openPlacesModal('landmarkPlaces')}>
                    <div className="view-more-places">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M9 6l6 6l-6 6" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Most visited places*/}
          {routingData && (
            <div className="routing-places-section">
              <div className="section-header">
                <h2 className="section-title6">
                  {intl.formatMessage({ id: 'mostVisited' })}
                </h2>
                <button className="view-all-btn5" onClick={() => openPlacesModal('mostVisited')}>
                  {intl.formatMessage({ id: 'viewAll' })}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M15 6l-6 6l6 6" />
                  </svg>
                </button>
              </div>
              <div className="places-horizontal-list">
                {routingData.places.mostVisited.slice(0, 6).map((place, index) => (
                  <div key={index} className="place-card">
                    <div className="image-container">
                      <div
                        className="place-image"
                        style={{ backgroundImage: `url(${place.image})` }}
                      ></div>
                      <button className="transparent-save-btn">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7.5 4.37508C7.15482 4.37508 6.875 4.6549 6.875 5.00008C6.875 5.34526 7.15482 5.62508 7.5 5.62508H12.5C12.8452 5.62508 13.125 5.34526 13.125 5.00008C13.125 4.6549 12.8452 4.37508 12.5 4.37508H7.5Z" fill="black" />
                          <path fillRule="evenodd" clipRule="evenodd" d="M9.95209 1.04175C8.22495 1.04174 6.8643 1.04173 5.80107 1.18622C4.70935 1.33459 3.83841 1.64565 3.15403 2.33745C2.47058 3.02831 2.1641 3.90593 2.01775 5.00626C1.87498 6.07967 1.87499 7.45393 1.875 9.20097V13.4493C1.87499 14.7056 1.87498 15.7002 1.95501 16.4491C2.03409 17.1891 2.20373 17.8568 2.6882 18.3033C3.07688 18.6615 3.56842 18.8873 4.09304 18.9473C4.74927 19.0224 5.36199 18.7091 5.96557 18.2815C6.57636 17.8489 7.3173 17.1935 8.25212 16.3667L8.28254 16.3398C8.71593 15.9564 9.00935 15.6978 9.25416 15.5187C9.49076 15.3457 9.63522 15.2832 9.75698 15.2587C9.91743 15.2263 10.0826 15.2263 10.243 15.2587C10.3648 15.2832 10.5092 15.3457 10.7458 15.5187C10.9906 15.6978 11.2841 15.9564 11.7175 16.3398L11.7479 16.3667C12.6827 17.1935 13.4237 17.8489 14.0344 18.2815C14.638 18.7091 15.2507 19.0224 15.907 18.9473C16.4316 18.8873 16.9231 18.6615 17.3118 18.3033C17.7963 17.8568 17.9659 17.1891 18.045 16.4491C18.125 15.7002 18.125 14.7056 18.125 13.4493V9.20095C18.125 7.45393 18.125 6.07966 17.9823 5.00626C17.8359 3.90593 17.5294 3.02831 16.846 2.33745C16.1616 1.64565 15.2907 1.33459 14.1989 1.18622C13.1357 1.04173 11.7751 1.04174 10.0479 1.04175H9.95209ZM4.04267 3.21655C4.45664 2.7981 5.01876 2.55403 5.9694 2.42484C6.93871 2.2931 8.21438 2.29175 10 2.29175C11.7856 2.29175 13.0613 2.2931 14.0306 2.42484C14.9812 2.55403 15.5434 2.7981 15.9573 3.21655C16.3722 3.63594 16.6149 4.20691 16.7432 5.17106C16.8737 6.15251 16.875 7.44361 16.875 9.24801V13.4092C16.875 14.7144 16.8741 15.6419 16.8021 16.3163C16.7282 17.0074 16.592 17.2668 16.4647 17.3841C16.2699 17.5636 16.0248 17.6757 15.7649 17.7054C15.5985 17.7245 15.3196 17.66 14.757 17.2615C14.2081 16.8727 13.5176 16.2632 12.5456 15.4035L12.5238 15.3842C12.1177 15.025 11.781 14.7271 11.4837 14.5097C11.1728 14.2824 10.8594 14.1077 10.4899 14.0333C10.1665 13.9681 9.83352 13.9681 9.51015 14.0333C9.14064 14.1077 8.82715 14.2824 8.51633 14.5097C8.21902 14.7271 7.88226 15.025 7.47621 15.3842L7.45439 15.4035C6.48239 16.2632 5.79189 16.8727 5.24304 17.2615C4.68038 17.66 4.40151 17.7245 4.23515 17.7054C3.97516 17.6757 3.73014 17.5636 3.53531 17.3841C3.40803 17.2668 3.27179 17.0074 3.19793 16.3163C3.12587 15.6419 3.125 14.7144 3.125 13.4092V9.24801C3.125 7.44361 3.1263 6.15251 3.25684 5.17106C3.38508 4.20691 3.62777 3.63594 4.04267 3.21655Z" fill="black" />
                        </svg>
                      </button>
                    </div>
                    <div className="place-details">
                      <h4 className="place-name">{place.title}</h4>
                      <div className="place-meta">
                        <span className="place-distance">{place.distance} {intl.formatMessage({ id: 'meter' })}</span>
                        <span className="place-meta-separator">|</span>
                        <span className="place-time">{place.time} {intl.formatMessage({ id: 'walking' })}</span>
                      </div>
                      <div className="place-rating-section">
                        <div className="place-rating-stars">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={star <= Math.round(place.rating) ? 'filled' : ''}
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
                        <span className="place-views">( {place.views} {intl.formatMessage({ id: 'commentsLabel' })})</span>
                      </div>
                    </div>
                  </div>
                ))}
                {routingData.places.mostVisited.length > 6 && (
                  <div className="view-more-places-container" onClick={() => openPlacesModal('mostVisited')}>
                    <div className="view-more-places">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M9 6l6 6l-6 6" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Nearest Places*/}
          {routingData && (
            <div className="routing-places-section">
              <div className="section-header">
                <h2 className="section-title6">
                  {intl.formatMessage({ id: 'nearMe' })}
                </h2>
                <button className="view-all-btn5" onClick={() => openPlacesModal('nearest')}>
                  {intl.formatMessage({ id: 'viewAll' })}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M15 6l-6 6l6 6" />
                  </svg>
                </button>
              </div>
              <div className="places-horizontal-list">
                {routingData.places.nearest.slice(0, 6).map((place, index) => (
                  <div key={index} className="place-card">
                    <div className="image-container">
                      <div
                        className="place-image"
                        style={{ backgroundImage: `url(${place.image})` }}
                      ></div>
                      <button className="transparent-save-btn">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7.5 4.37508C7.15482 4.37508 6.875 4.6549 6.875 5.00008C6.875 5.34526 7.15482 5.62508 7.5 5.62508H12.5C12.8452 5.62508 13.125 5.34526 13.125 5.00008C13.125 4.6549 12.8452 4.37508 12.5 4.37508H7.5Z" fill="black" />
                          <path fillRule="evenodd" clipRule="evenodd" d="M9.95209 1.04175C8.22495 1.04174 6.8643 1.04173 5.80107 1.18622C4.70935 1.33459 3.83841 1.64565 3.15403 2.33745C2.47058 3.02831 2.1641 3.90593 2.01775 5.00626C1.87498 6.07967 1.87499 7.45393 1.875 9.20097V13.4493C1.87499 14.7056 1.87498 15.7002 1.95501 16.4491C2.03409 17.1891 2.20373 17.8568 2.6882 18.3033C3.07688 18.6615 3.56842 18.8873 4.09304 18.9473C4.74927 19.0224 5.36199 18.7091 5.96557 18.2815C6.57636 17.8489 7.3173 17.1935 8.25212 16.3667L8.28254 16.3398C8.71593 15.9564 9.00935 15.6978 9.25416 15.5187C9.49076 15.3457 9.63522 15.2832 9.75698 15.2587C9.91743 15.2263 10.0826 15.2263 10.243 15.2587C10.3648 15.2832 10.5092 15.3457 10.7458 15.5187C10.9906 15.6978 11.2841 15.9564 11.7175 16.3398L11.7479 16.3667C12.6827 17.1935 13.4237 17.8489 14.0344 18.2815C14.638 18.7091 15.2507 19.0224 15.907 18.9473C16.4316 18.8873 16.9231 18.6615 17.3118 18.3033C17.7963 17.8568 17.9659 17.1891 18.045 16.4491C18.125 15.7002 18.125 14.7056 18.125 13.4493V9.20095C18.125 7.45393 18.125 6.07966 17.9823 5.00626C17.8359 3.90593 17.5294 3.02831 16.846 2.33745C16.1616 1.64565 15.2907 1.33459 14.1989 1.18622C13.1357 1.04173 11.7751 1.04174 10.0479 1.04175H9.95209ZM4.04267 3.21655C4.45664 2.7981 5.01876 2.55403 5.9694 2.42484C6.93871 2.2931 8.21438 2.29175 10 2.29175C11.7856 2.29175 13.0613 2.2931 14.0306 2.42484C14.9812 2.55403 15.5434 2.7981 15.9573 3.21655C16.3722 3.63594 16.6149 4.20691 16.7432 5.17106C16.8737 6.15251 16.875 7.44361 16.875 9.24801V13.4092C16.875 14.7144 16.8741 15.6419 16.8021 16.3163C16.7282 17.0074 16.592 17.2668 16.4647 17.3841C16.2699 17.5636 16.0248 17.6757 15.7649 17.7054C15.5985 17.7245 15.3196 17.66 14.757 17.2615C14.2081 16.8727 13.5176 16.2632 12.5456 15.4035L12.5238 15.3842C12.1177 15.025 11.781 14.7271 11.4837 14.5097C11.1728 14.2824 10.8594 14.1077 10.4899 14.0333C10.1665 13.9681 9.83352 13.9681 9.51015 14.0333C9.14064 14.1077 8.82715 14.2824 8.51633 14.5097C8.21902 14.7271 7.88226 15.025 7.47621 15.3842L7.45439 15.4035C6.48239 16.2632 5.79189 16.8727 5.24304 17.2615C4.68038 17.66 4.40151 17.7245 4.23515 17.7054C3.97516 17.6757 3.73014 17.5636 3.53531 17.3841C3.40803 17.2668 3.27179 17.0074 3.19793 16.3163C3.12587 15.6419 3.125 14.7144 3.125 13.4092V9.24801C3.125 7.44361 3.1263 6.15251 3.25684 5.17106C3.38508 4.20691 3.62777 3.63594 4.04267 3.21655Z" fill="black" />
                        </svg>
                      </button>
                    </div>
                    <div className="place-details">
                      <h4 className="place-name">{place.title}</h4>
                      <div className="place-meta">
                        <span className="place-distance">{place.distance} {intl.formatMessage({ id: 'meter' })}</span>
                        <span className="place-meta-separator">|</span>
                        <span className="place-time">{place.time} {intl.formatMessage({ id: 'walking' })}</span>
                      </div>
                      <div className="place-rating-section">
                        <div className="place-rating-stars">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={star <= Math.round(place.rating) ? 'filled' : ''}
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
                        <span className="place-views">( {place.views} {intl.formatMessage({ id: 'commentsLabel' })})</span>
                      </div>
                    </div>
                  </div>
                ))}
                {routingData.places.nearest.length > 6 && (
                  <div className="view-more-places-container" onClick={() => openPlacesModal('nearest')}>
                    <div className="view-more-places">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M9 6l6 6l-6 6" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}>
          <div className="sidebar-container" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <h3 className="sidebar-title">{intl.formatMessage({ id: 'menu' })}</h3>
              <button
                className="sidebar-close-btn"
                onClick={() => setIsSidebarOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M18 6l-12 12" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="sidebar-content">
              <div className={`sidebar-menu-item ${isMapTypeOpen ? 'expanded' : ''}`}>
                <div
                  className="sidebar-menu-main"
                  onClick={() => setIsMapTypeOpen(!isMapTypeOpen)}
                >
                  <span className="menu-item-text">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13" />
                      <path d="M9 4v13" />
                      <path d="M15 7v13" />
                    </svg>
                    {intl.formatMessage({ id: 'mapType' })}
                  </span>
                  <svg
                    className={`menu-arrow ${isMapTypeOpen ? 'open' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M6 9l6 6l6 -6" />
                  </svg>
                </div>

                {isMapTypeOpen && (
                  <div className="sidebar-submenu">
                    <div
                      className={`submenu-item ${selectedMapType === 'base' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMapType('base');
                        console.log('Base map selected');
                      }}
                    >
                      <div className="submenu-radio">
                        {selectedMapType === 'base' && <div className="radio-inner"></div>}
                      </div>
                      <span className="submenu-text">{intl.formatMessage({ id: 'baseMap' })}</span>
                    </div>

                    <div
                      className={`submenu-item ${selectedMapType === 'satellite' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMapType('satellite');
                        console.log('Satellite map selected');
                      }}
                    >
                      <div className="submenu-radio">
                        {selectedMapType === 'satellite' && <div className="radio-inner"></div>}
                      </div>
                      <span className="submenu-text">{intl.formatMessage({ id: 'satelliteMap' })}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapBeginPage; 
