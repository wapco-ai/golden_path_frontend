// src/pages/Amain.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'react-toastify';
import '../AdminPanel/Amain.css';
import logo from '../assets/images/logo2.png';
import 'react-datepicker/dist/react-datepicker.css';
import { toJalaali, toGregorian } from 'jalaali-js';
import ReactDatePicker from 'react-datepicker';
import maplibregl from 'maplibre-gl';
import { offlineFallbackStyle } from '../services/osmMapStyle';
import 'maplibre-gl/dist/maplibre-gl.css';
import PagesManage from './PagesManage';
import Reviews from './Reviews';
import Feedbacks from './Feedbacks';
import Admins from './Admins';
import Usersigned from './Usersigned';
import Userlogs from './Userlogs';

import { booleanValid as turfBooleanValid, centroid as turfCentroid, distance as turfDistance } from '@turf/turf';
import {
  createCulturalItem,
  deleteCulturalItem,
  exportCulturalItems,
  fetchCulturalItemDetails,
  fetchCulturalItems,
  updateCulturalItem
} from '../services/culturalItemsService';
import { ADMIN_ACCESS_TOKEN_KEY, useAdminAuthStore } from '../auth/admin/adminAuthStore';
import { initHaramVectorLayers } from '../utils/initVectorLayers';
import {
  DOOR_ACCESS_LAYER_ID,
  DOORS_ACCESS_POINT_LAYER_NAME,
  DEFAULT_TILE_LANG,
  createHaramAdminVectorTileConfig,
  layerEditSettings
} from '../config/vectorTiles';
import { getSessionFloor, setSessionFloor, subscribeToSessionFloor } from '../utils/sessionFloor';
import { createDoor, deleteDoor, getDoorInfo, moveDoor, updateDoorInfo } from '../services/adminDoorsService';
import { deleteArea, getAreaInfo, moveArea, updateAreaInfo } from '../services/adminAreasService';
import { convertLngLatToUtm32640 } from '../utils/utm';
import { fetchGroupMetadata, fetchSubGroups } from '../services/groupService';
import appConfig from '../config/appConfig';
import { normalizeGroupMetadata, normalizeSubGroupMetadata } from '../utils/groupMetadata';
import { getLanguageName } from '../utils/languageNames';
import { deleteFile, uploadFile } from '../services/fileService';
import { createVanEdge, createVanNode, deleteVanNode } from '../services/adminVanService';
import {
  createTempBlockArea,
  updateTempBlockArea,
  deleteTempBlockArea,
  getTempBlockArea,
  stopTempBlockArea,
  extendTempBlockArea
} from '../services/tempBlockAreasService';
import {
  fetchDashboardSummary,
  fetchDashboardUserVisits,
  fetchDashboardCommentStats,
  fetchDashboardNotifications,
  fetchDashboardRecentUsers
} from '../services/adminDashboardService';

function ensureRtlOnce() {
  if (window.__RTL_PLUGIN_SET__) return;
  window.__RTL_PLUGIN_SET__ = true;
  maplibregl.setRTLTextPlugin("/rtl/mapbox-gl-rtl-text.js", null, true);
}

const DOOR_ACCESS_SOURCE_ID = DOORS_ACCESS_POINT_LAYER_NAME;
const SELECTED_EDITABLE_FEATURE_SOURCE_ID = 'selected-editable-feature-source';
const SELECTED_EDITABLE_FEATURE_LAYER_ID = 'selected-editable-feature-layer';
const SELECTED_EDITABLE_FEATURE_LINE_LAYER_ID = 'selected-editable-feature-line';
const SELECTED_EDITABLE_FEATURE_FILL_LAYER_ID = 'selected-editable-feature-fill';
const VAN_DRAW_SOURCE_ID = 'van-draw-source';
const VAN_DRAW_LINE_LAYER_ID = 'van-draw-line-layer';
const VAN_DRAW_POINT_LAYER_ID = 'van-draw-point-layer';
const TEMP_AREA_DRAW_SOURCE_ID = 'temp-area-draw-source';
const TEMP_AREA_DRAW_FILL_LAYER_ID = 'temp-area-draw-fill-layer';
const TEMP_AREA_DRAW_LINE_LAYER_ID = 'temp-area-draw-line-layer';
const TEMP_AREA_DRAW_POINT_LAYER_ID = 'temp-area-draw-point-layer';
const TEMP_AREA_FLOW_STATES = {
  idle: 'idle',
  drawing: 'drawing',
  readyToSave: 'readyToSave',
  editing: 'editing'
};

const getApiErrorMessage = (error, fallbackMessage = '') => error?.response?.data?.message
  || error?.response?.data?.errors?.operational?.is_covered?.[0]
  || error?.message
  || fallbackMessage;

const DASHBOARD_RANGE_MAP = {
  'هفته اخیر': 'week',
  'ماه اخیر': 'month',
  'سه ماه اخیر': 'quarter',
  'سال اخیر': 'year'
};

const mapTimeFilterToRange = (label) => DASHBOARD_RANGE_MAP[label] || 'week';

const mapCommentFilterToRange = (label) => {
  if (label === 'امروز') {
    return 'week';
  }

  return mapTimeFilterToRange(label);
};

const buildYAxisLabelsFromMax = (maxValue) => {
  const numericMax = Number(maxValue) || 0;
  if (numericMax <= 0) {
    return [];
  }

  const step = Math.max(1, Math.ceil(numericMax / 5));
  const labels = [];
  for (let value = step * 5; value >= 0; value -= step) {
    labels.push(value);
    if (labels.length >= 6 && value <= 0) break;
  }

  if (labels[labels.length - 1] !== 0) {
    labels.push(0);
  }

  return labels;
};

const formatNumberFa = (value) => {
  if (value === null || value === undefined) return '۰';

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return numericValue.toLocaleString('fa-IR');
};

const formatDateTimeString = (value) => {
  if (!value) return '';

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('fa-IR');
  }

  return value;
};

const GENDER_OPTIONS = [
  { value: 'female', label: 'بانوان' },
  { value: 'male', label: 'مردان' },
  { value: 'both', label: 'خانوادگی' }
];

const GENDER_VALUE_MAP = {
  male: 'male',
  'مرد': 'male',
  'مردان': 'male',
  'مردانه': 'male',
  female: 'female',
  'زن': 'female',
  'زنان': 'female',
  'زنانه': 'female',
  both: 'both',
  'خانواده': 'both',
  'خانوادگی': 'both'
};

const TRANSPORT_OPTIONS = [
  { value: 'wheelchair', label: 'ویلچر', icon: 'wheelchair' },
  { value: 'van', label: 'ون برقی', icon: 'electric' },
  { value: 'walk', label: 'به صورت پیاده', icon: 'walking' }
];

const PLACE_TYPE_OPTIONS = [
  { value: 'ziyarati', label: 'زیارتی' },
  { value: 'farhangi', label: 'فرهنگی' },
  { value: 'khadamati', label: 'خدماتی' },
  { value: 'tarikhi', label: 'تاریخی' },
  { value: 'memari', label: 'معماری' }
];

const getGenderLabel = (value) => GENDER_OPTIONS.find((option) => option.value === value)?.label || value;
const normalizeGenderValue = (value) => {
  if (!value) return value;

  const normalized = String(value).trim().toLowerCase();
  if (GENDER_VALUE_MAP[normalized]) {
    return GENDER_VALUE_MAP[normalized];
  }

  return GENDER_OPTIONS.find((option) => option.value === value)?.value
    || GENDER_OPTIONS.find((option) => option.label === value)?.value
    || value;
};

const getTransportLabel = (value) => TRANSPORT_OPTIONS.find((option) => option.value === value)?.label || value;
const normalizeTransportValue = (value) => TRANSPORT_OPTIONS.find((option) => option.value === value)?.value
  || TRANSPORT_OPTIONS.find((option) => option.label === value)?.value
  || value;

const placeTypeLabelToValue = (label) => PLACE_TYPE_OPTIONS.find((option) => option.label === label)?.value || '';
const placeTypeValueToLabel = (value) => PLACE_TYPE_OPTIONS.find((option) => option.value === value)?.label || '';

const PRAYER_EVENT_OPTIONS = [
  { value: 'fajr', label: 'نماز صبح' },
  { value: 'dhuhr', label: 'نماز ظهر و عصر' },
  { value: 'maghrib', label: 'نماز مغرب و عشاء' }
];

const prayerEventLabelToValue = (label) => PRAYER_EVENT_OPTIONS.find((option) => option.label === label)?.value || label;
const prayerEventValueToLabel = (value) => PRAYER_EVENT_OPTIONS.find((option) => option.value === value)?.label || value;
const normalizePrayerEventValue = (value) => {
  const cleaned = (value || '').toString().trim();
  const lower = cleaned.toLowerCase();

  if (!cleaned) return '';
  if (['dhuhr', 'asr', 'dhuhr_asr'].includes(lower)) return 'dhuhr';
  if (['maghrib', 'isha', 'maghrib_isha'].includes(lower)) return 'maghrib';
  if (lower === 'fajr') return 'fajr';

  return prayerEventLabelToValue(cleaned);
};
const normalizePrayerEvents = (events = []) => {
  if (typeof events === 'string') {
    const cleaned = events.trim().replace(/^\{/, '').replace(/\}$/u, '');
    const splitEvents = cleaned
      ? cleaned.split(',').map((event) => event.trim()).filter(Boolean)
      : [];

    return splitEvents.map(normalizePrayerEventValue).filter(Boolean);
  }

  const eventArray = Array.isArray(events)
    ? events
    : (events ? [events] : []);

  return eventArray.map(normalizePrayerEventValue).filter(Boolean);
};

const basePath = (import.meta?.env?.BASE_URL || '/').replace(/\/$/, '');
const withBasePath = (path) => {
  if (!path || /^https?:\/\//i.test(path)) {
    return path;
  }

  if (!basePath) {
    return path;
  }

  if (path === basePath || path.startsWith(`${basePath}/`)) {
    return path;
  }

  return `${basePath}${path.startsWith('/') ? path : `/${path}`}`;
};

const isPlainIconName = (value) => typeof value === 'string'
  && value !== ''
  && !value.includes('/')
  && !/^https?:\/\//i.test(value);

const buildIconUrl = (value) => {
  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return withBasePath(value);
  }

  return withBasePath(`/assets/icons/${value}`);
};

const resolveCategoryIcon = (category) => (
  category?.meta?.iconRaw
  || category?.meta?.icon
  || category?.image
  || category?.icon
  || ''
);

const buildPrayerRulesPayload = (selectedEvents, beforeValue, afterValue) => {
  const before = Number.isFinite(Number(beforeValue)) ? Number(beforeValue) : 0;
  const after = Number.isFinite(Number(afterValue)) ? Number(afterValue) : 0;

  return PRAYER_EVENT_OPTIONS.reduce((rules, option) => {
    rules[option.value] = {
      enabled: selectedEvents.includes(option.value),
      before,
      after
    };

    return rules;
  }, {});
};

const normalizePrayerRules = (prayerRules = {}) => {
  const enabledEvents = [];
  let before = '';
  let after = '';

  PRAYER_EVENT_OPTIONS.forEach((option) => {
    const rule = prayerRules?.[option.value];

    if (rule?.enabled) {
      enabledEvents.push(option.value);

      if (before === '' && rule?.before !== undefined && rule?.before !== null) {
        before = String(rule.before);
      }

      if (after === '' && rule?.after !== undefined && rule?.after !== null) {
        after = String(rule.after);
      }
    }
  });

  return {
    events: enabledEvents,
    before,
    after
  };
};

const extractPrayerRulesFromRestrictions = (restrictions = []) => {
  const events = new Set();
  let before = '';
  let after = '';

  restrictions.forEach((item) => {
    const normalizedEvent = normalizePrayerEventValue(item?.prayer_event || item?.events || item?.event);

    if (normalizedEvent) {
      events.add(normalizedEvent);
    }

    if (before === '' && item?.before_minutes !== undefined && item?.before_minutes !== null) {
      before = String(item.before_minutes);
    }

    if (after === '' && item?.after_minutes !== undefined && item?.after_minutes !== null) {
      after = String(item.after_minutes);
    }
  });

  return {
    events: Array.from(events),
    before,
    after
  };
};

const parseGeoJsonGeometry = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed?.type && parsed?.coordinates ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  if (typeof value === 'object' && value?.type && value?.coordinates) {
    return value;
  }

  return null;
};

const mergePrayerRulesFromSource = (prayerRules = {}, restrictions = []) => {
  const mergedRules = PRAYER_EVENT_OPTIONS.reduce((rules, option) => {
    rules[option.value] = { enabled: false, before: 0, after: 0 };
    return rules;
  }, {});

  Object.entries(prayerRules || {}).forEach(([key, value]) => {
    const normalizedKey = normalizePrayerEventValue(key);
    if (!mergedRules[normalizedKey]) return;

    mergedRules[normalizedKey] = {
      enabled: Boolean(value?.enabled),
      before: Number.isFinite(Number(value?.before)) ? Number(value.before) : 0,
      after: Number.isFinite(Number(value?.after)) ? Number(value.after) : 0
    };
  });

  (restrictions || []).forEach((item) => {
    const normalizedKey = normalizePrayerEventValue(item?.prayer_event || item?.event);
    if (!mergedRules[normalizedKey]) return;

    mergedRules[normalizedKey] = {
      enabled: true,
      before: Number.isFinite(Number(item?.before_minutes)) ? Number(item.before_minutes) : 0,
      after: Number.isFinite(Number(item?.after_minutes)) ? Number(item.after_minutes) : 0
    };
  });

  return mergedRules;
};

const convertPrayerRulesToState = (prayerRules = {}) => {
  const enabledEvents = [];
  let before = '';
  let after = '';

  PRAYER_EVENT_OPTIONS.forEach((option) => {
    const rule = prayerRules[option.value];

    if (rule?.enabled) {
      enabledEvents.push(option.value);

      if (before === '' && rule?.before !== undefined && rule?.before !== null) {
        before = String(rule.before);
      }

      if (after === '' && rule?.after !== undefined && rule?.after !== null) {
        after = String(rule.after);
      }
    }
  });

  return { events: enabledEvents, before, after };
};

const normalizeDateToIso = (value) => {
  if (!value) return '';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const normalizeTempAreaData = (data = {}) => {
  const area = data?.area || data;
  const normalizedValidFrom = normalizeDateToIso(area?.valid_from || area?.validFrom || data?.valid_from || data?.validFrom);
  const normalizedValidTo = normalizeDateToIso(area?.valid_to || area?.validTo || data?.valid_to || data?.validTo);
  const mergedPrayerRules = mergePrayerRulesFromSource(
    area?.prayer_rules || area?.prayerRules || data?.prayer_rules,
    data?.prayer_restrictions || data?.prayerRestrictions
  );
  const prayerState = convertPrayerRulesToState(mergedPrayerRules);

  return {
    title: area?.title || area?.name || '',
    description: area?.reason || area?.description || '',
    valid_from: normalizedValidFrom,
    valid_to: normalizedValidTo,
    is_active: Boolean(area?.is_active ?? data?.is_active ?? true),
    prayer_rules: mergedPrayerRules,
    prayer_state: prayerState,
    geometry: parseGeoJsonGeometry(area?.geom_geojson_4326 || area?.geom || data?.geom_geojson_4326 || data?.geom)
  };
};

const normalizeTransportModes = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeTransportValue).filter(Boolean);
  }

  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/^\{/, '').replace(/\}$/, '');

    return cleaned
      ? cleaned.split(',').map((item) => normalizeTransportValue(item.trim())).filter(Boolean)
      : [];
  }

  return [];
};

const dedupeByValue = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const value = item?.value ?? '';
    const label = typeof item?.label === 'string'
      ? item.label
      : JSON.stringify(item?.label ?? '');

    if (!value && !label) return true;

    const key = `${value}::${label}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

const getFeatureCenterCoordinates = (feature) => {
  const geometry = feature?.geometry;

  if (!geometry) return null;

  if (geometry.type === 'Point') return geometry.coordinates;
  if (geometry.type === 'MultiPoint') return geometry.coordinates?.[0];

  try {
    const centroid = turfCentroid(feature);
    const coordinates = centroid?.geometry?.coordinates;

    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      return coordinates;
    }
  } catch (error) {
    console.error('خطا در محاسبه مرکز هندسی فیچر:', error);
  }

  return null;
};

const extractEditableVertices = (geometry = {}) => {
  if (!geometry?.type || !geometry?.coordinates) return [];

  if (geometry.type === 'Point') return [geometry.coordinates];
  if (geometry.type === 'MultiPoint') return geometry.coordinates;
  if (geometry.type === 'LineString') return geometry.coordinates;

  if (geometry.type === 'Polygon') {
    const outerRing = geometry.coordinates?.[0] || [];
    if (!outerRing.length) return [];

    const withoutClosingPoint = outerRing.length > 1
      && outerRing[0][0] === outerRing[outerRing.length - 1][0]
      && outerRing[0][1] === outerRing[outerRing.length - 1][1]
      ? outerRing.slice(0, -1)
      : outerRing;

    return withoutClosingPoint;
  }

  if (geometry.type === 'MultiPolygon') {
    const firstPolygon = geometry.coordinates?.[0]?.[0] || [];
    if (!firstPolygon.length) return [];

    const withoutClosingPoint = firstPolygon.length > 1
      && firstPolygon[0][0] === firstPolygon[firstPolygon.length - 1][0]
      && firstPolygon[0][1] === firstPolygon[firstPolygon.length - 1][1]
      ? firstPolygon.slice(0, -1)
      : firstPolygon;

    return withoutClosingPoint;
  }

  return [];
};


const rebuildGeometryFromVertices = (geometryType, vertices = []) => {
  if (!Array.isArray(vertices) || vertices.length === 0) return null;

  if (geometryType === 'Point') {
    return { type: 'Point', coordinates: vertices[0] };
  }

  if (geometryType === 'MultiPoint') {
    return { type: 'MultiPoint', coordinates: vertices };
  }

  if (geometryType === 'LineString') {
    return { type: 'LineString', coordinates: vertices };
  }

  if (geometryType === 'Polygon') {
    const closedRing = [...vertices, vertices[0]];
    return { type: 'Polygon', coordinates: [closedRing] };
  }

  if (geometryType === 'MultiPolygon') {
    const closedRing = [...vertices, vertices[0]];
    return { type: 'MultiPolygon', coordinates: [[closedRing]] };
  }

  return null;
};

const floorLabelToValue = (label) => {
  switch (label) {
    case 'منفی ۱':
      return -1;
    case 'همکف':
    default:
      return 0;
  }
};

const floorValueToLabel = (value) => {
  if (value === -1) {
    return 'منفی ۱';
  }
  return 'همکف';
};

const logDoorAccessPointDebugInfo = (mapInstance) => {
  if (!mapInstance) return;

  const logPrefix = 'fn_door_access_points_mvt debug';
  const source = mapInstance.getSource(DOOR_ACCESS_SOURCE_ID);
  const layerExists = Boolean(mapInstance.getLayer(DOOR_ACCESS_LAYER_ID));

  console.log(`${logPrefix} | layer present: ${layerExists}, source present: ${Boolean(source)}`);

  if (source) {
    const tileTemplates = source.tiles || source._options?.tiles;
    console.log(`${logPrefix} | tile templates:`, tileTemplates);
  }

  mapInstance.once('sourcedata', (event) => {
    if (event?.sourceId !== DOOR_ACCESS_SOURCE_ID || !event.isSourceLoaded) return;

    const sourceFeatures = mapInstance.querySourceFeatures(DOOR_ACCESS_SOURCE_ID, {
      sourceLayer: DOORS_ACCESS_POINT_LAYER_NAME
    });

    console.log(`${logPrefix} | source features loaded`, {
      featureCount: sourceFeatures.length,
      sample: sourceFeatures.slice(0, 5).map((feature) => feature?.properties)
    });
  });

  mapInstance.once('idle', () => {
    const renderedFeatures = mapInstance.queryRenderedFeatures({ layers: [DOOR_ACCESS_LAYER_ID] }) || [];
    const sample = renderedFeatures.slice(0, 5).map((feature) => ({
      coordinates: feature?.geometry?.coordinates,
      properties: feature?.properties
    }));

    console.log(`${logPrefix} | rendered feature snapshot`, {
      featureCount: renderedFeatures.length,
      sample
    });
  });
};

const Amain = () => {
  const {
    admin: adminProfile,
    permissions: adminPermissions,
    fetchProfile,
    logout,
    accessToken
  } = useAdminAuthStore();
  const API_BASE = `${appConfig.apiBaseUrl}/api/v1/admin`;
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [dashboardSummary, setDashboardSummary] = useState({
    totalUsers: 0,
    successfulNavigations: 0,
    culturalCenters: 0,
    lastUpdated: ''
  });
  const [isLoadingDashboardSummary, setIsLoadingDashboardSummary] = useState(false);
  const [commentStats, setCommentStats] = useState({
    total: 0,
    approved: 0,
    rejected: 0
  });
  const [isLoadingCommentStats, setIsLoadingCommentStats] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const [map, setMap] = useState(null);
  const [mapLayerAvailabilityVersion, setMapLayerAvailabilityVersion] = useState(0);
  const mapRef = useRef(null);
  const layerTileRefreshGuardRef = useRef(new Map());
  const lastSelectedFeatureJsonRef = useRef('');
  useEffect(() => {
    mapRef.current = map;
  }, [map]);
  const userPermissions = useMemo(
    () => adminPermissions || adminProfile?.permissions || adminProfile?.user?.permissions || [],
    [adminPermissions, adminProfile]
  );

  useEffect(() => {
    if (!adminProfile) {
      setIsLoadingProfile(true);
      fetchProfile()
        .catch(() => { })
        .finally(() => setIsLoadingProfile(false));
    }
  }, [adminProfile, fetchProfile]);
  const resolveAdminToken = useCallback(
    () => accessToken || sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY),
    [accessToken]
  );
  const adminFetch = useCallback(
    (url, options = {}) => {
      const headers = new Headers(options.headers || {});
      const token = resolveAdminToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...options, headers });
    },
    [resolveAdminToken]
  );
  const [mapLanguage, setMapLanguage] = useState(DEFAULT_TILE_LANG || 'fa');
  const adminVectorTileConfig = useMemo(
    () => createHaramAdminVectorTileConfig(mapLanguage),
    [mapLanguage]
  );
  const editableLayerOptions = useMemo(
    () => adminVectorTileConfig.map((layer) => {
      const settings = layerEditSettings[layer.id]
        || (layer.id === 'doorsAccessPoint' ? layerEditSettings[DOOR_ACCESS_LAYER_ID] : null)
        || {};

      return {
        id: layer.id,
        sourceId: layer.sourceId,
        label: layer.titleFa || layer.id,
        titleFa: layer.titleFa,
        type: layer.type,
        highlightColor: settings.highlightColor || '#3b82f6',
        isEditable: settings.enabled === true,
        requiredPermission: settings.requiredPermission || null
      };
    }),
    [adminVectorTileConfig]
  );
  const canUserEditLayer = useCallback(
    (layer) => {
      if (!layer?.isEditable) return false;
      if (!layer?.requiredPermission) return true;

      const permissions = Array.isArray(userPermissions) ? userPermissions : [];
      if (!permissions.length) return true;

      return permissions.includes(layer.requiredPermission);
    },
    [userPermissions]
  );
  const isMapLayerAvailable = useCallback(
    (layerId) => {
      if (!map || !layerId) return false;

      return Boolean(map.getLayer(layerId));
    },
    [map, mapLayerAvailabilityVersion]
  );

  const [mapViewState, setMapViewState] = useState({
    longitude: 59.6161,
    latitude: 36.2908,
    center: [59.6159, 36.2875],
    zoom: 16
  });
  const buildInitialLayerVisibility = () => adminVectorTileConfig.reduce((acc, layer) => {
    acc[layer.id] = !!layer.visibleByDefault;
    return acc;
  }, {});

  const [layerVisibility, setLayerVisibility] = useState(buildInitialLayerVisibility);
  const applyLayerVisibility = useCallback((mapInstance, visibilityState = layerVisibility) => {
    const targetMap = mapInstance || map;
    if (!targetMap) return;

    adminVectorTileConfig.forEach((layer) => {
      if (targetMap.getLayer(layer.id)) {
        targetMap.setLayoutProperty(layer.id, 'visibility', visibilityState?.[layer.id] ? 'visible' : 'none');
      }
    });
  }, [adminVectorTileConfig, layerVisibility, map]);
  const [isLayerListOpen, setIsLayerListOpen] = useState(false);
  const [mapFloor, setMapFloor] = useState('همکف');
  const [isMapFloorOpen, setIsMapFloorOpen] = useState(false);
  const [isMapLanguageOpen, setIsMapLanguageOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState(null);
  const editableLayerActionMenuMap = useMemo(() => ({
    'temp-areas-outline': 1,
    'areas-outline': 2,
    'van-nodes': 3
  }), []);
  const mapLanguageOptions = useMemo(() => ([
    { value: 'fa', label: 'فارسی' },
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'العربية' },
    { value: 'ur', label: 'اردو' }
  ]), []);
  const selectedMapLanguage = mapLanguageOptions.find((option) => option.value === mapLanguage)
    || mapLanguageOptions[0];
  const MIN_REFRESH_INTERVAL_MS = 1200;
  const refreshLayerTiles = useCallback((layerId) => {
    if (!map || !layerId) return;

    const now = Date.now();
    const guard = layerTileRefreshGuardRef.current;
    const last = guard.get(layerId) || 0;

    if (now - last < MIN_REFRESH_INTERVAL_MS) {
      return;
    }
    guard.set(layerId, now);

    const layerConfig = adminVectorTileConfig.find((layer) => layer.id === layerId);
    if (!layerConfig) return;

    const source = map.getSource(layerConfig.sourceId);
    const tileUrlFactory = typeof layerConfig.tileUrlFactory === 'function'
      ? layerConfig.tileUrlFactory
      : null;

    const baseTileUrl = tileUrlFactory
      ? tileUrlFactory({ floor: floorLabelToValue(mapFloor) })
      : layerConfig.tileUrl;

    if (!source || typeof source.setTiles !== 'function' || !baseTileUrl) return;

    const cacheBustedUrl = `${baseTileUrl}${baseTileUrl.includes('?') ? '&' : '?'}cacheBust=${now}`;

    source.setTiles([cacheBustedUrl]);

    if (import.meta?.env?.DEV) {
      console.debug('[tiles] refresh', { layerId, now, baseTileUrl });
    }
  }, [adminVectorTileConfig, map, mapFloor]);
  const refreshVectorTileSources = useCallback(() => {
    if (!map) return;

    const now = Date.now();
    const updatedSources = new Set();

    adminVectorTileConfig.forEach((layerConfig) => {
      const { sourceId } = layerConfig;
      if (!sourceId || updatedSources.has(sourceId)) return;

      const tileUrlFactory = typeof layerConfig.tileUrlFactory === 'function'
        ? layerConfig.tileUrlFactory
        : null;
      const baseTileUrl = tileUrlFactory
        ? tileUrlFactory({ floor: floorLabelToValue(mapFloor) })
        : layerConfig.tileUrl;

      const source = map.getSource(sourceId);
      if (!source || typeof source.setTiles !== 'function' || !baseTileUrl) return;

      const cacheBustedUrl = `${baseTileUrl}${baseTileUrl.includes('?') ? '&' : '?'}cacheBust=${now}`;
      source.setTiles([cacheBustedUrl]);
      updatedSources.add(sourceId);
    });

    if (import.meta?.env?.DEV) {
      console.debug('[tiles] refresh sources', { now, sources: [...updatedSources] });
    }
  }, [adminVectorTileConfig, map, mapFloor]);
  const ensureVanDrawLayers = useCallback(() => {
    if (!map) return;

    if (!map.getSource(VAN_DRAW_SOURCE_ID)) {
      map.addSource(VAN_DRAW_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!map.getLayer(VAN_DRAW_LINE_LAYER_ID)) {
      map.addLayer({
        id: VAN_DRAW_LINE_LAYER_ID,
        type: 'line',
        source: VAN_DRAW_SOURCE_ID,
        paint: {
          'line-color': '#f97316',
          'line-width': 4,
          'line-dasharray': [1.6, 1.6]
        },
        filter: ['==', ['geometry-type'], 'LineString']
      });
    }

    if (!map.getLayer(VAN_DRAW_POINT_LAYER_ID)) {
      map.addLayer({
        id: VAN_DRAW_POINT_LAYER_ID,
        type: 'circle',
        source: VAN_DRAW_SOURCE_ID,
        paint: {
          'circle-radius': 5,
          'circle-color': '#1e40af',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        },
        filter: [
          'any',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['geometry-type'], 'MultiPoint']
        ]
      });
    }
  }, [map]);
  const ensureTempAreaDrawLayers = useCallback(() => {
    if (!map) return;

    if (!map.getSource(TEMP_AREA_DRAW_SOURCE_ID)) {
      map.addSource(TEMP_AREA_DRAW_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!map.getLayer(TEMP_AREA_DRAW_FILL_LAYER_ID)) {
      map.addLayer({
        id: TEMP_AREA_DRAW_FILL_LAYER_ID,
        type: 'fill',
        source: TEMP_AREA_DRAW_SOURCE_ID,
        paint: {
          'fill-color': '#f4a6b9',
          'fill-opacity': 0.35
        },
        filter: ['==', ['geometry-type'], 'Polygon']
      });
    }

    if (!map.getLayer(TEMP_AREA_DRAW_LINE_LAYER_ID)) {
      map.addLayer({
        id: TEMP_AREA_DRAW_LINE_LAYER_ID,
        type: 'line',
        source: TEMP_AREA_DRAW_SOURCE_ID,
        paint: {
          'line-color': '#d3516f',
          'line-width': 3,
          'line-dasharray': [1.4, 1.4]
        },
        filter: [
          'match',
          ['geometry-type'],
          ['LineString', 'Polygon'],
          true,
          false
        ]
      });
    }

    if (!map.getLayer(TEMP_AREA_DRAW_POINT_LAYER_ID)) {
      map.addLayer({
        id: TEMP_AREA_DRAW_POINT_LAYER_ID,
        type: 'circle',
        source: TEMP_AREA_DRAW_SOURCE_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': '#d3516f',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        },
        filter: ['==', ['geometry-type'], 'Point']
      });
    }
  }, [map]);
  const safeCommentTotal = Math.max(0, Number(commentStats.total) || 0);
  const safeApprovedComments = Math.max(0, Number(commentStats.approved) || 0);
  const safeRejectedComments = Math.max(0, Number(commentStats.rejected) || 0);
  const unknownComments = Math.max(0, safeCommentTotal - safeApprovedComments - safeRejectedComments);
  const approvedDegrees = safeCommentTotal ? (safeApprovedComments / safeCommentTotal) * 360 : 0;
  const rejectedDegrees = safeCommentTotal ? (safeRejectedComments / safeCommentTotal) * 360 : 0;
  const unknownDegrees = safeCommentTotal ? (unknownComments / safeCommentTotal) * 360 : 0;
  const [isVanDrawingMode, setIsVanDrawingMode] = useState(false);
  const [vanLineCoordinates, setVanLineCoordinates] = useState([]);
  const [isSavingVanRoute, setIsSavingVanRoute] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [facManagementOpen, setfacManagementOpen] = useState(false);
  const [reportsManagementOpen, setReportsManagementOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [recentUsersPagination, setRecentUsersPagination] = useState({
    page: 1,
    pageSize: 6,
    total: 0,
    pages: 1
  });
  const [searchTerm, setSearchTerm] = useState('');
  const currentJalaliDate = useMemo(() => {
    const now = new Date();
    return toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, []);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState(['منوی اصلی', 'داشبورد', 'آمار کلی استارتاپ من']);
  const [currentReportView, setCurrentReportView] = useState(null);
  const [pieChartTimeFilter, setPieChartTimeFilter] = useState('ماه اخیر');
  const [barChartTimeFilter, setBarChartTimeFilter] = useState('هفته اخیر');
  const [isPieChartFilterOpen, setIsPieChartFilterOpen] = useState(false);
  const [isBarChartFilterOpen, setIsBarChartFilterOpen] = useState(false);
  const [selectedBar, setSelectedBar] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [isLoadingBarChart, setIsLoadingBarChart] = useState(false);
  const [barChartYAxisOverrides, setBarChartYAxisOverrides] = useState({});
  const [isLoadingRecentUsers, setIsLoadingRecentUsers] = useState(false);
  const contentRef = useRef(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isLocationMarkerMode, setIsLocationMarkerMode] = useState(false);
  const [isCreatingDoor, setIsCreatingDoor] = useState(false);
  const [isPlaceCovered, setIsPlaceCovered] = useState(null);
  const [isAreaEditMode, setIsAreaEditMode] = useState(false);
  const [isAreaGeometryDirty, setIsAreaGeometryDirty] = useState(false);
  const [isSavingAreaGeometry, setIsSavingAreaGeometry] = useState(false);
  const [tempAreaFlowState, setTempAreaFlowState] = useState(TEMP_AREA_FLOW_STATES.idle);
  const [tempAreaFormMode, setTempAreaFormMode] = useState('edit');
  const [isTempAreaDrawingMode, setIsTempAreaDrawingMode] = useState(false);
  const [tempAreaVertices, setTempAreaVertices] = useState([]);
  const [isTempAreaMoveMode, setIsTempAreaMoveMode] = useState(false);
  const [tempAreaMoveGeometry, setTempAreaMoveGeometry] = useState(null);
  const [isTempAreaVertexEditMode, setIsTempAreaVertexEditMode] = useState(false);
  const [isTempAreaGeometryDirty, setIsTempAreaGeometryDirty] = useState(false);
  const [isSavingTempAreaGeometry, setIsSavingTempAreaGeometry] = useState(false);
  const [isTempAreaEditModalOpen, setIsTempAreaEditModalOpen] = useState(false);
  const [tempAreaName, setTempAreaName] = useState('');
  const [tempAreaDescription, setTempAreaDescription] = useState('');
  const [tempAreaValidFrom, setTempAreaValidFrom] = useState('');
  const [tempAreaValidTo, setTempAreaValidTo] = useState('');
  const [tempAreaStartTime, setTempAreaStartTime] = useState('');
  const [tempAreaEndTime, setTempAreaEndTime] = useState('');
  const [tempAreaSelectedStartDate, setTempAreaSelectedStartDate] = useState(null);
  const [tempAreaSelectedEndDate, setTempAreaSelectedEndDate] = useState(null);
  const [tempAreaCalendarDate, setTempAreaCalendarDate] = useState(() => ({
    year: currentJalaliDate.jy,
    month: currentJalaliDate.jm
  }));
  const [activeTempAreaDateField, setActiveTempAreaDateField] = useState(null);
  const [tempAreaPrayerEvents, setTempAreaPrayerEvents] = useState([]);
  const [tempAreaPrayerBefore, setTempAreaPrayerBefore] = useState('');
  const [tempAreaPrayerAfter, setTempAreaPrayerAfter] = useState('');
  const [tempAreaIsActive, setTempAreaIsActive] = useState(true);
  const [isLoadingTempAreaDetails, setIsLoadingTempAreaDetails] = useState(false);
  const [isSavingTempAreaDetails, setIsSavingTempAreaDetails] = useState(false);
  const vertexMarkersRef = useRef([]);
  const areaOriginalGeometryRef = useRef(null);
  const tempAreaVertexMarkersRef = useRef([]);
  const clearVertexMarkers = useCallback(() => {
    vertexMarkersRef.current.forEach((marker) => marker?.remove());
    vertexMarkersRef.current = [];
  }, []);

  const clearTempAreaVertexMarkers = useCallback(() => {
    tempAreaVertexMarkersRef.current.forEach((marker) => marker?.remove());
    tempAreaVertexMarkersRef.current = [];
  }, []);
  const [locationMarker, setLocationMarker] = useState(null);
  const [activeEditableLayerId, setActiveEditableLayerId] = useState('');
  const hasUserClearedEditableLayer = useRef(false);
  const [selectedEditableFeature, setSelectedEditableFeature] = useState(null);
  const tempAreaOriginalGeometryRef = useRef(null);
  const tempAreaVertexOriginalGeometryRef = useRef(null);
  const tempAreaVertexWorkingGeometryRef = useRef(null);
  const tempAreaVertexEditIdRef = useRef(null);
  const tempAreaVertexDirtyRef = useRef(false);
  const tempAreaVertexSelectionRef = useRef(null);
  const tempAreaDraftGeometryRef = useRef(null);
  const tempAreaPreviousCursorRef = useRef(null);
  const prevFloorLangRef = useRef({ floor: null, lang: null });
  const unreadNotifications = useMemo(
    () => notifications.filter(notif => !notif.read),
    [notifications]
  );
  const unreadNotificationsCount = unreadNotifications.length;

  const setMapCursorForTempAreaDrawing = useCallback(() => {
    if (!map?.getCanvas) return;

    const canvas = map.getCanvas();
    if (!canvas) return;

    if (tempAreaPreviousCursorRef.current === null) {
      tempAreaPreviousCursorRef.current = canvas.style.cursor;
    }

    canvas.style.cursor = 'crosshair';
  }, [map]);


  const resetMapCursor = useCallback(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance?.getCanvas) return;

    const canvas = mapInstance.getCanvas();
    if (!canvas) return;

    const previousCursor = tempAreaPreviousCursorRef.current;
    canvas.style.cursor = previousCursor ?? 'grab';
    tempAreaPreviousCursorRef.current = null;
  }, []);
  const activeEditableLayer = useMemo(() => {
    const selectedLayer = editableLayerOptions.find((layer) => layer.id === activeEditableLayerId);

    if (!canUserEditLayer(selectedLayer)) {
      return null;
    }

    if (!isMapLayerAvailable(selectedLayer?.id)) {
      return null;
    }

    return selectedLayer;
  }, [activeEditableLayerId, editableLayerOptions, canUserEditLayer, isMapLayerAvailable]);
  const isVanNodesLayerActive = activeEditableLayer?.id === 'van-nodes';
  const isVanDrawingLayerActive = isVanNodesLayerActive;
  const isTempAreaLayerActive = activeEditableLayer?.id === 'temp-areas-outline';
  const refreshActiveEditableLayerTiles = useCallback((layerIdOverride) => {
    const targetLayerId = layerIdOverride || activeEditableLayerId;
    if (!targetLayerId) return;

    const layerIdsToRefresh = new Set([targetLayerId]);

    if (targetLayerId === 'van-nodes') {
      layerIdsToRefresh.add('van-edges');
    }

    if (targetLayerId === DOOR_ACCESS_LAYER_ID) {
      layerIdsToRefresh.add('doors');
    }

    layerIdsToRefresh.forEach((layerId) => refreshLayerTiles(layerId));
  }, [activeEditableLayerId, refreshLayerTiles]);
  useEffect(() => {
    const mappedSubMenu = editableLayerActionMenuMap[activeEditableLayer?.id];
    if (typeof mappedSubMenu === 'number') {
      setOpenSubMenu(mappedSubMenu);
      return;
    }

    setOpenSubMenu((current) => {
      const mappedValues = Object.values(editableLayerActionMenuMap);
      if (mappedValues.includes(current)) {
        return null;
      }

      return current;
    });
  }, [activeEditableLayer?.id, editableLayerActionMenuMap]);
  useEffect(() => {
    if (!isVanDrawingLayerActive && isVanDrawingMode) {
      setIsVanDrawingMode(false);
      setVanLineCoordinates([]);
    }
  }, [isVanDrawingMode, isVanDrawingLayerActive]);
  useEffect(() => {
    if (!isTempAreaLayerActive) {
      setIsTempAreaDrawingMode(false);
      setTempAreaFlowState(TEMP_AREA_FLOW_STATES.idle);
      setTempAreaVertices([]);
      tempAreaDraftGeometryRef.current = null;
      setIsTempAreaVertexEditMode(false);
      setIsTempAreaGeometryDirty(false);
      tempAreaVertexOriginalGeometryRef.current = null;
      tempAreaVertexWorkingGeometryRef.current = null;
      tempAreaVertexEditIdRef.current = null;
      tempAreaVertexSelectionRef.current = null;
      clearTempAreaVertexMarkers();
    }
    resetMapCursor();
  }, [isTempAreaLayerActive, resetMapCursor, clearTempAreaVertexMarkers]);
  const selectedFeatureProperties = selectedEditableFeature?.features?.[0]?.properties;
  const selectedFeatureCoordinates = selectedEditableFeature?.features?.[0]?.geometry?.coordinates;
  const selectedDoorId = selectedFeatureProperties?.door_id
    || selectedFeatureProperties?.doorId
    || selectedFeatureProperties?.doorID
    || selectedFeatureProperties?.doorid
    || selectedFeatureProperties?.id;
  const selectedDoorAccessPointId = selectedFeatureProperties?.id;
  const selectedAreaId = activeEditableLayer?.id === 'areas-outline'
    ? selectedFeatureProperties?.area_id
    || selectedFeatureProperties?.areaId
    || selectedFeatureProperties?.areaID
    || selectedFeatureProperties?.id
    : null;
  const selectedTempAreaId = isTempAreaLayerActive
    ? selectedFeatureProperties?.temp_block_area_id
    || selectedFeatureProperties?.tempBlockAreaId
    || selectedFeatureProperties?.tempBlockAreaID
    || selectedFeatureProperties?.tempAreaId
    || selectedFeatureProperties?.temp_area_id
    || selectedFeatureProperties?.id
    : null;
  const selectedVanNodeId = isVanNodesLayerActive
    ? selectedFeatureProperties?.node_id
    || selectedFeatureProperties?.nodeId
    || selectedFeatureProperties?.nodeID
    || selectedFeatureProperties?.id
    : null;
  const applyAreaGeometryToSelection = useCallback((geometry) => {
    if (!geometry) return null;

    let nextSelection = null;

    setSelectedEditableFeature((current) => {
      const feature = current?.features?.[0];
      if (!feature) return current;

      const updatedFeature = { ...feature, geometry };
      nextSelection = { ...current, features: [updatedFeature] };
      return nextSelection;
    });

    return nextSelection;
  }, []);
  const applyTempAreaGeometryToSelection = useCallback((geometry) => {
    if (!geometry) return null;

    let nextSelection = null;

    setSelectedEditableFeature((current) => {
      const feature = current?.features?.[0];
      if (!feature) return current;

      const updatedFeature = { ...feature, geometry };
      nextSelection = { ...current, features: [updatedFeature] };
      return nextSelection;
    });

    if (nextSelection) {
      tempAreaVertexSelectionRef.current = nextSelection;
    }

    return nextSelection;
  }, [setSelectedEditableFeature]);

  useEffect(() => {
    tempAreaVertexDirtyRef.current = isTempAreaGeometryDirty;
  }, [isTempAreaGeometryDirty]);
  const isTempAreaFormDisabled = isSavingTempAreaDetails || isLoadingTempAreaDetails;
  const showDoorTools = activeEditableLayer?.id === DOOR_ACCESS_LAYER_ID && !!selectedDoorId && !!selectedEditableFeature;
  useEffect(() => {
    const isDoorLayerActive = activeEditableLayer?.id === DOOR_ACCESS_LAYER_ID;

    setOpenSubMenu((current) => {
      if (isDoorLayerActive && showDoorTools) {
        return 4;
      }

      if (current === 4) {
        return null;
      }

      return current;
    });
  }, [activeEditableLayer?.id, showDoorTools]);
  const isActiveLayerPointBased = useMemo(
    () => activeEditableLayer?.type === 'circle' || activeEditableLayer?.type === 'symbol',
    [activeEditableLayer]
  );
  const [lastCreatedDoorId, setLastCreatedDoorId] = useState(null);
  const [lastCreatedAccessPointId, setLastCreatedAccessPointId] = useState(null);
  const [isSavingDoorInfo, setIsSavingDoorInfo] = useState(false);
  const [isLoadingDoorInfo, setIsLoadingDoorInfo] = useState(false);
  const [lastCreatedAreaId, setLastCreatedAreaId] = useState(null);
  const [isSavingAreaInfo, setIsSavingAreaInfo] = useState(false);
  const [isLoadingAreaInfo, setIsLoadingAreaInfo] = useState(false);
  const [isEditingDoorInfo, setIsEditingDoorInfo] = useState(false);
  const [isDoorMoveMode, setIsDoorMoveMode] = useState(false);
  const isAreaLayerActive = activeEditableLayer?.id === 'areas-outline';
  const isDoorAccessLayerActive = activeEditableLayer?.id === DOOR_ACCESS_LAYER_ID;
  const intl = useIntl();
  const language = intl?.locale || 'fa';
  const isRtlLanguage = ['fa', 'ar', 'ur'].includes(language);
  const mapStyle = useMemo(
    () => (isRtlLanguage ? './rtl/style.json' : './rtl/style-en.json'),
    [isRtlLanguage]
  );
  const translateLabel = useCallback(
    (labelKey) => {
      if (!labelKey || typeof labelKey !== 'string') return labelKey;

      return intl?.messages?.[labelKey]
        ? intl.formatMessage({ id: labelKey })
        : labelKey;
    },
    [intl]
  );

  const resolveLocalizedCategoryLabel = useCallback(
    (item) => {
      const languageKey = language === 'en'
        ? 'english'
        : language === 'ar'
          ? 'arabic'
          : language === 'ur'
            ? 'urdu'
            : null;

      return (languageKey && item?.languageTitles?.[languageKey])
        || item?.title
        || item?.label
        || item?.name
        || '';
    },
    [language]
  );

  const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [placeIcon, setPlaceIcon] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [placeCategory, setPlaceCategory] = useState('');
  const [placeSubcategory, setPlaceSubcategory] = useState('');
  const [placeFunction, setPlaceFunction] = useState('');
  const [groupOptions, setGroupOptions] = useState([]);
  const [subGroupOptions, setSubGroupOptions] = useState([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingSubGroups, setIsLoadingSubGroups] = useState(false);
  const [selectedTransport, setSelectedTransport] = useState([]);
  const [selectedGenderAccess, setSelectedGenderAccess] = useState([]);
  const [timeRestrictions, setTimeRestrictions] = useState([]);
  const [prayerTimeRestrictions, setPrayerTimeRestrictions] = useState([]);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState([]);
  const [selectedJalaliDate, setSelectedJalaliDate] = useState(null);
  const [selectedJalaliEndDate, setSelectedJalaliEndDate] = useState(null);
  const [calendarDate, setCalendarDate] = useState(() => ({
    year: currentJalaliDate.jy,
    month: currentJalaliDate.jm,
    day: currentJalaliDate.jd
  }));
  const [selectedRestrictionType, setSelectedRestrictionType] = useState(null);
  const [restrictionFormOpen, setRestrictionFormOpen] = useState(false);
  const [selectedGenderRestrictions, setSelectedGenderRestrictions] = useState([]);
  const [timeRestrictionPairs, setTimeRestrictionPairs] = useState([
    { start: '', end: '' }
  ]);
  const [limitAllHours, setLimitAllHours] = useState(false);
  const [isPrayerDateFilterOpen, setIsPrayerDateFilterOpen] = useState(false);
  const [prayerCalendarDate, setPrayerCalendarDate] = useState({
    year: currentJalaliDate.jy,
    month: currentJalaliDate.jm
  });

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);


  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  const [prayerSelectedJalaliDate, setPrayerSelectedJalaliDate] = useState(null);
  const [prayerSelectedJalaliEndDate, setPrayerSelectedJalaliEndDate] = useState(null);
  const [prayerRestrictionFormOpen, setPrayerRestrictionFormOpen] = useState(false);
  const [selectedPrayerEvents, setSelectedPrayerEvents] = useState([]);
  const [prayerBeforeMinutes, setPrayerBeforeMinutes] = useState('');
  const [prayerAfterMinutes, setPrayerAfterMinutes] = useState('');
  const [prayerTimeRestrictionsList, setPrayerTimeRestrictionsList] = useState([]);
  const isSavingPlaceInfo = isSavingDoorInfo || isSavingAreaInfo;
  const isLoadingPlaceInfo = isLoadingDoorInfo || isLoadingAreaInfo;
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);



  const [categories, setCategories] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState([]);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [categoryTotalItems, setCategoryTotalItems] = useState(0);
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [newCategory, setNewCategory] = useState({
    title: '',
    description: '',
    image: null,
    status: 'active',
    subcategoryInput: '',
    subcategories: [],
    languageTitles: {
      english: '',
      arabic: '',
      urdu: ''
    }
  });
  const [editingCategory, setEditingCategory] = useState(null);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryData, setEditCategoryData] = useState({
    title: '',
    description: '',
    icon: null,
    status: 'active'
  });
  const [isIconUploaded, setIsIconUploaded] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState(null);
  const [iconOptions, setIconOptions] = useState([]);
  const [isIconListLoading, setIsIconListLoading] = useState(false);
  const [iconListError, setIconListError] = useState('');
  const [iconSearchTerm, setIconSearchTerm] = useState('');
  const [culturalData, setCulturalData] = useState([]);
  const [culturalSearchTerm, setCulturalSearchTerm] = useState('');
  const [isDeleteCulturalModalOpen, setIsDeleteCulturalModalOpen] = useState(false);
  const [culturalToDelete, setCulturalToDelete] = useState(null);
  const [culturalCurrentPage, setCulturalCurrentPage] = useState(1);
  const [culturalItemsPerPage, setCulturalItemsPerPage] = useState(7);
  const [culturalTotalItems, setCulturalTotalItems] = useState(0);
  const [isLoadingCultural, setIsLoadingCultural] = useState(false);
  const [culturalPoiId, setCulturalPoiId] = useState('');
  const [locationRoofType, setLocationRoofType] = useState('');
  const [locationStatus, setLocationStatus] = useState('');
  const [isAddCulturalModalOpen, setIsAddCulturalModalOpen] = useState(false);
  const [culturalStep, setCulturalStep] = useState(1);
  const [culturalTitle, setCulturalTitle] = useState('');
  const [culturalDescription, setCulturalDescription] = useState('');
  const [showUserFeedbacks, setShowUserFeedbacks] = useState(true);
  const [showMediaGallery, setShowMediaGallery] = useState(true);
  const [selectedPlaceType, setSelectedPlaceType] = useState('');
  const [selectedCulturalTypes, setSelectedCulturalTypes] = useState([]);
  const [culturalTypeError, setCulturalTypeError] = useState(false);
  const [culturalMap, setCulturalMap] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [currentMarker, setCurrentMarker] = useState(null);
  const editMapTimeoutRef = useRef(null);
  const [titleForModal, setTitleForModal] = useState('');
  const [adminAvatar, setAdminAvatar] = useState(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRefreshingMainTable, setIsRefreshingMainTable] = useState(false);

  const [culturalPlaceCategory, setCulturalPlaceCategory] = useState('');
  const [culturalPlaceSubcategory, setCulturalPlaceSubcategory] = useState('');
  const [culturalSubGroupOptions, setCulturalSubGroupOptions] = useState([]);
  const [isLoadingCulturalGroups, setIsLoadingCulturalGroups] = useState(false);
  const [isLoadingCulturalSubGroups, setIsLoadingCulturalSubGroups] = useState(false);
  const [culturalCategories, setCulturalCategories] = useState([]);

  const [isRestrictionModalOpen, setIsRestrictionModalOpen] = useState(false);
  const [editRestrictionFormOpen, setEditRestrictionFormOpen] = useState(false);
  const [editSelectedRestrictionType, setEditSelectedRestrictionType] = useState(null);
  const [editTimeRestrictionPairs, setEditTimeRestrictionPairs] = useState([{ start: '', end: '' }]);
  const [editLimitAllHours, setEditLimitAllHours] = useState(false);
  const [editSelectedGenderRestrictions, setEditSelectedGenderRestrictions] = useState([]);
  const [editIsDateFilterOpen, setEditIsDateFilterOpen] = useState(false);
  const [editSelectedDateFilter, setEditSelectedDateFilter] = useState([]);
  const [editSelectedJalaliDate, setEditSelectedJalaliDate] = useState(null);
  const [editCalendarDate, setEditCalendarDate] = useState(() => {
    const now = new Date();
    const jalali = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return { year: jalali.jy, month: jalali.jm, day: jalali.jd };
  });

  // Prayer restriction states for the modal
  const [editPrayerRestrictionFormOpen, setEditPrayerRestrictionFormOpen] = useState(false);
  const [editIsPrayerDateFilterOpen, setEditIsPrayerDateFilterOpen] = useState(false);
  const [editPrayerCalendarDate, setEditPrayerCalendarDate] = useState({ year: 1403, month: 1 });
  const [editPrayerSelectedJalaliDate, setEditPrayerSelectedJalaliDate] = useState(null);
  const [editSelectedPrayerEvents, setEditSelectedPrayerEvents] = useState([]);
  const [editPrayerBeforeMinutes, setEditPrayerBeforeMinutes] = useState('');
  const [editPrayerAfterMinutes, setEditPrayerAfterMinutes] = useState('');

  const [descriptionForModal, setDescriptionForModal] = useState('');
  const [categoryLanguageTitles, setCategoryLanguageTitles] = useState({
    english: '',
    arabic: '',
    urdu: ''
  });
  const [isCategoryTitleLanguageModalOpen, setIsCategoryTitleLanguageModalOpen] = useState(false);


  const [isTitleLanguageModalOpen, setIsTitleLanguageModalOpen] = useState(false);
  const [currentTitleField, setCurrentTitleField] = useState(null); // Track which modal's title field is active
  const [languageTitles, setLanguageTitles] = useState({
    english: '',
    arabic: '',
    urdu: ''
  });

  const [editCategoryLanguageTitles, setEditCategoryLanguageTitles] = useState({
    english: '',
    arabic: '',
    urdu: ''
  });
  const [isEditCategoryTitleLanguageModalOpen, setIsEditCategoryTitleLanguageModalOpen] = useState(false);
  const [showSubcategoriesModal, setShowSubcategoriesModal] = useState(false);

  // For cultural modal description
  const [isDescriptionLanguageModalOpen, setIsDescriptionLanguageModalOpen] = useState(false);
  const [currentDescriptionField, setCurrentDescriptionField] = useState(null);
  const [languageDescriptions, setLanguageDescriptions] = useState({
    english: '',
    arabic: '',
    urdu: ''
  });

  const [languageAddresses, setLanguageAddresses] = useState({
    english: '',
    arabic: '',
    urdu: ''
  });
  const [isAddressLanguageModalOpen, setIsAddressLanguageModalOpen] = useState(false);
  const [currentAddressField, setCurrentAddressField] = useState(null);
  const [culturalTimeRestrictions, setCulturalTimeRestrictions] = useState([]);
  const [culturalPrayerTimeRestrictions, setCulturalPrayerTimeRestrictions] = useState([]);
  const [isCulturalDateFilterOpen, setIsCulturalDateFilterOpen] = useState(false);
  const [culturalSelectedDateFilter, setCulturalSelectedDateFilter] = useState([]);
  const [culturalSelectedJalaliDate, setCulturalSelectedJalaliDate] = useState(null);
  const [culturalCalendarDate, setCulturalCalendarDate] = useState(() => {
    const now = new Date();
    const jalali = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return { year: jalali.jy, month: jalali.jm, day: jalali.jd };
  });
  const [culturalSelectedRestrictionType, setCulturalSelectedRestrictionType] = useState(null);
  const [culturalRestrictionFormOpen, setCulturalRestrictionFormOpen] = useState(false);
  const [culturalSelectedGenderRestrictions, setCulturalSelectedGenderRestrictions] = useState([]);
  const [culturalTimeRestrictionPairs, setCulturalTimeRestrictionPairs] = useState([
    { start: '', end: '' }
  ]);
  const [culturalLimitAllHours, setCulturalLimitAllHours] = useState(false);
  const [isCulturalPrayerDateFilterOpen, setIsCulturalPrayerDateFilterOpen] = useState(false);
  const [culturalPrayerCalendarDate, setCulturalPrayerCalendarDate] = useState({ year: 1403, month: 1 });
  const [culturalPrayerSelectedJalaliDate, setCulturalPrayerSelectedJalaliDate] = useState(null);
  const [culturalPrayerRestrictionFormOpen, setCulturalPrayerRestrictionFormOpen] = useState(false);
  const [culturalSelectedPrayerEvents, setCulturalSelectedPrayerEvents] = useState([]);
  const [culturalPrayerBeforeMinutes, setCulturalPrayerBeforeMinutes] = useState('');
  const [culturalPrayerAfterMinutes, setCulturalPrayerAfterMinutes] = useState('');
  const [culturalPrayerTimeRestrictionsList, setCulturalPrayerTimeRestrictionsList] = useState([]);
  const [profileImages, setProfileImages] = useState([]);
  const [audioFiles, setAudioFiles] = useState([]);
  const [textFiles, setTextFiles] = useState([]);
  const [primaryImage, setPrimaryImage] = useState(null);

  const [isEditingCultural, setIsEditingCultural] = useState(false);
  const [editingCulturalId, setEditingCulturalId] = useState(null);
  const [editingCulturalData, setEditingCulturalData] = useState(null);
  const [showOrientationModal, setShowOrientationModal] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [selectedOrientation, setSelectedOrientation] = useState('');
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);

  const [isFileTitleLanguageModalOpen, setIsFileTitleLanguageModalOpen] = useState(false);
  const [isFileDescriptionLanguageModalOpen, setIsFileDescriptionLanguageModalOpen] = useState(false);
  const [fileLanguageTitles, setFileLanguageTitles] = useState({
    english: '',
    arabic: '',
    urdu: ''
  });
  const [fileLanguageDescriptions, setFileLanguageDescriptions] = useState({
    english: '',
    arabic: '',
    urdu: ''
  });

  const [pendingFileInfo, setPendingFileInfo] = useState(null);
  const [fileUploadTitle, setFileUploadTitle] = useState('');
  const [fileUploadDescription, setFileUploadDescription] = useState('');
  const [isFileLanguageModalOpen, setIsFileLanguageModalOpen] = useState(false);
  const [categoryCurrentPage, setCategoryCurrentPage] = useState(1);
  const [categoryItemsPerPage, setCategoryItemsPerPage] = useState(7);
  const [categoryError, setCategoryError] = useState('');

  const buildMediaUrl = (media, defaultMime = 'image/jpeg') => {
    if (!media) return null;

    if (typeof media === 'string') {
      const trimmed = media.trim();
      if (trimmed.startsWith('data:')) return trimmed;

      const isRawBase64 = /^[A-Za-z0-9+/]+={0,2}$/g.test(trimmed.replace(/\s+/g, ''));
      if (isRawBase64) {
        return `data:${defaultMime};base64,${trimmed}`;
      }

      return trimmed;
    }

    if (typeof media === 'object') {
      if (media.url) return media.url;
      if (media.data) {
        return `data:${media.mime || defaultMime};base64,${media.data}`;
      }
    }

    return null;
  };

  const normalizeMediaAttachment = (file, defaultMime = 'application/octet-stream') => {
    if (!file) return null;

    const mimeType = file.mime
      || (file.type?.includes('/') ? file.type : null)
      || (file.type === 'image' ? 'image/jpeg' : null)
      || (file.type === 'video' ? 'video/mp4' : null)
      || (file.type === 'audio' ? 'audio/mpeg' : null)
      || defaultMime;

    return {
      id: file.id || `attachment-${Math.random().toString(36).slice(2)}`,
      name: file.name || 'فایل پیوست',
      orientation: file.orientation ?? null,
      ...file,
      type: mimeType,
      mime: mimeType,
      url: buildMediaUrl(file, mimeType) || file.url || ''
    };
  };

  const normalizePrimaryMedia = (primaryMedia, existingImages = []) => {
    if (!primaryMedia) {
      return { primary: null, images: existingImages };
    }

    if (typeof primaryMedia === 'object') {
      const normalizedPrimary = {
        id: primaryMedia.id || 'existing-primary-image',
        name: primaryMedia.name || 'تصویر اصلی',
        type: primaryMedia.type || 'image/*',
        url: primaryMedia.url || primaryMedia,
        isPrimary: primaryMedia.isPrimary ?? true,
        orientation: primaryMedia.orientation ?? null
      };

      const images = existingImages.some(img => img.id === normalizedPrimary.id)
        ? existingImages
        : [normalizedPrimary, ...existingImages];

      return { primary: normalizedPrimary, images };
    }

    const dataUrlMatch = typeof primaryMedia === 'string'
      ? primaryMedia.match(/^data:([^;]+);/)
      : null;

    const derivedType = dataUrlMatch?.[1] || 'image/*';

    const normalizedPrimary = {
      id: 'existing-primary-image',
      name: 'تصویر اصلی',
      type: derivedType,
      url: primaryMedia,
      isPrimary: true
    };

    const images = existingImages.some(img => img.id === normalizedPrimary.id)
      ? existingImages
      : [normalizedPrimary, ...existingImages];

    return { primary: normalizedPrimary, images };
  };

  const normalizeImageAttachments = (files = []) => {
    if (!Array.isArray(files)) return [];

    return files
      .map(file => normalizeMediaAttachment(file))
      .filter((file) => file
        && typeof file.url === 'string'
        && file.url.trim()
        && (
          (typeof file.type === 'string' && file.type.startsWith('image'))
          || (typeof file.mime === 'string' && file.mime.startsWith('image'))
          || file.fileType === 'image'
        ));
  };

  const normalizeLanguageMedia = (media = {}, language = 'fa') => {
    const seenPaths = new Set();
    const languageMedia = Array.isArray(media?.[language]) ? media[language] : [];

    return languageMedia
      .map((file, idx) => normalizeMediaAttachment({
        ...file,
        id: file?.id || file?.path || file?.url || `media-${language}-${idx}`
      }, file?.mime || file?.type || 'application/octet-stream'))
      .filter((file) => {
        if (!file?.url) return false;
        const key = file.path || file.url;
        if (seenPaths.has(key)) return false;
        seenPaths.add(key);
        return true;
      });
  };

  const getCategoryPageNumbers = () => {
    const totalPages = Math.ceil(categoryTotalItems / categoryItemsPerPage);
    const maxVisiblePages = 6;
    const pages = [];

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, categoryCurrentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  const handleCategoryPageChange = (pageNumber) => {
    setCategoryCurrentPage(pageNumber);
  };

  const openFileTitleLanguageModal = () => {
    setIsFileTitleLanguageModalOpen(true);
  };

  const openFileDescriptionLanguageModal = () => {
    setIsFileDescriptionLanguageModalOpen(true);
  };


  const handleFileUploadWithModal = (event, fileType) => {
    const files = Array.from(event.target.files);

    if (files.length === 0) return;

    // Process the first file (you can extend to multiple later)
    const file = files[0];

    // Check file size
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      alert(`حجم فایل نباید بیشتر از ۱۰۰ مگابایت باشد`);
      event.target.value = '';
      return;
    }

    // Determine the actual file type
    let actualFileType = fileType;
    if (file.type.startsWith('video/')) {
      actualFileType = 'video';
    } else if (file.type.startsWith('audio/')) {
      actualFileType = 'audio';
    } else if (file.type.startsWith('image/')) {
      actualFileType = 'image';
    } else if (file.type === 'application/pdf' || file.type.startsWith('text/')) {
      actualFileType = 'text';
    }

    // For images, show orientation modal
    if (actualFileType === 'image') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPendingImageFile({
          file,
          url: e.target.result,
          type: file.type,
          name: file.name,
          size: file.size
        });
        setShowOrientationModal(true);
      };
      reader.readAsDataURL(file);
    }
    // For other file types (video, audio, text), show title/description modal
    else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPendingFileInfo({
          file,
          url: e.target.result,
          type: file.type,
          name: file.name,
          size: file.size,
          fileType: actualFileType // Use the actual file type
        });
        setIsFileUploadModalOpen(true);

        // Set default title from filename (without extension)
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setFileUploadTitle(fileNameWithoutExt);
        setFileUploadDescription('');
        setFileLanguageTitles({
          english: '',
          arabic: '',
          urdu: ''
        });
        setFileLanguageDescriptions({
          english: '',
          arabic: '',
          urdu: ''
        });
      };

      // Read the file based on type
      if (actualFileType === 'video' || actualFileType === 'audio') {
        reader.readAsDataURL(file);
      } else {
        // For text/PDF files
        reader.readAsDataURL(file);
      }
    }

    // Reset file input
    event.target.value = '';
  };

  const handleNotificationClick = () => {
    setShowNotifications(prev => !prev);
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
  };

  const handleMarkAsRead = (id) => {
    setNotifications(prev => prev.map(notif =>
      notif.id === id ? { ...notif, read: true } : notif
    ));
  };

  const handleDeleteNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  // Helper function to detect file type from MIME type
  const detectFileType = (file) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type === 'application/pdf' || file.type.startsWith('text/') ||
      file.type.includes('document') || file.type.includes('sheet')) {
      return 'text';
    }
    return 'text'; // Default
  };

  // Helper function to get file category label
  const getFileCategory = (mimeType) => {
    if (mimeType.startsWith('video/')) return 'ویدئو';
    if (mimeType.startsWith('audio/')) return 'صوت';
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.startsWith('text/')) return 'متن';
    if (mimeType.includes('document')) return 'سند';
    if (mimeType.includes('sheet')) return 'اکسل';
    return 'فایل';
  };

  // Helper function to get file type label in Persian
  const getFileTypeLabel = (fileType) => {
    const labels = {
      video: 'ویدئو',
      audio: 'صوت',
      text: 'متنی',
      image: 'تصویر'
    };
    return labels[fileType] || fileType;
  };

  const resolveFileBucket = (file) => {
    const mime = file?.type || file?.mime || '';
    if (mime.startsWith('image/') || mime.startsWith('video/')) return 'images';
    if (mime.startsWith('audio/')) return 'audio';
    return 'files';
  };

  const resolveAttachmentType = (mimeType = '') => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  };

  const uploadCulturalFiles = async (files = [], entityId) => {
    const targetEntityId = entityId ?? 'cultural-item';
    const uploadedFiles = [];

    for (const file of files) {
      if (!file) continue;

      // Already uploaded/remote files
      if (!file.file) {
        uploadedFiles.push({
          ...file,
          path: file.path || file.url || '',
          url: file.url || file.path || '',
          mime: file.mime || file.type,
          metadata: file.metadata || file.metaData || null,
          bucket: file.bucket || resolveFileBucket(file)
        });
        continue;
      }

      try {
        const response = await uploadFile({
          file: file.file,
          entityTable: 'contents',
          entityId: targetEntityId,
          bucket: resolveFileBucket(file),
          keepOriginalName: true
        });

        uploadedFiles.push({
          id: file.id,
          name: file.name,
          orientation: file.orientation ?? null,
          mime: response?.mime || file.mime || file.type,
          path: response?.path || '',
          url: response?.url || response?.path || '',
          metadata: response?.metadata || response?.metaData || null,
          bucket: response?.bucket || resolveFileBucket(file)
        });
      } catch (error) {
        console.error('File upload failed', error);
        throw error;
      }
    }

    return uploadedFiles;
  };

  const buildAttachmentPayload = (files = []) => {
    const seenPaths = new Set();

    return files
      .filter((file) => file?.path || file?.url)
      .map((file) => ({
        type: resolveAttachmentType(file?.mime || file?.type || ''),
        mime: file?.mime || file?.type || 'application/octet-stream',
        path: file?.path || file?.url || '',
        url: file?.url || file?.path || '',
        metadata: file?.metadata || file?.metaData || null,
        bucket: file?.bucket,
        orientation: file?.orientation ?? null,
        name: file?.name
      }))
      .filter((attachment) => {
        const key = attachment.path || attachment.url;
        if (seenPaths.has(key)) return false;
        seenPaths.add(key);
        return true;
      });
  };

  const buildCulturalTranslationsPayload = (attachments = []) => {
    const mediaPayload = attachments
      .map((file) => {
        const url = file?.url || file?.path || '';
        if (!url) return null;

        return {
          type: file?.type || resolveAttachmentType(file?.mime || file?.type || ''),
          mime: file?.mime || 'application/octet-stream',
          url,
          path: file?.path || '',
          bucket: file?.bucket,
          metadata: file?.metadata || null,
          name: file?.name,
          orientation: file?.orientation ?? null
        };
      })
      .filter(Boolean);

    const buildEntry = (title, body) => ({
      title: title || '',
      body: body || '',
      media: mediaPayload
    });

    return {
      fa: buildEntry(culturalTitle, culturalDescription),
      en: buildEntry(languageTitles.english, languageDescriptions.english),
      ar: buildEntry(languageTitles.arabic, languageDescriptions.arabic),
      ur: buildEntry(languageTitles.urdu, languageDescriptions.urdu)
    };
  };

  const normalizeDisplaySettings = (settings = {}) => {
    const normalized = settings.displaySettings || settings.display_settings || settings;

    return {
      showUserFeedbacks: normalized.showUserFeedbacks
        ?? normalized.show_user_feedbacks
        ?? normalized.showUserComments
        ?? normalized.show_user_comments
        ?? true,
      showMediaGallery: normalized.showMediaGallery
        ?? normalized.show_media_gallery
        ?? normalized.showMultimedia
        ?? normalized.show_multimedia
        ?? true
    };
  };

  const buildDisplaySettingsPayload = () => ({
    showUserFeedbacks: Boolean(showUserFeedbacks),
    showMediaGallery: Boolean(showMediaGallery),
    showUserComments: Boolean(showUserFeedbacks),
    showMultimedia: Boolean(showMediaGallery)
  });

  const buildSettingsPayload = () => ({
    showUserFeedbacks: Boolean(showUserFeedbacks),
    showMediaGallery: Boolean(showMediaGallery),
    placeType: selectedPlaceType || null
  });

  const normalizeTimeRestrictions = (restrictions = []) => restrictions.map((restriction) => ({
    date: restriction?.date || restriction?.title || restriction?.date_scope || '',
    isoDateScope: restriction?.isoDateScope || restriction?.date_scope || '',
    gender: restriction?.gender || restriction?.allowed_genders || [],
    timePairs: restriction?.timePairs || restriction?.time_pairs || restriction?.time_ranges || [],
    limitAllHours: restriction?.limitAllHours ?? restriction?.all_hours ?? false
  }));

  const normalizePrayerRestrictions = (restrictions = []) => {
    const seen = new Set();

    return restrictions.reduce((acc, restriction) => {
      const normalizedEvents = normalizePrayerEvents(restriction?.events);
      const normalizedBefore = restriction?.before
        ?? restriction?.before_minutes
        ?? restriction?.beforeMinutes
        ?? 0;
      const normalizedAfter = restriction?.after
        ?? restriction?.after_minutes
        ?? restriction?.afterMinutes
        ?? 0;

      const dateScopeValue = restriction?.isoDateScope || restriction?.date_scope || restriction?.date || restriction?.title || '';
      const dateScopeKey = Array.isArray(dateScopeValue)
        ? dateScopeValue.join('|')
        : String(dateScopeValue);

      const dedupKey = JSON.stringify({
        events: [...normalizedEvents].sort().join('|'),
        before: normalizedBefore,
        after: normalizedAfter,
        dateScope: dateScopeKey
      });

      if (seen.has(dedupKey)) return acc;
      seen.add(dedupKey);

      acc.push({
        ...restriction,
        date: restriction?.date || restriction?.title || restriction?.date_scope || '',
        isoDateScope: restriction?.isoDateScope || restriction?.date_scope || '',
        before: normalizedBefore,
        after: normalizedAfter,
        events: normalizedEvents
      });

      return acc;
    }, []);
  };

  const buildCulturalTimeRestrictionsPayload = () => culturalTimeRestrictions.map((restriction) => ({
    date_scope: restriction?.isoDateScope?.length
      ? restriction.isoDateScope
      : restriction?.date_scope?.length
        ? restriction.date_scope
        : buildDateScopeIso(restriction?.date),
    gender: Array.isArray(restriction?.gender)
      ? restriction.gender.map(normalizeGenderValue).filter(Boolean)
      : [],
    time_ranges: Array.isArray(restriction?.timePairs)
      ? restriction.timePairs.map((pair) => ({
        start: pair?.start || '',
        end: pair?.end || ''
      }))
      : Array.isArray(restriction?.time_ranges)
        ? restriction.time_ranges.map((pair) => ({
          start: pair?.start || '',
          end: pair?.end || ''
        }))
        : [],
    all_hours: Boolean(restriction?.limitAllHours ?? restriction?.all_hours)
  })).filter((restriction) => restriction.date_scope?.length);

  const normalizeDateScopeArray = (dateScopeValue, fallbackDate) => {
    if (Array.isArray(dateScopeValue)) return dateScopeValue;
    if (typeof dateScopeValue === 'string' && dateScopeValue.length) return [dateScopeValue];

    const derived = buildDateScopeIso(fallbackDate);
    return Array.isArray(derived) ? derived : [];
  };

  const getPrayerRestrictionParts = (restriction = {}) => {
    const normalizedEvents = normalizePrayerEvents(
      restriction?.events
      ?? restriction?.prayer_event
      ?? restriction?.prayerEvent
    ).sort();
    const dateScope = normalizeDateScopeArray(
      restriction?.isoDateScope?.length ? restriction.isoDateScope : restriction?.date_scope,
      restriction?.date
    );

    const beforeMinutes = restriction?.before_minutes
      ?? (restriction?.before !== undefined ? Number(restriction.before) : undefined)
      ?? (restriction?.beforeMinutes !== undefined ? Number(restriction.beforeMinutes) : undefined)
      ?? 0;

    const afterMinutes = restriction?.after_minutes
      ?? (restriction?.after !== undefined ? Number(restriction.after) : undefined)
      ?? (restriction?.afterMinutes !== undefined ? Number(restriction.afterMinutes) : undefined)
      ?? 0;

    const dedupKey = JSON.stringify({
      events: normalizedEvents.join('|'),
      before: beforeMinutes,
      after: afterMinutes,
      dateScope: dateScope.join('|')
    });

    return {
      normalizedEvents,
      beforeMinutes,
      afterMinutes,
      dateScope,
      dedupKey
    };
  };


  const buildCulturalPrayerRestrictionsPayload = () => {
    const seen = new Set();

    return culturalPrayerTimeRestrictionsList.reduce((acc, restriction) => {
      const {
        normalizedEvents,
        beforeMinutes,
        afterMinutes,
        dateScope,
        dedupKey
      } = getPrayerRestrictionParts(restriction);
      const eventLabels = normalizedEvents.map(prayerEventValueToLabel);

      if (seen.has(dedupKey) || !dateScope?.length) return acc;
      seen.add(dedupKey);

      acc.push({
        events: normalizedEvents,
        before_minutes: beforeMinutes,
        after_minutes: afterMinutes,
        date_scope: dateScope,
        title: restriction?.title
          ?? restriction?.label
          ?? (eventLabels.length
            ? `${eventLabels.join(' و ')} : ${beforeMinutes || 0} دقیقه قبل الی ${afterMinutes || 0} دقیقه بعد`
            : '')
      });

      return acc;
    }, []);
  };

  const handleSaveFileWithDetails = () => {
    if (!pendingFileInfo) return;

    if (!fileUploadTitle.trim()) {
      alert('لطفا عنوان فایل را وارد کنید');
      return;
    }

    if (!fileUploadDescription.trim()) {
      alert('لطفا توضیحات فایل را وارد کنید');
      return;
    }

    const newFile = {
      id: Date.now() + Math.random(),
      file: pendingFileInfo.file,
      name: pendingFileInfo.name,
      originalName: pendingFileInfo.name,
      title: fileUploadTitle,
      description: fileUploadDescription,
      languageTitles: { ...fileLanguageTitles },
      languageDescriptions: { ...fileLanguageDescriptions },
      type: pendingFileInfo.type,
      size: pendingFileInfo.size,
      url: pendingFileInfo.url || URL.createObjectURL(pendingFileInfo.file),
      fileType: pendingFileInfo.fileType,
      originalFileType: pendingFileInfo.originalFileType,
      uploadedAt: new Date().toISOString(),
      metadata: {
        dimensions: pendingFileInfo.dimensions,
        duration: pendingFileInfo.duration,
        pageCount: pendingFileInfo.pageCount
      }
    };

    // Add to appropriate state based on file type
    switch (pendingFileInfo.fileType) {
      case 'image':
        // Images go to profileImages with isPrimary flag
        newFile.isPrimary = profileImages.length === 0 && !primaryImage;
        newFile.orientation = selectedOrientation;
        setProfileImages(prev => [...prev, newFile]);
        if (profileImages.length === 0 && !primaryImage) {
          setPrimaryImage(newFile);
        }
        break;
      case 'video':
        // Videos go to profileImages
        newFile.isPrimary = profileImages.length === 0 && !primaryImage;
        newFile.isVideo = true;
        setProfileImages(prev => [...prev, newFile]);
        if (profileImages.length === 0 && !primaryImage) {
          setPrimaryImage(newFile);
        }
        break;
      case 'audio':
        setAudioFiles(prev => [...prev, newFile]);
        break;
      case 'text':
        setTextFiles(prev => [...prev, newFile]);
        break;
      default:
        // For unknown types, add to text files
        setTextFiles(prev => [...prev, newFile]);
    }

    // Check if there are more files to process
    const nextFileInput = document.querySelector('.file-input-hidden[data-file-index]');
    if (nextFileInput && pendingFileInfo.index !== null &&
      pendingFileInfo.index + 1 < pendingFileInfo.totalFiles) {
      // There are more files, trigger next file
      const nextIndex = pendingFileInfo.index + 1;
      // You would need to store all files and process them sequentially
      // For now, we'll just close and let user select next file
      alert(`فایل ${pendingFileInfo.name} آپلود شد. لطفا فایل بعدی را انتخاب کنید.`);
    }

    // Close modal and reset
    setIsFileUploadModalOpen(false);
    setPendingFileInfo(null);
    setFileUploadTitle('');
    setFileUploadDescription('');
    setFileLanguageTitles({
      english: '',
      arabic: '',
      urdu: ''
    });
    setFileLanguageDescriptions({
      english: '',
      arabic: '',
      urdu: ''
    });
    setSelectedOrientation('');
  };

  const openFileLanguageModal = () => {
    setIsFileLanguageModalOpen(true);
  };

  const handleFileLanguageTitleChange = (language, value) => {
    setFileLanguageTitles(prev => ({
      ...prev,
      [language]: value
    }));
  };

  const handleFileLanguageDescriptionChange = (language, value) => {
    setFileLanguageDescriptions(prev => ({
      ...prev,
      [language]: value
    }));
  };

  const handleSaveFileLanguageInfo = () => {
    setIsFileLanguageModalOpen(false);
  };



  useEffect(() => {
    document.title = 'Admin Panel';

    const metaConfigs = [
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
      },
      { name: 'theme-color', content: '#000000' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
    ];

    const metaState = metaConfigs.map(({ name, content }) => {
      let element = document.querySelector(`meta[name="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('name', name);
        document.head.appendChild(element);
        return { element, previousContent: null, created: true, content };
      }

      const previousContent = element.getAttribute('content');
      return { element, previousContent, created: false, content };
    });

    metaState.forEach(({ element, content }) => {
      element.setAttribute('content', content);
    });

    return () => {
      metaState.forEach(({ element, previousContent, created }) => {
        if (created) {
          element.remove();
        } else if (previousContent !== null) {
          element.setAttribute('content', previousContent);
        }
      });
    };
  }, []);

  const handleAvatarClick = () => {
    setIsAvatarModalOpen(true);
  };

  const handleAvatarFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('فقط فایل‌های تصویری (JPEG, PNG, GIF, WebP) مجاز هستند');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('حجم فایل نباید بیشتر از ۵ مگابایت باشد');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAvatar = () => {
    if (!avatarPreview) {
      alert('لطفا تصویری انتخاب کنید');
      return;
    }

    setIsUploadingAvatar(true);

    // In a real application, you would upload to your server here
    // For now, we'll just save it locally in state
    setTimeout(() => {
      setAdminAvatar(avatarPreview);
      setAvatarPreview(null);
      setIsAvatarModalOpen(false);
      setIsUploadingAvatar(false);

      // Show success message
      alert('تصویر پروفایل با موفقیت آپلود شد');
    }, 1000);
  };

  const handleSettingsClick = () => {
    setIsSettingsModalOpen(true);
  };

  const handleChangePasswordClick = () => {
    setIsChangePasswordModalOpen(true);
  };

  const handleSupportClick = () => {
    setIsSupportModalOpen(true);
  };

  const handleCloseSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  const handleCloseChangePasswordModal = () => {
    setIsChangePasswordModalOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleCloseSupportModal = () => {
    setIsSupportModalOpen(false);
    setSupportName('');
    setSupportEmail('');
    setSupportPhone('');
    setSupportMessage('');
  };

  const handleChangePassword = async () => {

    if (!currentPassword) {
      alert('لطفا رمز عبور فعلی را وارد کنید');
      return;
    }

    if (!newPassword) {
      alert('لطفا رمز عبور جدید را وارد کنید');
      return;
    }

    if (newPassword.length < 6) {
      alert('رمز عبور جدید باید حداقل ۶ کاراکتر باشد');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('رمز عبور جدید با تأیید آن مطابقت ندارد');
      return;
    }

    try {
      setIsChangingPassword(true);

      // Here you would make an API call to change password
      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast.success('رمز عبور با موفقیت تغییر یافت');
      handleCloseChangePasswordModal();
    } catch (error) {
      toast.error('خطا در تغییر رمز عبور');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSendSupportMessage = async () => {

    if (!supportName.trim()) {
      alert('لطفا نام خود را وارد کنید');
      return;
    }

    if (!supportEmail.trim()) {
      alert('لطفا ایمیل خود را وارد کنید');
      return;
    }

    if (!supportPhone.trim()) {
      alert('لطفا شماره تلفن خود را وارد کنید');
      return;
    }

    if (!supportMessage.trim()) {
      alert('لطفا پیام خود را وارد کنید');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(supportEmail)) {
      alert('لطفا یک ایمیل معتبر وارد کنید');
      return;
    }

    const phoneRegex = /^[\d\s\+]+$/;
    if (!phoneRegex.test(supportPhone.replace(/\s+/g, ''))) {
      alert('لطفا یک شماره تلفن معتبر وارد کنید');
      return;
    }

    try {
      setIsSendingSupport(true);

      await new Promise(resolve => setTimeout(resolve, 1500));

      toast.success('پیام شما با موفقیت ارسال شد. تیم پشتیبانی به زودی با شما تماس خواهد گرفت.');
      handleCloseSupportModal();
    } catch (error) {
      toast.error('خطا در ارسال پیام. لطفا مجددا تلاش کنید.');
    } finally {
      setIsSendingSupport(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAdminAvatar(null);
    setAvatarPreview(null);
    setIsAvatarModalOpen(false);
    alert('تصویر پروفایل حذف شد');
  };
  const [barData, setBarData] = useState([]);

  const generateBarData = (filter) => {
    const now = new Date();
    const currentJalali = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const jalaliMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

    switch (filter) {
      case 'هفته اخیر':
        return [
          { day: 'شنبه', value: 70, count: 175, label: 'شنبه' },
          { day: 'یکشنبه', value: 45, count: 112, label: 'یکشنبه' },
          { day: 'دوشنبه', value: 85, count: 213, label: 'دوشنبه' },
          { day: 'سه شنبه', value: 60, count: 150, label: 'سه شنبه' },
          { day: 'چهارشنبه', value: 30, count: 75, label: 'چهارشنبه' },
          { day: 'پنجشنبه', value: 90, count: 225, label: 'پنجشنبه' },
          { day: 'جمعه', value: 50, count: 125, label: 'جمعه' }
        ];

      case 'ماه اخیر':
        const currentMonth = jalaliMonths[currentJalali.jm - 1];
        return [
          { day: `هفته اول ${currentMonth}`, value: 65, count: 650, label: 'هفته اول' },
          { day: `هفته دوم ${currentMonth}`, value: 80, count: 800, label: 'هفته دوم' },
          { day: `هفته سوم ${currentMonth}`, value: 55, count: 550, label: 'هفته سوم' },
          { day: `هفته چهارم ${currentMonth}`, value: 75, count: 750, label: 'هفته چهارم' }
        ];

      case 'سه ماه اخیر':
        const last3Months = [];
        for (let i = 2; i >= 0; i--) {
          const monthIndex = (currentJalali.jm - 1 - i + 12) % 12;
          last3Months.push(jalaliMonths[monthIndex]);
        }

        return last3Months.map((month, index) => ({
          day: month,
          value: [70, 60, 80][index],
          count: [2800, 2400, 3200][index],
          label: month
        }));

      case 'سال اخیر':
        const yearData = [
          { value: 60, count: 500 },  // فروردین
          { value: 65, count: 1950 },  // اردیبهشت
          { value: 70, count: 2100 },  // خرداد
          { value: 75, count: 2250 },  // تیر
          { value: 80, count: 2400 },  // مرداد
          { value: 85, count: 2550 },  // شهریور
          { value: 90, count: 2700 },  // مهر
          { value: 85, count: 2550 },  // آبان
          { value: 80, count: 2400 },  // آذر
          { value: 75, count: 2250 },  // دی
          { value: 70, count: 2100 },  // بهمن
          { value: 65, count: 1950 }   // اسفند
        ];

        return jalaliMonths.map((month, index) => ({
          day: month,
          value: yearData[index].value,
          count: yearData[index].count,
          label: month
        }));

      default:
        return generateBarData('هفته اخیر');
    }
  };

  const getYAxisLabels = (filter) => {
    const overrideLabels = barChartYAxisOverrides[filter];
    if (overrideLabels?.length) {
      return overrideLabels;
    }

    switch (filter) {
      case 'هفته اخیر':
        return [250, 200, 150, 100, 50, 0];
      case 'ماه اخیر':
        return [1000, 800, 600, 400, 200, 0];
      case 'سه ماه اخیر':
        return [3500, 3000, 2500, 2000, 1500, 1000, 500, 0];
      case 'سال اخیر':
        return [3000, 2500, 2000, 1500, 1000, 500, 0];
      default:
        return [250, 200, 150, 100, 50, 0];
    }
  };

  const loadDashboardSummary = useCallback(async () => {
    setIsLoadingDashboardSummary(true);
    try {
      const data = await fetchDashboardSummary();
      setDashboardSummary({
        totalUsers: data?.totalUsers ?? 0,
        successfulNavigations: data?.successfulNavigations ?? 0,
        culturalCenters: data?.culturalCenters ?? 0,
        lastUpdated: data?.lastUpdated || ''
      });
    } catch (error) {
      console.error('خطا در دریافت خلاصه داشبورد', error);
      toast.error('خطا در دریافت خلاصه داشبورد');
    } finally {
      setIsLoadingDashboardSummary(false);
    }
  }, []);

  const loadUserVisits = useCallback(async (filter = barChartTimeFilter) => {
    setIsLoadingBarChart(true);
    setSelectedBar(null);
    try {
      const data = await fetchDashboardUserVisits({ range: mapTimeFilterToRange(filter) });
      const normalizedBars = (data?.labels || []).map((label, index) => ({
        day: label,
        label,
        count: Number(data?.data?.[index]) || 0
      }));

      setBarData(normalizedBars.length ? normalizedBars : generateBarData(filter));

      const yAxisLabels = buildYAxisLabelsFromMax(data?.maxYAxis);
      if (yAxisLabels.length) {
        setBarChartYAxisOverrides((prev) => ({ ...prev, [filter]: yAxisLabels }));
      }
    } catch (error) {
      console.error('خطا در دریافت آمار بازدید کاربران', error);
      toast.error('خطا در دریافت آمار بازدید کاربران');
      setBarData(generateBarData(filter));
    } finally {
      setIsLoadingBarChart(false);
    }
  }, [barChartTimeFilter]);

  const loadCommentStats = useCallback(async (filter = pieChartTimeFilter) => {
    setIsLoadingCommentStats(true);
    try {
      const data = await fetchDashboardCommentStats({ range: mapCommentFilterToRange(filter) });
      setCommentStats({
        total: data?.total ?? 0,
        approved: data?.approved ?? 0,
        rejected: data?.rejected ?? 0
      });
    } catch (error) {
      console.error('خطا در دریافت آمار دیدگاه‌ها', error);
      toast.error('خطا در دریافت آمار دیدگاه‌ها');
    } finally {
      setIsLoadingCommentStats(false);
    }
  }, [pieChartTimeFilter]);

  const loadNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const data = await fetchDashboardNotifications({ limit: 10, unreadOnly: false });
      const now = new Date();
      const normalized = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];

      const normalizeCreatedAt = (value) => {
        if (typeof value === 'string' && value.includes(' ') && !value.includes('T')) {
          const candidate = value.replace(' ', 'T');
          const parsed = new Date(candidate);
          if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString();
          }
        }

        return value;
      };

      setNotifications(normalized.map((item, index) => {
        const type = item?.type === 'new_comment'
          ? 'comment'
          : item?.type === 'new_user'
            ? 'user'
            : 'feedback';

        const createdAtValue = normalizeCreatedAt(item?.createdAt);
        const parsedDate = new Date(createdAtValue || Date.now());
        const validDate = Number.isNaN(parsedDate.getTime()) ? now : parsedDate;
        const safeDate = validDate > now ? now : validDate;
        const createdAtText = formatDateTimeString(safeDate);

        return {
          id: item?.id ?? `${item?.type || 'notif'}-${item?.entityId || index}-${item?.createdAt || index}`,
          title: item?.title || 'اعلان',
          message: item?.message || '',
          createdAt: safeDate.toISOString(),
          time: createdAtText,
          read: Boolean(item?.read),
          type
        };
      }));
    } catch (error) {
      console.error('خطا در دریافت اعلان‌ها', error);
      toast.error('خطا در دریافت اعلان‌ها');
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  const loadRecentUsers = useCallback(async ({
    page = 1,
    pageSize = itemsPerPage,
    search = ''
  } = {}) => {
    setIsLoadingRecentUsers(true);
    try {
      const data = await fetchDashboardRecentUsers({ page, pageSize, search });
      const normalizedUsers = Array.isArray(data?.data) ? data.data : [];

      setUsers(normalizedUsers.map((user, index) => ({
        id: user?.id ?? index,
        fullName: user?.name || user?.fullName || user?.email || '---',
        phone: user?.phone || '-',
        registerDate: formatDateTimeString(user?.joinDate) || '',
        gender: user?.gender || '-',
        successCount: Number(user?.successCount) || 0
      })));

      if (data?.pagination) {
        const { page: respPage, pageSize: respPageSize, total, pages } = data.pagination;
        setRecentUsersPagination({
          page: respPage ?? page,
          pageSize: respPageSize ?? pageSize,
          total: total ?? normalizedUsers.length,
          pages: pages ?? Math.max(1, Math.ceil((total ?? normalizedUsers.length) / (respPageSize || pageSize || 1)))
        });
      } else {
        setRecentUsersPagination({
          page,
          pageSize,
          total: normalizedUsers.length,
          pages: Math.max(1, Math.ceil(normalizedUsers.length / (pageSize || 1)))
        });
      }
    } catch (error) {
      console.error('خطا در دریافت کاربران اخیر', error);
      toast.error('خطا در دریافت کاربران اخیر');
    } finally {
      setIsLoadingRecentUsers(false);
    }
  }, [itemsPerPage]);

  useEffect(() => {
    loadDashboardSummary();
  }, [loadDashboardSummary]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    loadUserVisits(barChartTimeFilter);
  }, [barChartTimeFilter, loadUserVisits]);

  useEffect(() => {
    loadCommentStats(pieChartTimeFilter);
  }, [pieChartTimeFilter, loadCommentStats]);

  useEffect(() => {
    loadRecentUsers({ page: currentPage, pageSize: itemsPerPage, search: searchTerm });
  }, [currentPage, itemsPerPage, searchTerm, loadRecentUsers]);

  const loadCulturalItems = useCallback(async () => {
    setIsLoadingCultural(true);
    try {
      const data = await fetchCulturalItems({
        page: culturalCurrentPage,
        pageSize: culturalItemsPerPage,
        search: culturalSearchTerm
      });
      setCulturalData(data.items || []);
      setCulturalTotalItems(data.totalItems || 0);
    } catch (error) {
      console.error('خطا در دریافت اطلاعات فرهنگی:', error);
      toast.error('خطا در دریافت اطلاعات فرهنگی');
    } finally {
      setIsLoadingCultural(false);
    }
  }, [culturalCurrentPage, culturalItemsPerPage, culturalSearchTerm]);

  useEffect(() => {
    loadCulturalItems();
  }, [loadCulturalItems]);

  // Add these handler functions with other handler functions
  const handleDeleteCultural = (id) => {
    setCulturalToDelete(id);
    setIsDeleteCulturalModalOpen(true);
  };

  const confirmDeleteCultural = async () => {
    if (!culturalToDelete) return;
    try {
      await deleteCulturalItem(culturalToDelete);
      toast.success('آیتم فرهنگی با موفقیت حذف شد');
      loadCulturalItems();
    } catch (error) {
      console.error('حذف آیتم فرهنگی با خطا مواجه شد', error);
      toast.error('حذف آیتم فرهنگی با خطا مواجه شد');
    } finally {
      setIsDeleteCulturalModalOpen(false);
      setCulturalToDelete(null);
    }
  };

  const handleCulturalPageChange = (pageNumber) => {
    setCulturalCurrentPage(pageNumber);
  };

  const handleCulturalItemsPerPageChange = (value) => {
    setCulturalItemsPerPage(parseInt(value));
    setCulturalCurrentPage(1);
  };

  const getCulturalPageNumbers = () => {
    const totalItems = culturalTotalItems;
    const totalPages = Math.ceil(totalItems / culturalItemsPerPage);
    const maxVisiblePages = 6;
    const pages = [];

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, culturalCurrentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedBar !== null && !event.target.closest('.bar-chart-container')) {
        setSelectedBar(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedBar]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isPieChartFilterOpen &&
        !event.target.closest('.time-filter') &&
        !event.target.closest('.chart-filter')) {
        setIsPieChartFilterOpen(false);
      }
      if (isBarChartFilterOpen &&
        !event.target.closest('.time-filter') &&
        !event.target.closest('.chart-filter')) {
        setIsBarChartFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPieChartFilterOpen, isBarChartFilterOpen]);

  useEffect(() => {
    let isMounted = true;

    const languageGroup = getLanguageName(language);

    setIsLoadingGroups(true);
    fetchGroupMetadata({ language, withPng: false, group: languageGroup })
      .then((groupData) => {
        if (!isMounted) return;
        const normalizedGroups = normalizeGroupMetadata(groupData?.groups, language);
        const translatedGroups = normalizedGroups.map((group) => ({
          ...group,
          label: translateLabel(group.label)
        }));
        setGroupOptions(dedupeByValue(translatedGroups));
      })
      .catch((error) => {
        console.error('Failed to load group metadata', error);
        toast.error('بارگذاری گروه‌ها با مشکل مواجه شد');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingGroups(false);
      });

    return () => {
      isMounted = false;
    };
  }, [language, translateLabel]);

  useEffect(() => {
    if (!placeCategory) {
      setSubGroupOptions([]);
      return;
    }

    let isMounted = true;
    setIsLoadingSubGroups(true);
    setSubGroupOptions([]);

    fetchSubGroups({ language, groups: [placeCategory], withImages: false })
      .then((subGroupData) => {
        if (!isMounted) return;
        const normalized = normalizeSubGroupMetadata(subGroupData?.subGroups, language);
        const translatedSubGroups = (normalized[placeCategory] || []).map((subGroup) => ({
          ...subGroup,
          label: translateLabel(subGroup.label)
        }));
        setSubGroupOptions(dedupeByValue(translatedSubGroups));
      })
      .catch((error) => {
        console.error('Failed to load sub groups', error);
        toast.error('بارگذاری زیرگروه‌ها با مشکل مواجه شد');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingSubGroups(false);
      });

    return () => {
      isMounted = false;
    };
  }, [language, placeCategory, translateLabel]);

  const fetchCategories = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(categoryCurrentPage),
      pageSize: String(categoryItemsPerPage),
      search: categorySearchTerm,
      includeSubcategories: '1'
    });

    try {
      const response = await adminFetch(`${API_BASE}/categories?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        const errorMessage = getApiErrorMessage({ response: { data } }, 'خطا در دریافت دسته‌بندی‌ها');
        throw new Error(errorMessage);
      }
      setCategories(Array.isArray(data.items) ? data.items : []);
      setCategoryTotalItems(Number(data.total) || 0);
      setCategoryError('');
    } catch (error) {
      console.error('Failed to fetch categories', error);
      const errorMessage = getApiErrorMessage(error, 'خطا در دریافت دسته‌بندی‌ها');
      setCategoryError(errorMessage);
      toast.error(errorMessage);
    }
  }, [API_BASE, adminFetch, categoryCurrentPage, categoryItemsPerPage, categorySearchTerm]);

  const fetchCulturalCategories = useCallback(async () => {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '200',
      search: '',
      includeSubcategories: '1'
    });

    try {
      const response = await adminFetch(`${API_BASE}/categories?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = getApiErrorMessage({ response: { data } }, 'خطا در دریافت دسته‌بندی‌ها');
        throw new Error(errorMessage);
      }

      const categoryItems = Array.isArray(data?.items) ? data.items : [];
      setCulturalCategories(categoryItems);
      return categoryItems;
    } catch (error) {
      console.error('Failed to fetch cultural categories', error);
      toast.error('بارگذاری دسته‌بندی‌های فرهنگی با مشکل مواجه شد');
      return [];
    }
  }, [API_BASE, adminFetch]);

  const fetchCategorySubcategories = useCallback(async (categoryId) => {
    if (!categoryId) return [];

    try {
      const response = await adminFetch(`${API_BASE}/categories/${categoryId}/subcategories`);
      if (!response.ok) {
        throw new Error('Failed to fetch subcategories');
      }

      const data = await response.json();
      const subcategories = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
          ? data
          : [];

      setCategories((prev) => prev.map((category) => {
        const value = category.id ?? category.value ?? category._id ?? category.title;
        if (String(value) !== String(categoryId)) return category;
        return {
          ...category,
          subcategories,
          numSubcategories: subcategories.length
        };
      }));

      return subcategories;
    } catch (error) {
      console.error('Failed to fetch subcategories', error);
      alert('خطا در دریافت زیرگروه‌ها');
      return [];
    }
  }, [API_BASE, adminFetch]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const culturalGroupOptions = useMemo(
    () => dedupeByValue(
      (culturalCategories || []).map((category) => ({
        ...category,
        value: category?.id ?? category?.value ?? category?._id ?? category?.meta?.code ?? category?.title,
        label: resolveLocalizedCategoryLabel(category)
      }))
    ),
    [culturalCategories, resolveLocalizedCategoryLabel]
  );

  const fetchCulturalSubGroupOptions = useCallback(async (groupId) => {
    if (!groupId) return [];

    let categoryList = culturalCategories;
    if (!categoryList || categoryList.length === 0) {
      categoryList = await fetchCulturalCategories();
    }

    const targetCategory = categoryList.find((category) => {
      const categoryValue = category?.id ?? category?.value ?? category?._id ?? category?.meta?.code ?? category?.title;
      return String(categoryValue) === String(groupId);
    });

    const translatedSubGroups = (targetCategory?.subcategories || []).map((subGroup) => ({
      ...subGroup,
      value: subGroup?.id ?? subGroup?.value ?? subGroup?._id ?? subGroup?.title,
      label: resolveLocalizedCategoryLabel(subGroup)
    }));

    return dedupeByValue(translatedSubGroups);
  }, [culturalCategories, fetchCulturalCategories, resolveLocalizedCategoryLabel]);

  const toggleUserManagement = () => {
    setUserManagementOpen(!userManagementOpen);
  };

  const togglefacManagement = () => {
    setfacManagementOpen(!facManagementOpen);
  };


  const handleSaveAllPlaceData = () => {
    const placeData = {
      name: placeName,
      category: placeCategory,
      subcategory: placeSubcategory,
      function: placeFunction,
      transport: selectedTransport,
      genderAccess: selectedGenderAccess,
      restrictions: timeRestrictions,
      createdAt: new Date().toISOString()
    };

    console.log('Saving place data with restrictions:', placeData);
    alert(`مکان جدید با ${timeRestrictions.length} محدودیت ثبت شد`);

    // Close modal and reset
    setIsAddPlaceModalOpen(false);
    resetForm();
  };

  const openAddressLanguageModal = (fieldType = 'address') => {
    setCurrentAddressField(fieldType);
    setIsAddressLanguageModalOpen(true);
  };

  const handleSaveLanguageAddresses = () => {
    setIsAddressLanguageModalOpen(false);
  };

  const handleLanguageAddressChange = (language, value) => {
    setLanguageAddresses(prev => ({
      ...prev,
      [language]: value
    }));
  };

  const handleEditCultural = async (id) => {
    try {
      const itemToEdit = await fetchCulturalItemDetails(id);
      if (!itemToEdit) return;

      setEditingCulturalId(id);
      setEditingCulturalData({ ...itemToEdit });

      setCulturalTitle(itemToEdit.title || '');
      setCulturalDescription(itemToEdit.description || '');
      setPlaceAddress(itemToEdit.addressInShrine || '');
      setCulturalPoiId(itemToEdit.poiId || '');

      const itemTitles = itemToEdit.titles || {};
      const itemDescriptions = itemToEdit.descriptions || {};

      setLanguageTitles({
        english: itemTitles.en || '',
        arabic: itemTitles.ar || '',
        urdu: itemTitles.ur || ''
      });

      setLanguageDescriptions({
        english: itemDescriptions.en || '',
        arabic: itemDescriptions.ar || '',
        urdu: itemDescriptions.ur || ''
      });

      const resolvedPlaceType = itemToEdit.placeType
        || itemToEdit.place_type
        || itemToEdit.settings?.placeType
        || '';

      const resolvedPlaceLabel = resolvedPlaceType
        ? placeTypeValueToLabel(resolvedPlaceType)
        : placeTypeValueToLabel(placeTypeLabelToValue(itemToEdit.culturalTypes?.[0]));

      setSelectedPlaceType(resolvedPlaceType || placeTypeLabelToValue(itemToEdit.culturalTypes?.[0]) || '');
      if (resolvedPlaceLabel) {
        setSelectedCulturalTypes([resolvedPlaceLabel]);
      } else if (itemToEdit.culturalTypes) {
        setSelectedCulturalTypes([...itemToEdit.culturalTypes]);
      }

      // Add group and subgroup data - UPDATED
      const grouping = itemToEdit.grouping || {};
      const groupId = grouping.group_id || itemToEdit.group_id || '';
      const subGroupId = grouping.sub_group_id || itemToEdit.sub_group_id || '';

      setCulturalPlaceCategory(groupId);
      setCulturalPlaceSubcategory(subGroupId);

      // Load sub-groups for the selected group
      if (groupId) {
        setIsLoadingCulturalSubGroups(true);
        try {
          const subGroupList = await fetchCulturalSubGroupOptions(groupId);

          setCulturalSubGroupOptions(subGroupList);
          if (subGroupId && !subGroupList.some((sub) => String(sub.value) === String(subGroupId))) {
            setCulturalPlaceSubcategory('');
          }
        } catch (error) {
          console.error('Failed to load sub groups for edit', error);
        } finally {
          setIsLoadingCulturalSubGroups(false);
        }
      }

      const resolvedDisplaySettings = normalizeDisplaySettings({
        ...(itemToEdit.displaySettings || {}),
        ...(itemToEdit.display_settings || {}),
        showUserFeedbacks: itemToEdit.showUserFeedbacks ?? itemToEdit.show_user_feedbacks,
        showMediaGallery: itemToEdit.showMediaGallery ?? itemToEdit.show_media_gallery,
        showUserComments: itemToEdit.showUserComments ?? itemToEdit.show_user_comments,
        showMultimedia: itemToEdit.showMultimedia ?? itemToEdit.show_multimedia
      });
      setShowUserFeedbacks(Boolean(resolvedDisplaySettings.showUserFeedbacks));
      setShowMediaGallery(Boolean(resolvedDisplaySettings.showMediaGallery));

      const resolvedTimeRestrictions = normalizeTimeRestrictions(
        itemToEdit.restrictions?.timeRestrictions
        || itemToEdit.restrictions?.time_restrictions
        || itemToEdit.timeRestrictions
        || itemToEdit.time_restrictions
        || []
      );

      const resolvedPrayerRestrictions = normalizePrayerRestrictions(
        itemToEdit.restrictions?.prayerTimeRestrictions
        || itemToEdit.restrictions?.prayer_time_restrictions
        || itemToEdit.prayerTimeRestrictions
        || itemToEdit.prayer_restrictions
        || []
      );

      setCulturalTimeRestrictions(resolvedTimeRestrictions);
      setCulturalPrayerTimeRestrictionsList(resolvedPrayerRestrictions);

      const normalizedAttachments = (itemToEdit.attachments || [])
        .map(file => normalizeMediaAttachment(file))
        .filter(Boolean);

      const normalizedMedia = normalizeLanguageMedia(itemToEdit.media);

      const seenAttachmentKeys = new Set();
      const dedupedAttachments = [...normalizedAttachments, ...normalizedMedia].filter((file) => {
        const key = file?.path || file?.url || file?.id;
        if (!key) return false;
        if (seenAttachmentKeys.has(key)) return false;
        seenAttachmentKeys.add(key);
        return true;
      });

      const imageAttachments = dedupedAttachments.filter((file) =>
        (file.type && file.type.startsWith('image')) || (file.mime && file.mime.startsWith('image'))
      );
      const audioAttachments = dedupedAttachments.filter((file) =>
        (file.type && file.type.startsWith('audio')) || (file.mime && file.mime.startsWith('audio'))
      );
      const textAttachments = dedupedAttachments.filter((file) =>
        !((file.type && (file.type.startsWith('image') || file.type.startsWith('audio') || file.type.startsWith('video')))
          || (file.mime && (file.mime.startsWith('image') || file.mime.startsWith('audio') || file.mime.startsWith('video'))))
      );

      const normalizedPrimary = itemToEdit.primaryImage
        ? normalizeMediaAttachment(itemToEdit.primaryImage)
        : imageAttachments[0] || null;

      const { primary, images } = normalizePrimaryMedia(normalizedPrimary, imageAttachments);

      setProfileImages(images);
      setAudioFiles(audioAttachments);
      setTextFiles(textAttachments);
      setPrimaryImage(primary || images[0] || null);

      if (itemToEdit.location) {
        setSelectedLocation({
          lat: itemToEdit.location.lat,
          lng: itemToEdit.location.lng
        });
      } else {
        setSelectedLocation(null);
      }

      setIsEditingCultural(true);
    } catch (error) {
      console.error('خطا در دریافت جزئیات آیتم فرهنگی', error);
      toast.error('دریافت جزئیات آیتم فرهنگی ناموفق بود');
    }
  };



  const handleRefreshMainTable = async (e) => {

    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setIsRefreshingMainTable(true);

    try {
      await loadRecentUsers({ page: currentPage, pageSize: itemsPerPage, search: searchTerm });
      toast.success('جدول به روز رسانی شد');
    } catch (error) {
      console.error('به‌روزرسانی جدول ناموفق بود', error);
      toast.error('به‌روزرسانی جدول ناموفق بود');
    } finally {
      setIsRefreshingMainTable(false);
    }
  };


  const handleSaveEditCultural = async () => {
    if (!editingCulturalId || !culturalTitle.trim()) {
      alert('لطفا عنوان را وارد کنید');
      return;
    }

    if (!selectedPlaceType) {
      setCulturalTypeError(true);
      alert('لطفا نوع مکان را انتخاب کنید');
      return;
    }

    try {
      const uploadedFiles = await uploadCulturalFiles([
        ...profileImages,
        ...audioFiles,
        ...textFiles
      ], editingCulturalId);

      const attachments = buildAttachmentPayload(uploadedFiles);
      const resolvedPrimary = uploadedFiles.find((file) => file.id === primaryImage?.id)
        || uploadedFiles.find((file) => file.isPrimary)
        || null;

      const selectedSubGroup = culturalSubGroupOptions.find(
        (subGroup) => String(subGroup.value) === String(culturalPlaceSubcategory)
      );

      const timeRestrictionsPayload = buildCulturalTimeRestrictionsPayload();
      const prayerRestrictionsPayload = buildCulturalPrayerRestrictionsPayload();
      const translationsPayload = buildCulturalTranslationsPayload(attachments);
      const settingsPayload = buildSettingsPayload();

      const payload = {
        poi_id: editingCulturalId,
        translations: translationsPayload,
        addressInShrine: placeAddress,
        grouping: {
          group_id: culturalPlaceCategory || null,
          sub_group_id: selectedSubGroup?.value || null,
          sub_group_label: selectedSubGroup?.label || null
        },
        settings: settingsPayload,
        time_restrictions: timeRestrictionsPayload,
        prayer_restrictions: prayerRestrictionsPayload,
        primaryImage: resolvedPrimary?.path || resolvedPrimary?.url || null,
        location: selectedLocation
          ? { lng: selectedLocation.lng, lat: selectedLocation.lat }
          : null
      };

      await updateCulturalItem(editingCulturalId, payload);
      toast.success('اطلاعات فرهنگی با موفقیت ویرایش شد');
      loadCulturalItems();
      exitEditMode();
    } catch (error) {
      console.error('خطا در ویرایش آیتم فرهنگی', error);
      toast.error('ویرایش آیتم فرهنگی ناموفق بود');
    }
  };

  const cleanupCulturalMap = useCallback(() => {
    console.log('Cultural map remove');
    if (currentMarker) {
      currentMarker.remove();
      setCurrentMarker(null);
    }

    if (culturalMap) {
      try {
        culturalMap.remove();
      } catch (error) {
        console.warn('Cultural map removal skipped', error);
      }
      setCulturalMap(null);
    }
  }, [currentMarker, culturalMap]);

  const formatJalaliDate = (date) => {
    const jalali = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());

    const jalaliMonths = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];

    return `${jalali.jd} ${jalaliMonths[jalali.jm - 1]} ${jalali.jy}`;
  };


  const categorizeNotificationsByPeriod = (notifications) => {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000));
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

    // Create period buckets
    const periods = [
      {
        label: 'last12Hours',
        start: twelveHoursAgo,
        end: now,
        displayText: '12 ساعت گذشته'
      },
      {
        label: '12to24Hours',
        start: twentyFourHoursAgo,
        end: twelveHoursAgo,
        displayText: 'دیروز'
      },
      {
        label: '24to48Hours',
        start: fortyEightHoursAgo,
        end: twentyFourHoursAgo,
        displayText: 'پریروز'
      }
    ];

    // Categorize notifications by type and period
    const categorized = {};

    // Initialize structure
    periods.forEach(period => {
      categorized[period.label] = {
        displayText: period.displayText,
        comments: [],
        feedbacks: [],
        users: []
      };
    });

    // Categorize each notification
    notifications.forEach(notification => {
      const parsedDate = new Date(notification?.createdAt || Date.now());
      const validDate = Number.isNaN(parsedDate.getTime()) ? now : parsedDate;
      const notificationDate = validDate > now ? now : validDate;

      // Find which period this notification belongs to
      let targetPeriod = null;
      for (const period of periods) {
        if (notificationDate >= period.start && notificationDate < period.end) {
          targetPeriod = period.label;
          break;
        }
      }

      // If notification is older than 48 hours, use actual date
      if (!targetPeriod && notificationDate < fortyEightHoursAgo) {
        targetPeriod = 'older';
        if (!categorized.older) {
          categorized.older = {};
        }
        const dateKey = formatJalaliDate(notificationDate);
        if (!categorized.older[dateKey]) {
          categorized.older[dateKey] = {
            displayText: dateKey,
            comments: [],
            feedbacks: [],
            users: []
          };
        }
      }

      // Categorize by type
      if (targetPeriod) {
        const periodData = targetPeriod === 'older'
          ? categorized.older[formatJalaliDate(notificationDate)]
          : categorized[targetPeriod];

        if (notification.type === 'comment') {
          periodData.comments.push(notification);
        } else if (notification.type === 'feedback') {
          periodData.feedbacks.push(notification);
        } else if (notification.type === 'user') {
          periodData.users.push(notification);
        }
      }
    });

    return categorized;
  };


  const categorizedData = categorizeNotificationsByPeriod(notifications);

  const getNotificationDisplayData = (categorizedData) => {
    const displayData = [];


    Object.entries(categorizedData).forEach(([periodKey, periodData]) => {
      if (typeof periodData === 'object' && !Array.isArray(periodData)) {

        const buildDisplayItem = (type, items, displayText, period) => {
          const totalCount = items.length;

          if (totalCount === 0) return;

          const unreadCount = items.filter(item => !item.read).length;

          displayData.push({
            type,
            count: totalCount,
            unreadCount,
            timeText: displayText,
            period
          });
        };

        if (periodKey === 'older') {
          Object.entries(periodData).forEach(([dateKey, dateData]) => {
            buildDisplayItem('comment', dateData.comments, `${dateData.displayText}`, 'older');
            buildDisplayItem('feedback', dateData.feedbacks, `${dateData.displayText}`, 'older');
            buildDisplayItem('user', dateData.users, `${dateData.displayText}`, 'older');
          });
        } else {
          // For regular time periods
          buildDisplayItem('comment', periodData.comments, periodData.displayText, periodKey);
          buildDisplayItem('feedback', periodData.feedbacks, periodData.displayText, periodKey);
          buildDisplayItem('user', periodData.users, periodData.displayText, periodKey);
        }
      }
    });

    return displayData;
  };

  const categorizedDisplayData = getNotificationDisplayData(categorizedData);
  const hasUnreadInLast12Hours = categorizedDisplayData.some(
    (item) => item.period === 'last12Hours' && item.unreadCount > 0
  );

  const exitEditMode = () => {
    // Clean up map and marker FIRST
    cleanupCulturalMap();

    // Reset edit mode states
    setIsEditingCultural(false);
    setEditingCulturalId(null);
    setEditingCulturalData(null);

    // Reset form but don't clean up map twice
    resetEditFormWithoutMapCleanup();

    // Navigate back
    setBreadcrumbPath(['منوی اصلی', 'مدیریت امکانات', 'مدیریت اطلاعات فرهنگی']);
  };

  useEffect(() => {
    let isMounted = true;
    setIsLoadingCulturalGroups(true);
    fetchCulturalCategories()
      .then((categories) => {
        if (!isMounted) return;
        setCulturalCategories(categories);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingCulturalGroups(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fetchCulturalCategories]);

  const resetEditFormWithoutMapCleanup = () => {
    setCulturalTitle('');
    setCulturalDescription('');
    setShowUserFeedbacks(true);
    setShowMediaGallery(true);
    setSelectedPlaceType('');
    setSelectedCulturalTypes([]);
    setPlaceAddress('');
    setCulturalPoiId('');
    setSelectedLocation(null);

    setCulturalPlaceCategory('');
    setCulturalPlaceSubcategory('');
    setCulturalSubGroupOptions([]);
    setIsLoadingCulturalGroups(false);
    setIsLoadingCulturalSubGroups(false);

    setProfileImages([]);
    setAudioFiles([]);
    setTextFiles([]);
    setPrimaryImage(null);

    setIsTitleLanguageModalOpen(false);
    setIsDescriptionLanguageModalOpen(false);
    setIsAddressLanguageModalOpen(false);

    setLanguageTitles({
      english: '',
      arabic: '',
      urdu: ''
    });
    setLanguageDescriptions({
      english: '',
      arabic: '',
      urdu: ''
    });
    setLanguageAddresses({
      english: '',
      arabic: '',
      urdu: ''
    });

    setCurrentTitleField(null);
    setCurrentDescriptionField(null);
    setCurrentAddressField(null);
  };

  const handleCancelEditCultural = () => {
    // Clean up map and marker
    cleanupCulturalMap();

    setIsEditingCultural(false);
    setEditingCulturalId(null);
    setEditingCulturalData(null);
    resetCulturalForm();

    setBreadcrumbPath(['منوی اصلی', 'مدیریت امکانات', 'مدیریت اطلاعات فرهنگی']);
  };

  const getPageTitle = () => {
    if (currentReportView === 'کاربران ثبت نام کرده') {
      return {
        title: 'گزارش کاربران ثبت نام کرده در نرم افزار مسیربایی حرم تا امروز',
        description: ''
      };
    }

    if (currentReportView === 'لاگ های مسیریابی کاربران') {
      return {
        title: 'گزارش لاگ های  کاربران در نرم افزار مسیربایی حرم',
        description: ''
      };
    }

    if (currentReportView === 'دیدگاه ها') {
      return {
        title: '  دیدگاه های کاربران در  نرم افزار مسیربایی حرم',
        description: ''
      };
    }

    if (currentReportView === 'مدیریت ادمین‌ها') {
      return {
        title: ' مدیریت ادمین های سیستم ',
        description: ''
      };
    }

    if (currentReportView === 'مدیریت دسته بندی‌ها') {
      return {
        title: ' مدیریت دسته ‌بندی‌های موجود در نرم افزار آستان قدس رضوی',
        description: ''
      };
    }

    if (currentReportView === 'بازخورد ها') {
      return {
        title: 'بازخوردهای ثبت شده ی کاربران در اپلیکیشن',
        description: ''
      };
    }


    if (isEditingCultural && editingCulturalData) {
      return {
        title: `ویرایش اطلاعات فرهنگی ${editingCulturalData.title}`,
        description: ''
      };
    }

    if (currentReportView === 'مدیریت صفحات') {
      return {
        title: 'مدیریت صفحات ایجاد شده مربوط به نرم‌افزار  آستان قدس رضوی',
        description: ''
      };
    }


    if (activeMenu === 'mapmanage') {
      return {
        title: ' مدیریت نقشه و نقاط و مکان های حرم مطهر',
        description: ''
      };
    }

    return {
      title: 'آمار و جزئیات کلی محصول مسیربایی حرم تا امروز',
      description: ''
    };

  };


  const handleCulturalTypeToggle = (type) => {
    const resolvedOption = PLACE_TYPE_OPTIONS.find((option) => option.label === type || option.value === type);
    if (!resolvedOption) return;

    if (selectedPlaceType === resolvedOption.value) {
      setSelectedPlaceType('');
      setSelectedCulturalTypes([]);
    } else {
      setSelectedPlaceType(resolvedOption.value);
      setSelectedCulturalTypes([resolvedOption.label]);
      setCulturalTypeError(false);
    }
  };

  const openAddCulturalModal = () => {
    setIsAddCulturalModalOpen(true);
    setCulturalStep(1);
  };

  const closeAddCulturalModal = () => {
    setIsAddCulturalModalOpen(false);
    resetCulturalForm();
  };

  const resetCulturalForm = () => {
    setCulturalStep(1);
    setCulturalTitle('');
    setCulturalDescription('');
    setShowUserFeedbacks(true);
    setShowMediaGallery(true);
    setSelectedPlaceType('');
    setSelectedCulturalTypes([]);
    setPlaceAddress('');
    setSelectedLocation(null);

    setIsEditingCultural(false);

    setCulturalPlaceCategory('');
    setCulturalPlaceSubcategory('');
    setCulturalSubGroupOptions([]);
    setIsLoadingCulturalGroups(false);
    setIsLoadingCulturalSubGroups(false);

    setProfileImages([]);
    setAudioFiles([]);
    setTextFiles([]);
    setPrimaryImage(null);

    setIsTitleLanguageModalOpen(false);
    setIsDescriptionLanguageModalOpen(false);
    setIsAddressLanguageModalOpen(false);

    setCulturalRestrictionFormOpen(false);
    setCulturalPrayerRestrictionFormOpen(false);
    setCulturalTimeRestrictions([]);
    setCulturalPrayerTimeRestrictionsList([]);
    setCulturalSelectedPrayerEvents([]);
    setCulturalPrayerBeforeMinutes('');
    setCulturalPrayerAfterMinutes('');

    // Reset prayer restriction form states
    setIsCulturalPrayerDateFilterOpen(false); // ADD THIS
    setCulturalPrayerRestrictionFormOpen(false); // ADD THIS
    setCulturalSelectedPrayerEvents([]); // ADD THIS
    setCulturalPrayerBeforeMinutes(''); // ADD THIS
    setCulturalPrayerAfterMinutes(''); // ADD THIS

    // Also reset the prayer time restrictions list if needed
    // setCulturalPrayerTimeRestrictionsList([]); // Uncomment if you want to clear saved restrictions too

    cleanupCulturalMap();

    setLanguageTitles({
      english: '',
      arabic: '',
      urdu: ''
    });
    setLanguageDescriptions({
      english: '',
      arabic: '',
      urdu: ''
    });
    setLanguageAddresses({
      english: '',
      arabic: '',
      urdu: ''
    });

    setCurrentTitleField(null);
    setCurrentDescriptionField(null);
    setCurrentAddressField(null);
    setTitleForModal('');
    setDescriptionForModal('');

    // Reset restriction states
    setCulturalTimeRestrictions([]);
    setCulturalPrayerTimeRestrictions([]);
    setIsCulturalDateFilterOpen(false);
    setCulturalSelectedDateFilter([]);
    setCulturalSelectedJalaliDate(null);
    setCulturalCalendarDate(() => {
      const now = new Date();
      const jalali = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      return { year: jalali.jy, month: jalali.jm, day: jalali.jd };
    });
    setCulturalSelectedRestrictionType(null);
    setCulturalRestrictionFormOpen(false);
    setCulturalSelectedGenderRestrictions([]);
    setCulturalTimeRestrictionPairs([{ start: '', end: '' }]);
    setCulturalLimitAllHours(false);

    // Prayer calendar states (already handled above with initial state)
    setCulturalPrayerCalendarDate({ year: 1403, month: 1 });
    setCulturalPrayerSelectedJalaliDate(null);
    setCulturalPrayerTimeRestrictionsList([]);
  };

  const handleCulturalNextStep = () => {
    if (culturalStep === 1) {
      if (!culturalTitle.trim()) {
        alert('لطفا عنوان را وارد کنید');
        return;
      }

      if (!selectedPlaceType) {
        setCulturalTypeError(true);
        alert('لطفا حداقل یک نوع مکان را انتخاب کنید');
        return;
      }

      setCulturalTypeError(false);
      setCulturalStep(2);

      setTimeout(() => {
        initializeCulturalMap();
      }, 100);

    } else if (culturalStep === 2) {
      if (!placeAddress.trim()) {
        alert('لطفا آدرس را وارد کنید');
        return;
      }

      if (!selectedLocation) {
        alert('لطفا یک نقطه روی نقشه انتخاب کنید');
        return;
      }

      setCulturalStep(3);
    } else if (culturalStep === 3) {
      setCulturalStep(4);
    }
  };


  // Cultural restriction handlers
  const handleCulturalDateFilterToggle = (filter) => {
    if (filter === 'انتخاب از تقویم') {
      setCulturalSelectedDateFilter([filter]);
      setIsCulturalDateFilterOpen(true);
      setCulturalRestrictionFormOpen(false);
      setCulturalSelectedRestrictionType(null);
      return;
    }

    if (filter === culturalSelectedRestrictionType && culturalRestrictionFormOpen) {
      setCulturalSelectedRestrictionType(null);
      setCulturalRestrictionFormOpen(false);
      setIsCulturalDateFilterOpen(false);
      return;
    }

    setCulturalSelectedDateFilter([filter]);
    setCulturalSelectedRestrictionType(filter);
    setCulturalRestrictionFormOpen(true);
    setIsCulturalDateFilterOpen(false);
  };

  const handleCulturalPrevMonth = () => {
    setCulturalCalendarDate(prev => {
      let newMonth = prev.month - 1;
      let newYear = prev.year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  const handleCulturalNextMonth = () => {
    setCulturalCalendarDate(prev => {
      let newMonth = prev.month + 1;
      let newYear = prev.year;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  const handleCulturalDaySelect = (day) => {
    setCulturalSelectedJalaliDate({
      year: culturalCalendarDate.year,
      month: culturalCalendarDate.month,
      day: day
    });

    const jalaliMonths = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];
    const dateText = `${day} ${jalaliMonths[culturalCalendarDate.month - 1]} ${culturalCalendarDate.year}`;

    setCulturalSelectedRestrictionType(`روز ${dateText}`);
    setIsCulturalDateFilterOpen(false);
    setCulturalRestrictionFormOpen(true);
    setCulturalTimeRestrictionPairs([{ start: '', end: '' }]);
    setCulturalLimitAllHours(false);
    setCulturalSelectedGenderRestrictions([]);
  };

  const renderCulturalJalaliCalendarDays = () => {
    const { year, month } = culturalCalendarDate;
    const now = new Date();
    const today = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const firstDay = jalaliMonthStart(year, month);
    const daysInMonth = jalaliMonthLength(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`cult-empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = year === today.jy && month === today.jm && day === today.jd;
      const isSelected = culturalSelectedJalaliDate &&
        culturalSelectedJalaliDate.year === year &&
        culturalSelectedJalaliDate.month === month &&
        culturalSelectedJalaliDate.day === day;

      days.push(
        <div
          key={`cult-day-${day}`}
          className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => handleCulturalDaySelect(day)}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  const handleCulturalAddTimeRestriction = () => {
    setCulturalTimeRestrictionPairs([...culturalTimeRestrictionPairs, { start: '', end: '' }]);
  };

  const handleCulturalRemoveTimeRestriction = (index) => {
    if (culturalTimeRestrictionPairs.length > 1) {
      const newPairs = culturalTimeRestrictionPairs.filter((_, i) => i !== index);
      setCulturalTimeRestrictionPairs(newPairs);
    }
  };

  const handleCulturalTimeChange = (index, field, value) => {
    const newPairs = [...culturalTimeRestrictionPairs];
    newPairs[index][field] = value;
    setCulturalTimeRestrictionPairs(newPairs);
  };

  const handleCulturalGenderRestrictionToggle = (gender) => {
    if (culturalSelectedGenderRestrictions.includes(gender)) {
      setCulturalSelectedGenderRestrictions(culturalSelectedGenderRestrictions.filter(g => g !== gender));
    } else {
      setCulturalSelectedGenderRestrictions([...culturalSelectedGenderRestrictions, gender]);
    }
  };

  const isCulturalRestrictionFormValid = () => {
    if (culturalSelectedGenderRestrictions.length === 0) {
      return false;
    }

    if (!culturalLimitAllHours) {
      const hasValidTimePairs = culturalTimeRestrictionPairs.every(pair =>
        pair.start && pair.end && pair.start !== '' && pair.end !== ''
      );

      if (!hasValidTimePairs) {
        return false;
      }

      const hasValidTimeOrder = culturalTimeRestrictionPairs.every(pair => {
        if (!pair.start || !pair.end) return false;
        const startMinutes = convertTimeToMinutes(pair.start);
        const endMinutes = convertTimeToMinutes(pair.end);
        return startMinutes < endMinutes;
      });

      if (!hasValidTimeOrder) {
        return false;
      }
    }

    return true;
  };

  const getCulturalRestrictionTitle = () => {
    if (!culturalSelectedRestrictionType) return '';

    if (culturalSelectedRestrictionType === 'همه روزه') return 'همه روزه';
    if (culturalSelectedRestrictionType === 'تمام این ماه') return 'این ماه';
    if (culturalSelectedRestrictionType === 'کل این هفته') return 'این هفته';
    if (culturalSelectedRestrictionType.startsWith('روز')) return culturalSelectedRestrictionType;

    return culturalSelectedRestrictionType;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications &&
        !event.target.closest('.notifications-btn') &&
        !event.target.closest('.notifications-popup')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Helper function to create custom marker element
  const createMarkerElement = () => {
    const el = document.createElement('div');
    el.innerHTML = `
    <svg width="24" height="41" viewBox="0 0 24 41" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clip-rule="evenodd" d="M12 0C5.37258 0 0 6.00388 0 12.75C0 19.4433 3.82999 26.7186 9.8056 29.5117C11.1986 30.1628 12.8014 30.1628 14.1944 29.5117C20.17 26.7186 24 19.4433 24 12.75C24 6.00388 18.6274 0 12 0ZM12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#EA4335"/>
      <path d="M12.0088 22.5685C7.15256 22.5687 3.21582 26.5061 3.21582 31.3624C3.21606 36.2185 7.15271 40.1552 12.0088 40.1554C16.8651 40.1554 20.8025 36.2187 20.8027 31.3624C20.8027 26.506 16.8652 22.5685 12.0088 22.5685Z" stroke="#EA4335" stroke-width="1.50419"/>
    </svg>
  `;
    el.style.cursor = 'pointer';
    el.style.width = '24px';
    el.style.height = '41px';
    return el;
  };

  const handleCulturalConfirmRestriction = () => {
    if (!isCulturalRestrictionFormValid()) {
      alert('لطفا اطلاعات محدودیت را به درستی تکمیل کنید');
      return;
    }

    const newRestriction = {
      id: Date.now(),
      date: getCulturalRestrictionTitle(),
      gender: [...culturalSelectedGenderRestrictions],
      timePairs: culturalLimitAllHours
        ? [{ start: '00:00', end: '23:59' }]
        : culturalTimeRestrictionPairs.filter(pair => pair.start && pair.end),
      limitAllHours: culturalLimitAllHours
    };

    setCulturalTimeRestrictions(prev => [...prev, newRestriction]);
    handleCulturalCloseRestrictionForm();
  };

  const handleCulturalCloseRestrictionForm = () => {
    setCulturalRestrictionFormOpen(false);
    setCulturalSelectedRestrictionType(null);
    setCulturalSelectedGenderRestrictions([]);
    setCulturalTimeRestrictionPairs([{ start: '', end: '' }]);
    setCulturalLimitAllHours(false);
    setCulturalSelectedDateFilter([]);
    setCulturalSelectedJalaliDate(null);
  };

  const removeCulturalRestriction = (index) => {
    setCulturalTimeRestrictions(prev => prev.filter((_, i) => i !== index));
  };

  // Prayer restriction handlers for cultural modal
  const handleCulturalPrayerPrevMonth = () => {
    setCulturalPrayerCalendarDate(prev => {
      let newMonth = prev.month - 1;
      let newYear = prev.year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };


  const initializeEditMap = () => {
    // Prevent re-initializing the edit map if it already exists
    if (culturalMap) {
      console.warn('پیش از این نقشه ایجاد شده است.');
      return;
    }

    if (!document.getElementById('edit-cultural-map-container')) {
      console.log('Map container not found');
      return;
    }

    console.log('Initializing edit map with selectedLocation:', selectedLocation);

    const mapInstance = new maplibregl.Map({
      container: 'edit-cultural-map-container',
      style: {
        ...offlineFallbackStyle,
        sources: {},
        layers: [
          {
            id: 'admin-map-background',
            type: 'background',
            paint: { 'background-color': '#0b192f' }
          }
        ]
      },
      center: selectedLocation ?
        [selectedLocation.lng, selectedLocation.lat] :
        [59.6161, 36.2908],
      zoom: 16,
    });

    mapInstance.addControl(new maplibregl.NavigationControl());

    const createRedMarker = () => {
      const el = document.createElement('div');
      el.innerHTML = `
        <svg width="24" height="41" viewBox="0 0 24 41" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clip-rule="evenodd" d="M12 0C5.37258 0 0 6.00388 0 12.75C0 19.4433 3.82999 26.7186 9.8056 29.5117C11.1986 30.1628 12.8014 30.1628 14.1944 29.5117C20.17 26.7186 24 19.4433 24 12.75C24 6.00388 18.6274 0 12 0ZM12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#EA4335"/>
          <path d="M12.0088 22.5685C7.15256 22.5687 3.21582 26.5061 3.21582 31.3624C3.21606 36.2185 7.15271 40.1552 12.0088 40.1554C16.8651 40.1554 20.8025 36.2187 20.8027 31.3624C20.8027 26.506 16.8652 22.5685 12.0088 22.5685Z" stroke="#EA4335" stroke-width="1.50419"/>
        </svg>
      `;
      el.style.cursor = 'pointer';
      el.style.width = '24px';
      el.style.height = '41px';

      el.style.transform = 'translate(-50%, -100%)';

      return el;
    };

    let marker = null;

    // Add initial marker if there's a selected location
    if (selectedLocation) {
      console.log('Adding marker at:', selectedLocation);
      marker = new maplibregl.Marker({
        element: createRedMarker()  // Use custom red marker
      })
        .setLngLat([selectedLocation.lng, selectedLocation.lat])
        .addTo(mapInstance);
      setCurrentMarker(marker);
    }

    // Add click event to map for selecting new location
    mapInstance.on('click', (e) => {
      const coordinates = e.lngLat;
      // بررسی اینکه آیا مکان جدید واقعاً متفاوت است
      if (!selectedLocation || (coordinates.lng !== selectedLocation.lng || coordinates.lat !== selectedLocation.lat)) {
        // Update selected location state
        setSelectedLocation(coordinates);

        // Remove existing marker if it exists
        if (marker) {
          marker.remove();
        }

        // Create new marker at clicked location WITH CUSTOM RED MARKER
        marker = new maplibregl.Marker({
          element: createRedMarker()  // Use custom red marker
        })
          .setLngLat([coordinates.lng, coordinates.lat])
          .addTo(mapInstance);

        // Update current marker in state
        setCurrentMarker(marker);

        console.log('New location selected:', coordinates);
        // پاک‌سازی منابع هنگام خروج از حالت ویرایش

      }
    });

    setCulturalMap(mapInstance);
    return mapInstance;
  }


  useEffect(() => {
    if (!isEditingCultural || !editingCulturalData) return;

    // Ensure not to reinitialize if already set up
    if (culturalMap) return;

    if (isEditingCultural && editingCulturalData && !culturalMap) {
      // Initialize edit map after a short delay to ensure DOM is ready
      editMapTimeoutRef.current = setTimeout(() => {
        initializeEditMap();
      }, 100);
    }

    return () => {
      if (editMapTimeoutRef.current) {
        clearTimeout(editMapTimeoutRef.current);
        editMapTimeoutRef.current = null;
      }
    };
  });

  const handleCulturalPrayerNextMonth = () => {
    setCulturalPrayerCalendarDate(prev => {
      let newMonth = prev.month + 1;
      let newYear = prev.year;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  const handleFileUpload = (event, fileType) => {
    const files = Array.from(event.target.files);

    files.forEach(file => {
      // Check file type
      if (file.type.startsWith('image/')) {
        // For images - show orientation modal
        const reader = new FileReader();
        reader.onload = (e) => {
          // Store the image data temporarily
          setPendingImageFile({
            file,
            url: e.target.result,
            type: file.type,
            name: file.name,
            size: file.size
          });
          // Show orientation modal for images only
          setShowOrientationModal(true);
        };
        reader.readAsDataURL(file);
      }
      else if (file.type.startsWith('video/')) {
        // For videos - upload directly without orientation modal
        const newFile = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          url: URL.createObjectURL(file),
          isPrimary: profileImages.length === 0 && !primaryImage,
          orientation: null // No orientation for videos
        };

        setProfileImages(prev => [...prev, newFile]);

        // Set as primary if it's the first media file
        if (profileImages.length === 0 && !primaryImage) {
          setPrimaryImage(newFile);
        }
      }
      else if (file.type.startsWith('audio/')) {
        // For audio files
        const audioUrl = URL.createObjectURL(file);
        setAudioFiles(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          url: audioUrl
        }]);
      }
      else if (file.type === 'application/pdf') {
        // For PDF files
        const pdfUrl = URL.createObjectURL(file);
        setTextFiles(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          url: pdfUrl
        }]);
      }
    });

    // Reset file input
    event.target.value = '';
  };

  const handleOrientationSelect = (orientation) => {
    if (!pendingImageFile) return;

    const newFile = {
      id: Date.now() + Math.random(),
      file: pendingImageFile.file,
      name: pendingImageFile.name,
      type: pendingImageFile.type,
      size: pendingImageFile.size,
      url: pendingImageFile.url,
      isPrimary: profileImages.length === 0 && !primaryImage,
      orientation: orientation
    };

    setProfileImages(prev => [...prev, newFile]);

    // Set as primary if it's the first image
    if (profileImages.length === 0 && !primaryImage) {
      setPrimaryImage(newFile);
    }

    // Reset and close modal
    setPendingImageFile(null);
    setSelectedOrientation('');
    setShowOrientationModal(false);
  };

  // Function to skip orientation selection
  const handleSkipOrientation = () => {
    if (!pendingImageFile) return;

    const newFile = {
      id: Date.now() + Math.random(),
      file: pendingImageFile.file,
      name: pendingImageFile.name,
      type: pendingImageFile.type,
      size: pendingImageFile.size,
      url: pendingImageFile.url,
      isPrimary: profileImages.length === 0 && !primaryImage,
      orientation: null // No orientation selected
    };

    setProfileImages(prev => [...prev, newFile]);

    // Set as primary if it's the first image
    if (profileImages.length === 0 && !primaryImage) {
      setPrimaryImage(newFile);
    }

    // Reset and close modal
    setPendingImageFile(null);
    setSelectedOrientation('');
    setShowOrientationModal(false);
  };

  // Set primary image handler
  const handleSetPrimaryImage = (imageId) => {
    const image = profileImages.find(img => img.id === imageId);
    if (image) {
      setPrimaryImage(image);
    }
  };

  const handleRemoveFile = async (fileId, fileType) => {
    let fileToRemove = null;

    if (fileType === 'image') {
      fileToRemove = profileImages.find(img => img.id === fileId);
      if (fileToRemove) {
        const remainingImages = profileImages.filter(img => img.id !== fileId);
        setProfileImages(remainingImages);

        // If removing primary image, set another image as primary or null
        if (primaryImage && primaryImage.id === fileId) {
          setPrimaryImage(remainingImages.length > 0 ? remainingImages[0] : null);
        }
      }
    } else if (fileType === 'audio') {
      fileToRemove = audioFiles.find(audio => audio.id === fileId);
      if (fileToRemove && fileToRemove.url) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      setAudioFiles(prev => prev.filter(audio => audio.id !== fileId));
    } else if (fileType === 'text') {
      fileToRemove = textFiles.find(text => text.id === fileId);
      if (fileToRemove && fileToRemove.url) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      setTextFiles(prev => prev.filter(text => text.id !== fileId));
    }

    const remotePath = fileToRemove?.path || fileToRemove?.url;
    const shouldDeleteRemote = fileToRemove && !fileToRemove.file && remotePath;

    if (shouldDeleteRemote) {
      try {
        await deleteFile(remotePath);
      } catch (error) {
        console.error('حذف فایل از سرور با خطا مواجه شد', error);
        toast.error('حذف فایل از سرور ناموفق بود');
      }
    }
  };

  const renderCulturalPrayerJalaliCalendarDays = () => {
    const { year, month } = culturalPrayerCalendarDate;
    const now = new Date();
    const today = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const firstDay = jalaliMonthStart(year, month);
    const daysInMonth = jalaliMonthLength(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`cult-p-empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = year === today.jy && month === today.jm && day === today.jd;
      const isSelected = culturalPrayerSelectedJalaliDate &&
        culturalPrayerSelectedJalaliDate.year === year &&
        culturalPrayerSelectedJalaliDate.month === month &&
        culturalPrayerSelectedJalaliDate.day === day;

      days.push(
        <div
          key={`cult-p-day-${day}`}
          className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => {
            setCulturalPrayerSelectedJalaliDate({ year, month, day });
            const jalaliMonths = [
              'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
              'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
            ];
            const dateText = `${day} ${jalaliMonths[month - 1]} ${year}`;
            setIsCulturalPrayerDateFilterOpen(false);
            setCulturalPrayerRestrictionFormOpen(true);
          }}
        >
          {day}
        </div>
      );
    }

    return days;
  };


  const createRedMarker = () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <svg width="24" height="41" viewBox="0 0 24 41" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clip-rule="evenodd" d="M12 0C5.37258 0 0 6.00388 0 12.75C0 19.4433 3.82999 26.7186 9.8056 29.5117C11.1986 30.1628 12.8014 30.1628 14.1944 29.5117C20.17 26.7186 24 19.4433 24 12.75C24 6.00388 18.6274 0 12 0ZM12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#EA4335"/>
        <path d="M12.0088 22.5685C7.15256 22.5687 3.21582 26.5061 3.21582 31.3624C3.21606 36.2185 7.15271 40.1552 12.0088 40.1554C16.8651 40.1554 20.8025 36.2187 20.8027 31.3624C20.8027 26.506 16.8652 22.5685 12.0088 22.5685Z" stroke="#EA4335" stroke-width="1.50419"/>
      </svg>
    `;
    el.style.cursor = 'pointer';
    el.style.width = '24px';
    el.style.height = '41px';
    return el;
  };

  const toggleCulturalPrayerEvent = (eventValue) => {
    if (culturalSelectedPrayerEvents.includes(eventValue)) {
      setCulturalSelectedPrayerEvents(culturalSelectedPrayerEvents.filter((value) => value !== eventValue));
    } else {
      setCulturalSelectedPrayerEvents([...culturalSelectedPrayerEvents, eventValue]);
    }
  };

  const removeCulturalDateFilter = (filter) => {
    setCulturalSelectedDateFilter(prev => prev.filter(f => f !== filter));
    if (filter === 'انتخاب از تقویم') {
      setCulturalSelectedJalaliDate(null);
    }
  };


  // Map initialization function for cultural modal - FIXED VERSION
  const initializeCulturalMap = () => {
    if (!document.getElementById('cultural-map-container')) return null;

    const mapInstance = new maplibregl.Map({
      container: 'cultural-map-container',
      style: {
        ...offlineFallbackStyle,
        sources: {},
        layers: [
          {
            id: 'admin-map-background',
            type: 'background',
            paint: { 'background-color': '#0b192f' }
          }
        ]
      },
      center: [59.6161, 36.2908],
      zoom: 16,
    });

    mapInstance.addControl(new maplibregl.NavigationControl());

    // Keep track of the marker
    let marker = null;

    // Add click event to map
    mapInstance.on('click', (e) => {
      const coordinates = e.lngLat;
      setSelectedLocation(coordinates);

      // Remove existing marker if it exists
      if (marker) {
        marker.remove();
      }

      // Create new marker
      marker = new maplibregl.Marker({
        element: createMarkerElement()
      })
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(mapInstance);

      // Store the marker in state
      setCurrentMarker(marker);
    });

    setCulturalMap(mapInstance);
    return mapInstance;
  };


  useEffect(() => {
    let isMounted = true;
    setIsLoadingCulturalSubGroups(true);

    if (!culturalPlaceCategory) {
      setCulturalSubGroupOptions([]);
      setCulturalPlaceSubcategory('');
      setIsLoadingCulturalSubGroups(false);
      return undefined;
    }

    fetchCulturalSubGroupOptions(culturalPlaceCategory)
      .then((options) => {
        if (!isMounted) return;
        setCulturalSubGroupOptions(options);

        if (culturalPlaceSubcategory && !options.some((sub) => String(sub.value) === String(culturalPlaceSubcategory))) {
          setCulturalPlaceSubcategory('');
        }
      })
      .catch((error) => {
        console.error('Failed to load sub groups for cultural edit', error);
        toast.error('بارگذاری زیرگروه‌های فرهنگی با مشکل مواجه شد');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingCulturalSubGroups(false);
      });

    return () => {
      isMounted = false;
    };
  }, [culturalPlaceCategory, culturalPlaceSubcategory, fetchCulturalSubGroupOptions]);

  const handleSaveCulturalData = async () => {
    if (!selectedPlaceType) {
      setCulturalTypeError(true);
      alert('لطفا حداقل یک نوع مکان را انتخاب کنید');
      return;
    }

    if (!culturalTitle.trim()) {
      alert('لطفا عنوان فارسی را وارد کنید');
      return;
    }

    if (!culturalPlaceCategory) {
      alert('لطفا گروه اصلی را انتخاب کنید');
      return;
    }

    if (!selectedLocation) {
      alert('لطفا یک نقطه روی نقشه انتخاب کنید');
      return;
    }

    const selectedSubGroup = culturalSubGroupOptions.find(
      (subGroup) => String(subGroup.value) === String(culturalPlaceSubcategory)
    );

    const resolveCategoryLeafId = () => {
      const value = selectedSubGroup?.value;
      if (value === undefined || value === null || value === '') return null;

      const numericValue = Number(value);
      return Number.isNaN(numericValue) ? value : numericValue;
    };

    try {
      const uploadedFiles = await uploadCulturalFiles([
        ...profileImages,
        ...audioFiles,
        ...textFiles
      ], culturalPoiId || 'new-cultural-item');

      const attachments = buildAttachmentPayload(uploadedFiles);
      const translationsPayload = buildCulturalTranslationsPayload(attachments);
      const settingsPayload = buildSettingsPayload();
      const poiPayload = {
        floor: floorLabelToValue(mapFloor),
        category_leaf_id: resolveCategoryLeafId(),
        location: {
          lng: selectedLocation.lng,
          lat: selectedLocation.lat
        },
        addressInShrine: placeAddress,
        grouping: {
          group_id: culturalPlaceCategory,
          sub_group_id: selectedSubGroup?.value || null,
          sub_group_label: selectedSubGroup?.label || null
        },
        placeType: selectedPlaceType || 'farhangi'
      };

      await createCulturalItem({
        poi: poiPayload,
        translations: translationsPayload,
        settings: {
          ...settingsPayload,
          placeType: selectedPlaceType || 'farhangi'
        }
      });

      toast.success('اطلاعات فرهنگی با موفقیت ثبت شد');
      closeAddCulturalModal();
      loadCulturalItems();
    } catch (error) {
      console.error('ثبت آیتم فرهنگی ناموفق بود', error);
      toast.error('ثبت آیتم فرهنگی ناموفق بود');
    }
  };


  const toggleReportsManagement = () => {
    setReportsManagementOpen(!reportsManagementOpen);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const filteredUsers = users.filter((user) =>
    (user.fullName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleSubmenuClick = (viewName) => {
    setCurrentReportView(viewName);

    // Reset edit mode when clicking any submenu
    setIsEditingCultural(false);
    setEditingCulturalId(null);
    setEditingCulturalData(null);

    if (viewName === 'کاربران ثبت نام کرده' ||
      viewName === 'لاگ های مسیریابی کاربران' ||
      viewName === 'بازخورد ها' ||
      viewName === 'دیدگاه ها') {
      setActiveMenu('reports');
      setBreadcrumbPath(['منوی اصلی', 'گزارشات', viewName]);
    } else if (viewName === 'مدیریت دسته بندی‌ها' ||
      viewName === 'مدیریت اطلاعات فرهنگی' ||
      viewName === 'مدیریت ادمین‌ها' ||
      viewName === 'مدیریت صفحات') {
      setActiveMenu('facmanage');
      setBreadcrumbPath(['منوی اصلی', 'مدیریت امکانات', viewName]);
      resetCategoryForm();
    }
  };

  const openTitleLanguageModal = (fieldType = 'title') => {
    setCurrentTitleField(fieldType);

    // If we're opening from cultural description field
    if (fieldType === 'description') {
      // Load existing translations for description
      setCurrentDescriptionField('culturalDescription');
      setIsDescriptionLanguageModalOpen(true);
    } else {
      // Load existing translations for title
      setIsTitleLanguageModalOpen(true);
    }
  };

  const handleSaveLanguageTitles = () => {
    setIsTitleLanguageModalOpen(false);
  };

  const handleSaveLanguageDescriptions = () => {
    setIsDescriptionLanguageModalOpen(false);
  };
  const handleLanguageTitleChange = (language, value) => {
    setLanguageTitles(prev => ({
      ...prev,
      [language]: value
    }));
  };

  const handleLanguageDescriptionChange = (language, value) => {
    setLanguageDescriptions(prev => ({
      ...prev,
      [language]: value
    }));
  };


  const resetForm = () => {
    setSelectedPlace(null);
    setPlaceName('');
    setPlaceAddress('');
    setOpeningTime('');
    setClosingTime('');
    setShortDescription('');
    setFullDescription('');
    setMediaFiles([]);
    setAdditionalNotes('');
    setPlaceIcon(null);
    setIsEditing(false);
    setPlaceCategory('');
    setPlaceSubcategory('');
    setPlaceFunction('');
    setSubGroupOptions([]);
    setSelectedTransport([]);
    setSelectedGenderAccess([]);
    setTimeRestrictions([]);
    setPrayerTimeRestrictions([]);

    setLocationRoofType('');
    setLocationStatus('');
    setIsPlaceCovered(null);

    setIsEditingDoorInfo(false);
    setLastCreatedDoorId(null);
    setLastCreatedAccessPointId(null);
    setLastCreatedAreaId(null);

    setSelectedRestrictionType(null);
    setRestrictionFormOpen(false);
    setSelectedGenderRestrictions([]);
    setTimeRestrictionPairs([{ start: '', end: '' }]);
    setLimitAllHours(false);
    setSelectedDateFilter([]);
    setSelectedJalaliDate(null);
    setSelectedJalaliEndDate(null);

    setSelectedPrayerEvents([]);
    setPrayerBeforeMinutes('');
    setPrayerAfterMinutes('');
    setPrayerSelectedJalaliDate(null);
    setPrayerSelectedJalaliEndDate(null);
    setPrayerRestrictionFormOpen(false);
    setIsPrayerDateFilterOpen(false);
    setPrayerTimeRestrictionsList([]);
    setCurrentStep(1);

    setIsTitleLanguageModalOpen(false);
    setIsDescriptionLanguageModalOpen(false);
    setLanguageTitles({
      english: '',
      arabic: '',
      urdu: ''
    });
    setLanguageDescriptions({
      english: '',
      arabic: '',
      urdu: ''
    });
    setCurrentTitleField(null);
    setCurrentDescriptionField(null);
  };

  const handleStepCircleClick = (stepNumber) => {
    if (!isEditingDoorInfo) return;
    setCurrentStep(stepNumber);
  };

  const activeLayerTitle = activeEditableLayer?.titleFa
    || activeEditableLayer?.label
    || activeEditableLayer?.id
    || 'نام لایه';


  // Map initialization effect
  useEffect(() => {
    if (activeMenu === 'mapmanage') {
      // Initialize map when map management is active
      if (map) return;

      const initializeMap = () => {
        // خیلی مهم: قبل از new Map
        // maplibregl.setRTLTextPlugin(
        //   "/rtl/mapbox-gl-rtl-text.js", // از public سرو میشه
        //   null,
        //   true
        // );

        ensureRtlOnce();

        const mapInstance = new maplibregl.Map({
          container: 'map-container',
          style: mapStyle,
          center: [59.6161, 36.2888], // Imam Reza Shrine coordinates in Mashhad, Iran
          zoom: 16, // Increased zoom to show more detail
        });

        mapInstance.addControl(new maplibregl.NavigationControl());
        mapInstance.on('load', (event) => {
          initHaramVectorLayers(event, adminVectorTileConfig);
          console.log('Haram vector layers loaded successfully in Amain map');
          logDoorAccessPointDebugInfo(mapInstance);
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
      // Clean up map when leaving map management
      if (map) {
        map.remove();
        setMap(null);

        if (locationMarker) {
          locationMarker.remove();
          setLocationMarker(null);
        }
      }

      setIsVanDrawingMode(false);
      setVanLineCoordinates([]);
      setIsTempAreaDrawingMode(false);
      setTempAreaVertices([]);
      resetMapCursor();
    }
  }, [activeMenu, map, mapStyle, resetMapCursor]);

  useEffect(() => {
    if (!map || activeMenu !== 'mapmanage') return;

    applyLayerVisibility(map);
  }, [activeMenu, applyLayerVisibility, map]);

  useEffect(() => {
    if (!map || activeMenu !== 'mapmanage') return;

    // فقط وقتی floor/lang عوض شد تایل‌ها را رفرش کن (نه هنگام ورود به edit mode)
    const prev = prevFloorLangRef.current;
    if (prev.floor === mapFloor && prev.lang === mapLanguage) return;
    prevFloorLangRef.current = { floor: mapFloor, lang: mapLanguage };

    refreshVectorTileSources();
  }, [activeMenu, map, mapFloor, mapLanguage, refreshVectorTileSources]);

  useEffect(() => {
    if (!map) return undefined;

    let debounceId = null;
    const updateLayerAvailability = () => {
      if (debounceId) return;

      debounceId = setTimeout(() => {
        debounceId = null;
        setMapLayerAvailabilityVersion((current) => current + 1);
      }, 300);
    };

    map.on('load', updateLayerAvailability);
    map.once('idle', updateLayerAvailability);

    return () => {
      map.off('load', updateLayerAvailability);
      // map.off('styledata', updateLayerAvailability);

      if (debounceId) {
        clearTimeout(debounceId);
      }
    };
  }, [map]);

  useEffect(() => {

    if (isEditingCultural && editingCulturalId && document.getElementById('edit-cultural-map-container')) {
      if (editMapTimeoutRef.current) {
        clearTimeout(editMapTimeoutRef.current);
        editMapTimeoutRef.current = null;
      }

      // Check if map has already been initialized
      if (isEditingCultural && editingCulturalData && !culturalMap) { // یا هر متغیر مشابه
        cleanupCulturalMap();
        // initializeEditMap();
      }
    }

    // return () => {
    //   if (editMapTimeoutRef.current) {
    //     clearTimeout(editMapTimeoutRef.current);
    //     editMapTimeoutRef.current = null;
    //   }
    //   // Clean up on unmount or when editing mode ends
    //   if (!isEditingCultural) {
    //     cleanupCulturalMap();
    //   }
    // };
  }, [isEditingCultural, editingCulturalId, cleanupCulturalMap, culturalMap]);

  const sanitizeFeatureForSelection = useCallback((feature) => {
    if (!feature?.geometry) return null;

    const clonedGeometry = JSON.parse(JSON.stringify(feature.geometry));
    const clonedProperties = feature.properties ? { ...feature.properties } : {};
    const stableId = feature.id ?? feature.properties?.id ?? feature.properties?.fid;

    return {
      type: 'Feature',
      geometry: clonedGeometry,
      properties: clonedProperties,
      ...(stableId ? { id: stableId } : {})
    };
  }, []);

  useEffect(() => {
    if (!map || activeMenu !== 'mapmanage') return undefined;

    if (map.isStyleLoaded()) {
      applyLayerVisibility(map);
      return undefined;
    }

    const handleLoad = () => applyLayerVisibility(map);
    map.once('load', handleLoad);

    return () => {
      map.off('load', handleLoad);
    };
  }, [map, activeMenu, layerVisibility, applyLayerVisibility]);

  useEffect(() => {
    if (!map || activeMenu !== 'mapmanage') return undefined;

    if (map.isStyleLoaded()) {
      ensureVanDrawLayers();
      return undefined;
    }

    const handleLoad = () => ensureVanDrawLayers();
    map.once('load', handleLoad);

    return () => {
      map.off('load', handleLoad);
    };
  }, [map, activeMenu, ensureVanDrawLayers]);

  useEffect(() => {
    if (!map || activeMenu !== 'mapmanage') return undefined;

    if (map.isStyleLoaded()) {
      ensureTempAreaDrawLayers();
      return undefined;
    }

    const handleLoad = () => ensureTempAreaDrawLayers();
    map.once('load', handleLoad);

    return () => {
      map.off('load', handleLoad);
    };
  }, [map, activeMenu, ensureTempAreaDrawLayers]);

  useEffect(() => {
    if (activeMenu !== 'mapmanage') {
      setSelectedEditableFeature(null);
      setIsTempAreaMoveMode(false);
      setTempAreaMoveGeometry(null);
      tempAreaOriginalGeometryRef.current = null;
    }
  }, [activeMenu]);

  useEffect(() => {
    const activeLayerOption = editableLayerOptions.find((layer) => layer.id === activeEditableLayerId);

    if (activeEditableLayerId && !canUserEditLayer(activeLayerOption)) {
      setActiveEditableLayerId('');
      setSelectedEditableFeature(null);
      hasUserClearedEditableLayer.current = false;
    }
  }, [activeEditableLayerId, editableLayerOptions, canUserEditLayer]);

  const handleDetailsClick = (user) => {
    setSelectedUser({
      ...user,
      birthDate: '۱۳۷۵/۵/۲۰',
      email: 'user.email@example.com',
      province: 'خراسان رضوی',
      city: 'مشهد'
    });
    setShowUserModal(true);
  };

  useEffect(() => {
    setSelectedEditableFeature(null);
  }, [activeEditableLayerId]);

  useEffect(() => {
    if (!map || activeMenu !== 'mapmanage') return;

    const vanSource = map.getSource(VAN_DRAW_SOURCE_ID);

    if (!vanSource) return;

    const vanFeatures = [];

    if (vanLineCoordinates.length) {
      vanFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: vanLineCoordinates
        },
        properties: {
          type: 'van-route'
        }
      });

      vanLineCoordinates.forEach((coordinate, index) => {
        vanFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: coordinate
          },
          properties: {
            type: 'van-node',
            order: index + 1
          }
        });
      });
    }

    vanSource.setData({ type: 'FeatureCollection', features: vanFeatures });
  }, [map, activeMenu, vanLineCoordinates]);

  useEffect(() => {
    if (!selectedEditableFeature) {
      setIsAreaEditMode(false);
      setIsAreaGeometryDirty(false);
      areaOriginalGeometryRef.current = null;
      clearVertexMarkers();
    }
  }, [selectedEditableFeature, clearVertexMarkers]);

  useEffect(() => {
    if (activeEditableLayer?.id !== 'areas-outline') {
      setIsAreaEditMode(false);
      setIsAreaGeometryDirty(false);
      areaOriginalGeometryRef.current = null;
      clearVertexMarkers();
    }
  }, [activeEditableLayer, clearVertexMarkers]);

  useEffect(() => {
    if (!isTempAreaLayerActive) {
      setIsTempAreaDrawingMode(false);
      setTempAreaVertices([]);
      setIsTempAreaMoveMode(false);
      setTempAreaMoveGeometry(null);
      tempAreaOriginalGeometryRef.current = null;
    }
    resetMapCursor();
  }, [isTempAreaLayerActive, resetMapCursor]);

  useEffect(() => {
    setIsDoorMoveMode(false);
  }, [selectedDoorId]);

  useEffect(() => {
    if (!isTempAreaLayerActive || !selectedEditableFeature) {
      setIsTempAreaMoveMode(false);
      setTempAreaMoveGeometry(null);
      tempAreaOriginalGeometryRef.current = null;
    }
  }, [isTempAreaLayerActive, selectedEditableFeature]);

  useEffect(() => {
    if (!map || activeMenu !== 'mapmanage') return undefined;

    const ensureHighlightLayer = () => {
      const highlightColor = activeEditableLayer?.highlightColor || '#3b82f6';
      const hideHighlightLayers = () => {
        [
          SELECTED_EDITABLE_FEATURE_LAYER_ID,
          SELECTED_EDITABLE_FEATURE_LINE_LAYER_ID,
          SELECTED_EDITABLE_FEATURE_FILL_LAYER_ID
        ].forEach((layerId) => {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'none');
          }
        });
      };

      if (!activeEditableLayer) {
        hideHighlightLayers();
        return;
      }

      if (!map.getSource(SELECTED_EDITABLE_FEATURE_SOURCE_ID)) {
        map.addSource(SELECTED_EDITABLE_FEATURE_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.getLayer(SELECTED_EDITABLE_FEATURE_FILL_LAYER_ID)) {
        map.addLayer({
          id: SELECTED_EDITABLE_FEATURE_FILL_LAYER_ID,
          type: 'fill',
          source: SELECTED_EDITABLE_FEATURE_SOURCE_ID,
          paint: {
            'fill-color': highlightColor,
            'fill-opacity': 0.08
          },
          filter: [
            'match',
            ['geometry-type'],
            ['Polygon', 'MultiPolygon'],
            true,
            false
          ]
        });
      }

      if (!map.getLayer(SELECTED_EDITABLE_FEATURE_LINE_LAYER_ID)) {
        map.addLayer({
          id: SELECTED_EDITABLE_FEATURE_LINE_LAYER_ID,
          type: 'line',
          source: SELECTED_EDITABLE_FEATURE_SOURCE_ID,
          paint: {
            'line-color': highlightColor,
            'line-width': 4,
            'line-blur': 0.4
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          filter: [
            'match',
            ['geometry-type'],
            ['LineString', 'Polygon', 'MultiLineString', 'MultiPolygon'],
            true,
            false
          ]
        });
      }

      if (!map.getLayer(SELECTED_EDITABLE_FEATURE_LAYER_ID)) {
        map.addLayer({
          id: SELECTED_EDITABLE_FEATURE_LAYER_ID,
          type: 'circle',
          source: SELECTED_EDITABLE_FEATURE_SOURCE_ID,
          paint: {
            'circle-radius': 7,
            'circle-color': highlightColor,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2
          },
          filter: [
            'match',
            ['geometry-type'],
            ['Point', 'MultiPoint'],
            true,
            false
          ]
        });
      }

      [
        SELECTED_EDITABLE_FEATURE_FILL_LAYER_ID,
        SELECTED_EDITABLE_FEATURE_LINE_LAYER_ID,
        SELECTED_EDITABLE_FEATURE_LAYER_ID
      ].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
      });

      [
        SELECTED_EDITABLE_FEATURE_FILL_LAYER_ID,
        SELECTED_EDITABLE_FEATURE_LINE_LAYER_ID,
        SELECTED_EDITABLE_FEATURE_LAYER_ID
      ].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          // Keep highlight layers above rebuilt language/style layers so selected features stay visible
          map.moveLayer(layerId);
        }
      });

      if (map.getLayer(SELECTED_EDITABLE_FEATURE_FILL_LAYER_ID)) {
        map.setPaintProperty(SELECTED_EDITABLE_FEATURE_FILL_LAYER_ID, 'fill-color', highlightColor);
      }

      if (map.getLayer(SELECTED_EDITABLE_FEATURE_LINE_LAYER_ID)) {
        map.setPaintProperty(SELECTED_EDITABLE_FEATURE_LINE_LAYER_ID, 'line-color', highlightColor);
      }

      if (map.getLayer(SELECTED_EDITABLE_FEATURE_LAYER_ID)) {
        map.setPaintProperty(SELECTED_EDITABLE_FEATURE_LAYER_ID, 'circle-color', highlightColor);
      }

      [
        SELECTED_EDITABLE_FEATURE_LAYER_ID,
        SELECTED_EDITABLE_FEATURE_LINE_LAYER_ID,
        SELECTED_EDITABLE_FEATURE_FILL_LAYER_ID
      ].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
      });
    };

    if (map.isStyleLoaded()) {
      ensureHighlightLayer();
    }

    // فقط وقتی style/load رخ داد هایلایت‌لایه‌ها رو بساز/آپدیت کن
    // وصل بودن به idle باعث loop رندر می‌شد چون داخلش moveLayer داریم.
    map.on('style.load', ensureHighlightLayer);
    map.once('load', ensureHighlightLayer);
    return () => {
      map.off('style.load', ensureHighlightLayer);
      map.off('load', ensureHighlightLayer); // برای اطمینان
    };
  }, [map, activeMenu, activeEditableLayer]);

  useEffect(() => {
    if (!map || activeMenu !== 'mapmanage') return undefined;

    const selectNearestFeature = () => {
      if (!activeEditableLayer) {
        setSelectedEditableFeature(null);
        return;
      }

      const center = map.getCenter();
      const centerPoint = map.project(center);
      const searchRadiusPx = 40000;
      const boundingBox = [
        [centerPoint.x - searchRadiusPx, centerPoint.y - searchRadiusPx],
        [centerPoint.x + searchRadiusPx, centerPoint.y + searchRadiusPx]
      ];

      const nearbyFeatures = map
        .queryRenderedFeatures(boundingBox, { layers: [activeEditableLayer.id] })
        .filter((feature) => !activeEditableLayer.sourceId || feature?.source === activeEditableLayer.sourceId);

      if (!nearbyFeatures.length) {
        setSelectedEditableFeature(null);
        return;
      }

      const centerCoordinates = [center.lng, center.lat];
      const featuresWithDistance = nearbyFeatures
        .map((feature) => {
          const featureCoordinates = getFeatureCenterCoordinates(feature);

          if (!featureCoordinates) {
            return null;
          }

          const distanceMeters = turfDistance(
            centerCoordinates,
            featureCoordinates,
            { units: 'kilometers' }
          ) * 1000;

          return { feature, distanceMeters };
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      if (!featuresWithDistance.length) {
        setSelectedEditableFeature(null);
        return;
      }

      const nearestFeature = featuresWithDistance[0];
      const sanitizedFeature = sanitizeFeatureForSelection(nearestFeature?.feature);

      if (sanitizedFeature) {
        const selectedFeatureCollection = {
          type: 'FeatureCollection',
          features: [sanitizedFeature]
        };

        setSelectedEditableFeature(selectedFeatureCollection);
      }

      if (activeEditableLayer.id === 'temp-areas-outline') {
        setOpenSubMenu(1);
      }

      if (activeEditableLayer.id === 'areas-outline') {
        setOpenSubMenu(2);
      }
    };

    if (map.isStyleLoaded()) {
      selectNearestFeature();
      return undefined;
    }

    map.once('load', selectNearestFeature);
    return () => map.off('load', selectNearestFeature);
  }, [map, activeMenu, activeEditableLayer]);

  useEffect(() => {
    if (!map || activeMenu !== 'mapmanage') return;

    const emptyFeatureCollection = { type: 'FeatureCollection', features: [] };
    const desiredData = selectedEditableFeature || emptyFeatureCollection;

    const desiredJson = JSON.stringify(desiredData);

    const tryApplySelectionToSource = () => {
      const source = map.getSource(SELECTED_EDITABLE_FEATURE_SOURCE_ID);
      if (!source || typeof source.setData !== 'function') return false;

      // جلوگیری از setData تکراری (که می‌تونه رندر/رویدادهای اضافی ایجاد کنه)
      if (lastSelectedFeatureJsonRef.current === desiredJson) return true;

      source.setData(desiredData);
      lastSelectedFeatureJsonRef.current = desiredJson;
      return true;
    };

    // اگر همین الان source آماده است، اعمال کن و تمام
    if (tryApplySelectionToSource()) return;

    // فقط تا زمانی که source ساخته بشه صبر کن، بعد listenerها رو بردار
    const handleReady = () => {
      if (tryApplySelectionToSource()) {
        map.off('load', handleReady);
        map.off('style.load', handleReady);
      }
    };

    map.on('load', handleReady);
    map.on('style.load', handleReady);

    return () => {
      map.off('load', handleReady);
      map.off('style.load', handleReady);
    };
  }, [map, activeMenu, selectedEditableFeature]);

  const buildTempAreaGeometry = useCallback((vertices = []) => {
    if (!Array.isArray(vertices) || !vertices.length) return null;

    if (vertices.length === 1) {
      return { type: 'Point', coordinates: vertices[0] };
    }

    if (vertices.length === 2) {
      return { type: 'LineString', coordinates: vertices };
    }

    const closedRing = [...vertices, vertices[0]];
    return { type: 'Polygon', coordinates: [closedRing] };
  }, []);

  const isTempAreaPolygonValid = useCallback((geometry) => {
    if (!geometry || geometry.type !== 'Polygon') return false;

    const ring = geometry.coordinates?.[0] || [];
    if (ring.length < 4) return false;

    try {
      return turfBooleanValid({ type: 'Feature', geometry });
    } catch (error) {
      return false;
    }
  }, []);

  const translateCoordinatesByDelta = useCallback((coordinates, delta) => {
    if (!map) return coordinates;

    if (!Array.isArray(coordinates)) return coordinates;

    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      const projected = map.project({ lng: coordinates[0], lat: coordinates[1] });
      const movedPoint = { x: projected.x + (delta?.x || 0), y: projected.y + (delta?.y || 0) };
      const { lng, lat } = map.unproject(movedPoint);
      return [lng, lat];
    }

    return coordinates.map((coord) => translateCoordinatesByDelta(coord, delta));
  }, [map]);

  const translateGeometryByDelta = useCallback((geometry, delta) => {
    if (!geometry?.type || !geometry?.coordinates || !map) return null;

    return {
      ...geometry,
      coordinates: translateCoordinatesByDelta(geometry.coordinates, delta)
    };
  }, [map, translateCoordinatesByDelta]);

  useEffect(() => {
    if (!map) return undefined;

    const source = map.getSource(TEMP_AREA_DRAW_SOURCE_ID);
    if (!source?.setData) return undefined;

    const geometry = buildTempAreaGeometry(tempAreaVertices);
    const feature = geometry
      ? { type: 'Feature', geometry, properties: { type: 'temp-area-draft' } }
      : null;

    const geojson = feature
      ? { type: 'FeatureCollection', features: [feature] }
      : { type: 'FeatureCollection', features: [] };

    source.setData(geojson);

    return undefined;
  }, [map, tempAreaVertices, buildTempAreaGeometry]);

  useEffect(() => {
    if (!map) return undefined;

    const source = map.getSource(TEMP_AREA_DRAW_SOURCE_ID);
    if (!source?.setData) return undefined;

    const geometry = buildTempAreaGeometry(tempAreaVertices);
    const feature = geometry
      ? { type: 'Feature', geometry, properties: { type: 'temp-area-draft' } }
      : null;

    const geojson = feature
      ? { type: 'FeatureCollection', features: [feature] }
      : { type: 'FeatureCollection', features: [] };

    source.setData(geojson);

    return undefined;
  }, [map, tempAreaVertices, buildTempAreaGeometry]);

  useEffect(() => {
    if (!map || activeMenu !== 'mapmanage') return undefined;

    const handleMapClick = async (event) => {
      const { lngLat, point } = event;

      if (isVanDrawingMode && isVanDrawingLayerActive) {
        const newCoordinate = [lngLat.lng, lngLat.lat];

        setVanLineCoordinates((prev) => {
          const updated = [...prev, newCoordinate];
          const utmCoordinate = convertLngLatToUtm32640({ lng: lngLat.lng, lat: lngLat.lat });
          console.log('van path point added', { wgs84: newCoordinate, utm: utmCoordinate });

          return updated;
        });

        return;
      }

      if (!activeEditableLayer) {
        console.warn('هیچ لایه قابل ویرایشی انتخاب نشده است.');
        return;
      }

      if (isTempAreaVertexEditMode && isTempAreaLayerActive) {
        if (isTempAreaGeometryDirty) {
          toast.error('اول ذخیره یا لغو کن');
          return;
        }

        clearTempAreaVertexMarkers();
        setIsTempAreaVertexEditMode(false);
        setIsTempAreaGeometryDirty(false);
        tempAreaVertexOriginalGeometryRef.current = null;
        tempAreaVertexWorkingGeometryRef.current = null;
        tempAreaVertexEditIdRef.current = null;
        tempAreaVertexSelectionRef.current = null;
      }

      if (isTempAreaMoveMode && isTempAreaLayerActive && selectedTempAreaId) {
        const selectedFeature = selectedEditableFeature?.features?.[0];
        const baseGeometry = tempAreaMoveGeometry || selectedFeature?.geometry;
        const centerCoordinates = getFeatureCenterCoordinates(selectedFeature);

        if (!selectedFeature || !baseGeometry || !centerCoordinates) {
          toast.error('برای جابجایی محدوده موقت، ابتدا یک محدوده معتبر انتخاب کنید');
          setIsTempAreaMoveMode(false);
          setTempAreaMoveGeometry(null);
          tempAreaOriginalGeometryRef.current = null;
          return;
        }

        const centerPoint = map.project({ lng: centerCoordinates[0], lat: centerCoordinates[1] });
        const delta = { x: point.x - centerPoint.x, y: point.y - centerPoint.y };
        const translatedGeometry = translateGeometryByDelta(baseGeometry, delta);

        if (!translatedGeometry) {
          toast.error('جابجایی محدوده موقت امکان‌پذیر نیست');
          return;
        }

        setTempAreaMoveGeometry(translatedGeometry);
        setSelectedEditableFeature((current) => {
          const feature = current?.features?.[0];
          if (!feature) return current;
          const updatedFeature = { ...feature, geometry: translatedGeometry };
          return { ...current, features: [updatedFeature] };
        });

        return;
      }

      if (isTempAreaDrawingMode && isTempAreaLayerActive) {
        setTempAreaVertices((prev) => {
          const updatedVertices = [...prev, [lngLat.lng, lngLat.lat]];

          if (prev.length === 0) {
            const remainingPoints = Math.max(3 - updatedVertices.length, 0);
            toast.info(`نقطه اول ثبت شد؛ ${remainingPoints} نقطه دیگر تا تکمیل نیاز است.`);
          }

          return updatedVertices;
        });
        return;
      }

      if (isDoorMoveMode && activeEditableLayer?.id === DOOR_ACCESS_LAYER_ID && selectedDoorId) {
        try {
          const floor = floorLabelToValue(mapFloor);
          const { x, y } = convertLngLatToUtm32640({ lng: lngLat.lng, lat: lngLat.lat });

          const moveResponse = await moveDoor(selectedDoorId, { x, y, floor });
          const movedProperties = {
            ...(selectedFeatureProperties || {}),
            door_id: selectedDoorId,
            id: selectedDoorAccessPointId || selectedDoorId
          };

          const movedFeature = {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [lngLat.lng, lngLat.lat]
                },
                properties: movedProperties
              }
            ]
          };

          setSelectedEditableFeature(movedFeature);
          refreshActiveEditableLayerTiles();
          toast.success(moveResponse?.message || 'درب با موفقیت جابجا شد');
        } catch (error) {
          toast.error(error?.message || 'جابجایی درب ناموفق بود');
        } finally {
          setIsDoorMoveMode(false);
        }
        return;
      }

      const searchRadiusPx = 40000;
      const boundingBox = [
        [point.x - searchRadiusPx, point.y - searchRadiusPx],
        [point.x + searchRadiusPx, point.y + searchRadiusPx]
      ];
      console.log('Point coordinates:', point);
      console.log('Active Layer:', activeEditableLayer);

      const nearbyFeatures = map
        .queryRenderedFeatures(boundingBox, { layers: [activeEditableLayer.id] })
        .filter((feature) => !activeEditableLayer.sourceId || feature?.source === activeEditableLayer.sourceId);

      if (!nearbyFeatures.length) {
        console.log('هیچ فیچری در لایه انتخابی در نزدیکی محل کلیک پیدا نشد.');
        return;
      }

      const clickCoordinates = [lngLat.lng, lngLat.lat];

      const featuresWithDistance = nearbyFeatures
        .map((feature) => {
          const featureCoordinates = getFeatureCenterCoordinates(feature);

          if (!featureCoordinates) {
            return null;
          }

          const distanceMeters = turfDistance(
            clickCoordinates,
            featureCoordinates,
            { units: 'kilometers' }
          ) * 1000;

          return { feature, distanceMeters };
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      if (!featuresWithDistance.length) {
        console.log('داده معتبر برای فیچرهای نزدیک یافت نشد.');
        return;
      }

      const nearestFeature = featuresWithDistance[0];
      const sanitizedFeature = sanitizeFeatureForSelection(nearestFeature?.feature);

      if (sanitizedFeature) {
        const selectedFeatureCollection = {
          type: 'FeatureCollection',
          features: [sanitizedFeature]
        };

        setSelectedEditableFeature(selectedFeatureCollection);
      }

      if (activeEditableLayer.id === 'areas-outline') {
        setOpenSubMenu(2);
      }

      if (nearestFeature?.feature) {
        console.log('نزدیک‌ترین فیچر انتخابی:', {
          layerId: activeEditableLayer.id,
          distanceMeters: Number(nearestFeature.distanceMeters.toFixed(2)),
          clickLocation: clickCoordinates,
          coordinates: nearestFeature.feature.geometry?.coordinates,
          properties: nearestFeature.feature.properties
        });
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
      resetMapCursor();
    };
  }, [
    map,
    activeMenu,
    activeEditableLayer,
    isVanDrawingMode,
    isVanDrawingLayerActive,
    mapFloor,
    isDoorMoveMode,
    selectedDoorId,
    selectedFeatureProperties,
    selectedDoorAccessPointId,
    isTempAreaMoveMode,
    isTempAreaLayerActive,
    isTempAreaDrawingMode,
    selectedTempAreaId,
    selectedEditableFeature,
    tempAreaMoveGeometry,
    translateGeometryByDelta,
    isTempAreaVertexEditMode,
    isTempAreaGeometryDirty,
    clearTempAreaVertexMarkers,
    refreshActiveEditableLayerTiles,
    resetMapCursor,
    sanitizeFeatureForSelection
  ]);

  const handleExportAllUsers = async () => {
    try {
      // Dynamically load SheetJS from CDN
      if (typeof window.XLSX === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const XLSX = window.XLSX;

      const allUsers = users;

      const data = allUsers.map(user => [
        user.fullName,
        `+۹۸ ${user.phone.replace('۹۸+', '').trim()}`,
        user.registerDate,
        user.gender,
        `${Math.floor(Math.random() * 5) + 1} بار`
      ]);

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet([
        ['نام و نام خانوادگی', 'شماره تماس', 'تاریخ ثبت نام', 'جنسیت', 'مسیریابی موفق'],
        ...data
      ]);

      // Column widths - NOTE: You have 5 columns but 6 width definitions
      // Fixed to 5 columns to match your data structure
      ws['!cols'] = [
        { wch: 30 },
        { wch: 20 },
        { wch: 18 },
        { wch: 15 },
        { wch: 18 }
      ];

      // Row heights
      const rowCount = data.length + 1;
      ws['!rows'] = Array(rowCount).fill().map((_, i) =>
        i === 0 ? { hpt: 25 } : { hpt: 22 }
      );


      const headerStyle = {
        font: {
          name: 'Tahoma',
          sz: 12,
          bold: true,
          color: { rgb: "FFFFFF" }
        },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { rgb: "1E40AF" }
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center',
          readingOrder: 2
        },
        border: {
          top: { style: 'thin', color: { rgb: "FFFFFF" } },
          bottom: { style: 'thin', color: { rgb: "FFFFFF" } },
          left: { style: 'thin', color: { rgb: "FFFFFF" } },
          right: { style: 'thin', color: { rgb: "FFFFFF" } }
        }
      };

      const dataStyle = {
        font: {
          name: 'Tahoma',
          sz: 11,
          color: { rgb: "000000" }
        },
        alignment: {
          horizontal: 'right',
          vertical: 'center',
          readingOrder: 2
        },
        border: {
          top: { style: 'thin', color: { rgb: "CCCCCC" } },
          bottom: { style: 'thin', color: { rgb: "CCCCCC" } },
          left: { style: 'thin', color: { rgb: "CCCCCC" } },
          right: { style: 'thin', color: { rgb: "CCCCCC" } }
        }
      };

      const altDataStyle = {
        ...dataStyle,
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { rgb: "F3F4F6" }
        }
      };


      const range = XLSX.utils.decode_range(ws['!ref']);

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });

          if (!ws[cell_ref]) continue;

          if (R === 0) {

            ws[cell_ref].s = headerStyle;
          } else {

            ws[cell_ref].s = R % 2 === 1 ? altDataStyle : dataStyle;
          }
        }
      }


      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'همه کاربران');


      wb.Workbook = wb.Workbook || {};
      wb.Workbook.Views = wb.Workbook.Views || [];
      wb.Workbook.Views.push({
        RTL: true
      });


      ws['!views'] = ws['!views'] || [];
      ws['!views'].push({
        rightToLeft: true
      });


      XLSX.writeFile(wb, `گزارش_کامل_کاربران_${new Date().toLocaleDateString('fa-IR')}.xlsx`);

      toast.success('گزارش کامل کاربران با موفقیت دانلود شد');
    } catch (error) {
      console.error('خطا در ایجاد گزارش:', error);
      toast.error('خطا در ایجاد گزارش');
    }
  };

  const handleZoomIn = () => {
    if (map) {
      map.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (map) {
      map.zoomOut();
    }
  };

  // Handle opening the restriction modal
  const handleOpenRestrictionModal = () => {
    setIsRestrictionModalOpen(true);

    // Reset all restriction states
    setEditIsDateFilterOpen(false);
    setEditRestrictionFormOpen(false);
    setEditSelectedRestrictionType(null);
    setEditTimeRestrictionPairs([{ start: '', end: '' }]);
    setEditLimitAllHours(false);
    setEditSelectedGenderRestrictions([]);
    setEditSelectedDateFilter([]);
    setEditSelectedJalaliDate(null);

    // Reset prayer restriction states
    setEditIsPrayerDateFilterOpen(false);
    setEditPrayerRestrictionFormOpen(false);
    setEditSelectedPrayerEvents([]);
    setEditPrayerBeforeMinutes('');
    setEditPrayerAfterMinutes('');
    setEditPrayerSelectedJalaliDate(null);
  };

  // Handle closing the restriction modal
  const handleCloseRestrictionModal = () => {
    setIsRestrictionModalOpen(false);

    // Reset all states
    setEditIsDateFilterOpen(false);
    setEditRestrictionFormOpen(false);
    setEditSelectedRestrictionType(null);
    setEditTimeRestrictionPairs([{ start: '', end: '' }]);
    setEditLimitAllHours(false);
    setEditSelectedGenderRestrictions([]);
    setEditSelectedDateFilter([]);
    setEditSelectedJalaliDate(null);

    setEditIsPrayerDateFilterOpen(false);
    setEditPrayerRestrictionFormOpen(false);
    setEditSelectedPrayerEvents([]);
    setEditPrayerBeforeMinutes('');
    setEditPrayerAfterMinutes('');
    setEditPrayerSelectedJalaliDate(null);
  };

  // Handle date filter toggle in modal
  const handleEditDateFilterToggle = (filter) => {
    if (filter === 'انتخاب از تقویم') {
      setEditSelectedDateFilter([filter]);
      setEditIsDateFilterOpen(true);
      setEditRestrictionFormOpen(false);
      setEditSelectedRestrictionType(null);
      return;
    }

    if (filter === editSelectedRestrictionType && editRestrictionFormOpen) {
      setEditSelectedRestrictionType(null);
      setEditRestrictionFormOpen(false);
      setEditIsDateFilterOpen(false);
      return;
    }

    setEditSelectedDateFilter([filter]);
    setEditSelectedRestrictionType(filter);
    setEditRestrictionFormOpen(true);
    setEditIsDateFilterOpen(false);
  };

  // Handle day select in modal calendar
  const handleEditDaySelect = (day) => {
    setEditSelectedJalaliDate({
      year: editCalendarDate.year,
      month: editCalendarDate.month,
      day: day
    });

    const jalaliMonths = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];
    const dateText = `${day} ${jalaliMonths[editCalendarDate.month - 1]} ${editCalendarDate.year}`;

    setEditSelectedRestrictionType(`روز ${dateText}`);
    setEditIsDateFilterOpen(false);
    setEditRestrictionFormOpen(true);
    setEditTimeRestrictionPairs([{ start: '', end: '' }]);
    setEditLimitAllHours(false);
    setEditSelectedGenderRestrictions([]);
  };

  // Handle prev month in modal calendar
  const handleEditPrevMonth = () => {
    setEditCalendarDate(prev => {
      let newMonth = prev.month - 1;
      let newYear = prev.year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  // Handle next month in modal calendar
  const handleEditNextMonth = () => {
    setEditCalendarDate(prev => {
      let newMonth = prev.month + 1;
      let newYear = prev.year;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  // Handle add time restriction in modal
  const handleEditAddTimeRestriction = () => {
    setEditTimeRestrictionPairs([...editTimeRestrictionPairs, { start: '', end: '' }]);
  };

  // Handle remove time restriction in modal
  const handleEditRemoveTimeRestriction = (index) => {
    if (editTimeRestrictionPairs.length > 1) {
      const newPairs = editTimeRestrictionPairs.filter((_, i) => i !== index);
      setEditTimeRestrictionPairs(newPairs);
    }
  };

  // Handle time change in modal
  const handleEditTimeChange = (index, field, value) => {
    const newPairs = [...editTimeRestrictionPairs];
    newPairs[index][field] = value;
    setEditTimeRestrictionPairs(newPairs);
  };

  // Handle gender restriction toggle in modal
  const handleEditGenderRestrictionToggle = (gender) => {
    if (editSelectedGenderRestrictions.includes(gender)) {
      setEditSelectedGenderRestrictions(editSelectedGenderRestrictions.filter(g => g !== gender));
    } else {
      setEditSelectedGenderRestrictions([...editSelectedGenderRestrictions, gender]);
    }
  };

  // Check if restriction form is valid
  const isEditRestrictionFormValid = () => {
    if (editSelectedGenderRestrictions.length === 0) {
      return false;
    }

    if (!editLimitAllHours) {
      const hasValidTimePairs = editTimeRestrictionPairs.every(pair =>
        pair.start && pair.end && pair.start !== '' && pair.end !== ''
      );

      if (!hasValidTimePairs) {
        return false;
      }

      const hasValidTimeOrder = editTimeRestrictionPairs.every(pair => {
        if (!pair.start || !pair.end) return false;
        const startMinutes = convertTimeToMinutes(pair.start);
        const endMinutes = convertTimeToMinutes(pair.end);
        return startMinutes < endMinutes;
      });

      if (!hasValidTimeOrder) {
        return false;
      }
    }

    return true;
  };

  // Get restriction title
  const getEditRestrictionTitle = () => {
    if (!editSelectedRestrictionType) return '';

    if (editSelectedRestrictionType === 'همه روزه') return 'همه روزه';
    if (editSelectedRestrictionType === 'تمام این ماه') return 'این ماه';
    if (editSelectedRestrictionType === 'کل این هفته') return 'این هفته';
    if (editSelectedRestrictionType.startsWith('روز')) return editSelectedRestrictionType;

    return editSelectedRestrictionType;
  };

  // Handle confirm restriction in modal
  const handleEditConfirmRestriction = () => {
    if (!isEditRestrictionFormValid()) {
      alert('لطفا اطلاعات محدودیت را به درستی تکمیل کنید');
      return;
    }

    const newRestriction = {
      id: Date.now(),
      date: getEditRestrictionTitle(),
      gender: [...editSelectedGenderRestrictions],
      timePairs: editLimitAllHours
        ? [{ start: '00:00', end: '23:59' }]
        : editTimeRestrictionPairs.filter(pair => pair.start && pair.end),
      limitAllHours: editLimitAllHours
    };

    // Add to existing restrictions
    setCulturalTimeRestrictions(prev => [...prev, newRestriction]);

    // Reset form
    setEditRestrictionFormOpen(false);
    setEditSelectedRestrictionType(null);
    setEditSelectedGenderRestrictions([]);
    setEditTimeRestrictionPairs([{ start: '', end: '' }]);
    setEditLimitAllHours(false);
    setEditSelectedDateFilter([]);
    setEditSelectedJalaliDate(null);
  };

  // Handle prayer prev month in modal
  const handleEditPrayerPrevMonth = () => {
    setEditPrayerCalendarDate(prev => {
      let newMonth = prev.month - 1;
      let newYear = prev.year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  // Handle prayer next month in modal
  const handleEditPrayerNextMonth = () => {
    setEditPrayerCalendarDate(prev => {
      let newMonth = prev.month + 1;
      let newYear = prev.year;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  // Toggle prayer event in modal
  const toggleEditPrayerEvent = (eventValue) => {
    if (editSelectedPrayerEvents.includes(eventValue)) {
      setEditSelectedPrayerEvents(editSelectedPrayerEvents.filter((value) => value !== eventValue));
    } else {
      setEditSelectedPrayerEvents([...editSelectedPrayerEvents, eventValue]);
    }
  };

  // Handle confirm prayer restriction in modal
  const handleEditConfirmPrayerRestriction = () => {
    if (editSelectedPrayerEvents.length === 0 || editPrayerBeforeMinutes === '' || editPrayerAfterMinutes === '') {
      alert('لطفا همه فیلدها را تکمیل کنید');
      return;
    }

    const eventLabels = editSelectedPrayerEvents.map(prayerEventValueToLabel);
    const title = eventLabels.join(' و ') + ` : ${editPrayerBeforeMinutes} دقیقه قبل الی ${editPrayerAfterMinutes} دقیقه بعد`;
    const newItem = {
      id: Date.now(),
      events: [...editSelectedPrayerEvents],
      before: String(editPrayerBeforeMinutes),
      after: String(editPrayerAfterMinutes),
      date: editPrayerSelectedJalaliDate ? `روز ${editPrayerSelectedJalaliDate.day} ${getJalaliMonthName(editPrayerSelectedJalaliDate.month)} ${editPrayerSelectedJalaliDate.year}` : 'همه روزها',
      isoDateScope: buildDateScopeIso(
        editPrayerSelectedJalaliDate
          ? `روز ${editPrayerSelectedJalaliDate.day} ${getJalaliMonthName(editPrayerSelectedJalaliDate.month)} ${editPrayerSelectedJalaliDate.year}`
          : 'همه روزها',
        editPrayerSelectedJalaliDate
      ),
      title
    };

    const { dedupKey: newKey } = getPrayerRestrictionParts(newItem);
    setCulturalPrayerTimeRestrictionsList((prev) => {
      const filtered = prev.filter((item) => {
        const { dedupKey } = getPrayerRestrictionParts(item);
        return dedupKey !== newKey;
      });
      return [...filtered, newItem];
    });

    // Reset form
    setEditSelectedPrayerEvents([]);
    setEditPrayerBeforeMinutes('');
    setEditPrayerAfterMinutes('');
    setEditPrayerSelectedJalaliDate(null);
    setEditPrayerRestrictionFormOpen(false);
    setEditIsPrayerDateFilterOpen(false);
  };

  // Render calendar days for modal
  const renderEditJalaliCalendarDays = () => {
    const { year, month } = editCalendarDate;
    const now = new Date();
    const today = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const firstDay = jalaliMonthStart(year, month);
    const daysInMonth = jalaliMonthLength(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`edit-empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = year === today.jy && month === today.jm && day === today.jd;
      const isSelected = editSelectedJalaliDate &&
        editSelectedJalaliDate.year === year &&
        editSelectedJalaliDate.month === month &&
        editSelectedJalaliDate.day === day;

      days.push(
        <div
          key={`edit-day-${day}`}
          className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => handleEditDaySelect(day)}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  // Render prayer calendar days for modal
  const renderEditPrayerJalaliCalendarDays = () => {
    const { year, month } = editPrayerCalendarDate;
    const now = new Date();
    const today = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const firstDay = jalaliMonthStart(year, month);
    const daysInMonth = jalaliMonthLength(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`edit-p-empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = year === today.jy && month === today.jm && day === today.jd;
      const isSelected = editPrayerSelectedJalaliDate &&
        editPrayerSelectedJalaliDate.year === year &&
        editPrayerSelectedJalaliDate.month === month &&
        editPrayerSelectedJalaliDate.day === day;

      days.push(
        <div
          key={`edit-p-day-${day}`}
          className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => {
            setEditPrayerSelectedJalaliDate({ year, month, day });
            const jalaliMonths = [
              'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
              'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
            ];
            const dateText = `${day} ${jalaliMonths[month - 1]} ${year}`;
            setEditIsPrayerDateFilterOpen(false);
            setEditPrayerRestrictionFormOpen(true);
          }}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  const toggleCategoryManagement = () => {
    setCategoryManagementOpen(!categoryManagementOpen);
  };

  const handleGPS = () => {
    if (map && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        map.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 15
        });
      });
    }
  };

  const handleFullscreenMap = () => {
    setIsMapFullscreen(true);
  };

  const handleExitFullscreenMap = () => {
    setIsMapFullscreen(false);
  };

  const handleEditableLayerChange = (event) => {
    setActiveEditableLayerId(event.target.value);
    setSelectedEditableFeature(null);
  };

  const handleEditableLayerSelect = (layerId) => {
    const layerOption = editableLayerOptions.find((layer) => layer.id === layerId);

    const isLayerAvailable = isMapLayerAvailable(layerId);

    if (!canUserEditLayer(layerOption) || !isLayerAvailable) return;

    setActiveEditableLayerId((current) => {
      const isSameLayer = current === layerId;
      hasUserClearedEditableLayer.current = isSameLayer;

      if (!isSameLayer) {
        hasUserClearedEditableLayer.current = false;
      }

      return isSameLayer ? '' : layerId;
    });
    setSelectedEditableFeature(null);
    setIsAreaEditMode(false);
    setIsAreaGeometryDirty(false);
    areaOriginalGeometryRef.current = null;
  };

  const rebuildSelectionFromVertices = useCallback((geometryType, updatedVertices) => {
    if (!geometryType || !Array.isArray(updatedVertices) || !updatedVertices.length) return;

    const updatedGeometry = rebuildGeometryFromVertices(geometryType, updatedVertices);
    if (!updatedGeometry) return;

    if (isAreaEditMode) {
      setIsAreaGeometryDirty(true);
    }

    setSelectedEditableFeature((current) => {
      if (!current?.features?.[0]) return current;
      const updatedFeature = { ...current.features[0], geometry: updatedGeometry };
      return { ...current, features: [updatedFeature] };
    });
  }, [isAreaEditMode]);

  const buildVertexMarkers = useCallback(() => {
    if (!map || !isAreaEditMode) {
      clearVertexMarkers();
      return;
    }

    const feature = selectedEditableFeature?.features?.[0];
    const geometryType = feature?.geometry?.type;
    const vertices = extractEditableVertices(feature?.geometry);

    if (!feature || !vertices.length) {
      clearVertexMarkers();
      return;
    }

    clearVertexMarkers();

    const highlightColor = activeEditableLayer?.highlightColor || '#0f172a';
    const newMarkers = vertices.map((coord, index) => {
      const marker = new maplibregl.Marker({ color: highlightColor, draggable: true, scale: 0.9 })
        .setLngLat(coord)
        .addTo(map);

      marker.on('dragend', () => {
        const updatedVertices = newMarkers.map((m) => {
          const { lng, lat } = m.getLngLat();
          return [lng, lat];
        });

        rebuildSelectionFromVertices(geometryType, updatedVertices);
      });

      marker.getElement().setAttribute('data-vertex-index', index);
      return marker;
    });

    vertexMarkersRef.current = newMarkers;
  }, [map, isAreaEditMode, clearVertexMarkers, selectedEditableFeature, activeEditableLayer, rebuildSelectionFromVertices]);

  useEffect(() => {
    buildVertexMarkers();

    return () => {
      clearVertexMarkers();
    };
  }, [buildVertexMarkers, clearVertexMarkers, selectedEditableFeature, isAreaEditMode]);

  const handleAreaEditModeToggle = () => {
    if (activeEditableLayer?.id !== 'areas-outline') {
      toast.error('برای ویرایش محدوده، لایه محدوده‌ها را انتخاب کنید');
      return;
    }

    if (!selectedEditableFeature) {
      toast.error('ابتدا یک محدوده را از نقشه انتخاب کنید');
      return;
    }

    if (!isAreaEditMode) {
      const geometry = selectedEditableFeature?.features?.[0]?.geometry;
      areaOriginalGeometryRef.current = geometry ? JSON.parse(JSON.stringify(geometry)) : null;
      setIsAreaGeometryDirty(false);
      setIsAreaEditMode(true);
      return;
    }

    if (isAreaGeometryDirty && areaOriginalGeometryRef.current) {
      applyAreaGeometryToSelection(areaOriginalGeometryRef.current);
    }

    setIsAreaGeometryDirty(false);
    areaOriginalGeometryRef.current = null;
    setIsAreaEditMode(false);
  };

  const handleSaveAreaGeometry = async () => {
    if (!isAreaEditMode) {
      toast.info('ابتدا حالت ویرایش محدوده را فعال کنید');
      return;
    }

    if (activeEditableLayer?.id !== 'areas-outline') {
      toast.error('برای ذخیره هندسه، لایه محدوده‌ها باید فعال باشد');
      return;
    }

    if (!selectedEditableFeature || !selectedAreaId) {
      toast.error('هیچ محدوده‌ای برای ذخیره انتخاب نشده است');
      return;
    }

    const geometry = selectedEditableFeature?.features?.[0]?.geometry;

    if (!geometry) {
      toast.error('هندسه محدوده برای ذخیره در دسترس نیست');
      return;
    }

    try {
      setIsSavingAreaGeometry(true);
      await moveArea(selectedAreaId, { geom_geojson_4326: geometry });
      toast.success('هندسه محدوده ذخیره شد');
      areaOriginalGeometryRef.current = geometry ? JSON.parse(JSON.stringify(geometry)) : null;
      setIsAreaGeometryDirty(false);
      setIsAreaEditMode(false);
      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || 'ذخیره هندسه محدوده ناموفق بود');
    } finally {
      setIsSavingAreaGeometry(false);
    }
  };

  const handleCancelAreaGeometry = () => {
    if (!isAreaEditMode) return;

    if (areaOriginalGeometryRef.current) {
      applyAreaGeometryToSelection(JSON.parse(JSON.stringify(areaOriginalGeometryRef.current)));
    }

    setIsAreaGeometryDirty(false);
    areaOriginalGeometryRef.current = null;
    setIsAreaEditMode(false);
    toast.info('ویرایش محدوده لغو شد');
  };

  const exitTempAreaVertexEditMode = useCallback((options = {}) => {
    const { restoreOriginal = false } = options;

    if (restoreOriginal && tempAreaVertexOriginalGeometryRef.current) {
      applyTempAreaGeometryToSelection(tempAreaVertexOriginalGeometryRef.current);
    }

    clearTempAreaVertexMarkers();
    setIsTempAreaVertexEditMode(false);
    setIsTempAreaGeometryDirty(false);
    tempAreaVertexOriginalGeometryRef.current = null;
    tempAreaVertexWorkingGeometryRef.current = null;
    tempAreaVertexEditIdRef.current = null;
    tempAreaVertexSelectionRef.current = null;
  }, [applyTempAreaGeometryToSelection, clearTempAreaVertexMarkers]);

  const buildTempAreaVertexMarkers = useCallback(() => {
    if (!map || !isTempAreaVertexEditMode) {
      clearTempAreaVertexMarkers();
      return;
    }

    if (!isTempAreaLayerActive || !selectedEditableFeature || !selectedTempAreaId) {
      clearTempAreaVertexMarkers();
      return;
    }

    if (tempAreaVertexEditIdRef.current && tempAreaVertexEditIdRef.current !== selectedTempAreaId) {
      clearTempAreaVertexMarkers();
      return;
    }

    const geometry = tempAreaVertexWorkingGeometryRef.current || selectedEditableFeature?.features?.[0]?.geometry;

    if (!geometry || geometry.type !== 'Polygon') {
      clearTempAreaVertexMarkers();
      return;
    }

    tempAreaVertexWorkingGeometryRef.current = geometry;

    const vertices = extractEditableVertices(geometry);

    if (!vertices.length) {
      clearTempAreaVertexMarkers();
      return;
    }

    clearTempAreaVertexMarkers();

    const highlightColor = activeEditableLayer?.highlightColor || '#0f172a';

    const newMarkers = vertices.map((coord, index) => {
      const marker = new maplibregl.Marker({ color: highlightColor, draggable: true, scale: 0.85 })
        .setLngLat(coord)
        .addTo(map);

      const updateGeometryFromMarkers = () => {
        const updatedVertices = newMarkers.map((m) => {
          const { lng, lat } = m.getLngLat();
          return [lng, lat];
        });

        const normalizedGeometry = rebuildGeometryFromVertices('Polygon', updatedVertices);
        tempAreaVertexWorkingGeometryRef.current = normalizedGeometry;
        applyTempAreaGeometryToSelection(normalizedGeometry);

        if (!tempAreaVertexDirtyRef.current) {
          setIsTempAreaGeometryDirty(true);
        }
      };

      marker.on('drag', updateGeometryFromMarkers);
      marker.on('dragend', updateGeometryFromMarkers);
      marker.getElement().setAttribute('data-temp-area-vertex-index', index);

      return marker;
    });

    tempAreaVertexMarkersRef.current = newMarkers;
  }, [
    map,
    isTempAreaVertexEditMode,
    isTempAreaLayerActive,
    selectedEditableFeature,
    selectedTempAreaId,
    activeEditableLayer,
    clearTempAreaVertexMarkers,
    applyTempAreaGeometryToSelection,
    rebuildGeometryFromVertices
  ]);

  useEffect(() => {
    buildTempAreaVertexMarkers();

    return () => {
      clearTempAreaVertexMarkers();
    };
  }, [buildTempAreaVertexMarkers, clearTempAreaVertexMarkers]);

  useEffect(() => {
    if (!isTempAreaVertexEditMode) return;

    if (activeMenu !== 'mapmanage') {
      exitTempAreaVertexEditMode({ restoreOriginal: false });
    }
  }, [activeMenu, isTempAreaVertexEditMode, exitTempAreaVertexEditMode]);

  const handleToggleTempAreaVertexEdit = () => {
    if (!isTempAreaLayerActive) {
      toast.error('برای ویرایش راس‌های محدوده موقت، لایه مربوطه را فعال کنید');
      setOpenSubMenu(1);
      return;
    }

    if (!selectedEditableFeature || !selectedTempAreaId) {
      toast.error('برای ویرایش راس‌های محدوده موقت، ابتدا محدوده را انتخاب کنید');
      return;
    }

    if (isTempAreaMoveMode) {
      toast.error('برای ویرایش راس‌ها، ابتدا حالت جابجایی را غیرفعال کنید');
      return;
    }

    const geometry = selectedEditableFeature?.features?.[0]?.geometry;

    if (!geometry || geometry.type !== 'Polygon') {
      toast.error('ویرایش راس‌ها فقط برای پلیگون محدوده موقت ممکن است');
      return;
    }

    if (isTempAreaVertexEditMode) {
      exitTempAreaVertexEditMode({ restoreOriginal: true });
      return;
    }

    tempAreaVertexOriginalGeometryRef.current = JSON.parse(JSON.stringify(geometry));
    tempAreaVertexWorkingGeometryRef.current = JSON.parse(JSON.stringify(geometry));
    tempAreaVertexEditIdRef.current = selectedTempAreaId;
    tempAreaVertexSelectionRef.current = selectedEditableFeature;
    setIsTempAreaGeometryDirty(false);
    setIsTempAreaVertexEditMode(true);
    toast.info('حالت ویرایش راس‌های محدوده موقت فعال شد');
  };

  const handleCancelTempAreaVertexEdit = () => {
    if (!isTempAreaVertexEditMode) return;

    exitTempAreaVertexEditMode({ restoreOriginal: true });
  };

  const handleSaveTempAreaVertexEdit = async () => {
    if (!isTempAreaVertexEditMode) return;

    const workingGeometry = tempAreaVertexWorkingGeometryRef.current
      || selectedEditableFeature?.features?.[0]?.geometry
      || tempAreaVertexOriginalGeometryRef.current;

    if (!workingGeometry || workingGeometry.type !== 'Polygon') {
      toast.error('هندسه محدوده موقت برای ذخیره معتبر نیست');
      return;
    }

    const normalizedGeometry = rebuildGeometryFromVertices('Polygon', extractEditableVertices(workingGeometry));

    if (!normalizedGeometry || !isTempAreaPolygonValid(normalizedGeometry)) {
      toast.error('هندسه محدوده موقت معتبر نیست. لطفاً پلیگون بدون خودتقاطع ایجاد کنید.');
      return;
    }

    if (!selectedTempAreaId) {
      toast.error('محدوده موقتی برای ذخیره انتخاب نشده است');
      return;
    }

    const payload = {
      floor: floorLabelToValue(mapFloor),
      restrict_type: selectedFeatureProperties?.restrict_type || selectedFeatureProperties?.restrictType || 'close',
      geom_geojson_4326: normalizedGeometry,
      reason: selectedFeatureProperties?.reason ?? selectedFeatureProperties?.description ?? null
    };

    try {
      setIsSavingTempAreaGeometry(true);
      await updateTempBlockArea(selectedTempAreaId, payload);
      applyTempAreaGeometryToSelection(normalizedGeometry);
      toast.success('تغییرات راس‌های محدوده موقت ذخیره شد');
      setIsTempAreaGeometryDirty(false);
      exitTempAreaVertexEditMode({ restoreOriginal: false });
      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || 'ذخیره تغییرات محدوده موقت ناموفق بود');
    } finally {
      setIsSavingTempAreaGeometry(false);
    }
  };

  useEffect(() => {
    if (!isTempAreaVertexEditMode) return;

    if (!isTempAreaLayerActive || !selectedEditableFeature || !selectedTempAreaId) {
      exitTempAreaVertexEditMode({ restoreOriginal: false });
      return;
    }

    if (tempAreaVertexEditIdRef.current && selectedTempAreaId !== tempAreaVertexEditIdRef.current) {
      if (tempAreaVertexDirtyRef.current) {
        toast.error('اول ذخیره یا لغو کن');
        if (tempAreaVertexSelectionRef.current) {
          setSelectedEditableFeature(tempAreaVertexSelectionRef.current);
        }
        return;
      }

      exitTempAreaVertexEditMode({ restoreOriginal: false });
    }
  }, [
    isTempAreaVertexEditMode,
    isTempAreaLayerActive,
    selectedEditableFeature,
    selectedTempAreaId,
    exitTempAreaVertexEditMode,
    setSelectedEditableFeature
  ]);

  const formatDateTimeLocal = (value) => {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return date.toISOString().slice(0, 16);
  };

  const convertIsoToJalaliDateTime = (value) => {
    if (!value) return { date: null, time: '' };

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: null, time: '' };

    const jalali = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return {
      date: { year: jalali.jy, month: jalali.jm, day: jalali.jd },
      time: `${hours}:${minutes}`
    };
  };

  const buildIsoFromJalaliDateTime = (dateParts, time) => {
    if (!dateParts || !time) return '';

    const [hours, minutes] = time.split(':');
    if (hours === undefined || minutes === undefined) return '';

    const { gy, gm, gd } = toGregorian(dateParts.year, dateParts.month, dateParts.day);
    const isoDate = new Date(Date.UTC(gy, gm - 1, gd, Number(hours), Number(minutes)));

    if (Number.isNaN(isoDate.getTime())) return '';

    return isoDate.toISOString();
  };

  const formatTempAreaDateLabel = (dateParts, time) => {
    if (!dateParts || !time) return 'انتخاب تاریخ';
    return `روز ${dateParts.day} ${getJalaliMonthName(dateParts.month)} ${dateParts.year} - ${time}`;
  };

  useEffect(() => {
    setTempAreaValidFrom(buildIsoFromJalaliDateTime(tempAreaSelectedStartDate, tempAreaStartTime));
  }, [tempAreaSelectedStartDate, tempAreaStartTime]);

  useEffect(() => {
    setTempAreaValidTo(buildIsoFromJalaliDateTime(tempAreaSelectedEndDate, tempAreaEndTime));
  }, [tempAreaSelectedEndDate, tempAreaEndTime]);

  const resetTempAreaFormState = useCallback(() => {
    setTempAreaName('');
    setTempAreaDescription('');
    setTempAreaValidFrom('');
    setTempAreaValidTo('');
    setTempAreaStartTime('');
    setTempAreaEndTime('');
    setTempAreaSelectedStartDate(null);
    setTempAreaSelectedEndDate(null);
    setTempAreaCalendarDate({ year: currentJalaliDate.jy, month: currentJalaliDate.jm });
    setTempAreaPrayerEvents([]);
    setTempAreaPrayerBefore('');
    setTempAreaPrayerAfter('');
    setTempAreaIsActive(true);
    setActiveTempAreaDateField(null);
    setTempAreaFlowState(TEMP_AREA_FLOW_STATES.idle);
    setTempAreaFormMode('edit');
    tempAreaDraftGeometryRef.current = null;
    resetMapCursor();
  }, [currentJalaliDate.jm, currentJalaliDate.jy, resetMapCursor]);

  const populateTempAreaFormFromData = useCallback((normalizedData = {}, geometryOverride = null) => {
    const start = convertIsoToJalaliDateTime(normalizedData.valid_from);
    const end = convertIsoToJalaliDateTime(normalizedData.valid_to);
    const prayerState = normalizedData.prayer_state || normalizePrayerRules(normalizedData.prayer_rules || {});

    setTempAreaName(normalizedData.title || '');
    setTempAreaDescription(normalizedData.description || '');
    setTempAreaValidFrom(formatDateTimeLocal(normalizedData.valid_from));
    setTempAreaValidTo(formatDateTimeLocal(normalizedData.valid_to));
    setTempAreaSelectedStartDate(start.date);
    setTempAreaStartTime(start.time);
    setTempAreaSelectedEndDate(end.date);
    setTempAreaEndTime(end.time);
    if (start?.date) {
      setTempAreaCalendarDate({ year: start.date.year, month: start.date.month });
    }
    setTempAreaPrayerEvents(prayerState.events || []);
    setTempAreaPrayerBefore(prayerState.before || '');
    setTempAreaPrayerAfter(prayerState.after || '');
    setTempAreaIsActive(Boolean(normalizedData.is_active ?? true));
    tempAreaDraftGeometryRef.current = geometryOverride || normalizedData.geometry || tempAreaDraftGeometryRef.current;
  }, [convertIsoToJalaliDateTime, formatDateTimeLocal]);

  const handleOpenTempAreaEditModal = async () => {
    if (!isTempAreaLayerActive) {
      toast.error('برای ویرایش محدوده موقت، لایه محدوده‌های موقت را فعال کنید');
      return;
    }

    if (!selectedEditableFeature || !selectedTempAreaId) {
      toast.error('برای ویرایش محدوده موقت، ابتدا یک محدوده را انتخاب کنید');
      return;
    }

    setTempAreaFormMode('edit');
    setTempAreaFlowState(TEMP_AREA_FLOW_STATES.editing);
    tempAreaDraftGeometryRef.current = null;

    const prefillData = normalizeTempAreaData(selectedFeatureProperties || {});
    populateTempAreaFormFromData(prefillData, selectedEditableFeature?.features?.[0]?.geometry);
    setIsTempAreaEditModalOpen(true);

    try {
      setIsLoadingTempAreaDetails(true);
      const tempAreaDetails = await getTempBlockArea(selectedTempAreaId);
      const normalizedDetails = normalizeTempAreaData(tempAreaDetails);
      populateTempAreaFormFromData(normalizedDetails, normalizedDetails.geometry || selectedEditableFeature?.features?.[0]?.geometry);
    } catch (error) {
      toast.error(error?.message || 'دریافت اطلاعات محدوده موقت ناموفق بود');
    } finally {
      setIsLoadingTempAreaDetails(false);
    }
  };

  const handleSaveTempAreaDetails = async () => {
    const isEditMode = tempAreaFormMode === 'edit';

    if (isEditMode && (!selectedEditableFeature || !selectedTempAreaId)) {
      toast.error('هیچ محدوده موقتی برای ویرایش انتخاب نشده است');
      return;
    }

    const geometry = isEditMode
      ? (tempAreaMoveGeometry || selectedEditableFeature?.features?.[0]?.geometry)
      : (tempAreaDraftGeometryRef.current || buildTempAreaGeometry(tempAreaVertices));

    if (!geometry || geometry.type !== 'Polygon') {
      toast.error('هندسه محدوده موقت در دسترس نیست');
      return;
    }

    if (!isTempAreaPolygonValid(geometry)) {
      toast.error('هندسه محدوده موقت معتبر نیست. لطفاً پلیگون بدون خودتقاطع رسم کنید.');
      return;
    }

    if (!tempAreaValidFrom || !tempAreaValidTo) {
      toast.error('بازه زمانی معتبر برای محدوده موقت انتخاب نشده است');
      return;
    }

    const payload = {
      floor: floorLabelToValue(mapFloor),
      title: tempAreaName?.trim() || null,
      reason: tempAreaDescription?.trim() || null,
      is_active: tempAreaIsActive,
      valid_from: tempAreaValidFrom ? new Date(tempAreaValidFrom).toISOString() : null,
      valid_to: tempAreaValidTo ? new Date(tempAreaValidTo).toISOString() : null,
      geom_geojson_4326: geometry,
      prayer_rules: buildPrayerRulesPayload(tempAreaPrayerEvents, tempAreaPrayerBefore, tempAreaPrayerAfter)
    };

    try {
      setIsSavingTempAreaDetails(true);

      if (isEditMode) {
        await updateTempBlockArea(selectedTempAreaId, payload);
        toast.success('اطلاعات محدوده موقت با موفقیت به‌روزرسانی شد');
      } else {
        await createTempBlockArea(payload);
        toast.success('محدوده موقت با موفقیت ثبت شد');
      }

      setIsTempAreaEditModalOpen(false);
      setIsTempAreaDrawingMode(false);
      setTempAreaFlowState(TEMP_AREA_FLOW_STATES.idle);
      setTempAreaVertices([]);
      tempAreaDraftGeometryRef.current = null;
      resetTempAreaFormState();
      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || (isEditMode ? 'به‌روزرسانی محدوده موقت ناموفق بود' : 'ثبت محدوده موقت ناموفق بود'));
    } finally {
      setIsSavingTempAreaDetails(false);
    }
  };

  const handleCloseTempAreaModal = () => {
    if (isSavingTempAreaDetails || isLoadingTempAreaDetails) return;

    setIsTempAreaEditModalOpen(false);
    setIsTempAreaDrawingMode(false);
    setTempAreaFlowState(TEMP_AREA_FLOW_STATES.idle);
    resetTempAreaFormState();
    tempAreaDraftGeometryRef.current = null;
  };

  const handleTempAreaMoveToggle = async () => {
    if (!isTempAreaLayerActive) {
      toast.error('برای جابجایی محدوده موقت، لایه محدوده موقت را فعال کنید');
      setOpenSubMenu(1);
      return;
    }

    if (!selectedEditableFeature || !selectedTempAreaId) {
      toast.error('برای جابجایی محدوده موقت، ابتدا یک محدوده را انتخاب کنید');
      return;
    }

    if (isTempAreaVertexEditMode) {
      if (isTempAreaGeometryDirty) {
        toast.error('اول ذخیره یا لغو کن');
        return;
      }

      exitTempAreaVertexEditMode({ restoreOriginal: false });
    }

    const selectedFeature = selectedEditableFeature?.features?.[0];
    const currentGeometry = tempAreaMoveGeometry || selectedFeature?.geometry;

    if (!isTempAreaMoveMode) {
      tempAreaOriginalGeometryRef.current = selectedFeature?.geometry || null;
      setTempAreaMoveGeometry(null);
      setIsTempAreaMoveMode(true);
      toast.info('برای جابجایی محدوده موقت، روی موقعیت جدید در نقشه کلیک کنید');
      return;
    }

    if (!currentGeometry) {
      toast.error('هندسه محدوده موقت برای ذخیره در دسترس نیست');
      setIsTempAreaMoveMode(false);
      return;
    }

    const hasMoved = tempAreaOriginalGeometryRef.current
      ? JSON.stringify(currentGeometry) !== JSON.stringify(tempAreaOriginalGeometryRef.current)
      : true;

    if (!hasMoved) {
      toast.error('محدوده موقت جابجا نشده است');
      setIsTempAreaMoveMode(false);
      return;
    }

    const payload = {
      floor: floorLabelToValue(mapFloor),
      restrict_type: 'close',
      geom_geojson_4326: currentGeometry,
      reason: selectedFeatureProperties?.reason ?? selectedFeatureProperties?.description ?? null
    };

    try {
      await updateTempBlockArea(selectedTempAreaId, payload);
      toast.success('جابجایی محدوده موقت با موفقیت ذخیره شد');
      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || 'ذخیره جابجایی محدوده موقت ناموفق بود');
      return;
    } finally {
      setIsTempAreaMoveMode(false);
      setTempAreaMoveGeometry(null);
      tempAreaOriginalGeometryRef.current = null;
    }
  };

  const handleStopTempArea = async () => {
    if (!selectedTempAreaId) {
      toast.error('محدوده موقتی برای توقف انتخاب نشده است');
      return;
    }

    const confirmStop = window.confirm('آیا از توقف فوری محدوده موقت مطمئن هستید؟');
    if (!confirmStop) return;

    try {
      setIsSavingTempAreaDetails(true);
      await stopTempBlockArea(selectedTempAreaId, {});
      toast.success('محدوده موقت با موفقیت متوقف شد');
      setIsTempAreaEditModalOpen(false);
      resetTempAreaFormState();
      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || 'توقف محدوده موقت ناموفق بود');
    } finally {
      setIsSavingTempAreaDetails(false);
    }
  };

  const handleExtendTempArea = async () => {
    if (!selectedTempAreaId) {
      toast.error('محدوده‌ای برای تمدید انتخاب نشده است');
      return;
    }

    if (!tempAreaValidTo) {
      toast.error('زمان پایان جدید برای تمدید محدوده تعیین نشده است');
      return;
    }

    const payload = {
      valid_from: tempAreaValidFrom ? new Date(tempAreaValidFrom).toISOString() : null,
      valid_to: new Date(tempAreaValidTo).toISOString(),
      is_active: tempAreaIsActive,
      prayer_rules: buildPrayerRulesPayload(tempAreaPrayerEvents, tempAreaPrayerBefore, tempAreaPrayerAfter)
    };

    try {
      setIsSavingTempAreaDetails(true);
      await extendTempBlockArea(selectedTempAreaId, payload);
      toast.success('زمان محدوده موقت با موفقیت تمدید شد');
      setIsTempAreaEditModalOpen(false);
      resetTempAreaFormState();
      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || 'تمدید محدوده موقت ناموفق بود');
    } finally {
      setIsSavingTempAreaDetails(false);
    }
  };

  const handleToggleTempAreaDrawing = async () => {
    if (!isTempAreaLayerActive) {
      toast.error('برای ثبت محدوده موقت، لایه محدوده موقت را فعال کنید');
      setOpenSubMenu(1);
      return;
    }

    if (isTempAreaVertexEditMode) {
      if (isTempAreaGeometryDirty) {
        toast.error('اول ذخیره یا لغو کن');
        return;
      }

      exitTempAreaVertexEditMode({ restoreOriginal: false });
    }

    ensureTempAreaDrawLayers();

    if (tempAreaFlowState === TEMP_AREA_FLOW_STATES.drawing) {
      toast.info('برای اتمام یا لغو ترسیم از دکمهٔ پایان ترسیم استفاده کنید');
      return;
    }

    resetTempAreaFormState();
    setTempAreaFormMode('create');
    setTempAreaFlowState(TEMP_AREA_FLOW_STATES.drawing);
    setTempAreaVertices([]);
    tempAreaDraftGeometryRef.current = null;
    setMapCursorForTempAreaDrawing();
    setIsTempAreaDrawingMode(true);
    toast.info('برای ترسیم محدوده موقت روی نقشه کلیک کنید');
  };

  const handleCompleteTempAreaDrawing = () => {
    if (tempAreaFlowState !== TEMP_AREA_FLOW_STATES.drawing) {
      toast.info('برای پایان ترسیم ابتدا حالت ترسیم محدوده موقت را فعال کنید');
      return;
    }

    const shouldFinalize = window.confirm('آیا می‌خواهید ترسیم محدوده موقت را به پایان برسانید؟ برای لغو روی «لغو» بزنید.');

    if (!shouldFinalize) {
      resetTempAreaFormState();
      setTempAreaVertices([]);
      setIsTempAreaDrawingMode(false);
      tempAreaDraftGeometryRef.current = null;
      resetMapCursor();
      toast.info('ترسیم محدوده موقت لغو شد');
      return;
    }

    if (tempAreaVertices.length < 3) {
      toast.error('برای اتمام ترسیم حداقل سه نقطه نیاز است');
      return;
    }

    const geometry = buildTempAreaGeometry(tempAreaVertices);

    if (!geometry || geometry.type !== 'Polygon' || !isTempAreaPolygonValid(geometry)) {
      toast.error('امکان ساخت هندسه معتبر برای محدوده وجود ندارد');
      return;
    }

    tempAreaDraftGeometryRef.current = geometry;
    setIsTempAreaDrawingMode(false);
    resetMapCursor();
    setTempAreaFlowState(TEMP_AREA_FLOW_STATES.readyToSave);
    setTempAreaFormMode('create');
    populateTempAreaFormFromData({
      title: '',
      description: '',
      valid_from: '',
      valid_to: '',
      is_active: true,
      prayer_rules: buildPrayerRulesPayload([], 0, 0),
      geometry
    }, geometry);
    setIsTempAreaEditModalOpen(true);
    toast.success('ترسیم محدوده موقت به پایان رسید. جزئیات را برای ثبت تکمیل کنید');
  };

  const handleDeleteTempArea = async () => {
    if (!isTempAreaLayerActive) {
      toast.error('برای حذف محدوده موقت، لایه محدوده موقت باید فعال باشد');
      return;
    }

    if (!selectedTempAreaId) {
      toast.error('محدوده موقتی برای حذف انتخاب نشده است');
      return;
    }

    const promptText = window.prompt(
      `برای حذف محدوده موقت با شناسه ${selectedTempAreaId}، عبارت "حذف" را وارد کنید:`
    );

    if (promptText === null) {
      toast.info('حذف محدوده موقت لغو شد');
      return;
    }

    if (promptText.trim() !== 'حذف') {
      toast.error('برای تأیید حذف باید دقیقاً عبارت "حذف" را وارد کنید');
      return;
    }

    try {
      await deleteTempBlockArea(selectedTempAreaId);
      toast.success('محدوده موقت با موفقیت حذف شد');
      setSelectedEditableFeature(null);
      setIsTempAreaDrawingMode(false);
      setTempAreaVertices([]);
      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || 'حذف محدوده موقت ناموفق بود');
    }
  };

  const handleOpenAddPlaceWithRoofOption = () => {
    if (activeEditableLayer?.id === 'areas-outline') {
      if (!selectedAreaId) {
        toast.error('برای ویرایش اطلاعات، ابتدا یک محدوده را انتخاب کنید');
        return;
      }

      openAreaInfoModal(selectedAreaId, true);
      return;
    }

    setLastCreatedAreaId(null);
    setCurrentStep(1);
    setIsAddPlaceModalOpen(true);
  };

  const handleDeleteSelectedArea = async () => {
    if (activeEditableLayer?.id !== 'areas-outline') {
      toast.error('برای حذف محدوده، لایه محدوده‌ها باید فعال باشد');
      return;
    }

    if (!selectedAreaId) {
      toast.error('محدوده‌ای برای حذف انتخاب نشده است');
      return;
    }

    const confirmDelete = window.confirm(`آیا از حذف محدوده انتخاب‌شده (شناسه ${selectedAreaId}) مطمئن هستید؟ این عملیات قابل بازگشت نیست.`);
    if (!confirmDelete) return;

    try {
      await deleteArea(selectedAreaId);
      toast.success('محدوده با موفقیت حذف شد');
      setSelectedEditableFeature(null);
      setIsAreaEditMode(false);
      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || 'حذف محدوده ناموفق بود');
    }
  };



  // Search places
  const handleSearchPlaces = (e) => {
    setSearchQuery(e.target.value);
    // In real app, this would filter from API
  };

  const handleLocationMarkerSelect = () => {
    if (activeEditableLayerId !== DOOR_ACCESS_LAYER_ID) {
      handleEditableLayerSelect(DOOR_ACCESS_LAYER_ID);
    }

    setIsLocationMarkerMode(true);

    if (!map) return;

    const center = map.getCenter();
    const centerCoordinates = { lng: center.lng, lat: center.lat };

    setSelectedLocation(centerCoordinates);

    if (locationMarker) {
      locationMarker.setLngLat(centerCoordinates);
    } else {
      const marker = new maplibregl.Marker({ color: '#1E2023' })
        .setLngLat(centerCoordinates)
        .addTo(map);
      setLocationMarker(marker);
    }

    map.flyTo({
      center: centerCoordinates,
      zoom: Math.max(map.getZoom(), 16)
    });
  };

  const saveVanRoute = useCallback(async (routeTitle) => {
    const floor = floorLabelToValue(mapFloor);
    const createdNodes = [];

    for (let index = 0; index < vanLineCoordinates.length; index += 1) {
      const coordinate = vanLineCoordinates[index];

      if (!Array.isArray(coordinate) || coordinate.length < 2) {
        throw new Error('مختصات مسیر ون نامعتبر است');
      }

      const [lng, lat] = coordinate || [];
      const { x, y } = convertLngLatToUtm32640({ lng, lat });
      const nodeTitle = `${routeTitle} - نقطه ${index + 1}`;

      const nodeResponse = await createVanNode({
        floor,
        node_type: index === 0 || index === vanLineCoordinates.length - 1 ? 'stop' : 'junction',
        geom: { x, y },
        basic_info: {
          title: { fa: nodeTitle, en: nodeTitle },
          description: { fa: '', en: '' }
        }
      });

      const nodeId = nodeResponse?.id;

      if (!nodeId) {
        throw new Error('شناسه گره ون دریافت نشد');
      }

      createdNodes.push({ id: nodeId, coordinate });
    }

    for (let index = 0; index < createdNodes.length - 1; index += 1) {
      const current = createdNodes[index];
      const next = createdNodes[index + 1];
      const edgeLengthKm = turfDistance(current.coordinate, next.coordinate, { units: 'kilometers' });
      const edgeLengthMeters = Number.isFinite(edgeLengthKm) ? Math.round(edgeLengthKm * 1000) : 0;

      await createVanEdge({
        src: current.id,
        dst: next.id,
        one_way: true,
        is_open: true,
        length_m: edgeLengthMeters,
        attrs: {},
        geom_geojson: {
          type: 'LineString',
          coordinates: [current.coordinate, next.coordinate]
        }
      });
    }

    refreshActiveEditableLayerTiles();
    toast.success('مسیر ون با موفقیت ذخیره شد');
  }, [mapFloor, refreshActiveEditableLayerTiles, vanLineCoordinates]);

  const handleToggleVanDrawing = async () => {
    if (!map) {
      toast.error('نقشه هنوز آماده نیست');
      return;
    }

    if (!isVanDrawingLayerActive) {
      toast.error('برای ترسیم مسیر ون، لایه گره‌های ون باید در حالت ویرایش فعال باشد');
      return;
    }

    if (!isVanDrawingMode) {
      setVanLineCoordinates([]);
      setIsVanDrawingMode(true);
      setOpenSubMenu(3);
      return;
    }

    if (vanLineCoordinates.length < 2) {
      toast.error('برای ذخیره مسیر ون حداقل دو نقطه لازم است');
      setIsVanDrawingMode(false);
      setVanLineCoordinates([]);
      return;
    }

    const routeTitle = window.prompt('برای ذخیره مسیر ون یک عنوان وارد کنید', 'مسیر ون جدید');

    if (!routeTitle || !routeTitle.trim()) return;

    try {
      setIsSavingVanRoute(true);
      await saveVanRoute(routeTitle.trim());
      setIsVanDrawingMode(false);
      setVanLineCoordinates([]);
    } catch (error) {
      toast.error(error?.message || 'ذخیره مسیر ون ناموفق بود');
    } finally {
      setIsSavingVanRoute(false);
    }
  };

  const handleVanNodeDelete = async () => {
    if (!isVanNodesLayerActive) {
      toast.error('برای حذف گره ون، لایه گره ون باید در حالت ویرایش فعال باشد');
      return;
    }

    if (!selectedVanNodeId) {
      toast.error('هیچ گره ونی برای حذف انتخاب نشده است');
      return;
    }

    const confirmDelete = window.confirm(`آیا از حذف گره ون انتخاب‌شده (شناسه ${selectedVanNodeId}) مطمئن هستید؟ این عملیات قابل بازگشت نیست.`);

    if (!confirmDelete) return;

    try {
      await deleteVanNode(selectedVanNodeId);
      toast.success('گره ون با موفقیت حذف شد');
      setSelectedEditableFeature(null);
      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || 'حذف گره ون ناموفق بود');
    }
  };

  const handleCancelLocationMarker = () => {
    setIsLocationMarkerMode(false);

    if (locationMarker) {
      locationMarker.remove();
      setLocationMarker(null);
    }

    setSelectedLocation(null);
  };

  const handleAddPlaceToMarker = async () => {
    if (!selectedLocation || typeof selectedLocation.lng !== 'number' || typeof selectedLocation.lat !== 'number') {
      toast.error('لطفاً ابتدا نشانگر را روی نقطه مدنظر قرار دهید');
      return;
    }

    const floor = floorLabelToValue(mapFloor);

    try {
      setIsCreatingDoor(true);

      const { x, y } = convertLngLatToUtm32640({
        lng: selectedLocation.lng,
        lat: selectedLocation.lat
      });

      const response = await createDoor({
        x,
        y,
        floor,
        allowed_gender: 'both',
        is_open: true,
        modes: ['walk', 'wheelchair'],
        bidirectional: true
      });

      const newDoorId = response?.door?.id || null;
      const newAccessPointId = response?.door_access_point?.id || null;

      toast.success('درب جدید با موفقیت ثبت شد');
      console.log('door creation response', response);
      await openDoorInfoModal(newDoorId, newAccessPointId, false);

      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || 'ثبت درب ناموفق بود');
    } finally {
      setIsCreatingDoor(false);
      setIsLocationMarkerMode(false);

      if (locationMarker) {
        locationMarker.remove();
        setLocationMarker(null);
      }

      setSelectedLocation(null);
    }
  };

  useEffect(() => {
    if (!map || !isLocationMarkerMode) return;

    const keepMarkerCentered = () => {
      const center = map.getCenter();
      const centerCoordinates = { lng: center.lng, lat: center.lat };

      if (locationMarker) {
        locationMarker.setLngLat(centerCoordinates);
      }

      setSelectedLocation(centerCoordinates);
    };

    map.on('move', keepMarkerCentered);

    return () => {
      map.off('move', keepMarkerCentered);
    };
  }, [map, isLocationMarkerMode, locationMarker]);


  useEffect(() => {
    if (!isLocationMarkerMode && locationMarker) {
      locationMarker.remove();
      setLocationMarker(null);
    }
  }, [isLocationMarkerMode, locationMarker]);
  useEffect(() => {
    // Reset scroll position when menu changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    // Also reset window scroll
    window.scrollTo(0, 0);
  }, [activeMenu, currentReportView]);

  const handleMenuClick = (menuName, breadcrumbLabel) => {
    if (menuName !== 'reports') {
      setCurrentReportView(null);
    }
    setActiveMenu(menuName);

    if (isEditingCultural) {
      setIsEditingCultural(false);
      setEditingCulturalId(null);
      setEditingCulturalData(null);
      resetCulturalForm();
    }


    if (menuName === 'dashboard') {
      setCurrentReportView(null);
      setBreadcrumbPath(['منوی اصلی', 'داشبورد', 'آمار کلی استارتاپ من']);
    } else if (menuName === 'mapmanage') {
      setBreadcrumbPath(['منوی اصلی', 'مدیریت نقشه']);
    } else if (menuName === 'facmanage') {
      setBreadcrumbPath(['منوی اصلی', 'مدیریت امکانات']);
    } else if (menuName === 'usermanage') {
      setBreadcrumbPath(['منوی اصلی', 'مدیریت کاربران']);
    } else if (menuName === 'reports') {
      setBreadcrumbPath(['منوی اصلی', 'گزارشات']);
    } else {
      setBreadcrumbPath(['منوی اصلی', breadcrumbLabel]);
    }
  };

  const handleLayerToggle = (layerId) => {
    setLayerVisibility((prev) => {
      const nextState = { ...prev, [layerId]: !prev[layerId] };
      applyLayerVisibility(map, nextState);
      return nextState;
    });
  };

  const mapApiTimeRestrictionsToForm = (apiRestrictions = []) => apiRestrictions.map((restriction, index) => {
    const derivedIsoScope = Array.isArray(restriction?.date_scope) && restriction.date_scope.length
      ? restriction.date_scope
      : buildDateScopeIso(restriction?.date);

    const isAllDaysScope = Array.isArray(derivedIsoScope) && derivedIsoScope.includes('ALL_DAYS');
    const dateLabel = isAllDaysScope
      ? 'همه روزها'
      : Array.isArray(restriction?.date_scope)
        ? restriction.date_scope.join(', ')
        : restriction?.date_scope || restriction?.date || 'نامشخص';

    return {
      id: restriction?.id || index,
      date: dateLabel,
      isoDateScope: derivedIsoScope?.length ? derivedIsoScope : [],
      gender: Array.isArray(restriction?.gender)
        ? restriction.gender.map(normalizeGenderValue).filter(Boolean)
        : [],
      timePairs: Array.isArray(restriction?.time_ranges)
        ? restriction.time_ranges.map((range) => ({
          start: range?.start || '',
          end: range?.end || ''
        }))
        : [],
      limitAllHours: Boolean(restriction?.all_hours)
    };
  });

  const mapApiPrayerRestrictionsToForm = (apiRestrictions = []) => {
    const aggregated = [];

    apiRestrictions.forEach((restriction, index) => {
      const derivedIsoScope = Array.isArray(restriction?.date_scope) && restriction.date_scope.length
        ? restriction.date_scope
        : buildDateScopeIso(restriction?.date);

      const normalizedEvents = normalizePrayerEvents(
        restriction?.events
        ?? restriction?.prayer_event
        ?? restriction?.prayerEvent
      );

      const isAllDaysScope = Array.isArray(derivedIsoScope) && derivedIsoScope.includes('ALL_DAYS');
      const dateLabel = isAllDaysScope
        ? 'همه روزها'
        : derivedIsoScope?.length
          ? derivedIsoScope.join(' / ')
          : restriction?.date || 'همه روزها';

      const beforeValue = restriction?.before_minutes ?? restriction?.before ?? '';
      const afterValue = restriction?.after_minutes ?? restriction?.after ?? '';

      const aggregateKey = JSON.stringify({
        before: beforeValue,
        after: afterValue,
        dateScope: derivedIsoScope?.join('|') || '',
        gender: Array.isArray(restriction?.gender)
          ? restriction.gender.map(normalizeGenderValue).filter(Boolean).join('|')
          : ''
      });

      const existing = aggregated.find((item) => item.key === aggregateKey);

      if (existing) {
        normalizedEvents.forEach((event) => existing.events.add(event));
        if (!existing.title) existing.title = restriction?.title || '';
        return;
      }

      const eventsSet = new Set(normalizedEvents);

      aggregated.push({
        key: aggregateKey,
        id: restriction?.id || index,
        events: eventsSet,
        before: beforeValue,
        after: afterValue,
        dateLabel,
        isoDateScope: derivedIsoScope?.length ? derivedIsoScope : [],
        title: restriction?.title || ''
      });
    });

    return aggregated.map((item, idx) => {
      const events = Array.from(item.events);
      const eventLabels = events.map(prayerEventValueToLabel);
      const isAllDaysScope = Array.isArray(item?.isoDateScope) && item.isoDateScope.includes('ALL_DAYS');
      const dateLabel = isAllDaysScope
        ? 'همه روزها'
        : item?.isoDateScope?.length
          ? item.isoDateScope.join(' / ')
          : item?.dateLabel || 'همه روزها';

      return {
        id: item?.id ?? idx,
        events,
        before: item?.before,
        after: item?.after,
        date: dateLabel,
        isoDateScope: item?.isoDateScope || [],
        title: item?.title
          || (eventLabels.length
            ? `${eventLabels.join(' و ')} : ${item.before || 0} دقیقه قبل الی ${item.after || 0} دقیقه بعد`
            : '')
      };
    });
  };

  const buildTimeRestrictionsPayload = () => {
    const payload = timeRestrictions.map((restriction) => ({
      date_scope: restriction?.isoDateScope?.length
        ? restriction.isoDateScope
        : buildDateScopeIso(restriction?.date),
      gender: Array.isArray(restriction?.gender)
        ? restriction.gender.map(normalizeGenderValue).filter(Boolean)
        : [],
      time_ranges: Array.isArray(restriction?.timePairs)
        ? restriction.timePairs.map((pair) => ({
          start: pair?.start || '',
          end: pair?.end || ''
        }))
        : [],
      all_hours: Boolean(restriction?.limitAllHours)
    }));

    const hasEmptyDateScope = payload.some((restriction) => !restriction.date_scope?.length);

    if (hasEmptyDateScope) {
      throw new Error('تاریخ محدودیت‌های زمانی باید به فرمت میلادی ISO-8601 ارسال شود');
    }

    return payload;
  };

  const buildPrayerRestrictionsPayload = () => {
    const seen = new Set();

    return prayerTimeRestrictionsList.reduce((acc, restriction) => {
      const {
        normalizedEvents,
        beforeMinutes,
        afterMinutes,
        dateScope,
        dedupKey
      } = getPrayerRestrictionParts(restriction);
      const eventLabels = normalizedEvents.map(prayerEventValueToLabel);

      if (seen.has(dedupKey) || !dateScope?.length) return acc;
      seen.add(dedupKey);

      acc.push({
        events: normalizedEvents,
        before_minutes: beforeMinutes,
        after_minutes: afterMinutes,
        date_scope: dateScope,
        title: restriction?.title
          ?? restriction?.label
          ?? (eventLabels.length
            ? `${eventLabels.join(' و ')} : ${beforeMinutes || 0} دقیقه قبل الی ${afterMinutes || 0} دقیقه بعد`
            : '')
      });

      return acc;
    }, []);
  };

  const buildDoorInfoPayload = () => {
    const selectedSubGroup = subGroupOptions.find((subGroup) => subGroup.value === placeSubcategory);

    return {
      basic_info: {
        title: {
          fa: placeName,
          en: languageTitles.english,
          ar: languageTitles.arabic,
          ur: languageTitles.urdu
        },
        description: fullDescription || shortDescription
      },
      grouping: {
        group_id: placeCategory || null,
        sub_group_id: selectedSubGroup?.value || null,
        sub_group_label: selectedSubGroup?.label
      },
      operational: {
        status: locationStatus === 'غیر فعال' ? 'inactive' : 'active',
        transport_modes: selectedTransport.map(normalizeTransportValue).filter(Boolean),
        gender_access: selectedGenderAccess.map(normalizeGenderValue).filter(Boolean),
        place_function: placeFunction || null,
        is_covered: typeof isPlaceCovered === 'boolean' ? isPlaceCovered : null
      },
      time_restrictions: buildTimeRestrictionsPayload(),
      prayer_restrictions: buildPrayerRestrictionsPayload(),
      notes: additionalNotes
    };
  };

  const handleAddPlaceConfirm = async () => {
    if (currentStep === 1) {
      const hasRequiredGrouping = isAreaLayerActive
        || (isDoorAccessLayerActive ? Boolean(placeFunction) : (placeCategory && placeSubcategory && placeFunction));

      if (placeName && hasRequiredGrouping) {
        setCurrentStep(2);
      } else {
        alert('لطفا تمام فیلدهای ضروری را پر کنید');
      }
    } else if (currentStep === 2) {
      if (selectedTransport.length === 0) {
        alert('لطفا حداقل یک نوع تردد را انتخاب کنید');
      } else if (selectedGenderAccess.length === 0) {
        alert('لطفا حداقل یک جنسیت تردد را انتخاب کنید');
      } else if (!locationStatus) {
        alert('لطفا وضعیت مکان را انتخاب کنید');
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      const targetAreaId = lastCreatedAreaId || selectedAreaId;

      if (isAreaLayerActive && !targetAreaId) {
        toast.error('شناسه محدوده برای ثبت اطلاعات در دسترس نیست');
        return;
      }

      if (!isAreaLayerActive && !lastCreatedDoorId) {
        toast.error('شناسه درب برای ثبت اطلاعات در دسترس نیست');
        return;
      }

      let payload;

      try {
        payload = buildDoorInfoPayload();
      } catch (error) {
        toast.error(error?.message || 'تاریخ محدودیت‌های زمانی به درستی انتخاب نشده است');
        return;
      }

      try {
        if (isAreaLayerActive) {
          setIsSavingAreaInfo(true);
          const response = await updateAreaInfo(targetAreaId, payload);
          toast.success(response?.message || 'اطلاعات محدوده با موفقیت ثبت شد');
        } else {
          setIsSavingDoorInfo(true);
          const response = await updateDoorInfo(lastCreatedDoorId, payload);
          toast.success(response?.message || 'اطلاعات مکان با موفقیت ثبت شد');
        }
        refreshActiveEditableLayerTiles();
        setIsAddPlaceModalOpen(false);
        resetForm();
        setCurrentStep(1);
      } catch (error) {
        const defaultMessage = isAreaLayerActive
          ? 'ثبت اطلاعات محدوده ناموفق بود'
          : 'ثبت اطلاعات مکان ناموفق بود';
        toast.error(getApiErrorMessage(error, defaultMessage));
      } finally {
        if (isAreaLayerActive) {
          setIsSavingAreaInfo(false);
        } else {
          setIsSavingDoorInfo(false);
        }
      }
    }
  };

  function fillDoorInfoForm(doorInfo = {}) {
    const basicInfo = doorInfo?.basic_info || {};
    const operational = doorInfo?.operational || {};
    const grouping = doorInfo?.grouping || {};

    setPlaceName(basicInfo?.title?.fa || '');
    setLanguageTitles({
      english: basicInfo?.title?.en || '',
      arabic: basicInfo?.title?.ar || '',
      urdu: basicInfo?.title?.ur || ''
    });
    setFullDescription(basicInfo?.description || '');
    setPlaceCategory(grouping?.group_id || doorInfo?.category || '');
    setPlaceSubcategory(grouping?.sub_group_id || doorInfo?.subcategory || '');
    setPlaceFunction(operational?.place_function || doorInfo?.function || '');
    setPlaceAddress(doorInfo?.address || '');
    setLocationStatus(operational?.status === 'inactive' ? 'غیر فعال' : 'فعال');
    setIsPlaceCovered(typeof operational?.is_covered === 'boolean' ? operational.is_covered : null);
    setSelectedTransport(normalizeTransportModes(operational?.transport_modes));
    setSelectedGenderAccess(Array.isArray(operational?.gender_access)
      ? operational.gender_access.map(normalizeGenderValue).filter(Boolean)
      : []);
    setTimeRestrictions(mapApiTimeRestrictionsToForm(doorInfo?.time_restrictions));
    setPrayerTimeRestrictionsList(mapApiPrayerRestrictionsToForm(doorInfo?.prayer_restrictions));
    setAdditionalNotes(doorInfo?.notes || '');
  }

  async function openDoorInfoModal(doorId, accessPointId = null, isEditMode = false) {
    setLastCreatedDoorId(doorId || null);
    setLastCreatedAccessPointId(accessPointId || null);
    setLastCreatedAreaId(null);
    setIsEditingDoorInfo(isEditMode);
    setIsAddPlaceModalOpen(true);
    setCurrentStep(1);

    if (!doorId) return;

    try {
      setIsLoadingDoorInfo(true);
      const info = await getDoorInfo(doorId);
      fillDoorInfoForm(info);
    } catch (error) {
      toast.error(error?.message || 'دریافت اطلاعات درب ناموفق بود');
    } finally {
      setIsLoadingDoorInfo(false);
    }
  }

  async function openAreaInfoModal(areaId, isEditMode = false) {
    setLastCreatedAreaId(areaId || null);
    setLastCreatedDoorId(null);
    setLastCreatedAccessPointId(null);
    setIsEditingDoorInfo(isEditMode);
    setIsAddPlaceModalOpen(true);
    setCurrentStep(1);

    if (!areaId) return;

    try {
      setIsLoadingAreaInfo(true);
      const info = await getAreaInfo(areaId, { language });
      fillDoorInfoForm(info);
    } catch (error) {
      toast.error(error?.message || 'دریافت اطلاعات محدوده ناموفق بود');
    } finally {
      setIsLoadingAreaInfo(false);
    }
  }

  const handleDoorDelete = async () => {
    if (!selectedDoorId) {
      toast.error('هیچ دربی برای حذف انتخاب نشده است');
      return;
    }

    const confirmDelete = window.confirm(`آیا از حذف درب انتخاب‌شده (شناسه ${selectedDoorId}) مطمئن هستید؟ این عملیات قابل بازگشت نیست.`);
    if (!confirmDelete) return;

    try {
      await deleteDoor(selectedDoorId);
      toast.success('درب با موفقیت حذف شد');
      setSelectedEditableFeature(null);
      setOpenSubMenu(null);
      refreshActiveEditableLayerTiles();
    } catch (error) {
      toast.error(error?.message || 'حذف درب ناموفق بود');
    }
  };

  const handleDoorMoveStart = () => {
    if (!selectedDoorId) {
      toast.error('هیچ دربی برای جابجایی انتخاب نشده است');
      return;
    }

    toast.info('مختصات جدید درب را روی نقشه انتخاب کنید');
    setIsDoorMoveMode(true);
  };

  const handleDoorEdit = async () => {
    if (!selectedDoorId) {
      toast.error('هیچ دربی برای ویرایش انتخاب نشده است');
      return;
    }

    await openDoorInfoModal(selectedDoorId, selectedDoorAccessPointId || null, true);
  };

  const activeLayerCount = Object.values(layerVisibility).filter(Boolean).length;

  const mapFloors = [
    'همکف',
    'منفی ۱'
  ];


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isCalendarOpen &&
        calendarRef.current &&
        !calendarRef.current.contains(event.target) &&
        // Also check if the click is not on the calendar button itself
        !event.target.closest('.calendar-btn')) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

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
  }, []);

  useEffect(() => {
    setSessionFloor(floorLabelToValue(mapFloor));
  }, [mapFloor]);

  useEffect(() => {
    // Chrome rendering fix
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

    if (isChrome) {
      // Force reflow to fix rendering issues
      setTimeout(() => {
        document.body.style.zoom = '1';
        document.body.style.display = 'none';
        document.body.offsetHeight; // Trigger reflow
        document.body.style.display = 'block';
      }, 100);
    }
  }, []);
  // Add these helper functions in your Amain component

  const getJalaliMonthName = (month) => {
    const jalaliMonths = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];
    return jalaliMonths[month - 1] || '';
  };

  const jalaliMonthNameToNumber = (monthName) => {
    const jalaliMonths = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];
    return jalaliMonths.indexOf(monthName) + 1;
  };

  const jalaliYearOptions = useMemo(() => {
    const startYear = currentJalaliDate.jy - 5;
    return Array.from({ length: 11 }, (_, i) => startYear + i);
  }, [currentJalaliDate.jy]);

  const formatJalaliDateLabel = (dateParts) => {
    if (!dateParts) return '';
    const jalaliMonths = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];
    return `${dateParts.day} ${jalaliMonths[dateParts.month - 1]} ${dateParts.year}`;
  };

  const compareJalaliDates = (first, second) => {
    if (!first || !second) return 0;
    const firstIso = jalaliDatePartsToIso(first);
    const secondIso = jalaliDatePartsToIso(second);
    if (firstIso === secondIso) return 0;
    return firstIso > secondIso ? 1 : -1;
  };

  const sortJalaliRange = (start, end) => {
    if (!start || !end) return [start, end];
    return compareJalaliDates(start, end) <= 0 ? [start, end] : [end, start];
  };

  const jalaliDatePartsToIso = ({ year, month, day }) => {
    const { gy, gm, gd } = toGregorian(year, month, day);
    return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
  };

  const getCurrentJalaliMonthBounds = () => {
    const today = new Date();
    const todayJalali = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const start = jalaliDatePartsToIso({ year: todayJalali.jy, month: todayJalali.jm, day: 1 });
    const endDay = jalaliMonthLength(todayJalali.jy, todayJalali.jm);
    const end = jalaliDatePartsToIso({ year: todayJalali.jy, month: todayJalali.jm, day: endDay });
    return [start, end];
  };

  const getCurrentWeekBounds = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const toIsoDate = (date) => date.toISOString().split('T')[0];
    return [toIsoDate(start), toIsoDate(end)];
  };

  const parseJalaliDateLabelToIso = (label) => {
    const match = /روز\s+(\d{1,2})\s+(\S+)\s+(\d{4})/u.exec(label || '');
    if (!match) return null;

    const [, dayStr, monthName, yearStr] = match;
    const monthNumber = jalaliMonthNameToNumber(monthName);
    if (!monthNumber) return null;

    return jalaliDatePartsToIso({
      year: Number(yearStr),
      month: monthNumber,
      day: Number(dayStr)
    });
  };

  const buildDateScopeIso = (dateLabel, jalaliSelection = null, jalaliEndSelection = null) => {
    if (!dateLabel) return [];

    if (dateLabel === 'کل روزها' || dateLabel === 'همه روزها' || dateLabel === 'ALL_DAYS') {
      return ['ALL_DAYS'];
    }

    const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

    if (isIsoDate(dateLabel)) {
      return [dateLabel];
    }

    if (typeof dateLabel === 'string' && dateLabel.includes('/')) {
      const parts = dateLabel.split('/');
      if (parts.every(isIsoDate)) {
        return parts;
      }
    }

    if (dateLabel === 'این ماه' || dateLabel === 'تمام این ماه') {
      return getCurrentJalaliMonthBounds();
    }

    if (dateLabel === 'این هفته' || dateLabel === 'کل این هفته') {
      return getCurrentWeekBounds();
    }

    if (jalaliSelection && jalaliEndSelection) {
      const [startDate, endDate] = sortJalaliRange(jalaliSelection, jalaliEndSelection);
      const startIso = jalaliDatePartsToIso(startDate);
      const endIso = jalaliDatePartsToIso(endDate);
      return startIso === endIso ? [startIso] : [startIso, endIso];
    }

    if (jalaliSelection) {
      return [jalaliDatePartsToIso(jalaliSelection)];
    }

    if (dateLabel.startsWith('از ') && dateLabel.includes(' تا ')) {
      const [startText, endText] = dateLabel.replace(/^از\s+/, '').split(/\s+تا\s+/);
      const startIso = parseJalaliDateLabelToIso(`روز ${startText}`);
      const endIso = parseJalaliDateLabelToIso(`روز ${endText}`);
      if (startIso && endIso) {
        const ordered = startIso <= endIso ? [startIso, endIso] : [endIso, startIso];
        return ordered[0] === ordered[1] ? [ordered[0]] : ordered;
      }
    }

    const isoFromLabel = parseJalaliDateLabelToIso(dateLabel);
    return isoFromLabel ? [isoFromLabel] : [];
  };

  const buildPrayerDateIso = (dateLabel, jalaliSelection = null, jalaliEndSelection = null) => {
    if (!dateLabel || dateLabel === 'همه روزها') return null;

    const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

    if (isIsoDate(dateLabel)) {
      return dateLabel;
    }

    if (typeof dateLabel === 'string' && dateLabel.includes('/')) {
      const [start, end] = dateLabel.split('/');
      if (isIsoDate(start) && isIsoDate(end)) {
        return dateLabel;
      }
    }

    if (dateLabel === 'تمام این ماه') {
      const [start, end] = getCurrentJalaliMonthBounds();
      return `${start}/${end}`;
    }

    if (dateLabel === 'کل این هفته') {
      const [start, end] = getCurrentWeekBounds();
      return `${start}/${end}`;
    }

    if (jalaliSelection && jalaliEndSelection) {
      const [startDate, endDate] = sortJalaliRange(jalaliSelection, jalaliEndSelection);
      const startIso = jalaliDatePartsToIso(startDate);
      const endIso = jalaliDatePartsToIso(endDate);
      return startIso === endIso ? startIso : `${startIso}/${endIso}`;
    }

    if (jalaliSelection) {
      return jalaliDatePartsToIso(jalaliSelection);
    }

    if (dateLabel.startsWith('از ') && dateLabel.includes(' تا ')) {
      const [startText, endText] = dateLabel.replace(/^از\s+/, '').split(/\s+تا\s+/);
      const startIso = parseJalaliDateLabelToIso(`روز ${startText}`);
      const endIso = parseJalaliDateLabelToIso(`روز ${endText}`);
      if (startIso && endIso) {
        const ordered = startIso <= endIso ? [startIso, endIso] : [endIso, startIso];
        return ordered[0] === ordered[1] ? ordered[0] : `${ordered[0]}/${ordered[1]}`;
      }
    }

    return parseJalaliDateLabelToIso(dateLabel);
  };

  const getPrayerDateLabel = () => {
    if (prayerSelectedJalaliDate && prayerSelectedJalaliEndDate) {
      const [startDate, endDate] = sortJalaliRange(prayerSelectedJalaliDate, prayerSelectedJalaliEndDate);
      const startLabel = formatJalaliDateLabel(startDate);
      const endLabel = formatJalaliDateLabel(endDate);
      return startLabel === endLabel ? `روز ${startLabel}` : `از ${startLabel} تا ${endLabel}`;
    }

    if (prayerSelectedJalaliDate) {
      return `روز ${formatJalaliDateLabel(prayerSelectedJalaliDate)}`;
    }

    return 'همه روزها';
  };

  const handleDateFilterToggle = (filter) => {
    // If it's "انتخاب از تقویم", just show the calendar, don't open form yet
    if (filter === 'انتخاب از تقویم') {
      setSelectedDateFilter(prev => [filter]);
      // Keep isDateFilterOpen true to show calendar
      setIsDateFilterOpen(true);
      // Don't open restriction form yet
      setRestrictionFormOpen(false);
      setSelectedRestrictionType(null);
      return;
    }

    // For other filters, open the form directly
    if (filter === selectedRestrictionType && restrictionFormOpen) {
      setSelectedRestrictionType(null);
      setRestrictionFormOpen(false);
      setIsDateFilterOpen(false);
      return;
    }

    setSelectedDateFilter(prev => [filter]);
    setSelectedRestrictionType(filter);
    setRestrictionFormOpen(true);
    setIsDateFilterOpen(false); // Close the date filter popup
  };

  const handlePrevMonth = () => {
    setCalendarDate(prev => {
      let newMonth = prev.month - 1;
      let newYear = prev.year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  const handleNextMonth = () => {
    setCalendarDate(prev => {
      let newMonth = prev.month + 1;
      let newYear = prev.year;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  const renderJalaliCalendarDays = () => {
    const { year, month } = calendarDate;

    // Get current Jalali date
    const now = new Date();
    const today = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Get first day of month (day of week)
    const firstDay = jalaliMonthStart(year, month);
    const daysInMonth = jalaliMonthLength(year, month);

    const days = [];

    // Empty cells for days before start of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = year === today.jy && month === today.jm && day === today.jd;
      const isStart = selectedJalaliDate &&
        selectedJalaliDate.year === year &&
        selectedJalaliDate.month === month &&
        selectedJalaliDate.day === day;
      const isEnd = selectedJalaliEndDate &&
        selectedJalaliEndDate.year === year &&
        selectedJalaliEndDate.month === month &&
        selectedJalaliEndDate.day === day;
      const isInRange = selectedJalaliDate && selectedJalaliEndDate
        ? compareJalaliDates(
          { year, month, day },
          selectedJalaliDate
        ) >= 0 && compareJalaliDates(
          { year, month, day },
          selectedJalaliEndDate
        ) <= 0
        : false;

      const classes = [
        'calendar-day',
        isToday ? 'today' : '',
        isStart ? 'selected range-start' : '',
        isEnd ? 'selected range-end' : '',
        isInRange && !isStart && !isEnd ? 'in-range' : ''
      ].filter(Boolean).join(' ');

      days.push(
        <div
          key={`day-${day}`}
          className={classes}
          onClick={() => {
            if (selectedDateFilter.includes('انتخاب از تقویم')) {
              handleDaySelect(day);
            }
          }}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  // Helper functions for Jalali calendar
  const jalaliMonthStart = (year, month) => {
    // Simplified calculation - in real app use a proper Jalali library
    const mod = (year - (month < 7 ? 474 : 473)) % 2820;
    return (mod + 38) * 682 % 2816 < 682 ? 1 : 0;
  };

  const jalaliMonthLength = (year, month) => {
    // Simplified calculation - in real app use a proper Jalali library
    if (month < 7) return 31;
    if (month < 12) return 30;
    return isLeapJalaliYear(year) ? 30 : 29;
  };

  const isLeapJalaliYear = (year) => {
    // Jalali leap year calculation
    const mod = year % 33;
    return mod === 1 || mod === 5 || mod === 9 || mod === 13 || mod === 17 || mod === 22 || mod === 26 || mod === 30;
  };

  const resetCategoryForm = () => {
    setNewCategory({
      title: '',
      description: '',
      image: null,
      status: 'active',
      subcategoryInput: '',
      subcategories: [],
      languageTitles: {
        english: '',
        arabic: '',
        urdu: ''
      }
    });
    setCategoryLanguageTitles({
      english: '',
      arabic: '',
      urdu: ''
    });
    setEditingCategory(null);
  };

  const handleAddSubcategoryToNew = () => {
    if (!newCategory.subcategoryInput?.trim()) return;

    const subcategory = {
      id: Date.now() + Math.random(),
      title: newCategory.subcategoryInput.trim(),
      createdAt: formatJalaliDate(new Date()),
      status: 'active'
    };

    setNewCategory(prev => ({
      ...prev,
      subcategoryInput: '',
      subcategories: [...(prev.subcategories || []), subcategory]
    }));
  };

  const handleRemoveSubcategoryFromNew = (index) => {
    setNewCategory(prev => ({
      ...prev,
      subcategories: prev.subcategories.filter((_, i) => i !== index)
    }));
  };

  const loadIconOptions = useCallback(async () => {
    if (iconOptions.length > 0) return;

    setIsIconListLoading(true);
    setIconListError('');
    try {
      const response = await fetch(withBasePath('/assets/icons/icons.json'));
      if (!response.ok) {
        throw new Error('Failed to fetch icons');
      }
      const data = await response.json();
      setIconOptions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load icon list', error);
      setIconListError('خطا در دریافت لیست آیکون‌ها');
    } finally {
      setIsIconListLoading(false);
    }
  }, [iconOptions.length]);

  const openIconPicker = useCallback((target) => {
    setIconPickerTarget(target);
    setIconSearchTerm('');
    setIsIconPickerOpen(true);
    loadIconOptions();
  }, [loadIconOptions]);

  const closeIconPicker = useCallback(() => {
    setIsIconPickerOpen(false);
    setIconPickerTarget(null);
    setIconSearchTerm('');
  }, []);

  const handleIconSelect = useCallback((filename) => {
    if (iconPickerTarget === 'edit') {
      setEditCategoryData((prev) => ({ ...prev, icon: filename }));
      setIsIconUploaded(true);
    } else {
      setNewCategory((prev) => ({ ...prev, image: filename }));
    }
    closeIconPicker();
  }, [closeIconPicker, iconPickerTarget]);

  const filteredIconOptions = useMemo(() => {
    const normalizedSearch = iconSearchTerm.trim().toLowerCase();
    if (!normalizedSearch) return iconOptions;
    return iconOptions.filter((icon) => icon.toLowerCase().includes(normalizedSearch));
  }, [iconOptions, iconSearchTerm]);

  const handleCreateCategory = async () => {
    if (!newCategory.title.trim()) {
      alert('عنوان دسته بندی الزامی است');
      return;
    }

    const payload = {
      title: newCategory.title,
      description: newCategory.description,
      status: newCategory.status,
      property_target: 'group',
      languageTitles: { ...categoryLanguageTitles },
      subcategories: (newCategory.subcategories || []).map((subcategory) => ({
        title: subcategory.title,
        property_target: 'subGroup'
      }))
    };
    if (isPlainIconName(newCategory.image)) {
      payload.icon = newCategory.image;
    }

    try {
      let response;
      if (newCategory.image instanceof File) {
        const formData = new FormData();
        formData.append('icon', newCategory.image);
        formData.append('property_target', 'group');
        formData.append('payload', JSON.stringify(payload));
        response = await adminFetch(`${API_BASE}/categories`, {
          method: 'POST',
          body: formData
        });
      } else {
        response = await adminFetch(`${API_BASE}/categories`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        throw new Error('Failed to create category');
      }

      setIsCreateCategoryModalOpen(false);
      resetCategoryForm();
      toast.success('دسته بندی با موفقیت ایجاد شد');
      fetchCategories();
    } catch (error) {
      console.error('Failed to create category', error);
      alert('خطا در ایجاد دسته بندی');
    }
  };

  const handleDeleteCategory = (id) => {
    setCategoryToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      const response = await adminFetch(`${API_BASE}/categories/${categoryToDelete}`, {
        method: 'DELETE'
      });

      if (response.status === 409) {
        alert('امکان حذف این دسته بندی وجود ندارد');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to delete category');
      }

      setIsDeleteModalOpen(false);
      setCategoryToDelete(null);
      fetchCategories();
    } catch (error) {
      console.error('Failed to delete category', error);
      alert('خطا در حذف دسته بندی');
    }
  };

  const toggleCategoryExpand = (id) => {
    if (expandedCategories.includes(id)) {
      setExpandedCategories(expandedCategories.filter(catId => catId !== id));
      return;
    }

    const targetCategory = categories.find((category) => category.id === id);
    if (targetCategory && !Array.isArray(targetCategory.subcategories)) {
      fetchCategorySubcategories(id);
    }

    setExpandedCategories([...expandedCategories, id]);
  };

  const handleEditCategory = (category) => {
    setEditingCategoryId(category.id);
    const resolvedIcon = resolveCategoryIcon(category);
    setEditCategoryData({
      title: category.title,
      description: category.description || '',
      icon: resolvedIcon || null,
      status: category.status || 'active'
    });

    // Load language titles if they exist
    setEditCategoryLanguageTitles({
      english: category.languageTitles?.english || '',
      arabic: category.languageTitles?.arabic || '',
      urdu: category.languageTitles?.urdu || ''
    });

    setIsIconUploaded(!!resolvedIcon);
    setIsEditCategoryModalOpen(true);
  };

  const handleUpdateCategory = async () => {
    if (!editCategoryData.title.trim()) {
      alert('عنوان دسته بندی الزامی است');
      return;
    }

    const payload = {
      title: editCategoryData.title,
      description: editCategoryData.description,
      status: editCategoryData.status,
      languageTitles: { ...editCategoryLanguageTitles }
    };
    if (isPlainIconName(editCategoryData.icon)) {
      payload.icon = editCategoryData.icon;
    }

    try {
      let response;
      if (editCategoryData.icon instanceof File) {
        const formData = new FormData();
        formData.append('icon', editCategoryData.icon);
        formData.append('payload', JSON.stringify(payload));
        response = await adminFetch(`${API_BASE}/categories/${editingCategoryId}`, {
          method: 'PUT',
          body: formData
        });
      } else {
        response = await adminFetch(`${API_BASE}/categories/${editingCategoryId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      setIsEditCategoryModalOpen(false);
      setEditCategoryData({
        title: '',
        description: '',
        icon: null,
        status: 'active'
      });
      setEditCategoryLanguageTitles({
        english: '',
        arabic: '',
        urdu: ''
      });
      setEditingCategoryId(null);
      setIsIconUploaded(false);
      toast.success('دسته بندی با موفقیت ویرایش شد');
      fetchCategories();
    } catch (error) {
      console.error('Failed to update category', error);
      alert('خطا در ویرایش دسته بندی');
    }
  };

  const handleAddSubcategoryInModal = async () => {
    const subcategoryTitle = prompt('عنوان زیرگروه را وارد کنید:');
    if (!subcategoryTitle) return;

    try {
      const response = await adminFetch(`${API_BASE}/categories/${editingCategoryId}/subcategories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: subcategoryTitle, property_target: 'subGroup' })
      });

      if (!response.ok) {
        throw new Error('Failed to add subcategory');
      }

      await fetchCategorySubcategories(editingCategoryId);
      alert('زیرگروه با موفقیت اضافه شد');
    } catch (error) {
      console.error('Failed to add subcategory', error);
      alert('خطا در افزودن زیرگروه');
    }
  };

  const handleAddSubcategory = async (parentId) => {
    const parentCategory = categories.find(cat => cat.id === parentId);
    if (!parentCategory) return;

    const subcategoryTitle = prompt('عنوان زیرگروه را وارد کنید:');
    if (!subcategoryTitle) return;

    try {
      const response = await adminFetch(`${API_BASE}/categories/${parentId}/subcategories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: subcategoryTitle, property_target: 'subGroup' })
      });

      if (!response.ok) {
        throw new Error('Failed to add subcategory');
      }

      await fetchCategorySubcategories(parentId);
    } catch (error) {
      console.error('Failed to add subcategory', error);
      alert('خطا در افزودن زیرگروه');
    }
  };

  const handleEditSubcategory = async (subcategory) => {
    const newTitle = prompt('عنوان جدید زیرگروه را وارد کنید:', subcategory.title);
    if (!newTitle) return;

    try {
      const response = await adminFetch(`${API_BASE}/subcategories/${subcategory.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle })
      });

      if (!response.ok) {
        throw new Error('Failed to update subcategory');
      }

      await fetchCategorySubcategories(subcategory.parentId);
    } catch (error) {
      console.error('Failed to update subcategory', error);
      alert('خطا در ویرایش زیرگروه');
    }
  };


  const handleDeleteSubcategory = async (subcategory) => {
    try {
      const response = await adminFetch(`${API_BASE}/subcategories/${subcategory.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete subcategory');
      }

      await fetchCategorySubcategories(subcategory.parentId);
    } catch (error) {
      console.error('Failed to delete subcategory', error);
      alert('خطا در حذف زیرگروه');
    }
  };

  // Filter categories based on search
  const filteredCategories = categories.filter(category =>
    category.title.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
    (category.description || '').toLowerCase().includes(categorySearchTerm.toLowerCase())
  );

  const handleDaySelect = (day) => {
    const clickedDate = {
      year: calendarDate.year,
      month: calendarDate.month,
      day: day
    };

    // First click sets the start date, second click sets the end date
    if (!selectedJalaliDate || selectedJalaliEndDate) {
      setSelectedJalaliDate(clickedDate);
      setSelectedJalaliEndDate(null);
      setSelectedRestrictionType(null);
      setRestrictionFormOpen(false);
      return;
    }

    const [startDate, endDate] = sortJalaliRange(selectedJalaliDate, clickedDate);
    const startLabel = formatJalaliDateLabel(startDate);
    const endLabel = formatJalaliDateLabel(endDate);
    const dateText = startLabel === endLabel ? `روز ${startLabel}` : `از ${startLabel} تا ${endLabel}`;

    setSelectedJalaliDate(startDate);
    setSelectedJalaliEndDate(endDate);
    setSelectedRestrictionType(dateText);
    setIsDateFilterOpen(false);
    setRestrictionFormOpen(true);
    setTimeRestrictionPairs([{ start: '', end: '' }]);
    setLimitAllHours(false);
    setSelectedGenderRestrictions([]);
  };

  const handlePrayerDaySelect = (day) => {
    const clickedDate = {
      year: prayerCalendarDate.year,
      month: prayerCalendarDate.month,
      day
    };

    if (!prayerSelectedJalaliDate || prayerSelectedJalaliEndDate) {
      setPrayerSelectedJalaliDate(clickedDate);
      setPrayerSelectedJalaliEndDate(null);
      setPrayerRestrictionFormOpen(false);
      return;
    }

    const [startDate, endDate] = sortJalaliRange(prayerSelectedJalaliDate, clickedDate);
    setPrayerSelectedJalaliDate(startDate);
    setPrayerSelectedJalaliEndDate(endDate);
    setIsPrayerDateFilterOpen(false);
    setPrayerRestrictionFormOpen(true);
  };

  const handleConfirmRestriction = () => {
    if (!isRestrictionFormValid()) {
      alert('لطفا اطلاعات محدودیت را به درستی تکمیل کنید');
      return;
    }

    const restrictionIsoScope = buildDateScopeIso(getRestrictionTitle(), selectedJalaliDate, selectedJalaliEndDate);

    if (!restrictionIsoScope.length) {
      alert('لطفا تاریخ محدودیت را از تقویم یا گزینه‌های موجود انتخاب کنید');
      return;
    }

    const newRestriction = {
      id: Date.now(),
      date: getRestrictionTitle(),
      isoDateScope: restrictionIsoScope,
      gender: [...selectedGenderRestrictions],
      timePairs: limitAllHours
        ? [{ start: '00:00', end: '23:59' }]
        : timeRestrictionPairs.filter(pair => pair.start && pair.end),
      limitAllHours
    };

    setTimeRestrictions(prev => [...prev, newRestriction]);

    // Reset form
    handleCloseRestrictionForm();
  };

  // Remove restriction
  const removeRestriction = (index) => {
    setTimeRestrictions(prev => prev.filter((_, i) => i !== index));
  };

  // Format time for display
  const formatTimeForDisplay = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  const isRestrictionFormValid = () => {
    // Check if at least one gender is selected
    if (selectedGenderRestrictions.length === 0) {
      return false;
    }

    // Check time restrictions if "limit all hours" is NOT selected
    if (!limitAllHours) {
      // Check if all time pairs have valid start and end times
      const hasValidTimePairs = timeRestrictionPairs.every(pair =>
        pair.start && pair.end && pair.start !== '' && pair.end !== ''
      );

      if (!hasValidTimePairs) {
        return false;
      }

      // Check if start time is before end time for each pair
      const hasValidTimeOrder = timeRestrictionPairs.every(pair => {
        if (!pair.start || !pair.end) return false;

        // Convert times to minutes for comparison
        const startMinutes = convertTimeToMinutes(pair.start);
        const endMinutes = convertTimeToMinutes(pair.end);

        return startMinutes < endMinutes;
      });

      if (!hasValidTimeOrder) {
        return false;
      }
    }

    return true;
  };

  // Helper function to convert time string to minutes
  const convertTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getRestrictionTitle = () => {
    if (!selectedRestrictionType) return '';

    if (selectedRestrictionType === 'کل روز') return 'کل روز ';
    if (selectedRestrictionType === 'تمام این ماه') return 'این ماه';
    if (selectedRestrictionType === 'کل این هفته') return 'این هفته';
    if (selectedRestrictionType.startsWith('روز')) return selectedRestrictionType;

    return selectedRestrictionType;
  };

  const handleAddTimeRestriction = () => {
    setTimeRestrictionPairs([...timeRestrictionPairs, { start: '', end: '' }]);
  };

  const handleRemoveTimeRestriction = (index) => {
    if (timeRestrictionPairs.length > 1) {
      const newPairs = timeRestrictionPairs.filter((_, i) => i !== index);
      setTimeRestrictionPairs(newPairs);
    }
  };

  const handleTimeChange = (index, field, value) => {
    const newPairs = [...timeRestrictionPairs];
    newPairs[index][field] = value;
    setTimeRestrictionPairs(newPairs);
  };

  const handleGenderRestrictionToggle = (gender) => {
    if (selectedGenderRestrictions.includes(gender)) {
      setSelectedGenderRestrictions(selectedGenderRestrictions.filter(g => g !== gender));
    } else {
      setSelectedGenderRestrictions([...selectedGenderRestrictions, gender]);
    }
  };

  const handleCloseRestrictionForm = () => {
    setRestrictionFormOpen(false);
    setSelectedRestrictionType(null);
    setSelectedGenderRestrictions([]);
    setTimeRestrictionPairs([{ start: '', end: '' }]);
    setLimitAllHours(false);
    setSelectedDateFilter([]);
    setSelectedJalaliDate(null);
    setSelectedJalaliEndDate(null);
  };

  const removeDateFilter = (filter) => {
    setSelectedDateFilter(prev => prev.filter(f => f !== filter));
    if (filter === 'انتخاب از تقویم') {
      setSelectedJalaliDate(null);
      setSelectedJalaliEndDate(null);
    }
  };

  const filteredCulturalData = culturalData;
  const totalCulturalPages = Math.max(1, Math.ceil(culturalTotalItems / culturalItemsPerPage));

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Add this function to handle items per page change
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const togglePrayerEvent = (eventValue) => {
    if (selectedPrayerEvents.includes(eventValue)) {
      setSelectedPrayerEvents(selectedPrayerEvents.filter((value) => value !== eventValue));
    } else {
      setSelectedPrayerEvents([...selectedPrayerEvents, eventValue]);
    }
  };

  const handlePrayerPrevMonth = () => {
    setPrayerCalendarDate(prev => {
      let newMonth = prev.month - 1;
      let newYear = prev.year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  const handlePrayerNextMonth = () => {
    setPrayerCalendarDate(prev => {
      let newMonth = prev.month + 1;
      let newYear = prev.year;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  // render days: nearly identical to renderJalaliCalendarDays but using prayerCalendarDate & prayerSelectedJalaliDate
  const renderPrayerJalaliCalendarDays = () => {
    const { year, month } = prayerCalendarDate;
    const now = new Date();
    const today = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const firstDay = jalaliMonthStart(year, month);
    const daysInMonth = jalaliMonthLength(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`p-empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = year === today.jy && month === today.jm && day === today.jd;
      const isStart = prayerSelectedJalaliDate &&
        prayerSelectedJalaliDate.year === year &&
        prayerSelectedJalaliDate.month === month &&
        prayerSelectedJalaliDate.day === day;
      const isEnd = prayerSelectedJalaliEndDate &&
        prayerSelectedJalaliEndDate.year === year &&
        prayerSelectedJalaliEndDate.month === month &&
        prayerSelectedJalaliEndDate.day === day;
      const isInRange = prayerSelectedJalaliDate && prayerSelectedJalaliEndDate
        ? compareJalaliDates({ year, month, day }, prayerSelectedJalaliDate) >= 0
        && compareJalaliDates({ year, month, day }, prayerSelectedJalaliEndDate) <= 0
        : false;

      const classes = [
        'calendar-day',
        isToday ? 'today' : '',
        isStart ? 'selected range-start' : '',
        isEnd ? 'selected range-end' : '',
        isInRange && !isStart && !isEnd ? 'in-range' : ''
      ].filter(Boolean).join(' ');

      days.push(
        <div
          key={`p-day-${day}`}
          className={classes}
          onClick={() => handlePrayerDaySelect(day)}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  const handleTempAreaPrevMonth = () => {
    setTempAreaCalendarDate(prev => {
      let newMonth = prev.month - 1;
      let newYear = prev.year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  const handleTempAreaNextMonth = () => {
    setTempAreaCalendarDate(prev => {
      let newMonth = prev.month + 1;
      let newYear = prev.year;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  const renderTempAreaJalaliCalendarDays = () => {
    const { year, month } = tempAreaCalendarDate;
    const now = new Date();
    const today = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const firstDay = jalaliMonthStart(year, month);
    const daysInMonth = jalaliMonthLength(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`temp-empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = year === today.jy && month === today.jm && day === today.jd;
      const isStart = tempAreaSelectedStartDate
        && tempAreaSelectedStartDate.year === year
        && tempAreaSelectedStartDate.month === month
        && tempAreaSelectedStartDate.day === day;
      const isEnd = tempAreaSelectedEndDate
        && tempAreaSelectedEndDate.year === year
        && tempAreaSelectedEndDate.month === month
        && tempAreaSelectedEndDate.day === day;
      const isInRange = tempAreaSelectedStartDate && tempAreaSelectedEndDate
        ? compareJalaliDates({ year, month, day }, tempAreaSelectedStartDate) >= 0
        && compareJalaliDates({ year, month, day }, tempAreaSelectedEndDate) <= 0
        : false;

      days.push(
        <div
          key={`temp-${day}`}
          className={`calendar-day ${isToday ? 'today' : ''} ${isStart ? 'selected' : ''} ${isEnd ? 'selected-end' : ''} ${isInRange ? 'in-range' : ''}`}
          onClick={() => {
            if (isTempAreaFormDisabled) return;

            const selectedDate = { year, month, day };
            if (activeTempAreaDateField === 'start') {
              setTempAreaSelectedStartDate(selectedDate);
              setActiveTempAreaDateField(null);
            } else if (activeTempAreaDateField === 'end') {
              setTempAreaSelectedEndDate(selectedDate);
              setActiveTempAreaDateField(null);
            }
          }}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  // Calculate pagination data
  const totalItems = recentUsersPagination?.total ?? filteredUsers.length;
  const totalPages = Math.max(1, recentUsersPagination?.pages || Math.ceil(totalItems / itemsPerPage) || 1);
  const currentUsers = filteredUsers;

  const adminDisplayName =
    adminProfile?.fullName ||
    adminProfile?.name ||
    adminProfile?.username ||
    adminProfile?.email ||
    adminProfile?.user?.fullName ||
    adminProfile?.user?.name ||
    adminProfile?.user?.username ||
    adminProfile?.user?.email ||
    'ادمین';

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 6;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  return (
    <div
      id="amain-admin-panel"
      className={`admin-panel admin-panel-isolated ${isMapFullscreen ? 'map-fullscreen' : ''}`}
    >
      {/* Header */}
      <div id="amain-header" className="admin-header">
        <div className="header-right">
          <div id="amain-logo" className="sidebar-logo">
            <img src={logo} alt="Logo" />
          </div>
          <div
            id="amain-profile-menu"
            className="admin-profile"
            onClick={handleAvatarClick}
            style={{ cursor: 'pointer' }}
          >
            <div className="profile-image">
              {adminAvatar ? (
                <img
                  src={adminAvatar}
                  alt="Admin Avatar"
                  className="admin-avatar-img"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div className="default-avatar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
                    <path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
                  </svg>
                </div>
              )}
            </div>
            <div className="profile-info">
              <div className="admin-name">
                <span>{isLoadingProfile ? 'در حال بارگذاری...' : adminDisplayName}</span>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.6921 7.09327C3.91674 6.83119 4.3113 6.80084 4.57338 7.02548L9.99997 11.6768L15.4266 7.02548C15.6886 6.80084 16.0832 6.83119 16.3078 7.09327C16.5325 7.35535 16.5021 7.74991 16.24 7.97455L10.4067 12.9745C10.1727 13.1752 9.82728 13.1752 9.59323 12.9745L3.75989 7.97455C3.49781 7.74991 3.46746 7.35535 3.6921 7.09327Z" fill="#1E2023" />
                </svg>
              </div>
              <div className="admin-role">ادمین . مدیر ارشد محصول</div>
            </div>
          </div>
        </div>
        <div className="header-left">
          {/* <form className="search-box5">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="search-box5-icon">
              <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
            </svg>

            <input
              type="text"
              placeholder="جستجو کنید ..."
              className="search-box5-input"
            />
          </form> */}
          <div className="notifications-btn" onClick={handleNotificationClick}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M14.8549 2.09564C13.8149 2.09564 12.9719 2.93869 12.9719 3.97865C12.9719 5.01861 13.8149 5.86166 14.8549 5.86166C15.8948 5.86166 16.7379 5.01861 16.7379 3.97865C16.7379 2.93869 15.8948 2.09564 14.8549 2.09564ZM11.7165 3.97865C11.7165 2.24539 13.1216 0.840302 14.8549 0.840302C16.5881 0.840302 17.9932 2.24539 17.9932 3.97865C17.9932 5.71192 16.5881 7.117 14.8549 7.117C13.1216 7.117 11.7165 5.71192 11.7165 3.97865ZM7.27561 2.51409L9.8335 2.51409C10.1802 2.51409 10.4612 2.79511 10.4612 3.14176C10.4612 3.48841 10.1802 3.76943 9.8335 3.76943H7.32282C5.72701 3.76943 4.5933 3.77076 3.73326 3.88639C2.89127 3.99959 2.40616 4.21189 2.05198 4.56607C1.6978 4.92025 1.48551 5.40535 1.3723 6.24734C1.25667 7.10739 1.25534 8.2411 1.25534 9.83691C1.25534 11.4327 1.25667 12.5664 1.3723 13.4265C1.48551 14.2685 1.6978 14.7536 2.05198 15.1077C2.40616 15.4619 2.89127 15.6742 3.73326 15.7874C4.5933 15.9031 5.72701 15.9044 7.32282 15.9044H10.6704C12.2662 15.9044 13.3999 15.9031 14.26 15.7874C15.1019 15.6742 15.587 15.4619 15.9412 15.1077C16.2954 14.7536 16.5077 14.2685 16.6209 13.4265C16.7365 12.5664 16.7379 11.4327 16.7379 9.83691C16.7379 9.5248 16.7401 9.2968 16.7421 9.10081C16.7452 8.78343 16.7475 8.54995 16.7381 8.17907C16.7293 7.83253 17.0031 7.54446 17.3496 7.53565C17.6961 7.52684 17.9842 7.80063 17.993 8.14717C18.0029 8.53724 18.0004 8.80349 17.9972 9.13998C17.9953 9.33576 17.9932 9.55533 17.9932 9.83691V9.88412C17.9932 11.4221 17.9932 12.6403 17.8651 13.5937C17.7331 14.5749 17.4552 15.3691 16.8289 15.9954C16.2026 16.6217 15.4084 16.8996 14.4272 17.0316C13.4738 17.1597 12.2556 17.1597 10.7176 17.1597H7.27561C5.7376 17.1597 4.51939 17.1597 3.56598 17.0316C2.58479 16.8996 1.79062 16.6217 1.16432 15.9954C0.538022 15.3691 0.260076 14.5749 0.128158 13.5937C-2.35736e-05 12.6403 -1.29997e-05 11.4221 2.69156e-07 9.88412V9.78969C-1.29997e-05 8.25168 -2.35736e-05 7.03347 0.128158 6.08007C0.260076 5.09888 0.538022 4.30471 1.16432 3.67841C1.79062 3.05211 2.58479 2.77416 3.56598 2.64225C4.51939 2.51406 5.7376 2.51407 7.27561 2.51409ZM3.49306 6.08751C3.71498 5.8212 4.11076 5.78522 4.37707 6.00714L6.18384 7.51278C6.96462 8.16344 7.50671 8.61372 7.96437 8.90806C8.40738 9.19299 8.70782 9.28864 8.99661 9.28864C9.2854 9.28864 9.58583 9.19299 10.0288 8.90806C10.4865 8.61372 11.0286 8.16344 11.8094 7.51278C12.0757 7.29086 12.4715 7.32684 12.6934 7.59314C12.9153 7.85945 12.8793 8.25524 12.613 8.47716L12.5816 8.50337C11.8398 9.12155 11.2386 9.62259 10.7079 9.96388C10.1551 10.3194 9.61681 10.544 8.99661 10.544C8.3764 10.544 7.83807 10.3194 7.28531 9.96388C6.75467 9.6226 6.15344 9.12156 5.41166 8.50339L3.57342 6.97152C3.30711 6.7496 3.27113 6.35381 3.49306 6.08751Z" fill="#0F71EF" />
              <path d="M11.7165 3.97865C11.7165 2.24539 13.1216 0.840302 14.8549 0.840302C16.5881 0.840302 17.9932 2.24539 17.9932 3.97865C17.9932 5.71192 16.5881 7.117 14.8549 7.117C13.1216 7.117 11.7165 5.71192 11.7165 3.97865Z" fill="#03234D" />
            </svg>
            <span>اعلان ها</span>
            {unreadNotificationsCount > 0 && (
              <div className="notification-badge">{unreadNotificationsCount}</div>
            )}
          </div>
        </div>

      </div>

      <div id="amain-content" className="admin-content-wrapper">
        {/* Sidebar */}
        <div id="amain-sidebar" className="admin-sidebar">


          <div className="sidebar-menu">
            <span className="menu-title3">
              منوی اصلی

            </span>
            <div
              id="dashboard-menu-item-m"
              className={`menu-item-m ${activeMenu === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleMenuClick('dashboard', 'داشبورد')}
            >
              <span className="menu-icon">
                <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3.42847 1.06232C3.98584 1.06232 4.37472 1.06308 4.67847 1.08478C4.97661 1.1061 5.14999 1.14536 5.28198 1.20294C5.67214 1.3732 5.98382 1.68484 6.15405 2.07501C6.21162 2.20702 6.2509 2.38036 6.27222 2.67853C6.29392 2.9823 6.29468 3.3711 6.29468 3.92853C6.29468 4.4859 6.29392 4.87478 6.27222 5.17853C6.25089 5.47668 6.21164 5.65005 6.15405 5.78204C5.98381 6.17222 5.67216 6.48387 5.28198 6.65411C5.14999 6.7117 4.97662 6.75095 4.67847 6.77228C4.37472 6.79398 3.98584 6.79474 3.42847 6.79474C2.87104 6.79474 2.48224 6.79398 2.17847 6.77228C1.8803 6.75096 1.70695 6.71168 1.57495 6.65411C1.18478 6.48388 0.873136 6.1722 0.702881 5.78204C0.645295 5.65006 0.606041 5.47667 0.584717 5.17853C0.563015 4.87478 0.562256 4.4859 0.562256 3.92853C0.562256 3.3711 0.563014 2.9823 0.584717 2.67853C0.606034 2.38031 0.645297 2.20702 0.702881 2.07501C0.873126 1.68481 1.18474 1.37319 1.57495 1.20294C1.70696 1.14536 1.88025 1.1061 2.17847 1.08478C2.48224 1.06308 2.87104 1.06232 3.42847 1.06232Z" stroke="black" strokeWidth="1.12501" />
                  <path d="M3.42847 9.2049C3.98584 9.2049 4.37472 9.20565 4.67847 9.22736C4.97661 9.24868 5.14999 9.28793 5.28198 9.34552C5.67214 9.51578 5.98382 9.82742 6.15405 10.2176C6.21162 10.3496 6.2509 10.5229 6.27222 10.8211C6.29392 11.1249 6.29468 11.5137 6.29468 12.0711C6.29468 12.6285 6.29392 13.0174 6.27222 13.3211C6.25089 13.6193 6.21164 13.7926 6.15405 13.9246C5.98381 14.3148 5.67216 14.6264 5.28198 14.7967C5.14999 14.8543 4.97662 14.8935 4.67847 14.9149C4.37472 14.9366 3.98584 14.9373 3.42847 14.9373C2.87104 14.9373 2.48224 14.9366 2.17847 14.9149C1.8803 14.8935 1.70695 14.8543 1.57495 14.7967C1.18478 14.6265 0.873136 14.3148 0.702881 13.9246C0.645295 13.7926 0.606041 13.6192 0.584717 13.3211C0.563015 13.0174 0.562256 12.6285 0.562256 12.0711C0.562256 11.5137 0.563014 11.1249 0.584717 10.8211C0.606034 10.5229 0.645297 10.3496 0.702881 10.2176C0.873126 9.82738 1.18474 9.51577 1.57495 9.34552C1.70696 9.28794 1.88025 9.24867 2.17847 9.22736C2.48224 9.20565 2.87104 9.2049 3.42847 9.2049Z" stroke="black" strokeWidth="1.12501" />
                  <path d="M11.5715 1.06232C12.1289 1.06232 12.5178 1.06308 12.8215 1.08478C13.1197 1.1061 13.2931 1.14536 13.425 1.20294C13.8152 1.3732 14.1269 1.68484 14.2971 2.07501C14.3547 2.20702 14.394 2.38036 14.4153 2.67853C14.437 2.9823 14.4377 3.3711 14.4377 3.92853C14.4377 4.4859 14.437 4.87478 14.4153 5.17853C14.394 5.47668 14.3547 5.65005 14.2971 5.78204C14.1269 6.17222 13.8152 6.48387 13.425 6.65411C13.2931 6.7117 13.1197 6.75095 12.8215 6.77228C12.5178 6.79398 12.1289 6.79474 11.5715 6.79474C11.0141 6.79474 10.6253 6.79398 10.3215 6.77228C10.0234 6.75096 9.85002 6.71168 9.71802 6.65411C9.32785 6.48388 9.0162 6.1722 8.84595 5.78204C8.78836 5.65006 8.74911 5.47667 8.72778 5.17853C8.70608 4.87478 8.70532 4.4859 8.70532 3.92853C8.70532 3.3711 8.70608 2.9823 8.72778 2.67853C8.7491 2.38031 8.78836 2.20702 8.84595 2.07501C9.01619 1.68481 9.32781 1.37319 9.71802 1.20294C9.85003 1.14536 10.0233 1.1061 10.3215 1.08478C10.6253 1.06308 11.0141 1.06232 11.5715 1.06232Z" stroke="black" strokeWidth="1.12501" />
                  <path d="M11.5715 9.2049C12.1289 9.2049 12.5178 9.20565 12.8215 9.22736C13.1197 9.24868 13.2931 9.28793 13.425 9.34552C13.8152 9.51578 14.1269 9.82742 14.2971 10.2176C14.3547 10.3496 14.394 10.5229 14.4153 10.8211C14.437 11.1249 14.4377 11.5137 14.4377 12.0711C14.4377 12.6285 14.437 13.0174 14.4153 13.3211C14.394 13.6193 14.3547 13.7926 14.2971 13.9246C14.1269 14.3148 13.8152 14.6264 13.425 14.7967C13.2931 14.8543 13.1197 14.8935 12.8215 14.9149C12.5178 14.9366 12.1289 14.9373 11.5715 14.9373C11.0141 14.9373 10.6253 14.9366 10.3215 14.9149C10.0234 14.8935 9.85002 14.8543 9.71802 14.7967C9.32785 14.6265 9.0162 14.3148 8.84595 13.9246C8.78836 13.7926 8.74911 13.6192 8.72778 13.3211C8.70608 13.0174 8.70532 12.6285 8.70532 12.0711C8.70532 11.5137 8.70608 11.1249 8.72778 10.8211C8.7491 10.5229 8.78836 10.3496 8.84595 10.2176C9.01619 9.82738 9.32781 9.51577 9.71802 9.34552C9.85003 9.28794 10.0233 9.24867 10.3215 9.22736C10.6253 9.20565 11.0141 9.2049 11.5715 9.2049Z" stroke="black" strokeWidth="1.12501" />
                </svg>
              </span>
              <span> داشبورد  </span>
            </div>

            <div className="menu-item-m with-submenu">

              <div
                className={`menu-item-m ${activeMenu === 'reports' ? 'active' : ''}`}
                onClick={() => {
                  toggleReportsManagement();
                  handleMenuClick('reports', 'گزارشات');
                }}
              >
                <span className="menu-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.19768 9.99579C3.19768 9.71643 3.42414 9.48997 3.70349 9.48997H9.09885C9.3782 9.48997 9.60466 9.71643 9.60466 9.99579C9.60466 10.2751 9.3782 10.5016 9.09885 10.5016H3.70349C3.42414 10.5016 3.19768 10.2751 3.19768 9.99579Z" fill="#858585" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.19768 12.3563C3.19768 12.0769 3.42414 11.8504 3.70349 11.8504H7.4128C7.69215 11.8504 7.91862 12.0769 7.91862 12.3563C7.91862 12.6356 7.69215 12.8621 7.4128 12.8621H3.70349C3.42414 12.8621 3.19768 12.6356 3.19768 12.3563Z" fill="#858585" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M7.91862 2.12812C7.60811 2.07536 7.18483 2.07136 6.42126 2.07136C5.12862 2.07136 4.20981 2.07242 3.51321 2.16565C2.83077 2.25699 2.43864 2.42831 2.15361 2.71334C1.86819 2.99876 1.69711 3.38968 1.60589 4.06821C1.5127 4.76129 1.51163 5.6749 1.51163 6.9609V9.65858C1.51163 10.9446 1.5127 11.8582 1.60589 12.5513C1.69711 13.2298 1.86819 13.6207 2.15361 13.9061C2.43903 14.1916 2.82996 14.3626 3.50848 14.4539C4.20156 14.547 5.11517 14.5481 6.40117 14.5481H9.09885C10.3848 14.5481 11.2985 14.547 11.9915 14.4539C12.6701 14.3626 13.061 14.1916 13.3464 13.9061C13.6318 13.6207 13.8029 13.2298 13.8941 12.5513C13.9873 11.8582 13.9884 10.9446 13.9884 9.65858V9.36379C13.9884 8.32787 13.9811 7.83679 13.8712 7.46671H11.7603C10.9963 7.46673 10.372 7.46674 9.87908 7.40047C9.36385 7.3312 8.91716 7.18129 8.5606 6.82473C8.20404 6.46817 8.05413 6.02148 7.98486 5.50625C7.91859 5.01334 7.9186 4.38901 7.91862 3.62501V2.12812ZM8.93025 2.65099V3.5888C8.93025 4.39791 8.93132 4.95386 8.98746 5.37146C9.04165 5.7745 9.13866 5.97213 9.27593 6.1094C9.4132 6.24667 9.61083 6.34368 10.0139 6.39786C10.4315 6.45401 10.9874 6.45508 11.7965 6.45508H13.1585C12.9586 6.26116 12.7024 6.0288 12.3698 5.72942L9.69991 3.32653C9.37256 3.03192 9.12892 2.81445 8.93025 2.65099ZM6.5195 1.05971C7.4533 1.05946 8.0566 1.0593 8.61187 1.27237C9.16712 1.48545 9.61354 1.88744 10.3042 2.50939C10.3281 2.53086 10.3522 2.5526 10.3766 2.57459L13.0465 4.97748C13.0749 5.00306 13.103 5.02832 13.1308 5.05326C13.929 5.77128 14.4453 6.23558 14.7229 6.85904C15.0006 7.48249 15.0004 8.17678 15 9.25047C15 9.28778 15 9.32555 15 9.36379V9.69662C15 10.936 15 11.9178 14.8967 12.6861C14.7904 13.4768 14.5665 14.1168 14.0617 14.6215C13.557 15.1262 12.917 15.3502 12.1263 15.4565C11.358 15.5598 10.3763 15.5598 9.1369 15.5597H6.36313C5.1237 15.5598 4.142 15.5598 3.37369 15.4565C2.58298 15.3502 1.94299 15.1262 1.43828 14.6215C0.933571 14.1168 0.709585 13.4768 0.603277 12.6861C0.499981 11.9178 0.49999 10.936 0.5 9.69663V6.92285C0.49999 5.68343 0.499981 4.70172 0.603277 3.93341C0.709585 3.14271 0.933571 2.50272 1.43828 1.99801C1.94339 1.4929 2.58552 1.26916 3.37901 1.16296C4.15052 1.05971 5.13711 1.05972 6.38331 1.05973L6.42126 1.05973C6.45442 1.05973 6.48716 1.05972 6.5195 1.05971Z" fill="#858585" />
                    <path d="M7.91862 2.12812H8.01862V2.04368L7.93537 2.02953L7.91862 2.12812ZM3.51321 2.16565L3.49994 2.06654L3.51321 2.16565ZM2.15361 2.71334L2.0829 2.64263L2.15361 2.71334ZM1.60589 4.06821L1.50678 4.05489H1.50678L1.60589 4.06821ZM1.60589 12.5513L1.50678 12.5646H1.50678L1.60589 12.5513ZM2.15361 13.9061L2.22432 13.8354H2.22432L2.15361 13.9061ZM3.50848 14.4539L3.52181 14.3548L3.50848 14.4539ZM11.9915 14.4539L11.9782 14.3548L11.9915 14.4539ZM13.8941 12.5513L13.795 12.5379L13.8941 12.5513ZM13.8712 7.46671L13.967 7.43823L13.9458 7.36671H13.8712V7.46671ZM11.7603 7.46671V7.36671H11.7603L11.7603 7.46671ZM9.87908 7.40047L9.86575 7.49958L9.87908 7.40047ZM8.5606 6.82473L8.48989 6.89544L8.5606 6.82473ZM7.98486 5.50625L7.88575 5.51958L7.98486 5.50625ZM7.91862 3.62501L8.01862 3.62501V3.62501H7.91862ZM8.93025 2.65099L8.99378 2.57376L8.83025 2.43921V2.65099H8.93025ZM8.98746 5.37146L8.88836 5.38478L8.98746 5.37146ZM10.0139 6.39786L10.0272 6.29876L10.0139 6.39786ZM13.1585 6.45508V6.55508H13.4052L13.2281 6.38331L13.1585 6.45508ZM12.3698 5.72942L12.3029 5.80375L12.3698 5.72942ZM9.69991 3.32653L9.7668 3.2522L9.69991 3.32653ZM8.61187 1.27237L8.64769 1.17901V1.17901L8.61187 1.27237ZM6.5195 1.05971L6.51953 1.15971L6.5195 1.05971ZM10.3042 2.50939L10.2373 2.5837L10.2373 2.5837L10.3042 2.50939ZM10.3766 2.57459L10.3098 2.64892V2.64892L10.3766 2.57459ZM13.0465 4.97748L12.9796 5.05181V5.05181L13.0465 4.97748ZM13.1308 5.05326L13.1976 4.97891V4.97891L13.1308 5.05326ZM14.7229 6.85904L14.6316 6.89972V6.89972L14.7229 6.85904ZM15 9.25047L15.1 9.2505V9.2505L15 9.25047ZM15 9.69662H14.9V9.69662L15 9.69662ZM14.8967 12.6861L14.7976 12.6727L14.8967 12.6861ZM14.0617 14.6215L13.991 14.5508L13.991 14.5508L14.0617 14.6215ZM12.1263 15.4565L12.113 15.3574L12.1263 15.4565ZM9.1369 15.5597L9.1369 15.4597H9.1369V15.5597ZM6.36313 15.5597V15.4597H6.36313L6.36313 15.5597ZM3.37369 15.4565L3.38701 15.3574L3.37369 15.4565ZM1.43828 14.6215L1.50899 14.5508V14.5508L1.43828 14.6215ZM0.603277 12.6861L0.702386 12.6727H0.702386L0.603277 12.6861ZM0.5 9.69663L0.6 9.69663V9.69663H0.5ZM0.5 6.92285H0.6V6.92285L0.5 6.92285ZM0.603277 3.93341L0.504169 3.92009L0.603277 3.93341ZM1.43828 1.99801L1.50899 2.06872L1.43828 1.99801ZM3.37901 1.16296L3.36575 1.06385L3.37901 1.16296ZM6.38331 1.05973L6.38331 1.15973H6.38331L6.38331 1.05973ZM6.42126 1.05973L6.42126 1.15973H6.42126V1.05973ZM3.70349 9.48997V9.38997C3.36891 9.38997 3.09768 9.6612 3.09768 9.99579H3.19768H3.29768C3.29768 9.77166 3.47937 9.58997 3.70349 9.58997V9.48997ZM9.09885 9.48997V9.38997H3.70349V9.48997V9.58997H9.09885V9.48997ZM9.60466 9.99579H9.70467C9.70467 9.6612 9.43343 9.38997 9.09885 9.38997V9.48997V9.58997C9.32298 9.58997 9.50466 9.77166 9.50466 9.99579H9.60466ZM9.09885 10.5016V10.6016C9.43343 10.6016 9.70467 10.3304 9.70467 9.99579H9.60466H9.50466C9.50466 10.2199 9.32298 10.4016 9.09885 10.4016V10.5016ZM3.70349 10.5016V10.6016H9.09885V10.5016V10.4016H3.70349V10.5016ZM3.19768 9.99579H3.09768C3.09768 10.3304 3.36891 10.6016 3.70349 10.6016V10.5016V10.4016C3.47937 10.4016 3.29768 10.2199 3.29768 9.99579H3.19768ZM3.70349 11.8504V11.7504C3.36891 11.7504 3.09768 12.0217 3.09768 12.3563H3.19768H3.29768C3.29768 12.1321 3.47937 11.9504 3.70349 11.9504V11.8504ZM7.4128 11.8504V11.7504H3.70349V11.8504V11.9504H7.4128V11.8504ZM7.91862 12.3563H8.01862C8.01862 12.0217 7.74738 11.7504 7.4128 11.7504V11.8504V11.9504C7.63693 11.9504 7.81862 12.1321 7.81862 12.3563H7.91862ZM7.4128 12.8621V12.9621C7.74738 12.9621 8.01862 12.6908 8.01862 12.3563H7.91862H7.81862C7.81862 12.5804 7.63693 12.7621 7.4128 12.7621V12.8621ZM3.70349 12.8621V12.9621H7.4128V12.8621V12.7621H3.70349V12.8621ZM3.19768 12.3563H3.09768C3.09768 12.6908 3.36891 12.9621 3.70349 12.9621V12.8621V12.7621C3.47937 12.7621 3.29768 12.5804 3.29768 12.3563H3.19768ZM6.42126 2.07136V2.17136C7.18843 2.17136 7.60166 2.17569 7.90186 2.22671L7.91862 2.12812L7.93537 2.02953C7.61456 1.97502 7.18123 1.97136 6.42126 1.97136V2.07136ZM3.51321 2.16565L3.52647 2.26477C4.21489 2.17263 5.12576 2.17136 6.42126 2.17136V2.07136V1.97136C5.13148 1.97136 4.20473 1.97221 3.49994 2.06654L3.51321 2.16565ZM2.15361 2.71334L2.22432 2.78405C2.48762 2.52076 2.85506 2.35463 3.52647 2.26477L3.51321 2.16565L3.49994 2.06654C2.80648 2.15935 2.38966 2.33587 2.0829 2.64263L2.15361 2.71334ZM1.60589 4.06821L1.70499 4.08153C1.79472 3.41414 1.96056 3.04781 2.22432 2.78405L2.15361 2.71334L2.0829 2.64263C1.77583 2.9497 1.5995 3.36522 1.50678 4.05489L1.60589 4.06821ZM1.51163 6.9609H1.61163C1.61163 5.67203 1.61292 4.76639 1.70499 4.08153L1.60589 4.06821L1.50678 4.05489C1.41249 4.75618 1.41163 5.67777 1.41163 6.9609H1.51163ZM1.51163 9.65858H1.61163V6.9609H1.51163H1.41163V9.65858H1.51163ZM1.60589 12.5513L1.70499 12.5379C1.61292 11.8531 1.61163 10.9474 1.61163 9.65858H1.51163H1.41163C1.41163 10.9417 1.41249 11.8633 1.50678 12.5646L1.60589 12.5513ZM2.15361 13.9061L2.22432 13.8354C1.96056 13.5717 1.79472 13.2053 1.70499 12.5379L1.60589 12.5513L1.50678 12.5646C1.5995 13.2543 1.77583 13.6698 2.0829 13.9768L2.15361 13.9061ZM3.50848 14.4539L3.52181 14.3548C2.85442 14.265 2.48809 14.0992 2.22432 13.8354L2.15361 13.9061L2.0829 13.9768C2.38998 14.2839 2.8055 14.4602 3.49516 14.553L3.50848 14.4539ZM6.40117 14.5481V14.4481C5.11231 14.4481 4.20666 14.4468 3.52181 14.3548L3.50848 14.4539L3.49516 14.553C4.19646 14.6473 5.11804 14.6481 6.40117 14.6481V14.5481ZM9.09885 14.5481V14.4481H6.40117V14.5481V14.6481H9.09885V14.5481ZM11.9915 14.4539L11.9782 14.3548C11.2934 14.4468 10.3877 14.4481 9.09885 14.4481V14.5481V14.6481C10.382 14.6481 11.3036 14.6473 12.0049 14.553L11.9915 14.4539ZM13.3464 13.9061L13.2757 13.8354C13.0119 14.0992 12.6456 14.265 11.9782 14.3548L11.9915 14.4539L12.0049 14.553C12.6945 14.4602 13.11 14.2839 13.4171 13.9768L13.3464 13.9061ZM13.8941 12.5513L13.795 12.5379C13.7053 13.2053 13.5395 13.5717 13.2757 13.8354L13.3464 13.9061L13.4171 13.9768C13.7242 13.6698 13.9005 13.2543 13.9932 12.5646L13.8941 12.5513ZM13.9884 9.65858H13.8884C13.8884 10.9474 13.8871 11.8531 13.795 12.5379L13.8941 12.5513L13.9932 12.5646C14.0875 11.8633 14.0884 10.9417 14.0884 9.65858H13.9884ZM13.9884 9.36379H13.8884V9.65858H13.9884H14.0884V9.36379H13.9884ZM13.8712 7.46671L13.7753 7.49519C13.8801 7.8479 13.8884 8.32115 13.8884 9.36379H13.9884H14.0884C14.0884 8.33459 14.0821 7.82568 13.967 7.43823L13.8712 7.46671ZM9.87908 7.40047L9.86575 7.49958C10.3668 7.56695 10.9989 7.56673 11.7603 7.56671L11.7603 7.46671L11.7603 7.36671C10.9937 7.36673 10.3772 7.36654 9.8924 7.30137L9.87908 7.40047ZM8.5606 6.82473L8.48989 6.89544C8.86815 7.2737 9.33949 7.42883 9.86575 7.49958L9.87908 7.40047L9.8924 7.30137C9.38822 7.23358 8.96617 7.08888 8.63131 6.75402L8.5606 6.82473ZM7.98486 5.50625L7.88575 5.51958C7.9565 6.04584 8.11163 6.51718 8.48989 6.89544L8.5606 6.82473L8.63131 6.75402C8.29645 6.41916 8.15175 5.99711 8.08396 5.49293L7.98486 5.50625ZM7.91862 3.62501L7.81862 3.62501C7.8186 4.38645 7.81838 5.01852 7.88575 5.51958L7.98486 5.50625L8.08396 5.49293C8.01879 5.00817 8.0186 4.39158 8.01862 3.62501L7.91862 3.62501ZM8.93025 3.5888H9.03025V2.65099H8.93025H8.83025V3.5888H8.93025ZM8.98746 5.37146L9.08657 5.35813C9.03154 4.94876 9.03025 4.4008 9.03025 3.5888H8.93025H8.83025C8.83025 4.39502 8.83111 4.95896 8.88836 5.38478L8.98746 5.37146ZM9.27593 6.1094L9.34664 6.03869C9.231 5.92306 9.13926 5.75 9.08657 5.35813L8.98746 5.37146L8.88836 5.38478C8.94405 5.799 9.04631 6.0212 9.20522 6.18011L9.27593 6.1094ZM10.0139 6.39786L10.0272 6.29876C9.63533 6.24607 9.46227 6.15433 9.34664 6.03869L9.27593 6.1094L9.20522 6.18011C9.36413 6.33902 9.58633 6.44128 10.0005 6.49697L10.0139 6.39786ZM11.7965 6.45508V6.35508C10.9845 6.35508 10.4366 6.3538 10.0272 6.29876L10.0139 6.39786L10.0005 6.49697C10.4264 6.55422 10.9903 6.55508 11.7965 6.55508V6.45508ZM13.1585 6.45508V6.35508H11.7965V6.45508V6.55508H13.1585V6.45508ZM12.3698 5.72942L12.3029 5.80375C12.6358 6.10334 12.8905 6.33446 13.0889 6.52686L13.1585 6.45508L13.2281 6.38331C13.0266 6.18786 12.7691 5.95425 12.4367 5.65509L12.3698 5.72942ZM9.69991 3.32653L9.63301 3.40086L12.3029 5.80375L12.3698 5.72942L12.4367 5.65509L9.7668 3.2522L9.69991 3.32653ZM8.93025 2.65099L8.86671 2.72821C9.06335 2.89 9.30529 3.10591 9.63301 3.40086L9.69991 3.32653L9.7668 3.2522C9.43983 2.95792 9.19449 2.73889 8.99378 2.57376L8.93025 2.65099ZM8.61187 1.27237L8.64769 1.17901C8.07151 0.957909 7.44742 0.959461 6.51948 0.959709L6.5195 1.05971L6.51953 1.15971C7.45919 1.15946 8.0417 1.16069 8.57604 1.36574L8.61187 1.27237ZM10.3042 2.50939L10.3711 2.43508C9.68477 1.81701 9.22386 1.40011 8.64769 1.17901L8.61187 1.27237L8.57604 1.36574C9.11039 1.57079 9.54232 1.95787 10.2373 2.5837L10.3042 2.50939ZM10.3766 2.57459L10.4435 2.50026C10.4191 2.47828 10.395 2.45655 10.3711 2.43508L10.3042 2.50939L10.2373 2.5837C10.2612 2.60517 10.2853 2.62691 10.3098 2.64892L10.3766 2.57459ZM13.0465 4.97748L13.1134 4.90315L10.4435 2.50026L10.3766 2.57459L10.3098 2.64892L12.9796 5.05181L13.0465 4.97748ZM13.1308 5.05326L13.1976 4.97891C13.1699 4.95396 13.1418 4.92872 13.1134 4.90315L13.0465 4.97748L12.9796 5.05181C13.0081 5.0774 13.0362 5.10267 13.0639 5.12761L13.1308 5.05326ZM14.7229 6.85904L14.8143 6.81836C14.5261 6.17139 13.9908 5.69234 13.1976 4.97891L13.1308 5.05326L13.0639 5.12761C13.8673 5.85022 14.3644 6.29977 14.6316 6.89972L14.7229 6.85904ZM15 9.25047L15.1 9.2505C15.1004 8.18368 15.1024 7.46531 14.8143 6.81836L14.7229 6.85904L14.6316 6.89972C14.8988 7.49967 14.9004 8.16989 14.9 9.25043L15 9.25047ZM15 9.36379H15.1C15.1 9.32556 15.1 9.28781 15.1 9.2505L15 9.25047L14.9 9.25043C14.9 9.28774 14.9 9.32553 14.9 9.36379H15ZM14.8967 12.6861L14.9959 12.6994C15.1002 11.9229 15.1 10.9334 15.1 9.69662L15 9.69662L14.9 9.69662C14.9 10.9387 14.8998 11.9126 14.7976 12.6727L14.8967 12.6861ZM14.0617 14.6215L14.1324 14.6922C14.6589 14.1658 14.8881 13.5012 14.9959 12.6994L14.8967 12.6861L14.7976 12.6727C14.6928 13.4524 14.474 14.0677 13.991 14.5508L14.0617 14.6215ZM12.1263 15.4565L12.1397 15.5556C12.9414 15.4478 13.606 15.2186 14.1325 14.6922L14.0617 14.6215L13.991 14.5508C13.508 15.0338 12.8927 15.2525 12.113 15.3574L12.1263 15.4565ZM9.1369 15.5597L9.13689 15.6597C10.3737 15.6598 11.3632 15.66 12.1397 15.5556L12.1263 15.4565L12.113 15.3574C11.3529 15.4596 10.379 15.4598 9.1369 15.4597L9.1369 15.5597ZM3.37369 15.4565L3.36036 15.5556C4.13684 15.66 5.12637 15.6598 6.36313 15.6597L6.36313 15.5597L6.36313 15.4597C5.12104 15.4598 4.14715 15.4596 3.38701 15.3574L3.37369 15.4565ZM1.43828 14.6215L1.36757 14.6922C1.89397 15.2186 2.5586 15.4478 3.36036 15.5556L3.37369 15.4565L3.38701 15.3574C2.60736 15.2525 1.99201 15.0338 1.50899 14.5508L1.43828 14.6215ZM0.603277 12.6861L0.504169 12.6994C0.611963 13.5012 0.841169 14.1658 1.36757 14.6922L1.43828 14.6215L1.50899 14.5508C1.02597 14.0677 0.807206 13.4524 0.702386 12.6727L0.603277 12.6861ZM0.5 9.69663L0.4 9.69662C0.39999 10.9334 0.399774 11.9229 0.504169 12.6994L0.603277 12.6861L0.702386 12.6727C0.600188 11.9126 0.59999 10.9387 0.6 9.69663L0.5 9.69663ZM0.603277 3.93341L0.504169 3.92009C0.399774 4.69657 0.39999 5.68609 0.4 6.92285L0.5 6.92285L0.6 6.92285C0.59999 5.68077 0.600188 4.70687 0.702386 3.94674L0.603277 3.93341ZM1.43828 1.99801L1.36757 1.9273C0.841169 2.4537 0.611963 3.11833 0.504169 3.92009L0.603277 3.93341L0.702386 3.94674C0.807206 3.16709 1.02597 2.55174 1.50899 2.06872L1.43828 1.99801ZM3.37901 1.16296L3.36575 1.06385C2.56131 1.17151 1.89445 1.40042 1.36757 1.9273L1.43828 1.99801L1.50899 2.06872C1.99233 1.58538 2.60973 1.36681 3.39228 1.26208L3.37901 1.16296ZM6.38331 1.05973L6.38331 0.959726C5.13976 0.959716 4.14539 0.959502 3.36575 1.06385L3.37901 1.16296L3.39228 1.26208C4.15565 1.15991 5.13446 1.15972 6.38331 1.15973L6.38331 1.05973ZM6.42126 1.05973L6.42127 0.959727L6.38331 0.959726L6.38331 1.05973L6.38331 1.15973L6.42126 1.15973L6.42126 1.05973ZM6.5195 1.05971L6.51948 0.959709C6.48713 0.959718 6.4544 0.959727 6.42126 0.959727V1.05973V1.15973C6.45443 1.15973 6.48719 1.15972 6.51953 1.15971L6.5195 1.05971ZM11.7603 7.46671V7.56671H13.8712V7.46671V7.36671H11.7603V7.46671ZM7.91862 2.12812H7.81862V3.62501H7.91862H8.01862V2.12812H7.91862ZM15 9.69662H15.1V9.36379H15H14.9V9.69662H15ZM6.36313 15.5597V15.6597H9.1369V15.5597V15.4597H6.36313V15.5597ZM0.5 6.92285H0.4V9.69663H0.5H0.6V6.92285H0.5Z" fill="#858585" />
                  </svg>

                </span>
                <span>گزارشات</span>
                <svg className={`submenu-arrow ${reportsManagementOpen ? 'open' : ''}`} width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M2.95363 5.98434C3.13334 5.77467 3.44899 5.75039 3.65866 5.9301L7.99993 9.65119L12.3412 5.9301C12.5509 5.75039 12.8665 5.77467 13.0462 5.98434C13.2259 6.194 13.2017 6.50965 12.992 6.68936L8.32532 10.6894C8.13808 10.8499 7.86178 10.8499 7.67453 10.6894L3.00787 6.68936C2.7982 6.50965 2.77392 6.194 2.95363 5.98434Z" fill="#858585" />
                </svg>

              </div>
              {reportsManagementOpen && (
                <div className="submenu-items">
                  <div
                    className={`submenu-item ${currentReportView === 'کاربران ثبت نام کرده' ? 'active' : ''}`}
                    onClick={() => handleSubmenuClick('کاربران ثبت نام کرده')}
                  >
                    <div className="submenu-branch"></div>
                    <span>کاربران ثبت نام کرده</span>
                  </div>
                  <div
                    className={`submenu-item ${currentReportView === 'دیدگاه ها' ? 'active' : ''}`}
                    onClick={() => handleSubmenuClick('دیدگاه ها')}
                  >
                    <div className="submenu-branch"></div>
                    <span>دیدگاه ها</span>
                  </div>
                  <div
                    className={`submenu-item ${currentReportView === 'لاگ های مسیریابی کاربران' ? 'active' : ''}`}
                    onClick={() => handleSubmenuClick('لاگ های مسیریابی کاربران')}
                  >
                    <div className="submenu-branch"></div>
                    <span>لاگ های مسیریابی کاربران</span>
                  </div>
                  <div
                    className={`submenu-item ${currentReportView === 'بازخورد ها' ? 'active' : ''}`}
                    onClick={() => handleSubmenuClick('بازخورد ها')}
                  >
                    <div className="submenu-branch"></div>
                    <span>بازخورد ها</span>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`menu-item-m ${activeMenu === 'mapmanage' ? 'active' : ''}`}
              onClick={() => handleMenuClick('mapmanage', 'مدیریت نقشه')}
            >
              <span className="menu-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M11.5906 1.95089C10.724 1.83438 9.58516 1.83331 7.99967 1.83331C6.41419 1.83331 5.27538 1.83438 4.40873 1.95089C3.55646 2.06548 3.04264 2.28341 2.66287 2.66318C2.2831 3.04295 2.06517 3.55676 1.95059 4.40903C1.83407 5.27568 1.83301 6.4145 1.83301 7.99998C1.83301 9.58546 1.83407 10.7243 1.95059 11.5909C2.06517 12.4432 2.2831 12.957 2.66287 13.3368C2.97462 13.6485 3.3767 13.8512 3.98218 13.9772L13.9769 3.98249C13.8509 3.37701 13.6482 2.97493 13.3365 2.66318C12.9567 2.28341 12.4429 2.06548 11.5906 1.95089ZM14.1245 5.24908L10.0404 9.3332L13.6452 12.938C13.8416 12.6052 13.9698 12.1785 14.0488 11.5909C14.1653 10.7243 14.1663 9.58546 14.1663 7.99998C14.1663 6.88096 14.1658 5.98444 14.1245 5.24908ZM12.9382 13.6452L9.33331 10.0403L5.24877 14.1248C5.98414 14.1661 6.88065 14.1666 7.99967 14.1666C9.58516 14.1666 10.724 14.1656 11.5906 14.0491C12.1785 13.97 12.6053 13.8418 12.9382 13.6452ZM11.7239 0.959811C12.687 1.0893 13.447 1.35953 14.0436 1.95607C14.6401 2.55261 14.9103 3.31263 15.0398 4.27578C15.1664 5.21678 15.1663 6.4228 15.1663 7.96173V8.03823C15.1663 9.57716 15.1664 10.7832 15.0398 11.7242C14.9103 12.6873 14.6401 13.4473 14.0436 14.0439C13.447 14.6404 12.687 14.9107 11.7239 15.0401C10.7829 15.1667 9.57685 15.1667 8.03792 15.1666H7.96143C6.4225 15.1667 5.21647 15.1667 4.27548 15.0401C3.31232 14.9107 2.55231 14.6404 1.95577 14.0439C1.35923 13.4473 1.089 12.6873 0.959506 11.7242C0.832993 10.7832 0.832999 9.57716 0.833008 8.03823V7.96173C0.832999 6.4228 0.832992 5.21677 0.959505 4.27578C1.089 3.31263 1.35923 2.55261 1.95577 1.95607C2.5523 1.35953 3.31232 1.0893 4.27548 0.959811C5.21647 0.833298 6.42249 0.833305 7.96142 0.833313H8.03793C9.57685 0.833304 10.7829 0.833298 11.7239 0.959811ZM3.16634 5.83812C3.16634 4.32944 4.46931 3.16658 5.99967 3.16658C7.53004 3.16658 8.83301 4.32944 8.83301 5.83812C8.83301 7.18897 8.00247 8.7833 6.62285 9.37288C6.22648 9.54226 5.77287 9.54226 5.3765 9.37288C3.99688 8.7833 3.16634 7.18897 3.16634 5.83812ZM5.99967 4.16658C4.95271 4.16658 4.16634 4.94819 4.16634 5.83812C4.16634 6.8671 4.82524 8.04981 5.76947 8.45332C5.91483 8.51544 6.08452 8.51544 6.22988 8.45332C7.17411 8.04981 7.83301 6.8671 7.83301 5.83812C7.83301 4.94819 7.04664 4.16658 5.99967 4.16658Z" fill="#858585" />
                  <path d="M6.66634 5.99998C6.66634 6.36817 6.36786 6.66665 5.99967 6.66665C5.63148 6.66665 5.33301 6.36817 5.33301 5.99998C5.33301 5.63179 5.63148 5.33331 5.99967 5.33331C6.36786 5.33331 6.66634 5.63179 6.66634 5.99998Z" fill="#858585" />
                </svg>


              </span>
              <span>مدیریت نقشه</span>
            </div>


            <div className="menu-item with-submenu">
              {/* <div
                className={`menu-item ${activeMenu === 'usermanage' ? 'active' : ''}`}
                onClick={() => {
                  toggleUserManagement();
                  handleMenuClick('usermanage', 'مدیریت کاربران');
                }}
              >
                <span className="menu-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.00033 0.833313C6.25142 0.833313 4.83366 2.25108 4.83366 3.99998C4.83366 5.74888 6.25142 7.16665 8.00033 7.16665C9.74923 7.16665 11.167 5.74888 11.167 3.99998C11.167 2.25108 9.74923 0.833313 8.00033 0.833313ZM5.83366 3.99998C5.83366 2.80336 6.80371 1.83331 8.00033 1.83331C9.19694 1.83331 10.167 2.80336 10.167 3.99998C10.167 5.1966 9.19694 6.16665 8.00033 6.16665C6.80371 6.16665 5.83366 5.1966 5.83366 3.99998Z" fill="#858585" />
                    <path d="M12.0003 2.16665C11.7242 2.16665 11.5003 2.3905 11.5003 2.66665C11.5003 2.94279 11.7242 3.16665 12.0003 3.16665C12.918 3.16665 13.5003 3.77047 13.5003 4.33331C13.5003 4.89616 12.918 5.49998 12.0003 5.49998C11.7242 5.49998 11.5003 5.72384 11.5003 5.99998C11.5003 6.27612 11.7242 6.49998 12.0003 6.49998C13.2918 6.49998 14.5003 5.61142 14.5003 4.33331C14.5003 3.05521 13.2918 2.16665 12.0003 2.16665Z" fill="#858585" />
                    <path d="M4.50033 2.66665C4.50033 2.3905 4.27647 2.16665 4.00033 2.16665C2.70884 2.16665 1.50033 3.05521 1.50033 4.33331C1.50033 5.61142 2.70884 6.49998 4.00033 6.49998C4.27647 6.49998 4.50033 6.27612 4.50033 5.99998C4.50033 5.72384 4.27647 5.49998 4.00033 5.49998C3.08267 5.49998 2.50033 4.89616 2.50033 4.33331C2.50033 3.77047 3.08267 3.16665 4.00033 3.16665C4.27647 3.16665 4.50033 2.94279 4.50033 2.66665Z" fill="#858585" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.00033 8.16665C6.81081 8.16665 5.71129 8.48717 4.89455 9.03167C4.0813 9.57384 3.50033 10.3777 3.50033 11.3333C3.50033 12.2889 4.0813 13.0928 4.89455 13.635C5.71129 14.1795 6.81081 14.5 8.00033 14.5C9.18984 14.5 10.2894 14.1795 11.1061 13.635C11.9194 13.0928 12.5003 12.2889 12.5003 11.3333C12.5003 10.3777 11.9194 9.57384 11.1061 9.03167C10.2894 8.48717 9.18984 8.16665 8.00033 8.16665ZM4.50033 11.3333C4.50033 10.8161 4.81478 10.2867 5.44925 9.86372C6.08022 9.44307 6.9807 9.16665 8.00033 9.16665C9.01995 9.16665 9.92043 9.44307 10.5514 9.86372C11.1859 10.2867 11.5003 10.8161 11.5003 11.3333C11.5003 11.8505 11.1859 12.3799 10.5514 12.8029C9.92043 13.2236 9.01995 13.5 8.00033 13.5C6.9807 13.5 6.08022 13.2236 5.44925 12.8029C4.81478 12.3799 4.50033 11.8505 4.50033 11.3333Z" fill="#858585" />
                    <path d="M12.8453 9.22621C12.9044 8.95648 13.171 8.78577 13.4408 8.84492C14.082 8.98554 14.6599 9.23955 15.0889 9.5906C15.5175 9.94134 15.8337 10.4235 15.8337 11C15.8337 11.5765 15.5175 12.0586 15.0889 12.4094C14.6599 12.7604 14.082 13.0144 13.4408 13.155C13.171 13.2142 12.9044 13.0435 12.8453 12.7737C12.7861 12.504 12.9568 12.2374 13.2266 12.1783C13.7548 12.0624 14.177 11.8634 14.4556 11.6354C14.7346 11.4071 14.8337 11.1842 14.8337 11C14.8337 10.8158 14.7346 10.5928 14.4556 10.3645C14.177 10.1365 13.7548 9.93755 13.2266 9.82171C12.9568 9.76256 12.7861 9.49594 12.8453 9.22621Z" fill="#858585" />
                    <path d="M2.55989 8.84492C2.82962 8.78577 3.09624 8.95648 3.15539 9.22621C3.21454 9.49594 3.04383 9.76256 2.77409 9.82171C2.24585 9.93755 1.82369 10.1365 1.54507 10.3645C1.26608 10.5928 1.16699 10.8158 1.16699 11C1.16699 11.1842 1.26608 11.4071 1.54507 11.6354C1.82369 11.8634 2.24585 12.0624 2.77409 12.1783C3.04383 12.2374 3.21454 12.504 3.15539 12.7737C3.09624 13.0435 2.82962 13.2142 2.55989 13.155C1.91863 13.0144 1.34079 12.7604 0.911787 12.4094C0.483158 12.0586 0.166992 11.5765 0.166992 11C0.166992 10.4235 0.483158 9.94134 0.911787 9.5906C1.34079 9.23955 1.91863 8.98554 2.55989 8.84492Z" fill="#858585" />
                  </svg>

                </span>
                <span>مدیریت کاربران</span>
                <svg className={`submenu-arrow ${userManagementOpen ? 'open' : ''}`} width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M2.95363 5.98434C3.13334 5.77467 3.44899 5.75039 3.65866 5.9301L7.99993 9.65119L12.3412 5.9301C12.5509 5.75039 12.8665 5.77467 13.0462 5.98434C13.2259 6.194 13.2017 6.50965 12.992 6.68936L8.32532 10.6894C8.13808 10.8499 7.86178 10.8499 7.67453 10.6894L3.00787 6.68936C2.7982 6.50965 2.77392 6.194 2.95363 5.98434Z" fill="#858585" />
                </svg>
              </div> */}

              {/* {userManagementOpen && (
                <div className="submenu-items">
                  <div className="submenu-item">
                    <div className="submenu-branch"></div>
                    <span>مدیریت نقش ها</span>
                  </div>
                  <div className="submenu-item">
                    <div className="submenu-branch"></div>
                    <span>دسترسی نقش ها به کاربران</span>
                  </div>
                </div>
              )} */}
            </div>

            <div
              className={`menu-item-m ${activeMenu === 'facmanage' ? 'active' : ''}`}
              onClick={() => {
                togglefacManagement();
                handleMenuClick;
              }}
            >
              <span className="menu-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M8.03259 0.833375H7.96676C7.52353 0.833351 7.1416 0.833331 6.83578 0.874448C6.50802 0.918514 6.19385 1.01789 5.93901 1.27272C5.68418 1.52755 5.58481 1.84172 5.54074 2.16948C5.49963 2.47531 5.49965 2.85722 5.49967 3.30046L5.49967 4.91873C5.34329 4.86346 5.17499 4.83338 4.99967 4.83338H2.99967C2.17125 4.83338 1.49967 5.50495 1.49967 6.33338V14.1667H1.33301C1.05687 14.1667 0.833008 14.3906 0.833008 14.6667C0.833008 14.9429 1.05687 15.1667 1.33301 15.1667H14.6663C14.9425 15.1667 15.1663 14.9429 15.1663 14.6667C15.1663 14.3906 14.9425 14.1667 14.6663 14.1667H14.4997V9.66671C14.4997 8.83828 13.8281 8.16671 12.9997 8.16671H10.9997C10.8244 8.16671 10.6561 8.19679 10.4997 8.25206L10.4997 3.30047C10.4997 2.85722 10.4997 2.47531 10.4586 2.16948C10.4145 1.84172 10.3152 1.52755 10.0603 1.27272C9.8055 1.01789 9.49133 0.918514 9.16357 0.874448C8.85775 0.833331 8.47582 0.833351 8.03259 0.833375ZM13.4997 14.1667V9.66671C13.4997 9.39057 13.2758 9.16671 12.9997 9.16671H10.9997C10.7235 9.16671 10.4997 9.39057 10.4997 9.66671V14.1667H13.4997ZM9.49967 14.1667V3.33338C9.49967 2.84784 9.49861 2.53398 9.46752 2.30273C9.43836 2.08586 9.39129 2.01789 9.35323 1.97982C9.31517 1.94176 9.24719 1.89469 9.03032 1.86553C8.79907 1.83444 8.48521 1.83338 7.99967 1.83338C7.51413 1.83338 7.20028 1.83444 6.96903 1.86553C6.75216 1.89469 6.68418 1.94176 6.64612 1.97982C6.60806 2.01789 6.56099 2.08586 6.53183 2.30273C6.50074 2.53398 6.49967 2.84784 6.49967 3.33338V14.1667H9.49967ZM5.49967 14.1667V6.33338C5.49967 6.05724 5.27582 5.83338 4.99967 5.83338H2.99967C2.72353 5.83338 2.49967 6.05724 2.49967 6.33338V14.1667H5.49967Z" fill="#858585" />
                </svg>


              </span>
              <span>مدیریت امکانات</span>
              <svg className={`submenu-arrow ${facManagementOpen ? 'open' : ''}`} width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M2.95363 5.98434C3.13334 5.77467 3.44899 5.75039 3.65866 5.9301L7.99993 9.65119L12.3412 5.9301C12.5509 5.75039 12.8665 5.77467 13.0462 5.98434C13.2259 6.194 13.2017 6.50965 12.992 6.68936L8.32532 10.6894C8.13808 10.8499 7.86178 10.8499 7.67453 10.6894L3.00787 6.68936C2.7982 6.50965 2.77392 6.194 2.95363 5.98434Z" fill="#858585" />
              </svg>
            </div>
            {facManagementOpen && (
              <div className="submenu-items">
                <div
                  className={`submenu-item ${currentReportView === 'مدیریت دسته بندی‌ها' ? 'active' : ''}`}
                  onClick={() => handleSubmenuClick('مدیریت دسته بندی‌ها')}
                >
                  <div className="submenu-branch"></div>
                  <span>مدیریت دسته بندی‌ها</span>
                </div>
                <div
                  className={`submenu-item ${currentReportView === 'مدیریت صفحات' ? 'active' : ''}`}
                  onClick={() => handleSubmenuClick('مدیریت صفحات')}
                >
                  <div className="submenu-branch"></div>
                  <span>مدیریت صفحات</span>
                </div>
                <div
                  className={`submenu-item ${currentReportView === 'مدیریت اطلاعات فرهنگی' ? 'active' : ''}`}
                  onClick={() => handleSubmenuClick('مدیریت اطلاعات فرهنگی')}
                >
                  <div className="submenu-branch"></div>
                  <span>مدیریت اطلاعات فرهنگی</span>
                </div>
                <div
                  className={`submenu-item ${currentReportView === 'مدیریت ادمین‌ها' ? 'active' : ''}`}
                  onClick={() => handleSubmenuClick('مدیریت ادمین‌ها')}
                >
                  <div className="submenu-branch"></div>
                  <span>مدیریت ادمین‌ها</span>
                </div>
              </div>
            )}

          </div>

          <div className="sidebar-footer">

            <span className="menu-title3"> حساب کاربری  </span>

            {/* <div className="menu-item" onClick={handleSettingsClick}>
              <span className="menu-icon">
                <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.99245 10.7857C7.45342 10.7857 6.20435 9.53661 6.20435 7.99758C6.20435 6.45854 7.45342 5.20947 8.99245 5.20947C10.5315 5.20947 11.7806 6.45854 11.7806 7.99758C11.7806 9.53661 10.5315 10.7857 8.99245 10.7857ZM8.99245 6.32471C8.07052 6.32471 7.31959 7.07564 7.31959 7.99758C7.31959 8.91951 8.07052 9.67044 8.99245 9.67044C9.91438 9.67044 10.6653 8.91951 10.6653 7.99758C10.6653 7.07564 9.91438 6.32471 8.99245 6.32471Z" fill="#858585" stroke="#858585" strokeWidth="0.2" />
                  <path d="M11.3792 15.5739C11.223 15.5739 11.0669 15.5516 10.9108 15.5144C10.4498 15.388 10.0632 15.098 9.81784 14.6891L9.72862 14.5404C9.28996 13.782 8.68773 13.782 8.24907 14.5404L8.16729 14.6817C7.92193 15.098 7.53532 15.3954 7.07435 15.5144C6.60595 15.6408 6.12268 15.5739 5.71375 15.3285L4.43494 14.5925C4.21024 14.4637 4.01313 14.2919 3.85487 14.0869C3.69662 13.8819 3.58033 13.6478 3.51266 13.3978C3.44499 13.1478 3.42726 12.8869 3.46049 12.6301C3.49372 12.3733 3.57725 12.1255 3.70632 11.901C3.92193 11.5218 3.98141 11.1798 3.85502 10.9642C3.72862 10.7486 3.40892 10.6222 2.97026 10.6222C1.88476 10.6222 1 9.73743 1 8.65193V7.34338C1 6.25788 1.88476 5.37312 2.97026 5.37312C3.40892 5.37312 3.72862 5.24673 3.85502 5.03112C3.98141 4.8155 3.92937 4.47349 3.70632 4.09431C3.4461 3.64078 3.37918 3.10546 3.51301 2.59989C3.64684 2.08688 3.97398 1.66309 4.43494 1.40286L5.72119 0.666803C6.56134 0.168662 7.66914 0.458625 8.17472 1.31364L8.26394 1.46234C8.7026 2.22071 9.30483 2.22071 9.74349 1.46234L9.82528 1.32108C10.3309 0.458625 11.4387 0.168662 12.2862 0.674238L13.5651 1.4103C13.7898 1.53905 13.9869 1.71083 14.1451 1.91582C14.3034 2.12081 14.4197 2.35499 14.4873 2.60497C14.555 2.85494 14.5727 3.11581 14.5395 3.37264C14.5063 3.62947 14.4227 3.87723 14.2937 4.10175C14.0781 4.48093 14.0186 4.82294 14.145 5.03855C14.2714 5.25416 14.5911 5.38056 15.0297 5.38056C16.1152 5.38056 17 6.26532 17 7.35082V8.65937C17 9.74487 16.1152 10.6296 15.0297 10.6296C14.5911 10.6296 14.2714 10.756 14.145 10.9716C14.0186 11.1872 14.0706 11.5293 14.2937 11.9084C14.5539 12.362 14.6283 12.8973 14.487 13.4029C14.4224 13.6544 14.3073 13.8902 14.1488 14.096C13.9904 14.3017 13.7918 14.4732 13.5651 14.5999L12.2788 15.3359C11.9963 15.4921 11.6914 15.5739 11.3792 15.5739ZM8.99256 12.8229C9.65427 12.8229 10.2714 13.2393 10.6952 13.9754L10.777 14.1166C10.8662 14.2727 11.0149 14.3843 11.1933 14.4289C11.3717 14.4735 11.5502 14.4512 11.6989 14.362L12.9851 13.6185C13.1814 13.5052 13.3251 13.3191 13.385 13.1006C13.4448 12.882 13.416 12.6486 13.3048 12.4512C12.881 11.7226 12.829 10.9716 13.1561 10.3991C13.4833 9.82665 14.1599 9.49952 15.0074 9.49952C15.4833 9.49952 15.8625 9.12033 15.8625 8.6445V7.33595C15.8625 6.86755 15.4833 6.48093 15.0074 6.48093C14.1599 6.48093 13.4833 6.15379 13.1561 5.5813C12.829 5.00881 12.881 4.25788 13.3048 3.52926C13.4164 3.33595 13.4461 3.10546 13.3866 2.88242C13.3271 2.65937 13.1859 2.48093 12.9926 2.36197L11.7063 1.62591C11.6287 1.58041 11.5429 1.55066 11.4538 1.53837C11.3647 1.52608 11.274 1.53148 11.187 1.55427C11.1 1.57706 11.0183 1.61679 10.9467 1.67118C10.8751 1.72558 10.8148 1.79357 10.7695 1.87126L10.6877 2.01253C10.2639 2.74859 9.64684 3.16494 8.98513 3.16494C8.32342 3.16494 7.70632 2.74859 7.28253 2.01253L7.20074 1.86383C7.10835 1.71188 6.9603 1.602 6.78811 1.55756C6.61592 1.51313 6.43319 1.53765 6.27881 1.62591L4.99256 2.36941C4.79627 2.48264 4.65258 2.66875 4.59271 2.88732C4.53285 3.10588 4.56165 3.33924 4.67286 3.53669C5.09665 4.26532 5.1487 5.01625 4.82156 5.58874C4.49442 6.16123 3.81784 6.48836 2.97026 6.48836C2.49442 6.48836 2.11524 6.86755 2.11524 7.34338V8.65193C2.11524 9.12033 2.49442 9.50695 2.97026 9.50695C3.81784 9.50695 4.49442 9.83409 4.82156 10.4066C5.1487 10.9791 5.09665 11.73 4.67286 12.4586C4.56134 12.6519 4.5316 12.8824 4.59108 13.1055C4.65056 13.3285 4.79182 13.507 4.98513 13.6259L6.27138 14.362C6.42751 14.4586 6.61338 14.4809 6.78439 14.4363C6.96282 14.3917 7.11152 14.2727 7.20818 14.1166L7.28996 13.9754C7.71375 13.2467 8.33085 12.8229 8.99256 12.8229Z" fill="#858585" stroke="#858585" strokeWidth="0.2" />
                </svg>
              </span>
              <span>تنظیمات</span>
            </div> */}
            <div className="menu-item" onClick={handleChangePasswordClick}>
              <span className="menu-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_167_1041)">
                    <path fillRule="evenodd" clipRule="evenodd" d="M6.16634 10.6667C6.16634 9.65419 6.98715 8.83337 7.99968 8.83337C9.0122 8.83337 9.83301 9.65419 9.83301 10.6667C9.83301 11.6792 9.0122 12.5 7.99968 12.5C6.98715 12.5 6.16634 11.6792 6.16634 10.6667ZM7.99968 9.83337C7.53944 9.83337 7.16634 10.2065 7.16634 10.6667C7.16634 11.1269 7.53944 11.5 7.99968 11.5C8.45991 11.5 8.83301 11.1269 8.83301 10.6667C8.83301 10.2065 8.45991 9.83337 7.99968 9.83337Z" fill="#858585" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.49968 6.20189V5.33337C3.49968 2.84809 5.51439 0.833374 7.99968 0.833374C10.485 0.833374 12.4997 2.84809 12.4997 5.33337V6.20189C12.6509 6.21252 12.7934 6.22636 12.9275 6.24439C13.5276 6.32507 14.0328 6.49766 14.4341 6.89894C14.8354 7.30022 15.008 7.80547 15.0887 8.40554C15.1664 8.98352 15.1664 9.7184 15.1663 10.6301V10.7033C15.1664 11.615 15.1664 12.3499 15.0887 12.9279C15.008 13.5279 14.8354 14.0332 14.4341 14.4345C14.0328 14.8358 13.5276 15.0083 12.9275 15.089C12.3495 15.1667 11.6147 15.1667 10.7029 15.1667H5.29643C4.3847 15.1667 3.64982 15.1667 3.07184 15.089C2.47177 15.0083 1.96652 14.8358 1.56524 14.4345C1.16396 14.0332 0.991368 13.5279 0.910691 12.9279C0.832984 12.3499 0.832995 11.615 0.833008 10.7033V10.6301C0.832995 9.7184 0.832984 8.98352 0.910691 8.40554C0.991368 7.80547 1.16396 7.30022 1.56524 6.89894C1.96652 6.49766 2.47177 6.32507 3.07184 6.24439C3.20593 6.22636 3.34845 6.21252 3.49968 6.20189ZM4.49968 5.33337C4.49968 3.40038 6.06668 1.83337 7.99968 1.83337C9.93267 1.83337 11.4997 3.40038 11.4997 5.33337V6.169C11.2507 6.1667 10.9853 6.1667 10.7029 6.16671H5.29643C5.01408 6.1667 4.74869 6.1667 4.49968 6.169V5.33337ZM3.20509 7.23547C2.71591 7.30124 2.45686 7.42154 2.27235 7.60605C2.08784 7.79056 1.96754 8.0496 1.90177 8.53879C1.83407 9.04235 1.83301 9.70976 1.83301 10.6667C1.83301 11.6237 1.83407 12.2911 1.90177 12.7946C1.96754 13.2838 2.08784 13.5429 2.27235 13.7274C2.45686 13.9119 2.71591 14.0322 3.20509 14.0979C3.70866 14.1656 4.37606 14.1667 5.33301 14.1667H10.6663C11.6233 14.1667 12.2907 14.1656 12.7943 14.0979C13.2834 14.0322 13.5425 13.9119 13.727 13.7274C13.9115 13.5429 14.0318 13.2838 14.0976 12.7946C14.1653 12.2911 14.1663 11.6237 14.1663 10.6667C14.1663 9.70976 14.1653 9.04235 14.0976 8.53879C14.0318 8.0496 13.9115 7.79056 13.727 7.60605C13.5425 7.42154 13.2834 7.30124 12.7943 7.23547C12.2907 7.16777 11.6233 7.16671 10.6663 7.16671H5.33301C4.37606 7.16671 3.70866 7.16777 3.20509 7.23547Z" fill="#858585" />
                  </g>
                  <defs>
                    <clipPath id="clip0_167_1041">
                      <rect width="16" height="16" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
              </span>
              <span>تغییر رمز عبور</span>
            </div>
            {/* <div className="menu-item" onClick={handleSupportClick}>
              <span className="menu-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.14513 2.06143C3.96259 1.2008 5.31473 1.36205 5.99046 2.31777L6.83112 3.50676C7.37161 4.2712 7.32595 5.33398 6.6809 6.0131L6.51767 6.18496C6.51721 6.18614 6.51673 6.18743 6.51624 6.18882C6.50761 6.21306 6.4858 6.29025 6.50727 6.43675C6.55176 6.74044 6.7862 7.35757 7.73797 8.3596C8.69274 9.36479 9.27185 9.6017 9.54021 9.64528C9.65599 9.66408 9.71654 9.64775 9.73585 9.64095L10.0083 9.35414C10.5908 8.74086 11.499 8.62004 12.2313 9.04155L13.505 9.77466C14.5936 10.4013 14.847 11.934 13.977 12.85L13.03 13.847C12.7344 14.1582 12.3314 14.4238 11.8333 14.473C10.6174 14.593 7.80066 14.4367 4.84774 11.3278C2.09229 8.42685 1.56884 5.90358 1.50267 4.67077L1.94674 4.64693L1.50267 4.67077C1.46998 4.06166 1.7415 3.53919 2.09873 3.16309L3.14513 2.06143ZM5.17393 2.89508C4.83237 2.41198 4.21874 2.38316 3.87019 2.75012L2.82379 3.85178C2.60286 4.08438 2.48694 4.35097 2.50123 4.61717C2.55526 5.62372 2.98871 7.91857 5.5728 10.6391C8.28225 13.4917 10.7784 13.5723 11.7351 13.4778C11.9243 13.4592 12.1189 13.3542 12.3049 13.1583L13.2519 12.1613C13.6605 11.7312 13.5534 10.9563 13.0061 10.6413L11.7325 9.90823C11.3907 9.7115 10.9903 9.77229 10.7333 10.0428L10.4297 10.3625L10.0782 10.0287C10.4297 10.3625 10.4292 10.363 10.4288 10.3635L10.4278 10.3645L10.4258 10.3665L10.4216 10.3708L10.4121 10.3802C10.4052 10.3869 10.3973 10.3942 10.3883 10.4021C10.3704 10.4178 10.3482 10.4357 10.3216 10.4546C10.2682 10.4925 10.197 10.5341 10.1071 10.5696C9.92307 10.6422 9.68009 10.6811 9.37991 10.6323C8.7949 10.5373 8.02815 10.1171 7.01291 9.04829C5.99468 7.97628 5.60497 7.17647 5.51783 6.58172C5.47348 6.27901 5.50897 6.03661 5.57411 5.85357C5.60614 5.76355 5.64396 5.69178 5.67884 5.63727C5.69623 5.61009 5.71281 5.58733 5.72747 5.56881C5.73479 5.55955 5.74164 5.55135 5.74788 5.54418L5.75676 5.53419L5.76083 5.52977L5.76277 5.5277L5.76371 5.5267C5.76417 5.52621 5.76463 5.52573 6.11907 5.86238L5.76463 5.52572L5.95584 5.32441C6.25287 5.0117 6.29602 4.48211 6.01459 4.08407L5.17393 2.89508Z" fill="#858585" />
                  <path d="M8.83933 1.25338C8.88346 0.98079 9.14116 0.795874 9.41375 0.840006C9.43062 0.843236 9.48491 0.853383 9.51336 0.859718C9.57024 0.872386 9.6496 0.891892 9.74853 0.920709C9.94639 0.978338 10.2228 1.07327 10.5545 1.22536C11.2187 1.52987 12.1026 2.06254 13.0198 2.97974C13.937 3.89694 14.4697 4.78081 14.7742 5.445C14.9263 5.77674 15.0212 6.05314 15.0788 6.251C15.1076 6.34993 15.1271 6.42929 15.1398 6.48617C15.1461 6.51462 15.1508 6.53746 15.154 6.55433L15.1578 6.57513C15.202 6.84772 15.0187 7.11607 14.7461 7.1602C14.4743 7.2042 14.2183 7.02018 14.1731 6.74887C14.1717 6.74158 14.1678 6.72201 14.1637 6.70355C14.1555 6.66663 14.1413 6.60808 14.1187 6.53065C14.0736 6.37575 13.9952 6.14553 13.8651 5.86175C13.6053 5.29488 13.1379 4.51209 12.3127 3.68684C11.4874 2.8616 10.7047 2.39427 10.1378 2.13439C9.854 2.00428 9.62378 1.92593 9.46888 1.88081C9.39145 1.85826 9.29412 1.83592 9.2572 1.82769C8.98588 1.78248 8.79533 1.5252 8.83933 1.25338Z" fill="#858585" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M8.99105 3.55308C9.06691 3.28756 9.34365 3.13381 9.60917 3.20967L9.47181 3.69044C9.60917 3.20967 9.6094 3.20974 9.60964 3.20981L9.61013 3.20995L9.61115 3.21024L9.61337 3.21089L9.61854 3.21244L9.63173 3.21655C9.64178 3.21976 9.65434 3.22395 9.6693 3.22926C9.69925 3.23988 9.73882 3.25499 9.78736 3.27579C9.88448 3.31742 10.0172 3.3817 10.1802 3.47817C10.5065 3.67129 10.952 3.99208 11.4753 4.51539C11.9986 5.03871 12.3194 5.48417 12.5125 5.81048C12.609 5.97348 12.6733 6.10619 12.7149 6.20332C12.7357 6.25185 12.7508 6.29143 12.7614 6.32137C12.7667 6.33633 12.7709 6.34889 12.7741 6.35894L12.7782 6.37213L12.7798 6.3773L12.7804 6.37952L12.7807 6.38054L12.7809 6.38103C12.7809 6.38127 12.781 6.3815 12.3002 6.51886L12.781 6.3815C12.8569 6.64702 12.7031 6.92376 12.4376 6.99963C12.1743 7.07484 11.9 6.92434 11.8214 6.66296L11.819 6.65578C11.8154 6.64576 11.8081 6.62604 11.7957 6.59724C11.7711 6.53968 11.7263 6.44552 11.6519 6.3198C11.5033 6.06864 11.2348 5.68914 10.7682 5.2225C10.3015 4.75587 9.92204 4.4874 9.67087 4.33875C9.54515 4.26434 9.45099 4.21961 9.39344 4.19494C9.36463 4.1826 9.34491 4.17524 9.33489 4.17169L9.32771 4.16922C9.06634 4.09064 8.91583 3.81634 8.99105 3.55308Z" fill="#858585" />
                </svg>
              </span>
              <span>پشتیبانی</span>
            </div> */}
            <div className="menu-item">
              <span className="menu-icon9">
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.84615 1.44869C8.84615 1.11945 8.57925 0.852539 8.25 0.852539C7.92075 0.852539 7.65385 1.11945 7.65385 1.44869V4.62818C7.65385 4.95743 7.92075 5.22433 8.25 5.22433C8.57925 5.22433 8.84615 4.95743 8.84615 4.62818V1.44869Z" fill="#EA4335" />
                  <path d="M5.69997 3.35383C6.00326 3.22568 6.14524 2.87594 6.0171 2.57266C5.88896 2.26937 5.53922 2.12738 5.23593 2.25552C2.45405 3.43088 0.5 6.18526 0.5 9.39741C0.5 13.6776 3.96979 17.1474 8.25 17.1474C12.5302 17.1474 16 13.6776 16 9.39741C16 6.18526 14.0459 3.43088 11.2641 2.25552C10.9608 2.12738 10.611 2.26937 10.4829 2.57266C10.3548 2.87594 10.4967 3.22568 10.8 3.35383C13.1561 4.34928 14.8077 6.68116 14.8077 9.39741C14.8077 13.0191 11.8717 15.9551 8.25 15.9551C4.62829 15.9551 1.69231 13.0191 1.69231 9.39741C1.69231 6.68116 3.34389 4.34928 5.69997 3.35383Z" fill="#EA4335" />
                  <path d="M8.84615 1.44869C8.84615 1.11945 8.57925 0.852539 8.25 0.852539C7.92075 0.852539 7.65385 1.11945 7.65385 1.44869V4.62818C7.65385 4.95743 7.92075 5.22433 8.25 5.22433C8.57925 5.22433 8.84615 4.95743 8.84615 4.62818V1.44869Z" stroke="#EA4335" strokeWidth="0.2" strokeLinecap="round" />
                  <path d="M5.69997 3.35383C6.00326 3.22568 6.14524 2.87594 6.0171 2.57266C5.88896 2.26937 5.53922 2.12738 5.23593 2.25552C2.45405 3.43088 0.5 6.18526 0.5 9.39741C0.5 13.6776 3.96979 17.1474 8.25 17.1474C12.5302 17.1474 16 13.6776 16 9.39741C16 6.18526 14.0459 3.43088 11.2641 2.25552C10.9608 2.12738 10.611 2.26937 10.4829 2.57266C10.3548 2.87594 10.4967 3.22568 10.8 3.35383C13.1561 4.34928 14.8077 6.68116 14.8077 9.39741C14.8077 13.0191 11.8717 15.9551 8.25 15.9551C4.62829 15.9551 1.69231 13.0191 1.69231 9.39741C1.69231 6.68116 3.34389 4.34928 5.69997 3.35383Z" stroke="#EA4335" strokeWidth="0.2" strokeLinecap="round" />
                </svg>

              </span>
              <span
                className="menu-item-exit"
                onClick={handleLogout}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleLogout();
                  }
                }}
              >
                خروج از حساب
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`admin-content ${isMapFullscreen ? 'fullscreen-map-content' : ''}`} ref={contentRef}>
          {/* Content Header */}
          <div className="content-header">
            <div className="breadcrumb-nav">
              {breadcrumbPath.map((item, index) => (
                <span key={index} className="breadcrumb-item">
                  {item}
                  {index < breadcrumbPath.length - 1 && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 12L6 8L10 4" stroke="#858585" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              ))}
            </div>
            <div className="header-content-wrapper">
              <div>
                <h1>{getPageTitle().title}</h1>
                <p>{getPageTitle().description}</p>
              </div>
              <div className="calendar-section">
                <div className="date-display">
                  {formatJalaliDate(selectedDate)}
                </div>
                <button className="calendar-btn"
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                >
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="20" fill="#F2F2F2" />
                    <path d="M17.1433 12.6388C17.2606 12.639 17.361 12.7402 17.361 12.8575V15.0001C17.361 15.1175 17.2606 15.2177 17.1433 15.2179C17.0258 15.2179 16.9246 15.1176 16.9245 15.0001V12.8575C16.9245 12.74 17.0257 12.6388 17.1433 12.6388Z" fill="#1E2023" stroke="#1E2023" strokeWidth="0.634921" />
                    <path d="M22.8576 12.6388C22.9749 12.639 23.0753 12.7402 23.0753 12.8575V15.0001C23.0753 15.1175 22.9749 15.2177 22.8576 15.2179C22.7401 15.2179 22.6389 15.1176 22.6388 15.0001V12.8575C22.6388 12.74 22.74 12.6388 22.8576 12.6388Z" fill="#1E2023" stroke="#1E2023" strokeWidth="0.634921" />
                    <path d="M17.5 21.7857C17.4071 21.7857 17.3143 21.7643 17.2286 21.7286C17.1357 21.6929 17.0643 21.6429 16.9929 21.5786C16.8643 21.4429 16.7857 21.2643 16.7857 21.0714C16.7857 20.9786 16.8071 20.8857 16.8429 20.8C16.8786 20.7143 16.9286 20.6357 16.9929 20.5643C17.0643 20.5 17.1357 20.45 17.2286 20.4143C17.4857 20.3071 17.8071 20.3643 18.0071 20.5643C18.1357 20.7 18.2143 20.8857 18.2143 21.0714C18.2143 21.1143 18.2071 21.1643 18.2 21.2143C18.1929 21.2572 18.1786 21.3 18.1571 21.3429C18.1429 21.3857 18.1214 21.4286 18.0929 21.4714C18.0714 21.5072 18.0357 21.5429 18.0071 21.5786C17.8714 21.7071 17.6857 21.7857 17.5 21.7857Z" fill="#1E2023" />
                    <path d="M20 21.7857C19.9071 21.7857 19.8143 21.7643 19.7286 21.7286C19.6357 21.6928 19.5643 21.6428 19.4929 21.5785C19.3643 21.4428 19.2857 21.2643 19.2857 21.0714C19.2857 20.9786 19.3071 20.8857 19.3429 20.8C19.3786 20.7143 19.4286 20.6357 19.4929 20.5643C19.5643 20.5 19.6357 20.45 19.7286 20.4143C19.9857 20.3 20.3071 20.3643 20.5071 20.5643C20.6357 20.7 20.7143 20.8857 20.7143 21.0714C20.7143 21.1143 20.7071 21.1643 20.7 21.2143C20.6929 21.2571 20.6786 21.3 20.6571 21.3428C20.6429 21.3857 20.6214 21.4285 20.5929 21.4714C20.5714 21.5071 20.5357 21.5428 20.5071 21.5785C20.3714 21.7071 20.1857 21.7857 20 21.7857Z" fill="#1E2023" />
                    <path d="M22.5 21.7857C22.4071 21.7857 22.3143 21.7643 22.2286 21.7286C22.1357 21.6928 22.0643 21.6428 21.9929 21.5785C21.9643 21.5428 21.9357 21.5071 21.9071 21.4714C21.8786 21.4285 21.8571 21.3857 21.8429 21.3428C21.8214 21.3 21.8071 21.2571 21.8 21.2143C21.7929 21.1643 21.7857 21.1143 21.7857 21.0714C21.7857 20.8857 21.8643 20.7 21.9929 20.5643C22.0643 20.5 22.1357 20.45 22.2286 20.4143C22.4929 20.3 22.8071 20.3643 23.0071 20.5643C23.1357 20.7 23.2143 20.8857 23.2143 21.0714C23.2143 21.1143 23.2071 21.1643 23.2 21.2143C23.1929 21.2571 23.1786 21.3 23.1571 21.3428C23.1429 21.3857 23.1214 21.4285 23.0929 21.4714C23.0714 21.5071 23.0357 21.5428 23.0071 21.5785C22.8714 21.7071 22.6857 21.7857 22.5 21.7857Z" fill="#1E2023" />
                    <path d="M17.5 24.2857C17.4071 24.2857 17.3143 24.2643 17.2286 24.2286C17.1429 24.1928 17.0643 24.1428 16.9929 24.0785C16.8643 23.4428 16.7857 23.7571 16.7857 23.5714C16.7857 23.4786 16.8071 23.3857 16.8429 23.3C16.8786 23.2071 16.9286 23.1286 16.9929 23.0643C17.2571 22.8 17.7429 22.8 18.0071 23.0643C18.1357 23.2 18.2143 23.3857 18.2143 23.5714C18.2143 23.7571 18.1357 23.9428 18.0071 24.0785C17.8714 24.2071 17.6857 24.2857 17.5 24.2857Z" fill="#1E2023" />
                    <path d="M20 24.2857C19.8143 24.2857 19.6286 24.2071 19.4929 24.0785C19.3643 23.9428 19.2857 23.7571 19.2857 23.5714C19.2857 23.4786 19.3071 23.3857 19.3429 23.3C19.3786 23.2071 19.4286 23.1286 19.4929 23.0643C19.7571 22.8 20.2429 22.8 20.5071 23.0643C20.5714 23.1286 20.6214 23.2071 20.6571 23.3C20.6929 23.3857 20.7143 23.4786 20.7143 23.5714C20.7143 23.7571 20.6357 23.9428 20.5071 24.0785C20.3714 24.2071 20.1857 24.2857 20 24.2857Z" fill="#1E2023" />
                    <path d="M22.5 24.2857C22.3143 24.2857 22.1286 24.2072 21.9929 24.0786C21.9286 24.0143 21.8786 23.9357 21.8429 23.8429C21.8071 23.7572 21.7857 23.6643 21.7857 23.5715C21.7857 23.4786 21.8071 23.3857 21.8429 23.3C21.8786 23.2072 21.9286 23.1286 21.9929 23.0643C22.1571 22.9 22.4071 22.8215 22.6357 22.8715C22.6857 22.8786 22.7286 22.8929 22.7714 22.9143C22.8143 22.9286 22.8571 22.95 22.9 22.9786C22.9357 23 22.9714 23.0357 23.0071 23.0643C23.1357 23.2 23.2143 23.3857 23.2143 23.5715C23.2143 23.7572 23.1357 23.9429 23.0071 24.0786C22.8714 24.2072 22.6857 24.2857 22.5 24.2857Z" fill="#1E2023" />
                    <path d="M26.0714 18.4571H13.9286C13.6357 18.4571 13.3929 18.2143 13.3929 17.9214C13.3929 17.6285 13.6357 17.3857 13.9286 17.3857H26.0714C26.3643 17.3857 26.6071 17.6285 26.6071 17.9214C26.6071 18.2143 26.3643 18.4571 26.0714 18.4571Z" fill="#1E2023" />
                    <path d="M22.8571 27.6786H17.1429C14.5357 27.6786 13.0357 26.1786 13.0357 23.5714V17.5C13.0357 14.8929 14.5357 13.3929 17.1429 13.3929H22.8571C25.4643 13.3929 26.9643 14.8929 26.9643 17.5V23.5714C26.9643 26.1786 25.4643 27.6786 22.8571 27.6786ZM17.1429 14.4643C15.1 14.4643 14.1071 15.4571 14.1071 17.5V23.5714C14.1071 25.6143 15.1 26.6071 17.1429 26.6071H22.8571C24.9 26.6071 25.8929 25.6143 25.8929 23.5714V17.5C25.8929 15.4571 24.9 14.4643 22.8571 14.4643H17.1429Z" fill="#1E2023" />
                  </svg>
                </button>

                {isCalendarOpen && (
                  <div className="calendar-popup2" ref={calendarRef}>
                    <ReactDatePicker
                      selected={selectedDate}
                      onChange={(date) => {
                        setSelectedDate(date);
                        setIsCalendarOpen(false);
                      }}
                      inline
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      renderCustomHeader={({
                        date,
                        decreaseMonth,
                        increaseMonth,
                        prevMonthButtonDisabled,
                        nextMonthButtonDisabled,
                      }) => (
                        <div className="custom-header">
                          <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled}>
                            ‹
                          </button>
                          <span>
                            {date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' })}
                          </span>
                          <button onClick={increaseMonth} disabled={nextMonthButtonDisabled}>
                            ›
                          </button>
                        </div>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>




          {currentReportView === 'مدیریت صفحات' ? (
            <PagesManage />
          ) : isEditingCultural && editingCulturalData ? (
            /* Edit Cultural Information Page */
            <div className="edit-cultural-page">

              {/* Edit Form Container */}
              <div className="edit-form-container">


                {/* Left Side - Form Fields */}
                <div className="edit-right-section">
                  {/* Title and Details */}
                  <div className="edit-form-section">
                    <h3 className="edit-form-title">عنوان و جزئیات</h3>

                    <div className="edit-form-group">
                      <label className="edit-form-label">عنوان</label>
                      <div className="title-input-with-language-edit">
                        <input
                          type="text"
                          className="edit-form-input"
                          placeholder="عنوان اطلاعات فرهنگی را بنویسید"
                          value={culturalTitle}
                          onChange={(e) => setCulturalTitle(e.target.value)}
                        />
                        <button
                          className="language-input-btn-edit1"
                          type="button"
                          onClick={() => openTitleLanguageModal('culturalTitle')}
                          title="ورود عنوان به زبان‌های دیگر"
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* 
                    <div className="edit-form-group">
                      <label className="edit-form-label">شناسه POI</label>
                      <input
                        type="number"
                        className="edit-form-input"
                        placeholder="شناسه POI را وارد کنید"
                        value={culturalPoiId}
                        onChange={(e) => setCulturalPoiId(e.target.value)}
                      />
                    </div> */}

                    <div className="edit-form-group">
                      <label className="edit-form-label">توضیحات</label>
                      <div className="description-input-with-language">
                        <textarea
                          className="form-textarea"
                          placeholder="درباره این مکان اطلاعات فرهنگی بنویسید"
                          value={culturalDescription}
                          onChange={(e) => setCulturalDescription(e.target.value)}
                          rows="3"
                        />
                        <button
                          className="language-input-btn15"
                          type="button"
                          onClick={() => setIsDescriptionLanguageModalOpen(true)}  // Only for description
                          title="ورود توضیحات به زبان‌های دیگر"
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Address and Location */}
                  <div className="edit-form-section">
                    <h3 className="edit-form-title">آدرس و موقعیت اطلاعات فرهنگی</h3>

                    <div className="edit-form-group">
                      <label className="edit-form-label">آدرس</label>
                      <div className="address-input-with-language-edit">
                        <textarea
                          className="edit-form-textarea"
                          placeholder="آدرس اطلاعات فرهنگی را بنویسید"
                          value={placeAddress}
                          onChange={(e) => setPlaceAddress(e.target.value)}
                          rows="2"
                        />
                        <button
                          className="language-input-btn-edit"
                          type="button"
                          onClick={() => openAddressLanguageModal('culturalAddress')}
                          title="ورود آدرس به زبان‌های دیگر"
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* map section is */}
                    <div className="edit-form-group">
                      <label className="edit-form-label">موقعیت جغرافیایی</label>
                      <div className="edit-map-container">
                        <div id="edit-cultural-map-container" className="edit-map-instance"></div>
                        {selectedLocation && (
                          <div className="selected-coordinates-edit">
                            <span>موقعیت انتخاب شده:</span>
                            <span className="coordinates-value-edit">
                              {selectedLocation.lat.toFixed(6)}°N, {selectedLocation.lng.toFixed(6)}°E
                            </span>
                          </div>
                        )}
                        <button
                          className="select-location-btn-edit"
                          onClick={() => {
                            // Reinitialize the map if it doesn't exist
                            if (isEditingCultural && editingCulturalData && !culturalMap) {
                              initializeEditMap();
                            } else {
                              // Focus on current location
                              culturalMap.flyTo({
                                center: [selectedLocation.lng, selectedLocation.lat],
                                zoom: 16
                              });
                            }
                          }}
                        >
                          {selectedLocation ? 'تغییر موقعیت روی نقشه' : 'انتخاب موقعیت روی نقشه'}
                        </button>
                      </div>
                    </div>
                  </div>


                  <div className="edit-form-section">
                    <h3 className="edit-form-title">محدودیت‌های اعمال شده</h3>

                    {/* Time-based Restrictions */}
                    <div className="edit-restrictions-section">
                      <div className="edit-restriction-header">
                        <span className="edit-restriction-title">محدودیت‌های اعمال شده بر این مکان بر اساس روز، ساعت و جنسیت</span>
                        <button
                          className="add-restriction-btn"
                          onClick={handleOpenRestrictionModal}
                        >
                          افزودن محدودیت
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                            <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                          </svg>
                        </button>
                      </div>

                      {culturalTimeRestrictions.length > 0 && (
                        <div className="edit-restrictions-display">
                          {culturalTimeRestrictions.map((restriction, index) => (
                            <div key={index} className="restriction-display-item">
                              <div className="restriction-info">
                                <span className="restriction-date">{restriction.date} ،</span>
                                <span className="restriction-gender">{restriction.gender.join('، ')} ،</span>
                                <span className="restriction-time">
                                  {restriction.timePairs.map((pair, idx) => (
                                    <span key={idx}>
                                      {pair.start} الی {pair.end}
                                      {idx < restriction.timePairs.length - 1 && '، '}
                                    </span>
                                  ))}
                                </span>
                              </div>
                              <button
                                className="remove-restriction-display-btn"
                                onClick={() => removeCulturalRestriction(index)}
                              >
                                <svg width="75" height="32" viewBox="0 0 75 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="0.5" y="0.5" width="74" height="31" rx="5.5" stroke="#EA4335" />
                                  <path fillRule="evenodd" clipRule="evenodd" d="M15.4099 13.1678C15.6855 13.1494 15.9237 13.3579 15.9421 13.6334L16.2487 18.2328C16.3086 19.1314 16.3513 19.7566 16.445 20.227C16.5359 20.6833 16.6628 20.9249 16.8451 21.0954C17.0274 21.2659 17.2768 21.3765 17.7381 21.4368C18.2137 21.499 18.8404 21.5 19.741 21.5H20.2565C21.1571 21.5 21.7838 21.499 22.2594 21.4368C22.7207 21.3765 22.9701 21.2659 23.1524 21.0954C23.3347 20.9249 23.4616 20.6833 23.5525 20.227C23.6462 19.7566 23.6889 19.1314 23.7488 18.2328L24.0554 13.6334C24.0738 13.3579 24.312 13.1494 24.5876 13.1678C24.8631 13.1862 25.0716 13.4244 25.0532 13.7L24.7442 18.3345C24.6872 19.1896 24.6412 19.8804 24.5332 20.4224C24.421 20.986 24.23 21.4567 23.8356 21.8256C23.4412 22.1946 22.9588 22.3538 22.3891 22.4284C21.8411 22.5001 21.1488 22.5 20.2917 22.5H19.7058C18.8488 22.5 18.1565 22.5001 17.6084 22.4284C17.0387 22.3538 16.5563 22.1946 16.1619 21.8256C15.7675 21.4567 15.5766 20.986 15.4643 20.4224C15.3563 19.8804 15.3103 19.1896 15.2533 18.3344L14.9443 13.7C14.9259 13.4244 15.1344 13.1862 15.4099 13.1678Z" fill="#EA4335" />
                                  <path fillRule="evenodd" clipRule="evenodd" d="M18.9023 9.50003L18.8716 9.50001C18.7273 9.49992 18.6017 9.49984 18.483 9.51879C18.0141 9.59366 17.6084 9.8861 17.3891 10.3072C17.3336 10.4138 17.2939 10.5331 17.2484 10.67L17.2387 10.6991L17.174 10.8932C17.1613 10.9312 17.1578 10.9417 17.1547 10.9502C17.038 11.2729 16.7353 11.4911 16.3922 11.4998C16.3832 11.5 16.3721 11.5 16.3321 11.5H14.332C14.0559 11.5 13.832 11.7239 13.832 12C13.832 12.2762 14.0559 12.5 14.332 12.5L16.3378 12.5L16.349 12.5H23.6486L23.6597 12.5L25.6654 12.5C25.9416 12.5 26.1654 12.2762 26.1654 12C26.1654 11.7239 25.9416 11.5 25.6654 11.5H23.6654C23.6254 11.5 23.6143 11.5 23.6053 11.4998C23.2622 11.4911 22.9595 11.2729 22.8428 10.9501C22.8397 10.9417 22.8361 10.931 22.8235 10.8932L22.7588 10.6991L22.7491 10.67C22.7036 10.5331 22.6639 10.4138 22.6084 10.3072C22.3891 9.8861 21.9834 9.59366 21.5145 9.51879C21.3958 9.49984 21.2702 9.49992 21.1259 9.50001L21.0952 9.50003H18.9023ZM18.0951 11.2903C18.0689 11.3627 18.0385 11.4327 18.0041 11.5H21.9934C21.959 11.4327 21.9286 11.3627 21.9024 11.2903L21.8766 11.2148L21.8101 11.0153C21.7493 10.8329 21.7354 10.7958 21.7215 10.7691C21.6484 10.6287 21.5131 10.5312 21.3568 10.5063C21.3272 10.5015 21.2875 10.5 21.0952 10.5H18.9023C18.7101 10.5 18.6704 10.5015 18.6407 10.5063C18.4844 10.5312 18.3491 10.6287 18.276 10.7691C18.2622 10.7958 18.2482 10.8329 18.1874 11.0153L18.1208 11.2149C18.1108 11.2449 18.103 11.2683 18.0951 11.2903Z" fill="#EA4335" />
                                  <path d="M38.7759 20C37.7026 20 36.8953 19.9907 36.3539 19.972C35.8219 19.944 35.4253 19.9067 35.1639 19.86C34.9119 19.8133 34.6646 19.734 34.4219 19.622C33.9926 19.4353 33.6659 19.1647 33.4419 18.81C33.2273 18.4553 33.1199 18.04 33.1199 17.564C33.1199 17.2747 33.1619 16.9713 33.2459 16.654L33.7639 14.68L34.7859 14.988L34.2679 17.004C34.2119 17.228 34.1839 17.424 34.1839 17.592C34.1839 17.816 34.2353 18.0073 34.3379 18.166C34.4499 18.3153 34.6179 18.4413 34.8419 18.544C35.0006 18.6187 35.1826 18.6747 35.3879 18.712C35.6026 18.7493 35.9713 18.7773 36.4939 18.796C37.0166 18.8147 37.8006 18.824 38.8459 18.824H41.6319C42.1826 18.824 42.5933 18.8007 42.8639 18.754C43.1346 18.7073 43.3213 18.628 43.4239 18.516C43.5266 18.3947 43.5779 18.2173 43.5779 17.984C43.5779 17.844 43.5733 17.732 43.5639 17.648C43.0226 17.732 42.4346 17.774 41.7999 17.774C41.1186 17.774 40.5726 17.578 40.1619 17.186C39.7606 16.7847 39.5599 16.2387 39.5599 15.548C39.5599 15.0627 39.6486 14.61 39.8259 14.19C40.0126 13.77 40.2833 13.434 40.6379 13.182C41.0019 12.9207 41.4359 12.79 41.9399 12.79C42.6119 12.79 43.1719 13.042 43.6199 13.546C44.0773 14.05 44.3433 14.722 44.4179 15.562L44.5719 17.48C44.5906 17.76 44.5999 17.9513 44.5999 18.054C44.5999 18.53 44.5113 18.908 44.3339 19.188C44.1659 19.468 43.8626 19.6733 43.4239 19.804C42.9946 19.9347 42.3879 20 41.6039 20H38.8459H38.7759ZM40.5399 15.408C40.5399 15.8 40.6519 16.1127 40.8759 16.346C41.0999 16.57 41.4079 16.682 41.7999 16.682C42.3786 16.682 42.9339 16.6353 43.4659 16.542L43.3959 15.66C43.3306 15.0907 43.1626 14.652 42.8919 14.344C42.6306 14.0267 42.2993 14.868 41.8979 13.868C41.4779 13.868 41.1466 14.022 40.9039 14.33C40.6613 14.6287 40.5399 14.988 40.5399 15.408ZM41.2959 10.088H42.7099V11.488H41.2959V10.088ZM48.5068 20C47.8161 20 47.2655 19.8647 46.8548 19.594C46.4535 19.314 46.2295 18.95 46.1828 18.502C46.1361 18.306 46.1128 17.998 46.1128 17.578H47.0928C47.0928 17.8673 47.1115 18.1007 47.1488 18.278C47.1861 18.474 47.2981 18.614 47.4848 18.698C47.6808 18.782 47.9655 18.824 48.3388 18.824H49.1928C50.1728 18.824 50.6628 18.53 50.6628 17.942C50.6628 17.8767 50.6441 17.76 50.6068 17.592V17.564L49.5568 13.448L50.5928 13.168L51.6428 17.298C51.7361 17.662 51.8201 17.9467 51.8948 18.152C51.9788 18.348 52.0908 18.5113 52.2308 18.642C52.3708 18.7633 52.5575 18.824 52.7908 18.824H53.4768L53.5468 19.412L53.4768 20H52.7908C52.1655 20 51.6615 19.7387 51.2788 19.216C50.8308 19.7387 50.0888 20 49.0528 20H48.5068ZM49.1788 10.704H50.5788V12.104H49.1788V10.704ZM53.3362 18.824H53.5323C54.3629 18.824 55.0583 18.8053 55.6183 18.768C56.1783 18.7213 56.7523 18.614 57.3403 18.446L60.6303 17.564L57.7883 15.94C57.5083 15.772 57.2189 15.688 56.9203 15.688C56.6309 15.688 56.3556 15.772 56.0943 15.94C55.8329 16.0987 55.6229 16.3227 55.4642 16.612L55.2123 17.046L54.2883 16.472L54.5543 15.996C54.8156 15.52 55.1516 15.1513 55.5623 14.89C55.9823 14.6287 56.4303 14.498 56.9062 14.498C57.3916 14.498 57.8583 14.6333 58.3063 14.904L61.8763 17.06L61.7083 18.432L57.6063 19.594C56.9529 19.7713 56.3229 19.8833 55.7163 19.93C55.1096 19.9767 54.3769 20 53.5183 20H53.3362V18.824Z" fill="#EA4335" />
                                </svg>

                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Prayer Time Restrictions */}
                    <div className="edit-restrictions-section">
                      <div className="edit-restriction-header">
                        <span className="edit-restriction-title">محدودیت‌های اعمال شده بر این مکان بر اساس اوقات شرعي</span>
                      </div>

                      {culturalPrayerTimeRestrictionsList.length > 0 && (
                        <div className="prayer-restrictions-list">
                          {culturalPrayerTimeRestrictionsList.map((item, idx) => (
                            <div key={item.id} className="prayer-restriction-row">
                              <div className="prayer-restriction-badge">
                                <span className="prayer-restriction-text">{item.date} ، {item.title}</span>
                              </div>
                              <button className="remove-prayer-btn" onClick={() => {
                                setCulturalPrayerTimeRestrictionsList(prev => prev.filter((_, i) => i !== idx));
                              }}>
                                حذف
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" clipRule="evenodd" d="M3.40994 5.1678C3.68547 5.14943 3.92372 5.3579 3.94209 5.63343L4.24872 10.2328C4.30862 11.1314 4.35131 11.7566 4.44502 12.227C4.53592 12.6833 4.66281 12.9249 4.84508 13.0954C5.02736 13.2659 5.2768 13.3765 5.73813 13.4368C6.21373 13.499 6.8404 13.5 7.74097 13.5H8.25654C9.1571 13.5 9.78377 13.499 10.2594 13.4368C10.7207 13.3765 10.9701 13.2659 11.1524 13.0954C11.3347 12.9249 11.4616 12.6833 11.5525 12.227C11.6462 11.7566 11.6889 11.1314 11.7488 10.2328L12.0554 5.63343C12.0738 5.3579 12.312 5.14943 12.5876 5.1678C12.8631 5.18617 13.0716 5.42442 13.0532 5.69995L12.7442 10.3345C12.6872 11.1896 12.6412 11.8804 12.5332 12.4224C12.421 12.986 12.23 13.4567 11.8356 13.8256C11.4412 14.1946 10.9588 14.3538 10.3891 14.4284C9.84105 14.5001 9.14876 14.5 8.2917 14.5H7.70581C6.84875 14.5 6.15646 14.5001 5.60843 14.4284C5.03866 14.3538 4.5563 14.1946 4.1619 13.8256C3.7675 13.4567 3.57656 12.986 3.46429 12.4224C3.35631 11.8804 3.31027 11.1896 3.25327 10.3344L2.94431 5.69995C2.92594 5.42442 3.13441 5.18617 3.40994 5.1678Z" fill="#EA4335" />
                                  <path fillRule="evenodd" clipRule="evenodd" d="M6.90226 1.50003L6.87161 1.50001C6.72734 1.49992 6.60166 1.49984 6.48298 1.51879C6.01412 1.59366 5.60838 1.8861 5.38909 2.30723C5.33358 2.41382 5.29391 2.53309 5.24838 2.66998L5.2387 2.69905L5.17397 2.89323C5.16131 2.93121 5.15778 2.94168 5.15471 2.95016C5.03797 3.2729 4.73529 3.49106 4.39219 3.49976C4.38317 3.49999 4.37212 3.50003 4.33209 3.50003H2.33203C2.05589 3.50003 1.83203 3.72388 1.83203 4.00003C1.83203 4.27617 2.05589 4.50003 2.33203 4.50003L4.3378 4.50003L4.34896 4.50003H11.6486L11.6597 4.50003L13.6654 4.50003C13.9416 4.50003 14.1654 4.27617 14.1654 4.00003C14.1654 3.72388 13.9416 3.50003 13.6654 3.50003H11.6654C11.6254 3.50003 11.6143 3.49999 11.6053 3.49976C11.2622 3.49106 10.9595 3.27289 10.8428 2.95014C10.8397 2.94172 10.8361 2.93102 10.8235 2.89323L10.7588 2.69905L10.7491 2.66996C10.7036 2.53307 10.6639 2.41382 10.6084 2.30723C10.3891 1.8861 9.98339 1.59366 9.51453 1.51879C9.39585 1.49984 9.27016 1.49992 9.1259 1.50001L9.09525 1.50003H6.90226ZM6.09508 3.29032C6.0689 3.36269 6.03847 3.43268 6.00413 3.50003H9.99338C9.95904 3.43268 9.92861 3.3627 9.90243 3.29033L9.87662 3.21477L9.81013 3.01528C9.74934 2.83294 9.73535 2.79575 9.72147 2.76909C9.64837 2.62872 9.51313 2.53124 9.35684 2.50628C9.32715 2.50154 9.28746 2.50003 9.09525 2.50003H6.90226C6.71005 2.50003 6.67035 2.50154 6.64067 2.50628C6.48438 2.53124 6.34914 2.62872 6.27604 2.76909C6.26216 2.79575 6.24816 2.83294 6.18738 3.01528L6.12085 3.21489C6.11083 3.24495 6.10303 3.26834 6.09508 3.29032Z" fill="#EA4335" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="edit-action-buttons">
                    <button
                      className="cancel-edit-btn"
                      onClick={handleCancelEditCultural}
                    >
                      انصراف
                    </button>
                    <button
                      className="save-edit-btn"
                      onClick={handleSaveEditCultural}
                    >
                      ثبت تغییرات
                    </button>
                  </div>
                </div>
                {/* Left Section */}
                <div className="edit-left-section">
                  {/* Profile Images and Videos Section */}
                  <div className="edit-media-section">
                    <div className="edit-section-header">
                      <span className="edit-section-title">تصاویر و ویدئوهای پروفایل اطلاعات فرهنگی</span>
                      <label className="add-file-btn12">
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          onChange={(e) => handleFileUploadWithModal(e, 'image')} // Changed
                          className="file-input-hidden"
                        />
                        افزودن فایل
                        <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.2824 0H18.8284C17.8063 0 17.0544 0.42296 16.7137 1.17489C16.5257 1.51561 16.4435 1.91507 16.4435 2.38502V5.8392C16.4435 7.33131 17.3363 8.22422 18.8284 8.22422H22.2824C22.7523 8.22422 23.1517 8.14198 23.4924 7.954C24.2443 7.61328 24.6672 6.86135 24.6672 5.8392V2.38502C24.6672 0.892916 23.7744 0 22.2824 0ZM23.3867 4.61731C23.2692 4.7348 23.093 4.81705 22.905 4.82879H21.2485V5.42799L21.2603 6.46189C21.2485 6.66162 21.178 6.82611 21.037 6.96709C20.9196 7.08458 20.7433 7.16682 20.5554 7.16682C20.1677 7.16682 19.8505 6.8496 19.8505 6.46189V4.81705L18.2057 4.82879C18.0177 4.82571 17.8384 4.74885 17.7065 4.61477C17.5747 4.4807 17.5008 4.30017 17.5008 4.11211C17.5008 3.7244 17.818 3.40718 18.2057 3.40718L19.2396 3.41893H19.8505V1.77408C19.8505 1.38637 20.1677 1.0574 20.5554 1.0574C20.9431 1.0574 21.2603 1.38637 21.2603 1.77408L21.2485 2.60825V3.40718H22.905C23.2927 3.40718 23.6099 3.7244 23.6099 4.11211C23.5979 4.3017 23.5188 4.48081 23.3867 4.61731ZM8.22089 11.0216C8.96245 11.0216 9.67365 10.727 10.198 10.2026C10.7224 9.67824 11.017 8.96701 11.017 8.2254C11.017 7.48379 10.7224 6.77256 10.198 6.24816C9.67365 5.72376 8.96245 5.42916 8.22089 5.42916C7.47932 5.42916 6.76812 5.72376 6.24376 6.24816C5.71939 6.77256 5.4248 7.48379 5.4248 8.2254C5.4248 8.96701 5.71939 9.67824 6.24376 10.2026C6.76812 10.727 7.47932 11.0216 8.22089 11.0216Z" fill="#0F71EF" />
                          <path d="M22.2864 8.2209H21.7342V13.6371L21.5815 13.5079C20.6652 12.7207 19.1849 12.7207 18.2685 13.5079L13.3812 17.7023C12.4649 18.4894 10.9846 18.4894 10.0682 17.7023L9.6688 17.3733C8.83467 16.6449 7.50712 16.5744 6.56727 17.2088L2.17342 20.1578C1.91496 19.4998 1.76224 18.7362 1.76224 17.8432V7.99767C1.76224 4.68449 3.51272 2.9339 6.82573 2.9339H16.4475V2.38171C16.4475 1.91175 16.5298 1.51229 16.7177 1.17157H6.82573C2.54937 1.17157 0 3.72108 0 7.99767V17.8432C0 19.1239 0.223216 20.24 0.657901 21.1799C1.66825 23.4122 3.82993 24.6693 6.82573 24.6693H16.6708C20.9471 24.6693 23.4965 22.1198 23.4965 17.8432V7.95068C23.1558 8.13866 22.7563 8.2209 22.2864 8.2209Z" fill="#0F71EF" />
                        </svg>
                      </label>
                    </div>

                    {/* Primary Image Display */}
                    {primaryImage && (
                      <div className="primary-image-section-edit">
                        <div className="primary-image-label">تصویر اصلی</div>
                        <div className="primary-image-container-edit">
                          {primaryImage.type.startsWith('image/') ? (
                            <img
                              src={primaryImage.url}
                              alt={primaryImage.name}
                              className="primary-image-edit"
                            />
                          ) : primaryImage.type.startsWith('video/') ? (
                            <video controls className="primary-image-edit">
                              <source src={primaryImage.url} type={primaryImage.type} />
                            </video>
                          ) : null}
                          <button
                            className="remove-file-btn-edit"
                            onClick={() => handleRemoveFile(primaryImage.id, 'image')}
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
                              className="icon icon-tabler icons-tabler-outline icon-tabler-x"
                            >
                              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                              <path d="M18 6l-12 12" />
                              <path d="M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Profile Images Grid */}
                    {profileImages.length > 0 && (
                      <div className="profile-images-grid-edit">
                        {profileImages.map((file) => (
                          <div
                            key={file.id}
                            className={`profile-image-item-edit ${file.id === primaryImage?.id ? 'primary' : ''}`}
                          >
                            {file.type.startsWith('image/') ? (
                              <div className="image-container-with-badge-edit">
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="media-preview-edit"
                                />
                                {file.orientation && (
                                  <div className="orientation-badge-edit">
                                    {file.orientation === 'north' && 'شمال'}
                                    {file.orientation === 'south' && 'جنوب'}
                                    {file.orientation === 'east' && 'شرق'}
                                    {file.orientation === 'west' && 'غرب'}
                                  </div>
                                )}
                              </div>
                            ) : file.type.startsWith('video/') ? (
                              <video controls className="media-preview-edit">
                                <source src={file.url} type={file.type} />
                              </video>
                            ) : null}

                            <div className="profile-image-actions-edit">
                              {file.type.startsWith('image/') && file.id !== primaryImage?.id && (
                                <button
                                  className="set-primary-btn-edit"
                                  onClick={() => handleSetPrimaryImage(file.id)}
                                >
                                  اصلی
                                </button>
                              )}
                              <button
                                className="remove-file-btn-small-edit"
                                onClick={() => handleRemoveFile(file.id, 'image')}
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
                                  className="icon icon-tabler icons-tabler-outline icon-tabler-x"
                                >
                                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                  <path d="M18 6l-12 12" />
                                  <path d="M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Text and Audio Files Section */}
                  <div className="edit-files-section">
                    {/* Audio Files */}
                    <div className="edit-file-subsection">
                      <div className="edit-section-header">
                        <span className="edit-section-title">فایل‌های صوتی</span>
                        <label className="add-file-btn-small">
                          <input
                            type="file"
                            accept="audio/*"
                            multiple
                            onChange={(e) => handleFileUploadWithModal(e, 'audio')} // Changed
                            className="file-input-hidden"
                          />
                          افزودن فایل صوتی
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                            <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                          </svg>
                        </label>
                      </div>

                      {audioFiles.length > 0 && (
                        <div className="audio-files-list-edit">
                          {audioFiles.map((audio) => (
                            <div key={audio.id} className="audio-file-item-edit">
                              <div className="audio-file-info-edit">
                                <div className="audio-icon-edit">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#0F71EF" />
                                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C9.79086 2 8 3.79086 8 6V12C8 14.2091 9.79086 16 12 16C14.2091 16 16 14.2091 16 12V6C16 3.79086 14.2091 2 12 2ZM14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z" fill="#0F71EF" />
                                    <path fillRule="evenodd" clipRule="evenodd" d="M19 10C19.5523 10 20 10.4477 20 11V12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12V11C4 10.4477 4.44772 10 5 10C5.55228 10 6 10.4477 6 11V12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12V11C18 10.4477 18.4477 10 19 10Z" fill="#0F71EF" />
                                  </svg>
                                </div>
                                <span className="audio-file-name-edit">{audio.name}</span>
                              </div>
                              <button
                                className="remove-audio-btn-edit"
                                onClick={() => handleRemoveFile(audio.id, 'audio')}
                              >
                                حذف
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Text Files */}
                    <div className="edit-file-subsection">
                      <div className="edit-section-header">
                        <span className="edit-section-title">فایل‌های متنی</span>
                        <label className="add-file-btn-small">
                          <input
                            type="file"
                            accept=".pdf,.txt,.doc,.docx,.xls,.xlsx"
                            multiple
                            onChange={(e) => handleFileUploadWithModal(e, 'text')} // Changed
                            className="file-input-hidden"
                          />
                          افزودن فایل متنی
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                            <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                          </svg>
                        </label>
                      </div>

                      {textFiles.length > 0 && (
                        <div className="text-files-list-edit">
                          {textFiles.map((textFile) => (
                            <div key={textFile.id} className="text-file-item-edit">
                              <div className="text-file-info-edit">
                                <div className="pdf-icon-edit">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6 2C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2H6Z" fill="#EA4335" />
                                    <path d="M14 2V8H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M9 12H15M9 16H15M7 8H8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </div>
                                <span className="text-file-name-edit">{textFile.name}</span>
                              </div>
                              <button
                                className="remove-text-btn-edit"
                                onClick={() => handleRemoveFile(textFile.id, 'text')}
                              >
                                حذف
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Display Settings Section */}
                  <div className="edit-display-section">
                    <div className="edit-section-header">
                      <span className="edit-section-title">نمایش و عدم نمایش اطلاعات به کاربر</span>
                    </div>

                    <div className="display-options-edit">
                      {/* دیدگاه‌های کاربران */}
                      <div className="display-option-edit">
                        <span className="option-label-edit">دیدگاه‌های کاربران</span>
                        <div className="display-toggle-edit">
                          <div
                            className={`toggle-option2-edit ${showUserFeedbacks ? 'selected' : ''}`}
                            onClick={() => setShowUserFeedbacks(true)}
                          >
                            نمایش
                          </div>
                          <div
                            className={`toggle-option-edit ${!showUserFeedbacks ? 'selected' : ''}`}
                            onClick={() => setShowUserFeedbacks(false)}
                          >
                            عدم نمایش
                          </div>
                        </div>
                      </div>

                      {/* چند رسانه‌ای‌ها */}
                      <div className="display-option-edit">
                        <span className="option-label-edit">چند رسانه‌ای‌ها</span>
                        <div className="display-toggle-edit">
                          <div
                            className={`toggle-option2-edit ${showMediaGallery ? 'selected' : ''}`}
                            onClick={() => setShowMediaGallery(true)}
                          >
                            نمایش
                          </div>
                          <div
                            className={`toggle-option-edit ${!showMediaGallery ? 'selected' : ''}`}
                            onClick={() => setShowMediaGallery(false)}
                          >
                            عدم نمایش
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Cultural Type Selection */}
                  <div className="edit-form-section">
                    <h3 className="edit-form-title">نوع این مکان</h3>
                    <div className="cultural-type-grid-edit">
                      {PLACE_TYPE_OPTIONS.map((typeOption) => {
                        const isSelected = selectedCulturalTypes.includes(typeOption.label);
                        return (
                          <div
                            key={typeOption.value}
                            className={`cultural-type-option-edit ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleCulturalTypeToggle(typeOption.label)}
                          >
                            <div className="cultural-type-checkbox-edit">
                              {isSelected ? (
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" fill="#0F71EF" stroke="#0F71EF" />
                                  <path fillRule="evenodd" clipRule="evenodd" d="M14.0303 6.96967C14.3232 7.26256 14.3232 7.73744 14.0303 8.03033L9.03033 13.0303C8.73744 13.3232 8.26256 13.3232 7.96967 13.0303L5.96967 11.0303C5.67678 10.7374 5.67678 10.2626 5.96967 9.96967C6.26256 9.67678 6.73744 9.67678 7.03033 9.96967L8.5 11.4393L12.9697 6.96967C13.2626 6.67678 13.7374 6.67678 14.0303 6.96967Z" fill="white" />
                                </svg>
                              ) : (
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" stroke="#D9D9D9" />
                                </svg>
                              )}
                            </div>
                            <span>{typeOption.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    {culturalTypeError && (
                      <div className="error-message-edit">لطفا حداقل یک نوع مکان را انتخاب کنید</div>
                    )}
                  </div>

                  <div className="edit-form-section">
                    <h3 className="edit-form-title">تعیین گروه این مکان فرهنگی</h3>
                    <div className="dropdown-group-cultural-edit">
                      <div className="dropdown-field-cultural-edit">
                        <select
                          className="form-input-cultural-edit"
                          value={culturalPlaceCategory}
                          onChange={(e) => {
                            setCulturalPlaceCategory(e.target.value);
                            setCulturalPlaceSubcategory('');
                          }}
                          disabled={isLoadingCulturalGroups}
                        >
                          <option value="" disabled>گروه اصلی فرهنگی</option>
                          {culturalGroupOptions.map((group) => (
                            <option key={`cultural-edit-group-${group.value}`} value={group.value}>
                              {group.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="dropdown-field-cultural-edit">
                        <select
                          className="form-input-cultural-edit"
                          value={culturalPlaceSubcategory}
                          onChange={(e) => setCulturalPlaceSubcategory(e.target.value)}
                          disabled={!culturalPlaceCategory || isLoadingCulturalSubGroups}
                        >
                          <option value="" disabled>زیرگروه فرهنگی</option>
                          {culturalSubGroupOptions.map((subGroup, index) => (
                            <option key={`cultural-edit-subgroup-${subGroup.value}-${index}`} value={subGroup.value}>
                              {subGroup.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : currentReportView === 'مدیریت اطلاعات فرهنگی' ? (
            /* Cultural Information Management Section */
            <div className="cultural-management-section">
              {/* Header with buttons */}
              <div className="cultural-header-section9">
                <button
                  className="export-cultural-btn"
                  onClick={() => exportCulturalItems({ language: 'fa', search: culturalSearchTerm })}
                >
                  گرفتن خروجی
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.69247 7.09327C3.91711 6.83119 4.31167 6.80084 4.57375 7.02548L10.0003 11.6768L15.4269 7.02548C15.689 6.80084 16.0836 6.83119 16.3082 7.09327C16.5328 7.35535 16.5025 7.74991 16.2404 7.97455L10.4071 12.9745C10.173 13.1752 9.82765 13.1752 9.59359 12.9745L3.76026 7.97455C3.49818 7.74991 3.46783 7.35535 3.69247 7.09327Z" fill="#1E2023" />
                  </svg>
                </button>
                <button className="new-cultural-btn" onClick={openAddCulturalModal}>
                  ایجاد اطلاعات فرهنگی
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.0001 18.3334C14.6025 18.3334 18.3334 14.6024 18.3334 10C18.3334 5.39765 14.6025 1.66669 10.0001 1.66669C5.39771 1.66669 1.66675 5.39765 1.66675 10C1.66675 14.6024 5.39771 18.3334 10.0001 18.3334ZM10.6251 7.50002C10.6251 7.15484 10.3453 6.87502 10.0001 6.87502C9.6549 6.87502 9.37508 7.15484 9.37508 7.50002L9.37508 9.37504H7.50008C7.1549 9.37504 6.87508 9.65486 6.87508 10C6.87508 10.3452 7.1549 10.625 7.50008 10.625H9.37508V12.5C9.37508 12.8452 9.6549 13.125 10.0001 13.125C10.3453 13.125 10.6251 12.8452 10.6251 12.5L10.6251 10.625H12.5001C12.8453 10.625 13.1251 10.3452 13.1251 10C13.1251 9.65486 12.8453 9.37504 12.5001 9.37504H10.6251V7.50002Z" fill="white" />
                  </svg>
                </button>

              </div>

              {/* Table Section Header */}
              <div className="cultural-table-header9">
                <div className="cultural-table-title">
                  <h3> اطلاعات فرهنگی ایجاد شده در اپلیکیشن </h3>
                  <button className="refresh-btn">
                    <svg width="18" height="18" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.047 5.99994C11.047 8.73518 8.8271 10.9551 6.09186 10.9551C3.35662 10.9551 1.68674 8.20002 1.68674 8.20002M1.68674 8.20002H3.92646M1.68674 8.20002V10.6776M1.13672 5.99994C1.13672 3.2647 3.3368 1.0448 6.09186 1.0448C9.39694 1.0448 11.047 3.79986 11.047 3.79986M11.047 3.79986V1.32229M11.047 3.79986H8.84692" stroke="#1E2023" strokeWidth="1.08112" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div className="cultural-header-right">
                  <div className="category-search-box">
                    <svg className="search-icon7" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
                    </svg>
                    <input
                      type="text"
                      placeholder="جستجوی موارد ... "
                      value={culturalSearchTerm}
                      onChange={(e) => setCulturalSearchTerm(e.target.value)}
                      className="cultural-search-input"
                    />
                  </div>
                </div>
              </div>

              {/* Cultural Data Table */}
              <div className="cultural-table-container">
                <table className="cultural-table">
                  <thead>
                    <tr>
                      <th>عنوان</th>
                      <th>آدرس در حرم</th>
                      <th>تاریخ ایجاد</th>
                      <th>توضیحات</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCulturalData.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div className="cultural-title-cell">
                            <div className="cultural-avatar">
                              {item.primaryImage ? (
                                <img
                                  src={item.primaryImage}
                                  alt={item.title}
                                  className="cultural-avatar-img"
                                />
                              ) : (
                                <div className="cultural-avatar-placeholder">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 7V5H5V7H19ZM19 11V9H5V11H19ZM19 15V13H5V15H19ZM19 19V17H5V19H19Z" fill="#858585" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="cultural-title-text">
                              <strong>{item.title}</strong>
                              {item.culturalTypes && item.culturalTypes.length > 0 && (
                                <div className="cultural-types">
                                  {item.culturalTypes.slice(0, 2).map((type, index) => (
                                    <span key={index} className="cultural-type">{type}</span>
                                  ))}
                                  {item.culturalTypes.length > 2 && (
                                    <span className="cultural-type-more">+{item.culturalTypes.length - 2}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{item.addressInShrine || '-'}</td>
                        <td>{item.createdAt || '-'}</td>
                        <td className="cultural-description-cell">
                          {item.description ? (
                            <div className="truncated-description">
                              {item.description.split(/\s+/).slice(0, 4).join(' ')}
                              {item.description.split(/\s+/).length > 7 && '...'}
                            </div>
                          ) : (
                            <span className="no-description">بدون توضیح</span>
                          )}
                        </td>
                        <td>
                          <div className="cultural-actions">
                            <button
                              className="edit-cultural-btn"
                              title="ویرایش"
                              onClick={() => handleEditCultural(item.id)}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g clipPath="url(#clip0_367_7217)">
                                  <path fillRule="evenodd" clipRule="evenodd" d="M7.96167 0.833374L8.99992 0.833374C9.27606 0.833374 9.49992 1.05723 9.49992 1.33337C9.49992 1.60952 9.27606 1.83337 8.99992 1.83337H7.99992C6.41444 1.83337 5.27562 1.83444 4.40897 1.95095C3.5567 2.06554 3.04289 2.28347 2.66312 2.66324C2.28335 3.04301 2.06542 3.55682 1.95083 4.40909C1.83431 5.27574 1.83325 6.41456 1.83325 8.00004C1.83325 9.58552 1.83431 10.7243 1.95083 11.591C2.06542 12.4433 2.28335 12.9571 2.66312 13.3368C3.04289 13.7166 3.5567 13.9345 4.40897 14.0491C5.27562 14.1656 6.41444 14.1667 7.99992 14.1667C9.5854 14.1667 10.7242 14.1656 11.5909 14.0491C12.4431 13.9345 12.957 13.7166 13.3367 13.3368C13.7165 12.9571 13.9344 12.4433 14.049 11.591C14.1655 10.7243 14.1666 9.58552 14.1666 8.00004V7.00004C14.1666 6.7239 14.3904 6.50004 14.6666 6.50004C14.9427 6.50004 15.1666 6.7239 15.1666 7.00004V8.03829C15.1666 9.57722 15.1666 10.7832 15.0401 11.7242C14.9106 12.6874 14.6404 13.4474 14.0438 14.044C13.4473 14.6405 12.6873 14.9107 11.7241 15.0402C10.7831 15.1667 9.5771 15.1667 8.03817 15.1667H7.96167C6.42274 15.1667 5.21671 15.1667 4.27572 15.0402C3.31257 14.9107 2.55255 14.6405 1.95601 14.044C1.35947 13.4474 1.08924 12.6874 0.95975 11.7242C0.833237 10.7832 0.833244 9.57722 0.833252 8.03829V7.96179C0.833244 6.42286 0.833237 5.21684 0.95975 4.27584C1.08924 3.31269 1.35947 2.55267 1.95601 1.95613C2.55255 1.35959 3.31257 1.08936 4.27572 0.959872C5.21671 0.833359 6.42274 0.833366 7.96167 0.833374ZM11.1803 1.51732C12.0922 0.605393 13.5707 0.605393 14.4826 1.51732C15.3946 2.42924 15.3946 3.90776 14.4826 4.81969L10.0506 9.25176C9.80306 9.49931 9.648 9.65438 9.47497 9.78934C9.27118 9.9483 9.05067 10.0846 8.81735 10.1958C8.61926 10.2902 8.41122 10.3595 8.07911 10.4702L6.14276 11.1156C5.78526 11.2348 5.39112 11.1418 5.12466 10.8753C4.8582 10.6088 4.76515 10.2147 4.88432 9.8572L5.52976 7.92086C5.64044 7.58874 5.70978 7.3807 5.80418 7.18261C5.91538 6.94929 6.05166 6.72878 6.21062 6.52499C6.34558 6.35195 6.50065 6.1969 6.74822 5.94937L11.1803 1.51732ZM13.7755 2.22442C13.2541 1.70302 12.4088 1.70302 11.8874 2.22442L11.6363 2.4755C11.6514 2.53941 11.6726 2.61555 11.7021 2.70048C11.7976 2.97586 11.9784 3.33852 12.3199 3.68004C12.6614 4.02156 13.0241 4.20235 13.2995 4.29789C13.3844 4.32735 13.4605 4.34853 13.5245 4.36366L13.7755 4.11258C14.2969 3.59118 14.2969 2.74582 13.7755 2.22442ZM12.7367 5.15143C12.3927 5.0035 11.992 4.76635 11.6128 4.38714C11.2336 4.00794 10.9965 3.60726 10.8485 3.26328L7.47826 6.63355C7.20058 6.91122 7.09168 7.02134 6.99913 7.14001C6.88484 7.28653 6.78685 7.44508 6.70691 7.61283C6.64216 7.74868 6.59237 7.89533 6.46819 8.26787L6.18026 9.13166L6.8683 9.8197L7.73209 9.53177C8.10463 9.40759 8.25128 9.35779 8.38713 9.29305C8.55488 9.21311 8.71342 9.11512 8.85995 9.00083C8.97862 8.90828 9.08874 8.79938 9.36641 8.5217L12.7367 5.15143Z" fill="#1E2023" />
                                </g>
                                <defs>
                                  <clipPath id="clip0_367_7217">
                                    <rect width="16" height="16" fill="white" />
                                  </clipPath>
                                </defs>
                              </svg>
                            </button>
                            <button
                              className="delete-cultural-btn"
                              onClick={() => handleDeleteCultural(item.id)}
                              title="حذف"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M3.41116 5.1678C3.68669 5.14943 3.92494 5.3579 3.94331 5.63343L4.24994 10.2328C4.30984 11.1314 4.35253 11.7566 4.44624 12.227C4.53714 12.6833 4.66403 12.9249 4.8463 13.0954C5.02858 13.2659 5.27802 13.3765 5.73935 13.4368C6.21496 13.499 6.84163 13.5 7.74219 13.5H8.25776C9.15832 13.5 9.78499 13.499 10.2606 13.4368C10.7219 13.3765 10.9714 13.2659 11.1536 13.0954C11.3359 12.9249 11.4628 12.6833 11.5537 12.227C11.6474 11.7566 11.6901 11.1314 11.75 10.2328L12.0566 5.63343C12.075 5.3579 12.3133 5.14943 12.5888 5.1678C12.8643 5.18617 13.0728 5.42442 13.0544 5.69995L12.7455 10.3345C12.6885 11.1896 12.6424 11.8804 12.5344 12.4224C12.4222 12.986 12.2312 13.4567 11.8368 13.8256C11.4424 14.1946 10.9601 14.3538 10.3903 14.4284C9.84227 14.5001 9.14998 14.5 8.29292 14.5H7.70703C6.84997 14.5 6.15768 14.5001 5.60965 14.4284C5.03988 14.3538 4.55752 14.1946 4.16312 13.8256C3.76872 13.4567 3.57778 12.986 3.46551 12.4224C3.35753 11.8804 3.31149 11.1896 3.25449 10.3344L2.94553 5.69995C2.92716 5.42442 3.13563 5.18617 3.41116 5.1678Z" fill="#1E2023" />
                                <path fillRule="evenodd" clipRule="evenodd" d="M6.90348 1.50003L6.87283 1.50001C6.72857 1.49992 6.60288 1.49984 6.4842 1.51879C6.01534 1.59366 5.60961 1.8861 5.39031 2.30723C5.3348 2.41382 5.29513 2.53309 5.2496 2.66998L5.23992 2.69905L5.17519 2.89323C5.16253 2.93121 5.159 2.94168 5.15593 2.95016C5.03919 3.2729 4.73651 3.49106 4.39341 3.49976C4.38439 3.49999 4.37334 3.50003 4.33331 3.50003H2.33325C2.05711 3.50003 1.83325 3.72388 1.83325 4.00003C1.83325 4.27617 2.05711 4.50003 2.33325 4.50003L4.33902 4.50003L4.35018 4.50003H11.6498L11.6609 4.50003L13.6666 4.50003C13.9428 4.50003 14.1666 4.27617 14.1666 4.00003C14.1666 3.72388 13.9428 3.50003 13.6666 3.50003H11.6666C11.6266 3.50003 11.6156 3.49999 11.6065 3.49976C11.2634 3.49106 10.9608 3.27289 10.844 2.95014C10.841 2.94172 10.8374 2.93102 10.8248 2.89323L10.76 2.69905L10.7503 2.66996C10.7048 2.53307 10.6651 2.41382 10.6096 2.30723C10.3903 1.8861 9.98461 1.59366 9.51575 1.51879C9.39707 1.49984 9.27138 1.49992 9.12712 1.50001L9.09647 1.50003H6.90348ZM6.0963 3.29032C6.07012 3.36269 6.03969 3.43268 6.00535 3.50003H9.9946C9.96026 3.43268 9.92983 3.3627 9.90365 3.29033L9.87784 3.21477L9.81135 3.01528C9.75057 2.83294 9.73657 2.79575 9.72269 2.76909C9.64959 2.62872 9.51435 2.53124 9.35806 2.50628C9.32837 2.50154 9.28868 2.50003 9.09647 2.50003H6.90348C6.71127 2.50003 6.67157 2.50154 6.64189 2.50628C6.4856 2.53124 6.35036 2.62872 6.27726 2.76909C6.26338 2.79575 6.24938 2.83294 6.1886 3.01528L6.12207 3.21489C6.11205 3.24495 6.10425 3.26834 6.0963 3.29032Z" fill="#1E2023" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="pagination-container">
                <div className="pagination-controls">
                  <div className="btc">
                    <button
                      className={`pagination-btn ${culturalCurrentPage === 1 ? 'disabled' : ''}`}
                      onClick={() => handleCulturalPageChange(1)}
                      disabled={culturalCurrentPage === 1}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                        <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={culturalCurrentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                      </svg>
                    </button>

                    <button
                      className={`pagination-btn ${culturalCurrentPage === 1 ? 'disabled' : ''}`}
                      onClick={() => handleCulturalPageChange(culturalCurrentPage - 1)}
                      disabled={culturalCurrentPage === 1}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                        <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={culturalCurrentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                      </svg>
                    </button>
                  </div>

                  <div className="page-numbers">
                    {getCulturalPageNumbers().map(page => (
                      <button
                        key={page}
                        className={`page-number ${culturalCurrentPage === page ? 'active' : ''}`}
                        onClick={() => handleCulturalPageChange(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <div className="btc">
                    <button
                      className={`pagination-btn ${culturalCurrentPage === totalCulturalPages ? 'disabled' : ''}`}
                      onClick={() => handleCulturalPageChange(culturalCurrentPage + 1)}
                      disabled={culturalCurrentPage === totalCulturalPages}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={culturalCurrentPage === Math.ceil(filteredCulturalData.length / culturalItemsPerPage) ? "#C5C5C5" : "#0F71EF"} />
                      </svg>
                    </button>

                    <button
                      className={`pagination-btn ${culturalCurrentPage === totalCulturalPages ? 'disabled' : ''}`}
                      onClick={() => handleCulturalPageChange(totalCulturalPages)}
                      disabled={culturalCurrentPage === totalCulturalPages}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={culturalCurrentPage === Math.ceil(filteredCulturalData.length / culturalItemsPerPage) ? "#C5C5C5" : "#0F71EF"} />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : currentReportView === 'کاربران ثبت نام کرده' ? (
            <Usersigned />
          ) : currentReportView === 'لاگ های مسیریابی کاربران' ? (
            <Userlogs />
          ) : currentReportView === 'دیدگاه ها' ? (
            <Reviews />
          ) : currentReportView === 'بازخورد ها' ? (
            <Feedbacks />
          ) : currentReportView === 'مدیریت ادمین‌ها' ? (
            <Admins />
          ) : currentReportView === 'مدیریت دسته بندی‌ها' ? (
            /* Category Management Section */
            <div className="category-management-section">
              {/* Header with buttons */}
              <div className="category-header-section">
                <button className="new-category-btn" onClick={() => setIsCreateCategoryModalOpen(true)}>
                  ایجاد دسته بندی جدید
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.0003 18.3334C14.6027 18.3334 18.3337 14.6024 18.3337 10C18.3337 5.39765 14.6027 1.66669 10.0003 1.66669C5.39795 1.66669 1.66699 5.39765 1.66699 10C1.66699 14.6024 5.39795 18.3334 10.0003 18.3334ZM10.6253 7.50002C10.6253 7.15484 10.3455 6.87502 10.0003 6.87502C9.65515 6.87502 9.37533 7.15484 9.37533 7.50002L9.37532 9.37504H7.50033C7.15515 9.37504 6.87533 9.65486 6.87533 10C6.87533 10.3452 7.15515 10.625 7.50033 10.625H9.37532V12.5C9.37532 12.8452 9.65515 13.125 10.0003 13.125C10.3455 13.125 10.6253 12.8452 10.6253 12.5L10.6253 10.625H12.5003C12.8455 10.625 13.1253 10.3452 13.1253 10C13.1253 9.65486 12.8455 9.37504 12.5003 9.37504H10.6253V7.50002Z" fill="white" />
                  </svg>
                </button>

              </div>

              {/* Table Section Header */}
              <div className="category-table-header">
                <div className="category-table-title">
                  <h3>دسته بندی های ایجاد شده در اپلیکیشن</h3>
                  <button className="refresh-btn">
                    <svg width="18" height="18" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.047 5.99994C11.047 8.73518 8.8271 10.9551 6.09186 10.9551C3.35662 10.9551 1.68674 8.20002 1.68674 8.20002M1.68674 8.20002H3.92646M1.68674 8.20002V10.6776M1.13672 5.99994C1.13672 3.2647 3.3368 1.0448 6.09186 1.0448C9.39694 1.0448 11.047 3.79986 11.047 3.79986M11.047 3.79986V1.32229M11.047 3.79986H8.84692" stroke="#1E2023" strokeWidth="1.08112" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div className="category-header-right">
                  <div className="category-search-box">
                    <svg className="search-icon7" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
                    </svg>
                    <input
                      type="text"
                      placeholder="جستجوی دسته بندی ..."
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      className="category-search-input"
                    />
                  </div>
                </div>
              </div>

              {categoryError && (
                <div className="category-error-message">
                  {categoryError}
                </div>
              )}

              {/* Categories Table */}
              <div className="categories-table-container">
                <table className="categories-table">
                  <thead>
                    <tr>
                      <th>عنوان دسته بندی</th>
                      <th>توضیحات دسته بندی</th>
                      <th>تصویر دسته بندی</th>
                      <th>تاریخ ایجاد</th>
                      <th>تعداد زیر گروه</th>
                      <th>وضعیت</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories
                      .map(category => (
                        <React.Fragment key={category.id}>
                          <tr key={category.id}>
                            <td>
                              <div className="category-title-cell">
                                <div className="category-expand-btn" onClick={() => toggleCategoryExpand(category.id)}>
                                  {expandedCategories.includes(category.id) ? (
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" clipRule="evenodd" d="M7.99967 14.1666C4.59392 14.1666 1.83301 11.4057 1.83301 7.99996C1.83301 4.5942 4.59392 1.83329 7.99967 1.83329C11.4054 1.83329 14.1663 4.5942 14.1663 7.99996C14.1663 11.4057 11.4054 14.1666 7.99967 14.1666ZM0.833008 7.99996C0.833008 11.958 4.04163 15.1666 7.99967 15.1666C11.9577 15.1666 15.1663 11.958 15.1663 7.99996C15.1663 4.04192 11.9577 0.833294 7.99967 0.833294C4.04163 0.833294 0.833008 4.04192 0.833008 7.99996ZM5.64612 9.35351C5.84138 9.54878 6.15797 9.54878 6.35323 9.35351L7.99967 7.70707L9.64612 9.35351C9.84138 9.54878 10.158 9.54878 10.3532 9.35351C10.5485 9.15825 10.5485 8.84167 10.3532 8.64641L8.35323 6.64641C8.15797 6.45114 7.84138 6.45114 7.64612 6.64641L5.64612 8.64641C5.45086 8.84167 5.45086 9.15825 5.64612 9.35351Z" fill="#0F71EF" />
                                    </svg>
                                  ) : (
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" clipRule="evenodd" d="M7.99967 1.83337C4.59392 1.83337 1.83301 4.59428 1.83301 8.00004C1.83301 11.4058 4.59392 14.1667 7.99967 14.1667C11.4054 14.1667 14.1663 11.4058 14.1663 8.00004C14.1663 4.59428 11.4054 1.83337 7.99967 1.83337ZM0.833008 8.00004C0.833008 4.042 4.04163 0.833374 7.99967 0.833374C11.9577 0.833374 15.1663 4.042 15.1663 8.00004C15.1663 11.9581 11.9577 15.1667 7.99967 15.1667C4.04163 15.1667 0.833008 11.9581 0.833008 8.00004ZM5.64612 6.64649C5.84138 6.45122 6.15797 6.45122 6.35323 6.64649L7.99967 8.29293L9.64612 6.64649C9.84138 6.45122 10.158 6.45122 10.3532 6.64649C10.5485 6.84175 10.5485 7.15833 10.3532 7.35359L8.35323 9.35359C8.15797 9.54886 7.84138 9.54886 7.64612 9.35359L5.64612 7.35359C5.45086 7.15833 5.45086 6.84175 5.64612 6.64649Z" fill="#858585" />
                                    </svg>
                                  )}
                                </div>
                                <strong>{category.title}</strong>
                              </div>
                            </td>
                            <td>
                              <div className="truncated-description">
                                {category.description ? (
                                  <>
                                    {category.description.split(/\s+/).slice(0, 7).join(' ')}
                                    {category.description.split(/\s+/).length > 7 && '...'}
                                  </>
                                ) : (
                                  <span className="no-description">-</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="category-image-cell">
                                {resolveCategoryIcon(category) ? (
                                  <div className="category-icon-wrapper">
                                    <img
                                      src={buildIconUrl(resolveCategoryIcon(category))}
                                      alt={category.title}
                                      className="category-icon-image"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        // Show fallback if image fails to load
                                        const fallback = e.target.parentElement?.querySelector('.category-icon-fallback');
                                        if (fallback) fallback.style.display = 'flex';
                                      }}
                                    />
                                    <div className="category-icon-fallback" style={{ display: 'none' }}>
                                      <span>تصویر</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="category-image-placeholder">
                                    بدون تصویر
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>{category.createdAt}</td>
                            <td>
                              <div className="subcategory-count-cell">
                                {category.numSubcategories}
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge ${category.status === 'active' ? 'active' : 'inactive'}`}>
                                {category.status === 'active' ? '' : ''}
                                {category.status === 'active' ? (
                                  <span style={{ color: '#139B3C', fontSize: '12px' }}>فعال</span>
                                ) : (
                                  <span style={{ color: '#F44336', fontSize: '12px' }}>غیرفعال</span>
                                )}
                              </span>
                            </td>
                            <td>
                              <div className="category-actions">
                                <button className="edit-btn" onClick={() => handleEditCategory(category)}>
                                  ویرایش
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <g clipPath="url(#clip0_367_3812)">
                                      <path fillRule="evenodd" clipRule="evenodd" d="M7.96142 0.833374L8.99967 0.833374C9.27582 0.833374 9.49967 1.05723 9.49967 1.33337C9.49967 1.60952 9.27582 1.83337 8.99967 1.83337H7.99967C6.41419 1.83337 5.27538 1.83444 4.40873 1.95095C3.55646 2.06554 3.04264 2.28347 2.66287 2.66324C2.2831 3.04301 2.06517 3.55682 1.95059 4.40909C1.83407 5.27574 1.83301 6.41456 1.83301 8.00004C1.83301 9.58552 1.83407 10.7243 1.95059 11.591C2.06517 12.4433 2.2831 12.9571 2.66287 13.3368C3.04264 13.7166 3.55646 13.9345 4.40873 14.0491C5.27538 14.1656 6.41419 14.1667 7.99967 14.1667C9.58516 14.1667 10.724 14.1656 11.5906 14.0491C12.4429 13.9345 12.9567 13.7166 13.3365 13.3368C13.7162 12.9571 13.9342 12.4433 14.0488 11.591C14.1653 10.7243 14.1663 9.58552 14.1663 8.00004V7.00004C14.1663 6.7239 14.3902 6.50004 14.6663 6.50004C14.9425 6.50004 15.1663 6.7239 15.1663 7.00004V8.03829C15.1664 9.57722 15.1664 10.7832 15.0398 11.7242C14.9104 12.6874 14.6401 13.4474 14.0436 14.044C13.447 14.6405 12.687 14.9107 11.7239 15.0402C10.7829 15.1667 9.57685 15.1667 8.03792 15.1667H7.96143C6.4225 15.1667 5.21647 15.1667 4.27548 15.0402C3.31232 14.9107 2.55231 14.6405 1.95577 14.044C1.35923 13.4474 1.089 12.6874 0.959506 11.7242C0.832993 10.7832 0.832999 9.57722 0.833008 8.03829V7.96179C0.832999 6.42286 0.832993 5.21684 0.959506 4.27584C1.089 3.31269 1.35923 2.55267 1.95577 1.95613C2.55231 1.35959 3.31232 1.08936 4.27548 0.959872C5.21647 0.833359 6.42249 0.833366 7.96142 0.833374ZM11.18 1.51732C12.092 0.605393 13.5705 0.605393 14.4824 1.51732C15.3943 2.42924 15.3943 3.90776 14.4824 4.81969L10.0503 9.25176C9.80281 9.49931 9.64776 9.65438 9.47473 9.78934C9.27093 9.9483 9.05042 10.0846 8.81711 10.1958C8.61902 10.2902 8.41097 10.3595 8.07887 10.4702L6.14251 11.1156C5.78502 11.2348 5.39088 11.1418 5.12442 10.8753C4.85795 10.6088 4.76491 10.2147 4.88408 9.8572L5.52952 7.92086C5.6402 7.58874 5.70953 7.3807 5.80394 7.18261C5.91513 6.94929 6.05141 6.72878 6.21037 6.52499C6.34533 6.35195 6.50041 6.1969 6.74797 5.94937L11.18 1.51732ZM13.7753 2.22442C13.2539 1.70302 12.4085 1.70302 11.8871 2.22442L11.6361 2.4755C11.6512 2.53941 11.6724 2.61555 11.7018 2.70048C11.7974 2.97586 11.9782 3.33852 12.3197 3.68004C12.6612 4.02156 13.0239 4.20235 13.2992 4.29789C13.3842 4.32735 13.4603 4.34853 13.5242 4.36366L13.7753 4.11258C14.2967 3.59118 14.2967 2.74582 13.7753 2.22442ZM12.7364 5.15143C12.3925 5.0035 11.9918 4.76635 11.6126 4.38714C11.2334 4.00794 10.9962 3.60726 10.8483 3.26328L7.47801 6.63355C7.20034 6.91122 7.09144 7.02134 6.99888 7.14001C6.88459 7.28653 6.78661 7.44508 6.70666 7.61283C6.64192 7.74868 6.59212 7.89533 6.46794 8.26787L6.18001 9.13166L6.86805 9.8197L7.73184 9.53177C8.10439 9.40759 8.25104 9.35779 8.38689 9.29305C8.55464 9.21311 8.71318 9.11512 8.85971 9.00083C8.97837 8.90828 9.08849 8.79938 9.36617 8.5217L12.7364 5.15143Z" fill="#1E2023" />
                                    </g>
                                    <defs>
                                      <clipPath id="clip0_367_3812">
                                        <rect width="16" height="16" fill="white" />
                                      </clipPath>
                                    </defs>
                                  </svg>
                                </button>
                                <button className="delete-btn" onClick={() => handleDeleteCategory(category.id)}>
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M3.41092 5.1678C3.68645 5.14943 3.9247 5.3579 3.94307 5.63343L4.24969 10.2328C4.3096 11.1314 4.35228 11.7566 4.446 12.227C4.5369 12.6833 4.66379 12.9249 4.84606 13.0954C5.02834 13.2659 5.27777 13.3765 5.73911 13.4368C6.21471 13.499 6.84138 13.5 7.74194 13.5H8.25752C9.15808 13.5 9.78475 13.499 10.2604 13.4368C10.7217 13.3765 10.9711 13.2659 11.1534 13.0954C11.3357 12.9249 11.4626 12.6833 11.5535 12.227C11.6472 11.7566 11.6899 11.1314 11.7498 10.2328L12.0564 5.63343C12.0748 5.3579 12.313 5.14943 12.5885 5.1678C12.8641 5.18617 13.0725 5.42442 13.0542 5.69995L12.7452 10.3345C12.6882 11.1896 12.6422 11.8804 12.5342 12.4224C12.4219 12.986 12.231 13.4567 11.8366 13.8256C11.4422 14.1946 10.9598 14.3538 10.3901 14.4284C9.84203 14.5001 9.14973 14.5 8.29268 14.5H7.70679C6.84973 14.5 6.15743 14.5001 5.60941 14.4284C5.03964 14.3538 4.55727 14.1946 4.16288 13.8256C3.76848 13.4567 3.57753 12.986 3.46527 12.4224C3.35729 11.8804 3.31125 11.1896 3.25425 10.3344L2.94528 5.69995C2.92691 5.42442 3.13538 5.18617 3.41092 5.1678Z" fill="#1E2023" />
                                    <path fillRule="evenodd" clipRule="evenodd" d="M6.90324 1.50003L6.87258 1.50001C6.72832 1.49992 6.60264 1.49984 6.48396 1.51879C6.01509 1.59366 5.60936 1.8861 5.39006 2.30723C5.33456 2.41382 5.29489 2.53309 5.24935 2.66998L5.23967 2.69905L5.17495 2.89323C5.16229 2.93121 5.15876 2.94168 5.15569 2.95016C5.03894 3.2729 4.73626 3.49106 4.39316 3.49976C4.38414 3.49999 4.37309 3.50003 4.33306 3.50003H2.33301C2.05687 3.50003 1.83301 3.72388 1.83301 4.00003C1.83301 4.27617 2.05687 4.50003 2.33301 4.50003L4.33877 4.50003L4.34993 4.50003H11.6495L11.6607 4.50003L13.6664 4.50003C13.9425 4.50003 14.1664 4.27617 14.1664 4.00003C14.1664 3.72388 13.9425 3.50003 13.6664 3.50003H11.6664C11.6264 3.50003 11.6153 3.49999 11.6063 3.49976C11.2632 3.49106 10.9605 3.27289 10.8438 2.95014C10.8407 2.94172 10.8371 2.93102 10.8245 2.89323L10.7598 2.69905L10.7501 2.66996C10.7046 2.53307 10.6649 2.41382 10.6094 2.30723C10.3901 1.8861 9.98437 1.59366 9.5155 1.51879C9.39682 1.49984 9.27114 1.49992 9.12688 1.50001L9.09622 1.50003H6.90324ZM6.09606 3.29032C6.06988 3.36269 6.03945 3.43268 6.00511 3.50003H9.99435C9.96001 3.43268 9.92959 3.3627 9.90341 3.29033L9.8776 3.21477L9.8111 3.01528C9.75032 2.83294 9.73633 2.79575 9.72245 2.76909C9.64935 2.62872 9.5141 2.53124 9.35781 2.50628C9.32813 2.50154 9.28843 2.50003 9.09622 2.50003H6.90324C6.71103 2.50003 6.67133 2.50154 6.64165 2.50628C6.48536 2.53124 6.35011 2.62872 6.27701 2.76909C6.26313 2.79575 6.24914 2.83294 6.18836 3.01528L6.12182 3.21489C6.1118 3.24495 6.10401 3.26834 6.09606 3.29032Z" fill="#1E2023" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Subcategories rows when expanded */}
                          {expandedCategories.includes(category.id) && category.subcategories && category.subcategories.map(subcategory => (
                            <tr key={`sub-${subcategory.id}`} className="subcategory-row">
                              <td>
                                <div className="subcategory-title-cell">
                                  <div className="subcategory-branch"></div>
                                  <div className="category-icon-placeholder small"></div>
                                  <span>{subcategory.title}</span>
                                </div>
                              </td>
                              <td></td>
                              <td></td>
                              <td>{subcategory.createdAt}</td>
                              <td></td>
                              <td>
                              </td>
                              <td>
                                <div className="category-actions">
                                  <button className="edit-icon-btn" onClick={() => handleEditSubcategory(subcategory)}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      {/* Edit icon SVG - same as above but smaller */}
                                      <g clipPath="url(#clip0_367_3812)">
                                        <path fillRule="evenodd" clipRule="evenodd" d="M7.96142 0.833374L8.99967 0.833374C9.27582 0.833374 9.49967 1.05723 9.49967 1.33337C9.49967 1.60952 9.27582 1.83337 8.99967 1.83337H7.99967C6.41419 1.83337 5.27538 1.83444 4.40873 1.95095C3.55646 2.06554 3.04264 2.28347 2.66287 2.66324C2.2831 3.04301 2.06517 3.55682 1.95059 4.40909C1.83407 5.27574 1.83301 6.41456 1.83301 8.00004C1.83301 9.58552 1.83407 10.7243 1.95059 11.591C2.06517 12.4433 2.2831 12.9571 2.66287 13.3368C3.04264 13.7166 3.55646 13.9345 4.40873 14.0491C5.27538 14.1656 6.41419 14.1667 7.99967 14.1667C9.58516 14.1667 10.724 14.1656 11.5906 14.0491C12.4429 13.9345 12.9567 13.7166 13.3365 13.3368C13.7162 12.9571 13.9342 12.4433 14.0488 11.591C14.1653 10.7243 14.1663 9.58552 14.1663 8.00004V7.00004C14.1663 6.7239 14.3902 6.50004 14.6663 6.50004C14.9425 6.50004 15.1663 6.7239 15.1663 7.00004V8.03829C15.1664 9.57722 15.1664 10.7832 15.0398 11.7242C14.9104 12.6874 14.6401 13.4474 14.0436 14.044C13.447 14.6405 12.687 14.9107 11.7239 15.0402C10.7829 15.1667 9.57685 15.1667 8.03792 15.1667H7.96143C6.4225 15.1667 5.21647 15.1667 4.27548 15.0402C3.31232 14.9107 2.55231 14.6405 1.95577 14.044C1.35923 13.4474 1.089 12.6874 0.959506 11.7242C0.832993 10.7832 0.832999 9.57722 0.833008 8.03829V7.96179C0.832999 6.42286 0.832993 5.21684 0.959506 4.27584C1.089 3.31269 1.35923 2.55267 1.95577 1.95613C2.55231 1.35959 3.31232 1.08936 4.27548 0.959872C5.21647 0.833359 6.42249 0.833366 7.96142 0.833374ZM11.18 1.51732C12.092 0.605393 13.5705 0.605393 14.4824 1.51732C15.3943 2.42924 15.3943 3.90776 14.4824 4.81969L10.0503 9.25176C9.80281 9.49931 9.64776 9.65438 9.47473 9.78934C9.27093 9.9483 9.05042 10.0846 8.81711 10.1958C8.61902 10.2902 8.41097 10.3595 8.07887 10.4702L6.14251 11.1156C5.78502 11.2348 5.39088 11.1418 5.12442 10.8753C4.85795 10.6088 4.76491 10.2147 4.88408 9.8572L5.52952 7.92086C5.6402 7.58874 5.70953 7.3807 5.80394 7.18261C5.91513 6.94929 6.05141 6.72878 6.21037 6.52499C6.34533 6.35195 6.50041 6.1969 6.74797 5.94937L11.18 1.51732ZM13.7753 2.22442C13.2539 1.70302 12.4085 1.70302 11.8871 2.22442L11.6361 2.4755C11.6512 2.53941 11.6724 2.61555 11.7018 2.70048C11.7974 2.97586 11.9782 3.33852 12.3197 3.68004C12.6612 4.02156 13.0239 4.20235 13.2992 4.29789C13.3842 4.32735 13.4603 4.34853 13.5242 4.36366L13.7753 4.11258C14.2967 3.59118 14.2967 2.74582 13.7753 2.22442ZM12.7364 5.15143C12.3925 5.0035 11.9918 4.76635 11.6126 4.38714C11.2334 4.00794 10.9962 3.60726 10.8483 3.26328L7.47801 6.63355C7.20034 6.91122 7.09144 7.02134 6.99888 7.14001C6.88459 7.28653 6.78661 7.44508 6.70666 7.61283C6.64192 7.74868 6.59212 7.89533 6.46794 8.26787L6.18001 9.13166L6.86805 9.8197L7.73184 9.53177C8.10439 9.40759 8.25104 9.35779 8.38689 9.29305C8.55464 9.21311 8.71318 9.11512 8.85971 9.00083C8.97837 8.90828 9.08849 8.79938 9.36617 8.5217L12.7364 5.15143Z" fill="#1E2023" />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_367_3812">
                                          <rect width="16" height="16" fill="white" />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </button>
                                  <button className="delete-icon-btn" onClick={() => handleDeleteSubcategory(subcategory)}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      {/* Delete icon SVG - same as above but smaller */}
                                      <path fillRule="evenodd" clipRule="evenodd" d="M3.41092 5.1678C3.68645 5.14943 3.9247 5.3579 3.94307 5.63343L4.24969 10.2328C4.3096 11.1314 4.35228 11.7566 4.446 12.227C4.5369 12.6833 4.66379 12.9249 4.84606 13.0954C5.02834 13.2659 5.27777 13.3765 5.73911 13.4368C6.21471 13.499 6.84138 13.5 7.74194 13.5H8.25752C9.15808 13.5 9.78475 13.499 10.2604 13.4368C10.7217 13.3765 10.9711 13.2659 11.1534 13.0954C11.3357 12.9249 11.4626 12.6833 11.5535 12.227C11.6472 11.7566 11.6899 11.1314 11.7498 10.2328L12.0564 5.63343C12.0748 5.3579 12.313 5.14943 12.5885 5.1678C12.8641 5.18617 13.0725 5.42442 13.0542 5.69995L12.7452 10.3345C12.6882 11.1896 12.6422 11.8804 12.5342 12.4224C12.4219 12.986 12.231 13.4567 11.8366 13.8256C11.4422 14.1946 10.9598 14.3538 10.3901 14.4284C9.84203 14.5001 9.14973 14.5 8.29268 14.5H7.70679C6.84973 14.5 6.15743 14.5001 5.60941 14.4284C5.03964 14.3538 4.55727 14.1946 4.16288 13.8256C3.76848 13.4567 3.57753 12.986 3.46527 12.4224C3.35729 11.8804 3.31125 11.1896 3.25425 10.3344L2.94528 5.69995C2.92691 5.42442 3.13538 5.18617 3.41092 5.1678Z" fill="#1E2023" />
                                      <path fillRule="evenodd" clipRule="evenodd" d="M6.90324 1.50003L6.87258 1.50001C6.72832 1.49992 6.60264 1.49984 6.48396 1.51879C6.01509 1.59366 5.60936 1.8861 5.39006 2.30723C5.33456 2.41382 5.29489 2.53309 5.24935 2.66998L5.23967 2.69905L5.17495 2.89323C5.16229 2.93121 5.15876 2.94168 5.15569 2.95016C5.03894 3.2729 4.73626 3.49106 4.39316 3.49976C4.38414 3.49999 4.37309 3.50003 4.33306 3.50003H2.33301C2.05687 3.50003 1.83301 3.72388 1.83301 4.00003C1.83301 4.27617 2.05687 4.50003 2.33301 4.50003L4.33877 4.50003L4.34993 4.50003H11.6495L11.6607 4.50003L13.6664 4.50003C13.9425 4.50003 14.1664 4.27617 14.1664 4.00003C14.1664 3.72388 13.9425 3.50003 13.6664 3.50003H11.6664C11.6264 3.50003 11.6153 3.49999 11.6063 3.49976C11.2632 3.49106 10.9605 3.27289 10.8438 2.95014C10.8407 2.94172 10.8371 2.93102 10.8245 2.89323L10.7598 2.69905L10.7501 2.66996C10.7046 2.53307 10.6649 2.41382 10.6094 2.30723C10.3901 1.8861 9.98437 1.59366 9.5155 1.51879C9.39682 1.49984 9.27114 1.49992 9.12688 1.50001L9.09622 1.50003H6.90324ZM6.09606 3.29032C6.06988 3.36269 6.03945 3.43268 6.00511 3.50003H9.99435C9.96001 3.43268 9.92959 3.3627 9.90341 3.29033L9.8776 3.21477L9.8111 3.01528C9.75032 2.83294 9.73633 2.79575 9.72245 2.76909C9.64935 2.62872 9.5141 2.53124 9.35781 2.50628C9.32813 2.50154 9.28843 2.50003 9.09622 2.50003H6.90324C6.71103 2.50003 6.67133 2.50154 6.64165 2.50628C6.48536 2.53124 6.35011 2.62872 6.27701 2.76909C6.26313 2.79575 6.24914 2.83294 6.18836 3.01528L6.12182 3.21489C6.1118 3.24495 6.10401 3.26834 6.09606 3.29032Z" fill="#1E2023" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                  </tbody>
                </table>
                {/* Pagination Controls for Categories */}
                <div className="pagination-container">
                  <div className="pagination-controls">
                    <div className="btc">
                      <button
                        className={`pagination-btn ${categoryCurrentPage === 1 ? 'disabled' : ''}`}
                        onClick={() => handleCategoryPageChange(1)}
                        disabled={categoryCurrentPage === 1}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                          <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={categoryCurrentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                        </svg>
                      </button>

                      <button
                        className={`pagination-btn ${categoryCurrentPage === 1 ? 'disabled' : ''}`}
                        onClick={() => handleCategoryPageChange(categoryCurrentPage - 1)}
                        disabled={categoryCurrentPage === 1}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                          <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={categoryCurrentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                        </svg>
                      </button>
                    </div>

                    <div className="page-numbers">
                      {getCategoryPageNumbers().map(page => (
                        <button
                          key={page}
                          className={`page-number ${categoryCurrentPage === page ? 'active' : ''}`}
                          onClick={() => handleCategoryPageChange(page)}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <div className="btc">
                      <button
                        className={`pagination-btn ${categoryCurrentPage === Math.ceil(categoryTotalItems / categoryItemsPerPage) ? 'disabled' : ''}`}
                        onClick={() => handleCategoryPageChange(categoryCurrentPage + 1)}
                        disabled={categoryCurrentPage === Math.ceil(categoryTotalItems / categoryItemsPerPage)}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={categoryCurrentPage === Math.ceil(categoryTotalItems / categoryItemsPerPage) ? "#C5C5C5" : "#0F71EF"} />
                        </svg>
                      </button>

                      <button
                        className={`pagination-btn ${categoryCurrentPage === Math.ceil(categoryTotalItems / categoryItemsPerPage) ? 'disabled' : ''}`}
                        onClick={() => handleCategoryPageChange(Math.ceil(categoryTotalItems / categoryItemsPerPage))}
                        disabled={categoryCurrentPage === Math.ceil(categoryTotalItems / categoryItemsPerPage)}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={categoryCurrentPage === Math.ceil(categoryTotalItems / categoryItemsPerPage) ? "#C5C5C5" : "#0F71EF"} />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeMenu === 'mapmanage' ? (
            /* Map Management Section */
            <div className="map-management-section">
              <div className="map-container">
                <div id="map-container" className="map-instance"></div>

                {/* Top Left - Map Type Selector */}
                <div className="map-control-top-left">
                  <div className="action-buttons-group">
                    <div className={`action-button ${openSubMenu === 0 ? 'selected' : ''}`}
                      onClick={() => setOpenSubMenu(openSubMenu === 0 ? null : 0)}>
                      <span>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M9.99935 1.04169C10.3445 1.04169 10.6243 1.32151 10.6243 1.66669V10.8105L12.0248 9.17661C12.2495 8.91453 12.644 8.88418 12.9061 9.10882C13.1682 9.33346 13.1985 9.72802 12.9739 9.9901L10.4739 12.9068C10.3551 13.0453 10.1818 13.125 9.99935 13.125C9.8169 13.125 9.64355 13.0453 9.52481 12.9068L7.02481 9.9901C6.80018 9.72802 6.83053 9.33346 7.09261 9.10882C7.35468 8.88418 7.74925 8.91453 7.97389 9.17661L9.37435 10.8105V1.66669C9.37435 1.32151 9.65417 1.04169 9.99935 1.04169ZM5.8292 6.87666C6.17438 6.87474 6.45575 7.153 6.45767 7.49817C6.4596 7.84334 6.18133 8.12472 5.83616 8.12664C4.92491 8.13171 4.27901 8.15538 3.78881 8.24542C3.31646 8.33218 3.04307 8.4715 2.84019 8.67437C2.60956 8.90501 2.45918 9.22882 2.37697 9.8403C2.29234 10.4698 2.29102 11.304 2.29102 12.5002V13.3335C2.29102 14.5297 2.29234 15.364 2.37697 15.9934C2.45918 16.6049 2.60956 16.9287 2.84019 17.1594C3.07083 17.39 3.39464 17.5404 4.00612 17.6226C4.63558 17.7072 5.46984 17.7085 6.66602 17.7085H13.3327C14.5289 17.7085 15.3631 17.7072 15.9926 17.6226C16.6041 17.5404 16.9279 17.39 17.1585 17.1594C17.3891 16.9287 17.5395 16.6049 17.6217 15.9934C17.7064 15.364 17.7077 14.5297 17.7077 13.3335V12.5002C17.7077 11.304 17.7064 10.4698 17.6217 9.8403C17.5395 9.22882 17.3891 8.90501 17.1585 8.67438C16.9556 8.4715 16.6822 8.33218 16.2099 8.24542C15.7197 8.15538 15.0738 8.13171 14.1625 8.12664C13.8174 8.12472 13.5391 7.84334 13.541 7.49817C13.5429 7.153 13.8243 6.87474 14.1695 6.87666C15.0708 6.88167 15.8219 6.90324 16.4357 7.01599C17.0674 7.13202 17.6049 7.35305 18.0424 7.79049C18.544 8.29209 18.7597 8.92365 18.8606 9.67374C18.9577 10.3962 18.9577 11.3148 18.9577 12.4545V13.3793C18.9577 14.5189 18.9577 15.4375 18.8606 16.16C18.7597 16.9101 18.544 17.5416 18.0424 18.0432C17.5408 18.5448 16.9092 18.7606 16.1591 18.8614C15.4367 18.9586 14.5181 18.9586 13.3784 18.9585H6.62029C5.48063 18.9586 4.56203 18.9586 3.83956 18.8614C3.08947 18.7606 2.4579 18.5448 1.95631 18.0432C1.45471 17.5416 1.23897 16.9101 1.13812 16.16C1.04099 15.4375 1.041 14.5189 1.04102 13.3793V12.4545C1.041 11.3148 1.04099 10.3962 1.13812 9.67374C1.23897 8.92365 1.45471 8.29209 1.95631 7.79049C2.39375 7.35305 2.93131 7.13202 3.56298 7.01599C4.17678 6.90324 4.92793 6.88167 5.8292 6.87666Z" fill={openSubMenu === 0 ? "white" : "#1E2023"} />
                        </svg>
                      </span>
                    </div>
                    <div className="date-separator3"></div>
                    <div className={`action-button ${openSubMenu === 0 ? 'selected' : ''}`}
                      onClick={() => setOpenSubMenu(openSubMenu === 0 ? null : 0)}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M9.99935 1.04169C10.1818 1.04169 10.3551 1.12141 10.4739 1.25994L12.9739 4.17661C13.1985 4.43869 13.1682 4.83325 12.9061 5.05789C12.644 5.28253 12.2495 5.25218 12.0248 4.9901L10.6244 3.35622L10.6243 12.5C10.6243 12.8452 10.3445 13.125 9.99935 13.125C9.65417 13.125 9.37435 12.8452 9.37435 12.5L9.37435 3.35622L7.97389 4.9901C7.74925 5.25218 7.35468 5.28253 7.09261 5.05789C6.83053 4.83325 6.80018 4.43869 7.02481 4.17661L9.52481 1.25994C9.64355 1.12141 9.8169 1.04169 9.99935 1.04169ZM5.8292 6.87666C6.17438 6.87474 6.45575 7.153 6.45767 7.49817C6.4596 7.84334 6.18133 8.12472 5.83616 8.12664C4.92491 8.13171 4.27901 8.15538 3.78881 8.24542C3.31646 8.33218 3.04307 8.4715 2.84019 8.67437C2.60956 8.90501 2.45918 9.22882 2.37697 9.8403C2.29234 10.4698 2.29102 11.304 2.29102 12.5002V13.3335C2.29102 14.5297 2.29234 15.364 2.37697 15.9934C2.45918 16.6049 2.60956 16.9287 2.84019 17.1594C3.07083 17.39 3.39464 17.5404 4.00612 17.6226C4.63558 17.7072 5.46984 17.7085 6.66602 17.7085H13.3327C14.5289 17.7085 15.3631 17.7072 15.9926 17.6226C16.6041 17.5404 16.9279 17.39 17.1585 17.1594C17.3891 16.9287 17.5395 16.6049 17.6217 15.9934C17.7064 15.364 17.7077 14.5297 17.7077 13.3335V12.5002C17.7077 11.304 17.7064 10.4698 17.6217 9.8403C17.5395 9.22882 17.3891 8.90501 17.1585 8.67437C16.9556 8.4715 16.6822 8.33218 16.2099 8.24542C15.7197 8.15538 15.0738 8.13171 14.1625 8.12664C13.8174 8.12472 13.5391 7.84334 13.541 7.49817C13.5429 7.153 13.8243 6.87474 14.1695 6.87666C15.0708 6.88167 15.8219 6.90324 16.4357 7.01599C17.0674 7.13202 17.6049 7.35305 18.0424 7.79049C18.544 8.29209 18.7597 8.92365 18.8606 9.67374C18.9577 10.3962 18.9577 11.3148 18.9577 12.4545V13.3793C18.9577 14.5189 18.9577 15.4375 18.8606 16.16C18.7597 16.9101 18.544 17.5416 18.0424 18.0432C17.5408 18.5448 16.9092 18.7606 16.1591 18.8614C15.4367 18.9586 14.5181 18.9585 13.3784 18.9585H6.62029C5.48063 18.9585 4.56203 18.9586 3.83956 18.8614C3.08947 18.7606 2.4579 18.5448 1.95631 18.0432C1.45471 17.5416 1.23897 16.9101 1.13812 16.16C1.04099 15.4375 1.041 14.5189 1.04102 13.3793V12.4545C1.041 11.3148 1.04099 10.3962 1.13812 9.67374C1.23897 8.92365 1.45471 8.29209 1.95631 7.79049C2.39375 7.35305 2.93131 7.13202 3.56298 7.01599C4.17678 6.90324 4.92793 6.88167 5.8292 6.87666Z" fill={openSubMenu === 0 ? "white" : "#1E2023"} />
                      </svg>
                    </div>
                    {openSubMenu === 0 && (
                      <div className="sub-buttons-temp-area temp-area-create-stack">
                        <button
                          className={`sub-btn temp-area-create ${isTempAreaDrawingMode ? 'active' : ''}`}
                          onClick={handleToggleTempAreaDrawing}
                          disabled={!isTempAreaLayerActive}
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
                            className="icon icon-tabler icons-tabler-outline icon-tabler-pentagon"
                          >
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M7 4l10 0l4 7l-9 9l-9 -9z" />
                          </svg>
                        </button>
                        {isTempAreaDrawingMode && (
                          <button
                            className="sub-btn temp-area-complete with-label active"
                            onClick={handleCompleteTempAreaDrawing}
                            disabled={!isTempAreaDrawingMode}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                              <path d="M5 12l5 5l9 -14" />
                            </svg>
                            <span className="sub-btn-label">اتمام ترسیم</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="action-buttons-group">

                    {/* Button 1 */}
                    <div className={`action-button temp-area-manage ${openSubMenu === 1 ? 'selected' : ''}`}
                      onClick={() => {
                        setOpenSubMenu(openSubMenu === 1 ? null : 1);
                        // Reset location marker mode when other buttons are clicked
                        setIsLocationMarkerMode(false);
                      }}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                        <path d="M19 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                        <path d="M5 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                        <path d="M15 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                        <path d="M6.5 9.5l3.5 -3" />
                        <path d="M14 5.5l3 1.5" />
                        <path d="M18.5 10l-2.5 7" />
                        <path d="M13.5 17.5l-7 -5" />
                      </svg>
                    </div>
                    {openSubMenu === 1 && (
                      <div className="sub-buttons1">
                        <button
                          className={`sub-btn move-temp-area ${isTempAreaMoveMode ? 'active' : ''}`}
                          onClick={handleTempAreaMoveToggle}
                          disabled={!isTempAreaLayerActive || isTempAreaVertexEditMode || isSavingTempAreaGeometry}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 512"><path fillRule="nonzero" d="M318.633 104.048h-49.644v94.774c22.158 5.014 39.533 22.56 44.319 44.772h94.644v-78.986L512 256l-104.048 91.392V268.989h-94.774c-4.968 21.952-22.237 39.221-44.189 44.189v94.774h78.403L256 512l-91.392-104.048H243.594v-94.644c-22.212-4.786-39.758-22.161-44.772-44.319h-94.774v78.403L0 256l104.048-91.392V243.594h94.644c4.83-22.419 22.483-40.072 44.902-44.902v-94.644h-78.986L256 0l91.392 104.048h-28.759z" /></svg>
                        </button>
                        <div className="temp-area-vertex-group">
                          <button
                            className={`sub-btn temp-area-vertex ${isTempAreaVertexEditMode ? 'active' : ''}`}
                            onClick={handleToggleTempAreaVertexEdit}
                            disabled={!isTempAreaLayerActive || isSavingTempAreaGeometry}
                          >
                            <svg
                              version="1.1"
                              id="Layer_1"
                              xmlns="http://www.w3.org/2000/svg"
                              xmlnsXlink="http://www.w3.org/1999/xlink"
                              x="0px"
                              y="0px"
                              viewBox="0 0 116.28 122.88"
                              xmlSpace="preserve"
                            >
                              <g>
                                <path
                                  className="st0"
                                  d="M42.85,22.45L77.49,8l29.87,30.77L93.42,73.3c-23.64,6.55-45.66,16.11-66.45,27.96l-4.22-5.24l41.23-40.88 c0.83,0.38,1.73,0.57,2.64,0.57c0,0,0.01,0,0.01,0c3.56,0,6.44-2.88,6.44-6.44c0-3.55-2.88-6.44-6.44-6.44 c-3.55,0-6.44,2.88-6.44,6.44c0,1.15,0.3,2.23,0.83,3.16L20.22,92.97l-5.66-5.17C27.01,67.42,36.53,45.69,42.85,22.45L42.85,22.45z M87.36,0l28.93,29.64l-2.64,2.57l-2.64,2.57L82.08,5.13l2.64-2.57L87.36,0L87.36,0z M18.99,107.36 c13.56,12.48,21.54,7.04,32.83-0.68c9.34-6.38,20.63-14.09,37.75-16.64c1.22-4.1,5.02-7.09,9.51-7.09c5.48,0,9.92-4.44,9.92,9.92 c0,5.48-4.44,9.92-9.92,9.92c-3.85,0-7.19-2.19-8.83-5.4c-15.32,2.43-25.69,9.51-34.28,15.37c-14.47,9.88-24.58,16.78-42.3-0.24 c-1.19,0.48-2.46,0.73-3.74,0.73c0,0-0.01,0-0.01,0c-5.48,0-9.92-4.44-9.92-9.92c0-5.48,4.44-9.92,9.92-9.92 c5.48,0,9.92,4.44,9.92,9.92c0,0,0,0.01,0,0.01C19.84,104.73,19.55,106.09,18.99,107.36L18.99,107.36L18.99,107.36z"
                                />
                              </g>
                            </svg>
                          </button>
                          {isTempAreaVertexEditMode && (
                            <div className="temp-area-vertex-actions">
                              <button
                                className="sub-btn temp-area-save with-label"
                                onClick={handleSaveTempAreaVertexEdit}
                                disabled={!isTempAreaGeometryDirty || isSavingTempAreaGeometry}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                  <path d="M9 11l3 3l8 -8" />
                                  <path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" />
                                </svg>
                                <span className="sub-btn-label">ذخیره</span>
                              </button>
                              <button
                                className="sub-btn temp-area-cancel with-label"
                                onClick={handleCancelTempAreaVertexEdit}
                                disabled={isSavingTempAreaGeometry}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                  <path d="M18 6l-12 12" />
                                  <path d="M6 6l12 12" />
                                </svg>
                                <span className="sub-btn-label">لغو</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="temp-area-draw-group">
                          <button
                            className="sub-btn create-temp-area"
                            onClick={handleToggleTempAreaDrawing}
                            disabled={!isTempAreaLayerActive || isTempAreaVertexEditMode || isSavingTempAreaGeometry}
                          >
                            <svg
                              version="1.1"
                              id="Layer_1"
                              xmlns="http://www.w3.org/2000/svg"
                              xmlnsXlink="http://www.w3.org/1999/xlink"
                              x="0px"
                              y="0px"
                              viewBox="0 0 106.67 122.88"
                              xmlSpace="preserve"
                            >
                              <g>
                                <path
                                  className="st0"
                                  d="M87.73,0c1.3-0.01,2.42,0.43,3.39,1.35l14.16,13.55c0.92,0.88,1.37,2.04,1.39,3.32 c0.02,1.3-0.36,2.49-1.26,3.39l-7.54,7.84L76.95,9.25l7.46-7.77C85.32,0.53,86.43,0.02,87.73,0L87.73,0L87.73,0z M21.44,72.88 c2.56-0.79,5.26,0.65,6.05,3.2c0.79,2.56-0.65,5.26-3.2,6.05c-7.45,2.28-12.44,6.7-14.1,10.85c-0.44,1.11-0.59,2.12-0.42,2.96 c0.13,0.63,0.51,1.21,1.14,1.66c2.72,1.99,8.58,2.5,18.42,0.11c4.76-1.16,2.81-0.68,5.99-1.27c6.32-1.17,12.63-1.97,17.72-1.72 c6.68,0.33,11.7,2.48,13.41,7.61c1.11,3.32,0.8,6.2,0.52,8.78c-0.1,0.93-0.19,1.79-0.15,2.36c0,0.02,1.01-0.05,5.9-0.44 c5.66-0.45,11.52-2.68,17.3-4.89c2.97-1.13,5.91-2.25,9.25-3.28c2.56-0.78,5.26,0.67,6.03,3.22c0.78,2.56-0.67,5.26-3.22,6.03 c-2.59,0.79-5.59,1.94-8.6,3.08c-6.45,2.46-12.96,4.94-20,5.5c-12.88,1.01-15.87-2.63-16.33-8.48c-0.11-1.38,0.03-2.71,0.18-4.14 c0.17-1.6,0.36-3.39-0.07-4.69c-0.19-0.58-2.02-0.88-4.68-1c-4.26-0.21-9.84,0.51-15.52,1.57c-2.83,0.52-0.8,0.02-5.45,1.15 c-12.96,3.15-21.57,1.81-26.39-1.71c-2.71-1.97-4.32-4.56-4.94-7.47c-0.58-2.71-0.25-5.63,0.91-8.54 C3.81,82.85,11.04,76.06,21.44,72.88L21.44,72.88L21.44,72.88z M44.06,51.71l12.84,12.35l-15.7,4.22 c-0.57,0.11-0.79-0.12-0.69-0.64L44.06,51.71L44.06,51.71L44.06,51.71z M70.31,16.13l20.91,20.14L62.66,66.41l-25.59,6.86 c-0.92,0.18-1.28-0.18-1.13-1.05l5.8-25.94L70.31,16.13L70.31,16.13L70.31,16.13z"
                                />
                              </g>
                            </svg>
                          </button>
                          {isTempAreaDrawingMode && (
                            <button
                              className="sub-btn temp-area-complete with-label"
                              onClick={handleCompleteTempAreaDrawing}
                              disabled={isTempAreaVertexEditMode || isSavingTempAreaGeometry}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M5 12l5 5l9 -14" />
                              </svg>
                              <span className="sub-btn-label">اتمام ترسیم</span>
                            </button>
                          )}
                        </div>
                        {/* <button
                          className={`sub-btn temp-area-complete with-label ${isTempAreaDrawingMode ? 'active' : ''}`}
                          onClick={handleCompleteTempAreaDrawing}
                          disabled={!isTempAreaDrawingMode || isTempAreaVertexEditMode || isSavingTempAreaGeometry}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <g>
                              <path
                                className="st0"
                                d="M87.73,0c1.3-0.01,2.42,0.43,3.39,1.35l14.16,13.55c0.92,0.88,1.37,2.04,1.39,3.32 c0.02,1.3-0.36,2.49-1.26,3.39l-7.54,7.84L76.95,9.25l7.46-7.77C85.32,0.53,86.43,0.02,87.73,0L87.73,0L87.73,0z M21.44,72.88 c2.56-0.79,5.26,0.65,6.05,3.2c0.79,2.56-0.65,5.26-3.2,6.05c-7.45,2.28-12.44,6.7-14.1,10.85c-0.44,1.11-0.59,2.12-0.42,2.96 c0.13,0.63,0.51,1.21,1.14,1.66c2.72,1.99,8.58,2.5,18.42,0.11c4.76-1.16,2.81-0.68,5.99-1.27c6.32-1.17,12.63-1.97,17.72-1.72 c6.68,0.33,11.7,2.48,13.41,7.61c1.11,3.32,0.8,6.2,0.52,8.78c-0.1,0.93-0.19,1.79-0.15,2.36c0,0.02,1.01-0.05,5.9-0.44 c5.66-0.45,11.52-2.68,17.3-4.89c2.97-1.13,5.91-2.25,9.25-3.28c2.56-0.78,5.26,0.67,6.03,3.22c0.78,2.56-0.67,5.26-3.22,6.03 c-2.59,0.79-5.59,1.94-8.6,3.08c-6.45,2.46-12.96,4.94-20,5.5c-12.88,1.01-15.87-2.63-16.33-8.48c-0.11-1.38,0.03-2.71,0.18-4.14 c0.17-1.6,0.36-3.39-0.07-4.69c-0.19-0.58-2.02-0.88-4.68-1c-4.26-0.21-9.84,0.51-15.52,1.57c-2.83,0.52-0.8,0.02-5.45,1.15 c-12.96,3.15-21.57,1.81-26.39-1.71c-2.71-1.97-4.32-4.56-4.94-7.47c-0.58-2.71-0.25-5.63,0.91-8.54 C3.81,82.85,11.04,76.06,21.44,72.88L21.44,72.88L21.44,72.88z M44.06,51.71l12.84,12.35l-15.7,4.22 c-0.57,0.11-0.79-0.12-0.69-0.64L44.06,51.71L44.06,51.71L44.06,51.71z M70.31,16.13l20.91,20.14L62.66,66.41l-25.59,6.86 c-0.92,0.18-1.28-0.18-1.13-1.05l5.8-25.94L70.31,16.13L70.31,16.13L70.31,16.13z"
                              />
                            </g>
                          </svg>
                        </button> */}
                        {isTempAreaDrawingMode && (
                          <button
                            className="sub-btn temp-area-complete with-label"
                            onClick={handleCompleteTempAreaDrawing}
                            disabled={isTempAreaVertexEditMode || isSavingTempAreaGeometry}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                              <path d="M5 12l5 5l9 -14" />
                            </svg>
                            <span className="sub-btn-label">اتمام ترسیم</span>
                          </button>
                        )}
                        <button
                          className="sub-btn edit-temp-area"
                          onClick={handleOpenTempAreaEditModal}
                          disabled={isTempAreaVertexEditMode || isSavingTempAreaGeometry}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 438.76"><path d="M61.42 0h338.91c33.78 0 61.42 27.65 61.42 61.42V178.3c-2.65-.26-5.31-.34-7.96-.22-1.79.05-3.59.2-5.4.44-10.99 1.52-22.13 6.81-30.32 14.38H242.91v87.19h83.02l-27.87 26.32h-55.15v87.19h9.12l-6.73 34.81H61.42C27.65 428.41 0 400.77 0 366.98V61.42C0 27.64 27.64 0 61.42 0zm303.35 428.24-72.14 10.52 14.58-75.31 57.56 64.79zm-33.7-86.51L450.8 228.58c2.23-2.19 6.19-3.1 8.3-.83l51.52 55.84c2.31 2.56 1.54 6.26-.96 8.62L388.57 406.56l-57.5-64.83zM30.13 306.41h186.46v87.19H30.13v-87.19zm0-227.01h186.46v87.18H30.13V79.4zm0 113.5h186.46v87.19H30.13V192.9zM242.91 79.4h186.47v87.18H242.91V79.4z" /></svg>
                        </button>
                        <button
                          className="sub-btn delete-temp-area"
                          onClick={handleDeleteTempArea}
                          disabled={isTempAreaVertexEditMode || isSavingTempAreaGeometry}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-trash">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M4 7l16 0" />
                            <path d="M10 11l0 6" />
                            <path d="M14 11l0 6" />
                            <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                            <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <div className="date-separator3"></div>

                    {/* Button 2 */}
                    <div className={`action-button area-mange ${openSubMenu === 2 ? 'selected' : ''}`}
                      onClick={() => {
                        setOpenSubMenu(openSubMenu === 2 ? null : 2);
                        // Reset location marker mode when other buttons are clicked
                        setIsLocationMarkerMode(false);
                      }}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M4.16797 1.04169C4.51315 1.04169 4.79297 1.32151 4.79297 1.66669V9.16669C4.79297 10.7557 4.7943 11.8846 4.90943 12.741C5.02216 13.5794 5.23355 14.0624 5.58622 14.4151C5.9389 14.7678 6.42194 14.9792 7.26034 15.0919C8.11673 15.207 9.24562 15.2084 10.8346 15.2084H18.3346C18.6798 15.2084 18.9596 15.4882 18.9596 15.8334C18.9596 16.1785 18.6798 16.4584 18.3346 16.4584H16.4596V18.3334C16.4596 18.6785 16.1798 18.9584 15.8346 18.9584C15.4895 18.9584 15.2096 18.6785 15.2096 18.3334V16.4584H10.7876C9.25616 16.4584 8.04313 16.4584 7.09378 16.3307C6.11676 16.1994 5.32597 15.9226 4.70234 15.299C4.0787 14.6754 3.80194 13.8846 3.67058 12.9075C3.54294 11.9582 3.54296 10.7452 3.54297 9.2137L3.54297 4.79169H1.66797C1.32279 4.79169 1.04297 4.51187 1.04297 4.16669C1.04297 3.82151 1.32279 3.54169 1.66797 3.54169H3.54297V1.66669C3.54297 1.32151 3.82279 1.04169 4.16797 1.04169ZM12.7423 4.90815C11.8859 4.79301 10.757 4.79169 9.16797 4.79169H6.66797C6.32279 4.79169 6.04297 4.51187 6.04297 4.16669C6.04297 3.82151 6.32279 3.54169 6.66797 3.54169L9.21498 3.54169C10.7465 3.54167 11.9595 3.54166 12.9088 3.6693C13.8858 3.80066 14.6766 4.07742 15.3003 4.70106C15.9239 5.32469 16.2007 6.11548 16.332 7.0925C16.4597 8.04185 16.4596 9.25488 16.4596 10.7863V13.3334C16.4596 13.6785 16.1798 13.9584 15.8346 13.9584C15.4895 13.9584 15.2096 13.6785 15.2096 13.3334V10.8334C15.2096 9.24434 15.2083 8.11545 15.0932 7.25906C14.9804 6.42065 14.7691 5.93761 14.4164 5.58494C14.0637 5.23226 13.5807 5.02087 12.7423 4.90815Z" fill={openSubMenu === 2 ? "white" : "#1E2023"} />
                      </svg>
                    </div>
                    {openSubMenu === 2 && (
                      <div className="sub-buttons2">
                        <button
                          className={`sub-btn move-area ${isAreaEditMode ? 'active' : ''}`}
                          onClick={handleAreaEditModeToggle}
                          disabled={isSavingAreaGeometry}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 512"><path fillRule="nonzero" d="M318.633 104.048h-49.644v94.774c22.158 5.014 39.533 22.56 44.319 44.772h94.644v-78.986L512 256l-104.048 91.392V268.989h-94.774c-4.968 21.952-22.237 39.221-44.189 44.189v94.774h78.403L256 512l-91.392-104.048H243.594v-94.644c-22.212-4.786-39.758-22.161-44.772-44.319h-94.774v78.403L0 256l104.048-91.392V243.594h94.644c4.83-22.419 22.483-40.072 44.902-44.902v-94.644h-78.986L256 0l91.392 104.048h-28.759z" /></svg>
                        </button>
                        {isAreaEditMode && (
                          <div className="area-edit-actions">
                            <button
                              className="sub-btn area-save with-label"
                              onClick={handleSaveAreaGeometry}
                              disabled={isSavingAreaGeometry}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M5 12l5 5l9 -14" />
                              </svg>
                              <span className="sub-btn-label">اتمام ترسیم</span>
                            </button>
                            <button
                              className="sub-btn area-cancel with-label"
                              onClick={handleCancelAreaGeometry}
                              disabled={isSavingAreaGeometry}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M18 6l-12 12" />
                                <path d="M6 6l12 12" />
                              </svg>
                              <span className="sub-btn-label">لغو</span>
                            </button>
                          </div>
                        )}
                        <button className="sub-btn edit-area" onClick={handleOpenAddPlaceWithRoofOption}>
                          <svg xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 438.76"><path d="M61.42 0h338.91c33.78 0 61.42 27.65 61.42 61.42V178.3c-2.65-.26-5.31-.34-7.96-.22-1.79.05-3.59.2-5.4.44-10.99 1.52-22.13 6.81-30.32 14.38H242.91v87.19h83.02l-27.87 26.32h-55.15v87.19h9.12l-6.73 34.81H61.42C27.65 428.41 0 400.77 0 366.98V61.42C0 27.64 27.64 0 61.42 0zm303.35 428.24-72.14 10.52 14.58-75.31 57.56 64.79zm-33.7-86.51L450.8 228.58c2.23-2.19 6.19-3.1 8.3-.83l51.52 55.84c2.31 2.56 1.54 6.26-.96 8.62L388.57 406.56l-57.5-64.83zM30.13 306.41h186.46v87.19H30.13v-87.19zm0-227.01h186.46v87.18H30.13V79.4zm0 113.5h186.46v87.19H30.13V192.9zM242.91 79.4h186.47v87.18H242.91V79.4z" /></svg>
                        </button>
                        <button className="sub-btn delete-area" onClick={handleDeleteSelectedArea}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-trash">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M4 7l16 0" />
                            <path d="M10 11l0 6" />
                            <path d="M14 11l0 6" />
                            <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                            <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <div className="date-separator3"></div>

                    {/* Button 3 */}
                    <div className={`action-button van-manage ${openSubMenu === 3 ? 'selected' : ''}`}
                      onClick={() => {
                        setOpenSubMenu(openSubMenu === 3 ? null : 3);
                        // Reset location marker mode when other buttons are clicked
                        setIsLocationMarkerMode(false);
                      }}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M4.9987 3.125C4.4234 3.125 3.95703 3.59137 3.95703 4.16667C3.95703 4.74196 4.4234 5.20833 4.9987 5.20833C5.57399 5.20833 6.04036 4.74196 6.04036 4.16667C6.04036 3.59137 5.57399 3.125 4.9987 3.125ZM2.70703 4.16667C2.70703 2.90101 3.73305 1.875 4.9987 1.875C6.04768 1.875 6.93205 2.57979 7.2041 3.54167H13.7487C15.7047 3.54167 17.2904 5.12733 17.2904 7.08333C17.2904 9.03934 15.7047 10.625 13.7487 10.625H6.2487C4.98305 10.625 3.95703 11.651 3.95703 12.9167C3.95703 14.1823 4.98305 15.2083 6.2487 15.2083H15.1565L14.5568 14.6086C14.3127 14.3645 14.3127 13.9688 14.5568 13.7247C14.8008 13.4806 15.1966 13.4806 15.4406 13.7247L17.1073 15.3914C17.3514 15.6355 17.3514 16.0312 17.1073 16.2753L15.4406 17.9419C15.1966 18.186 14.8008 18.186 14.5568 17.9419C14.3127 17.6979 14.3127 17.3021 14.5568 17.0581L15.1565 16.4583H6.2487C4.29269 16.4583 2.70703 14.8727 2.70703 12.9167C2.70703 10.9607 4.29269 9.375 6.2487 9.375H13.7487C15.0144 9.375 16.0404 8.34899 16.0404 7.08333C16.0404 5.81768 15.0144 4.79167 13.7487 4.79167H7.2041C6.93205 5.75354 6.04768 6.45833 4.9987 6.45833C3.73305 6.45833 2.70703 5.43232 2.70703 4.16667Z" fill={openSubMenu === 3 ? "white" : "#1E2023"} />
                      </svg>
                    </div>
                    {openSubMenu === 3 && (
                      <div className="sub-buttons3">
                        <button
                          className={`sub-btn van-create ${isVanDrawingMode ? 'active' : ''}`}
                          disabled={isSavingVanRoute}
                          onClick={handleToggleVanDrawing}
                        >
                          <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 106.67 122.88" xmlSpace="preserve"><g><path className="st0" d="M87.73,0c1.3-0.01,2.42,0.43,3.39,1.35l14.16,13.55c0.92,0.88,1.37,2.04,1.39,3.32 c0.02,1.3-0.36,2.49-1.26,3.39l-7.54,7.84L76.95,9.25l7.46-7.77C85.32,0.53,86.43,0.02,87.73,0L87.73,0L87.73,0z M21.44,72.88 c2.56-0.79,5.26,0.65,6.05,3.2c0.79,2.56-0.65,5.26-3.2,6.05c-7.45,2.28-12.44,6.7-14.1,10.85c-0.44,1.11-0.59,2.12-0.42,2.96 c0.13,0.63,0.51,1.21,1.14,1.66c2.72,1.99,8.58,2.5,18.42,0.11c4.76-1.16,2.81-0.68,5.99-1.27c6.32-1.17,12.63-1.97,17.72-1.72 c6.68,0.33,11.7,2.48,13.41,7.61c1.11,3.32,0.8,6.2,0.52,8.78c-0.1,0.93-0.19,1.79-0.15,2.36c0,0.02,1.01-0.05,5.9-0.44 c5.66-0.45,11.52-2.68,17.3-4.89c2.97-1.13,5.91-2.25,9.25-3.28c2.56-0.78,5.26,0.67,6.03,3.22c0.78,2.56-0.67,5.26-3.22,6.03 c-2.59,0.79-5.59,1.94-8.6,3.08c-6.45,2.46-12.96,4.94-20,5.5c-12.88,1.01-15.87-2.63-16.33-8.48c-0.11-1.38,0.03-2.71,0.18-4.14 c0.17-1.6,0.36-3.39-0.07-4.69c-0.19-0.58-2.02-0.88-4.68-1c-4.26-0.21-9.84,0.51-15.52,1.57c-2.83,0.52-0.8,0.02-5.45,1.15 c-12.96,3.15-21.57,1.81-26.39-1.71c-2.71-1.97-4.32-4.56-4.94-7.47c-0.58-2.71-0.25-5.63,0.91-8.54 C3.81,82.85,11.04,76.06,21.44,72.88L21.44,72.88L21.44,72.88z M44.06,51.71l12.84,12.35l-15.7,4.22 c-0.57,0.11-0.79-0.12-0.69-0.64L44.06,51.71L44.06,51.71L44.06,51.71z M70.31,16.13l20.91,20.14L62.66,66.41l-25.59,6.86 c-0.92,0.18-1.28-0.18-1.13-1.05l5.8-25.94L70.31,16.13L70.31,16.13L70.31,16.13z" /></g></svg>
                        </button>
                        <button className="sub-btn move-van-node">
                          <svg xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 512"><path fillRule="nonzero" d="M318.633 104.048h-49.644v94.774c22.158 5.014 39.533 22.56 44.319 44.772h94.644v-78.986L512 256l-104.048 91.392V268.989h-94.774c-4.968 21.952-22.237 39.221-44.189 44.189v94.774h78.403L256 512l-91.392-104.048H243.594v-94.644c-22.212-4.786-39.758-22.161-44.772-44.319h-94.774v78.403L0 256l104.048-91.392V243.594h94.644c4.83-22.419 22.483-40.072 44.902-44.902v-94.644h-78.986L256 0l91.392 104.048h-28.759z" /></svg>
                        </button>
                        <button className="sub-btn delete-van-node" onClick={handleVanNodeDelete}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-trash">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M4 7l16 0" />
                            <path d="M10 11l0 6" />
                            <path d="M14 11l0 6" />
                            <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                            <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <div className="date-separator3"></div>

                    {/* Button 4 - Location Marker */}
                    <div className={`action-button manage-door-point ${isLocationMarkerMode ? 'selected' : ''}`}
                      onClick={() => {
                        handleLocationMarkerSelect();
                        setOpenSubMenu(openSubMenu === 4 ? null : 4);
                      }}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M2.70898 8.4527C2.70898 4.37019 5.96316 1.04163 10.0007 1.04163C14.0381 1.04163 17.2923 4.37019 17.2923 8.4527C17.2923 10.4236 16.7306 12.5399 15.7377 14.3682C14.746 16.1942 13.297 17.781 11.4844 18.6282C10.5428 19.0683 9.45851 19.0683 8.51689 18.6282C6.70429 17.781 5.25533 16.1942 4.26361 14.3682C3.27067 12.5399 2.70898 10.4236 2.70898 8.4527ZM10.0007 2.29163C6.67435 2.29163 3.95898 5.03953 3.95898 8.4527C3.95898 10.2003 4.46118 12.1128 5.36207 13.7716C6.26418 15.4327 7.539 16.7913 9.04619 17.4958C9.65236 17.7791 10.3489 17.7791 10.9551 17.4958C12.4623 16.7913 13.7371 15.4327 14.6392 13.7716C15.5401 12.1128 16.0423 10.2003 16.0423 8.4527C16.0423 5.03953 13.327 2.29163 10.0007 2.29163ZM10.0007 5.62496C10.3458 5.62496 10.6257 5.90478 10.6257 6.24996V7.70829H12.084C12.4292 7.70829 12.709 7.98811 12.709 8.33329C12.709 8.67847 12.4292 8.95829 12.084 8.95829H10.6257V10.4166C10.6257 10.7618 10.3458 11.0416 10.0007 11.0416C9.65547 11.0416 9.37565 10.7618 9.37565 10.4166V8.95829H7.91732C7.57214 8.95829 7.29232 8.67847 7.29232 8.33329C7.29232 7.98811 7.57214 7.70829 7.91732 7.70829H9.37565V6.24996C9.37565 5.90478 9.65547 5.62496 10.0007 5.62496Z" fill={isLocationMarkerMode ? "white" : "#1E2023"} />
                      </svg>
                    </div>
                    {openSubMenu === 4 && showDoorTools && (
                      <div className="sub-buttons4">
                        <button className="sub-btn move-door-point" onClick={handleDoorMoveStart}>
                          <svg xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 512"><path fillRule="nonzero" d="M318.633 104.048h-49.644v94.774c22.158 5.014 39.533 22.56 44.319 44.772h94.644v-78.986L512 256l-104.048 91.392V268.989h-94.774c-4.968 21.952-22.237 39.221-44.189 44.189v94.774h78.403L256 512l-91.392-104.048H243.594v-94.644c-22.212-4.786-39.758-22.161-44.772-44.319h-94.774v78.403L0 256l104.048-91.392V243.594h94.644c4.83-22.419 22.483-40.072 44.902-44.902v-94.644h-78.986L256 0l91.392 104.048h-28.759z" /></svg>
                        </button>
                        <button className="sub-btn edit-door-point" onClick={handleDoorEdit}>
                          <svg xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 438.76"><path d="M61.42 0h338.91c33.78 0 61.42 27.65 61.42 61.42V178.3c-2.65-.26-5.31-.34-7.96-.22-1.79.05-3.59.2-5.4.44-10.99 1.52-22.13 6.81-30.32 14.38H242.91v87.19h83.02l-27.87 26.32h-55.15v87.19h9.12l-6.73 34.81H61.42C27.65 428.41 0 400.77 0 366.98V61.42C0 27.64 27.64 0 61.42 0zm303.35 428.24-72.14 10.52 14.58-75.31 57.56 64.79zm-33.7-86.51L450.8 228.58c2.23-2.19 6.19-3.1 8.3-.83l51.52 55.84c2.31 2.56 1.54 6.26-.96 8.62L388.57 406.56l-57.5-64.83zM30.13 306.41h186.46v87.19H30.13v-87.19zm0-227.01h186.46v87.18H30.13V79.4zm0 113.5h186.46v87.19H30.13V192.9zM242.91 79.4h186.47v87.18H242.91V79.4z" /></svg>
                        </button>
                        <button className="sub-btn delete-door-point" onClick={handleDoorDelete}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-trash">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M4 7l16 0" />
                            <path d="M10 11l0 6" />
                            <path d="M14 11l0 6" />
                            <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                            <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                          </svg>
                        </button>
                      </div>
                    )}

                  </div>
                </div>

                {/* Top Right - Action Buttons */}
                <div className="map-control-top-right">

                  {isMapFullscreen && (
                    <button className="exit-fullscreen-btn" onClick={handleExitFullscreenMap}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M13.4697 5.46967C13.7626 5.17678 14.2374 5.17678 14.5303 5.46967L20.5303 11.4697C20.8232 11.7626 20.8232 12.2374 20.5303 12.5303L14.5303 18.5303C14.2374 18.8232 13.7626 18.8232 13.4697 18.5303C13.1768 18.2374 13.1768 17.7626 13.4697 17.4697L18.1893 12.75H4C3.58579 12.75 3.25 12.4142 3.25 12C3.25 11.5858 3.58579 11.25 4 11.25H18.1893L13.4697 6.53033C13.1768 6.23744 13.1768 5.76256 13.4697 5.46967Z" fill="white" />
                      </svg>
                      بازگشت و کوچک‌نمایی نقشه
                    </button>
                  )}
                  <div className="map-type-selector">
                    <div className="map-type-display" onClick={() => { setIsLayerListOpen(!isLayerListOpen); setIsMapFloorOpen(false); setIsMapLanguageOpen(false); }}>
                      <span className="stgi">لایه‌های نقشه
                        <div className="date-separator2"></div>
                      </span>
                      <span>{activeLayerCount} لایه فعال</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path fillRule="evenodd" clipRule="evenodd" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" fill="#1E2023" />
                      </svg>
                    </div>

                    {isLayerListOpen && (
                      <div className="map-type-dropdown layers-dropdown">
                        <div className="active-editable-layer-info">
                          <span className="active-layer-label">  لایه فعال برای ویرایش : </span>
                        </div>
                        <div className="layer-options">
                          {adminVectorTileConfig.map(layer => {
                            const layerOption = editableLayerOptions.find((option) => option.id === layer.id);
                            const isLayerActive = activeEditableLayer?.id === layer.id;
                            const hasCorrespondingLayer = isMapLayerAvailable(layer.id);
                            const canEditLayer = canUserEditLayer(layerOption);
                            const isLayerSelectable = canEditLayer && hasCorrespondingLayer;
                            const editButtonTitle = !layerOption?.isEditable
                              ? 'ویرایش برای این لایه غیرفعال است'
                              : !hasCorrespondingLayer
                                ? 'لایه متناظر روی نقشه موجود نیست'
                                : !canEditLayer
                                  ? 'دسترسی لازم برای ویرایش این لایه را ندارید'
                                  : isLayerActive
                                    ? 'غیرفعال کردن ویرایش این لایه'
                                    : 'فعال‌سازی ویرایش این لایه';

                            return (
                              <label
                                key={layer.id}
                                className="map-type-option layer-toggle"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="layer-info">
                                  <span className="layer-title">{layer.titleFa || layer.id}</span>
                                  <span className="layer-subtitle">{layer.id}</span>
                                </div>
                                <div className="layer-actions">
                                  <button
                                    type="button"
                                    className={`edit-layer-btn ${isLayerActive ? 'active' : ''} ${!isLayerSelectable ? 'disabled' : ''}`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleEditableLayerSelect(layer.id);
                                    }}
                                    disabled={!isLayerSelectable}
                                    title={editButtonTitle}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M1.3335 11.6667V14.6667H4.3335L12.1568 6.84335L9.15683 3.84335L1.3335 11.6667Z" stroke="#1E2023" strokeWidth="1.25" strokeLinejoin="round" />
                                      <path d="M8.3335 4.66667L11.3335 7.66667" stroke="#1E2023" strokeWidth="1.25" strokeLinejoin="round" />
                                      <path d="M10.3335 2L13.3335 5L11.5002 6.83333L8.50016 3.83333L10.3335 2Z" stroke="#1E2023" strokeWidth="1.25" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                                  <input
                                    type="checkbox"
                                    checked={!!layerVisibility[layer.id]}
                                    onChange={() => handleLayerToggle(layer.id)}
                                  />
                                </div>
                              </label>
                            );
                          })}
                          {selectedEditableFeature && (
                            <div className="selected-feature-hint">
                              <div className="selected-feature-row">
                                <span className="selected-feature-label">لایه انتخابی:</span>
                                <span className="selected-feature-value">{activeEditableLayer?.label || 'هیچ‌کدام'}</span>
                              </div>
                              {selectedFeatureProperties && (
                                <div className="selected-feature-row">
                                  <span className="selected-feature-label">مشخصات:</span>
                                  <span className="selected-feature-value">{JSON.stringify(selectedFeatureProperties)}</span>
                                </div>
                              )}
                              {selectedFeatureCoordinates && Array.isArray(selectedFeatureCoordinates) && (
                                <div className="selected-feature-row">
                                  <span className="selected-feature-label">مختصات:</span>
                                  <span className="selected-feature-value">
                                    {selectedFeatureCoordinates.map((coord, index) => (
                                      <React.Fragment key={`coord-${index}`}>
                                        {Number(coord).toFixed(5)}
                                        {index < selectedFeatureCoordinates.length - 1 && ', '}
                                      </React.Fragment>
                                    ))}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="map-type-selector">
                    <div className="map-type-display" onClick={() => { setIsMapLanguageOpen(!isMapLanguageOpen); setIsMapFloorOpen(false); setIsLayerListOpen(false); }}>
                      <span className="stgi">زبان نقشه
                        <div className="date-separator2"></div>
                      </span>
                      <span>{selectedMapLanguage?.label}</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path fillRule="evenodd" clipRule="evenodd" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" fill="#1E2023" />
                      </svg>
                    </div>

                    {isMapLanguageOpen && (
                      <div className="map-type-dropdown">
                        {mapLanguageOptions.map(option => (
                          <div
                            key={option.value}
                            className="map-type-option"
                            onClick={() => {
                              setMapLanguage(option.value);
                              setIsMapLanguageOpen(false);
                            }}
                          >
                            {option.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="map-type-selector">
                    <div className="map-type-display" onClick={() => { setIsMapFloorOpen(!isMapFloorOpen); setIsLayerListOpen(false); setIsMapLanguageOpen(false); }}>
                      <span className="stgi">طبقه نقشه
                        <div className="date-separator2"></div>
                      </span>
                      <span>{mapFloor}</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path fillRule="evenodd" clipRule="evenodd" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" fill="#1E2023" />
                      </svg>
                    </div>

                    {isMapFloorOpen && (
                      <div className="map-type-dropdown">
                        {mapFloors.map(floor => (
                          <div
                            key={floor}
                            className="map-type-option"
                            onClick={() => {
                              setMapFloor(floor);
                              setIsMapFloorOpen(false);
                            }}
                          >
                            {floor}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Left - GPS and Zoom Controls */}
                <div className="map-control-bottom-left">
                  <div className="map-control-bottom-right">
                    <div className="gps-zoom-controls">
                      <div className="zoom-controls">
                        <button className="control-button zoom-in" onClick={handleZoomIn}>
                          <svg width="15" height="14" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13.4722 7.75H1.02778C0.602593 7.75 0.25 7.41 0.25 7C0.25 6.59 0.602593 6.25 1.02778 6.25H13.4722C13.8974 6.25 14.25 6.59 14.25 7C14.25 7.41 13.8974 7.75 13.4722 7.75Z" fill="#1E2023" stroke="#1E2023" strokeWidth="0.5" />
                            <path d="M7.25043 13.75C6.82525 13.75 6.47266 13.41 6.47266 13V1C6.47266 0.59 6.82525 0.25 7.25043 0.25C7.67562 0.25 8.02821 0.59 8.02821 1V13C8.02821 13.41 7.67562 13.75 7.25043 13.75Z" fill="#1E2023" stroke="#1E2023" strokeWidth="0.5" />
                          </svg>
                        </button>
                        <button className="control-button zoom-out" onClick={handleZoomOut}>
                          <svg width="15" height="14" viewBox="0 0 15 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13.4722 1.75H1.02778C0.602593 1.75 0.25 1.41 0.25 1C0.25 0.59 0.602593 0.25 1.02778 0.25H13.4722C13.8974 0.25 14.25 0.59 14.25 1C14.25 1.41 13.8974 1.75 13.4722 1.75Z" fill="#1E2023" stroke="#1E2023" strokeWidth="0.5" />
                          </svg>
                        </button>
                      </div>
                      <button className="control-button gps-button" onClick={handleGPS}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V3.28169C16.9842 3.64113 20.3589 7.01581 20.7183 11.25H22C22.4142 11.25 22.75 11.5858 22.75 12C22.75 12.4142 22.4142 12.75 22 12.75H20.7183C20.3589 16.9842 16.9842 20.3589 12.75 20.7183V22C12.75 22.4142 12.4142 22.75 12 22.75C11.5858 22.75 11.25 22.4142 11.25 22V20.7183C7.01581 20.3589 3.64113 16.9842 3.28169 12.75H2C1.58579 12.75 1.25 12.4142 1.25 12C1.25 11.5858 1.58579 11.25 2 11.25H3.28169C3.64113 7.01581 7.01581 3.64113 11.25 3.28169V2C11.25 1.58579 11.5858 1.25 12 1.25ZM12 4.75C7.99594 4.75 4.75 7.99594 4.75 12C4.75 16.0041 7.99594 19.25 12 19.25C16.0041 19.25 19.25 16.0041 19.25 12C19.25 7.99594 16.0041 4.75 12 4.75ZM12 9.75C10.7574 9.75 9.75 10.7574 9.75 12C9.75 13.2426 10.7574 14.25 12 14.25C13.2426 14.25 14.25 13.2426 14.25 12C14.25 10.7574 13.2426 9.75 12 9.75ZM8.25 12C8.25 9.92893 9.92893 8.25 12 8.25C14.0711 8.25 15.75 9.92893 15.75 12C15.75 14.0711 14.0711 15.75 12 15.75C9.92893 15.75 8.25 14.0711 8.25 12Z" fill="#1E2023" />
                          <path d="M9.75 12C9.75 10.7574 10.7574 9.75 12 9.75C13.2426 9.75 14.25 10.7574 14.25 12C14.25 13.2426 13.2426 14.25 12 14.25C10.7574 14.25 9.75 13.2426 9.75 12Z" fill="#1E2023" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {isLocationMarkerMode ? (
                    <div className="location-marker-controls">
                      <button className="cancel-marker-btn" onClick={handleCancelLocationMarker}>
                        لغو
                      </button>
                      <button
                        className="add-place-btn"
                        onClick={handleAddPlaceToMarker}
                        disabled={isCreatingDoor}
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M2.70898 8.4527C2.70898 4.37019 5.96316 1.04163 10.0007 1.04163C14.0381 1.04163 17.2923 4.37019 17.2923 8.4527C17.2923 10.4236 16.7306 12.5399 15.7377 14.3682C14.746 16.1942 13.297 17.781 11.4844 18.6282C10.5428 19.0683 9.45851 19.0683 8.51689 18.6282C6.70429 17.781 5.25533 16.1942 4.26361 14.3682C3.27067 12.5399 2.70898 10.4236 2.70898 8.4527ZM10.0007 2.29163C6.67435 2.29163 3.95898 5.03953 3.95898 8.4527C3.95898 10.2003 4.46118 12.1128 5.36207 13.7716C6.26418 15.4327 7.539 16.7913 9.04619 17.4958C9.65236 17.7791 10.3489 17.7791 10.9551 17.4958C12.4623 16.7913 13.7371 15.4327 14.6392 13.7716C15.5401 12.1128 16.0423 10.2003 16.0423 8.4527C16.0423 5.03953 13.327 2.29163 10.0007 2.29163ZM10.0007 5.62496C10.3458 5.62496 10.6257 5.90478 10.6257 6.24996V7.70829H12.084C12.4292 7.70829 12.709 7.98811 12.709 8.33329C12.709 8.67847 12.4292 8.95829 12.084 8.95829H10.6257V10.4166C10.6257 10.7618 10.3458 11.0416 10.0007 11.0416C9.65547 11.0416 9.37565 10.7618 9.37565 10.4166V8.95829H7.91732C7.57214 8.95829 7.29232 8.67847 7.29232 8.33329C7.29232 7.98811 7.57214 7.70829 7.91732 7.70829H9.37565V6.24996C9.37565 5.90478 9.65547 5.62496 10.0007 5.62496Z" fill="white" />
                        </svg>
                        {isCreatingDoor ? 'در حال ثبت درب...' : 'افزودن مکان روی نشانگر تنظیم شده'}
                      </button>
                    </div>
                  ) : (
                    !isMapFullscreen && (
                      <button className="zoom-map-button" onClick={handleFullscreenMap}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M11.9426 1.25H12.0574C14.3658 1.24999 16.1748 1.24998 17.5863 1.43975C19.031 1.63399 20.1711 2.03933 21.0659 2.93414C21.9607 3.82895 22.366 4.96897 22.5603 6.41371C22.75 7.82519 22.75 9.63423 22.75 11.9426V12.0574C22.75 14.3658 22.75 16.1748 22.5603 17.5863C22.366 19.031 21.9607 20.1711 21.0659 21.0659C20.1711 21.9607 19.031 22.366 17.5863 22.5603C16.1748 22.75 14.3658 22.75 12.0574 22.75H11.9426C9.63423 22.75 7.82519 22.75 6.41371 22.5603C4.96897 22.366 3.82895 21.9607 2.93414 21.0659C2.03933 20.1711 1.63399 19.031 1.43975 17.5863C1.24998 16.1748 1.24999 14.3658 1.25 12.0574V11.9426C1.24999 9.63423 1.24998 7.82519 1.43975 6.41371C1.63399 4.96897 2.03933 3.82895 2.93414 2.93414C3.82895 2.03933 4.96897 1.63399 6.41371 1.43975C7.82519 1.24998 9.63423 1.24999 11.9426 1.25ZM6.61358 2.92637C5.33517 3.09825 4.56445 3.42514 3.9948 3.9948C3.42514 4.56445 3.09825 5.33517 2.92637 6.61358C2.75159 7.91356 2.75 9.62177 2.75 12C2.75 14.3782 2.75159 16.0864 2.92637 17.3864C3.09825 18.6648 3.42514 19.4355 3.9948 20.0052C4.56445 20.5749 5.33517 20.9018 6.61358 21.0736C7.91356 21.2484 9.62177 21.25 12 21.25C14.3782 21.25 16.0864 21.2484 17.3864 21.0736C18.6648 20.9018 19.4355 20.5749 20.0052 20.0052C20.5749 19.4355 20.9018 18.6648 21.0736 17.3864C21.2484 16.0864 21.25 14.3782 21.25 12C21.25 9.62177 21.2484 7.91356 21.0736 6.61358C20.9018 5.33517 20.5749 4.56445 20.0052 3.9948C19.4355 3.42514 18.6648 3.09825 17.3864 2.92637C16.0864 2.75159 14.3782 2.75 12 2.75C9.62177 2.75 7.91356 2.75159 6.61358 2.92637ZM10.7474 5.99364C10.7509 6.40784 10.4179 6.74646 10.0038 6.74997C9.14788 6.75723 8.55011 6.7855 8.10037 6.8736C7.67158 6.95759 7.43423 7.08568 7.25996 7.25996C7.08568 7.43423 6.95759 7.67158 6.8736 8.10037C6.7855 8.55011 6.75723 9.14788 6.74997 10.0038C6.74646 10.4179 6.40784 10.7509 5.99364 10.7474C5.57944 10.7439 5.24652 10.4052 5.25003 9.99103C5.25724 9.14035 5.28357 8.41444 5.40157 7.81203C5.52367 7.18869 5.75316 6.64543 6.1993 6.1993C6.64543 5.75316 7.18869 5.52367 7.81203 5.40157C8.41444 5.28357 9.14035 5.25724 9.99103 5.25003C10.4052 5.24652 10.7439 5.57944 10.7474 5.99364ZM13.2502 5.99364C13.2537 5.57944 13.5923 5.24652 14.0065 5.25003C14.8572 5.25724 15.5831 5.28357 16.1855 5.40157C16.8089 5.52367 17.3521 5.75316 17.7983 6.1993C18.2444 6.64543 18.4739 7.18869 18.596 7.81203C18.714 8.41444 18.7403 9.14035 18.7475 9.99103C18.751 10.4052 18.4181 10.7439 18.0039 10.7474C17.5897 10.7509 17.2511 10.4179 17.2476 10.0038C17.2403 9.14788 17.2121 8.55011 17.124 8.10037C17.04 7.67158 16.9119 7.43423 16.7376 7.25996C16.5633 7.08568 16.326 6.95759 15.8972 6.8736C15.4475 6.7855 14.8497 6.75723 13.9938 6.74997C13.5796 6.74646 13.2467 6.40784 13.2502 5.99364ZM5.99364 13.2502C6.40784 13.2467 6.74646 13.5796 6.74997 13.9938C6.75723 14.8497 6.7855 15.4475 6.8736 15.8972C6.95759 16.326 7.08568 16.5633 7.25996 16.7376C7.43423 16.9119 7.67158 17.04 8.10037 17.124C8.55011 17.2121 9.14788 17.2403 10.0038 17.2476C10.4179 17.2511 10.7509 17.5897 10.7474 18.0039C10.7439 18.4181 10.4052 18.751 9.99103 18.7475C9.14035 18.7403 8.41444 18.714 7.81203 18.596C7.18869 18.4739 6.64543 18.2444 6.1993 17.7983C5.75316 17.3521 5.52367 16.8089 5.40157 16.1855C5.28357 15.5831 5.25724 14.8572 5.25003 14.0065C5.24652 13.5923 5.57944 13.2537 5.99364 13.2502ZM18.0039 13.2502C18.4181 13.2537 18.751 13.5923 18.7475 14.0065C18.7403 14.8572 18.714 15.5831 18.596 16.1855C18.4739 16.8089 18.2444 17.3521 17.7983 17.7983C17.3521 18.2444 16.8089 18.4739 16.1855 18.596C15.5831 18.714 14.8572 18.7403 14.0065 18.7475C13.5923 18.751 13.2537 18.4181 13.2502 18.0039C13.2467 17.5897 13.5796 17.2511 13.9938 17.2476C14.8497 17.2403 15.4475 17.2121 15.8972 17.124C16.326 17.04 16.5633 16.9119 16.7376 16.7376C16.9119 16.5633 17.04 16.326 17.124 15.8972C17.2121 15.4475 17.2403 14.8497 17.2476 13.9938C17.2511 13.5796 17.5897 13.2467 18.0039 13.2502Z" fill="white" />
                        </svg>
                        <span>بزرگنمایی نقشه</span>
                      </button>
                    )
                  )}
                </div>

                {/* Bottom Right - Zoom Map Button */}

              </div>
            </div>
          ) : (
            /* Charts Section */
            <div className="charts-section">
              {/* Middle Chart Container */}
              <div className="chart-container-middle" aria-busy={isLoadingBarChart}>
                {/* Top stats section */}
                <div className="stats-cards-container">
                  <div className="stat-card">
                    <div className="stat-card-icon">
                      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="4" width="48" height="48" rx="24" fill="#0F71EF" />
                        <rect x="4" y="4" width="48" height="48" rx="24" stroke="#F5F6FF" strokeWidth="8" />
                        <path d="M28.1706 36.6377C27.2958 36.6377 26.4291 36.3809 25.7469 35.8753L22.2958 33.299C21.3809 32.6169 20.6666 31.1963 20.6666 30.0567V24.0936C20.6666 22.8576 21.5735 21.5414 22.7373 21.108L26.7421 19.6072C27.5366 19.3103 28.7886 19.3103 29.5832 19.6072L33.596 21.108C34.7597 21.5414 35.6666 22.8576 35.6666 24.0936V30.0567C35.6666 31.1963 34.9523 32.6169 34.0374 33.299L30.5864 35.8753C29.9122 36.3809 29.0454 36.6377 28.1706 36.6377ZM27.1674 20.7308L23.1626 22.2316C22.4724 22.4885 21.8705 23.3552 21.8705 24.0936V30.0567C21.8705 30.8191 22.4082 31.8865 23.0101 32.336L26.4612 34.9122C27.3841 35.6024 28.9491 35.6024 29.8721 34.9122L33.3231 32.336C33.9331 31.8785 34.4628 30.8111 34.4628 30.0567V24.0936C34.4628 23.3633 33.8608 22.4965 33.1706 22.2316L29.1658 20.7308C28.6361 20.5302 27.7051 20.5302 27.1674 20.7308Z" fill="white" />
                        <path d="M27.1674 20.7308L23.1626 22.2316C22.4724 22.4885 21.8705 23.3552 21.8705 24.0936V30.0567C21.8705 30.8191 22.4082 31.8865 23.0101 32.336L26.4612 34.9122C27.3841 35.6024 28.9491 35.6024 29.8721 34.9122L33.3231 32.336C33.9331 31.8785 34.4628 30.8111 34.4628 30.0567V24.0936C34.4628 23.3633 33.8608 22.4965 33.1706 22.2316L29.1658 20.7308C28.6361 20.5302 27.7051 20.5302 27.1674 20.7308Z" fill="white" />
                        <path d="M28.1706 27.7373H28.1144C26.9507 27.7052 26.1 26.8143 26.1 25.7309C26.1 24.6233 27.0069 23.7164 28.1144 23.7164C29.222 23.7164 30.1289 24.6233 30.1289 25.7309C30.1284 26.2526 29.9258 26.7539 29.5637 27.1295C29.2016 27.5051 28.708 27.7258 28.1866 27.7453C28.1786 27.7373 28.1786 27.7373 28.1706 27.7373ZM28.1144 24.9203C27.665 24.9203 27.3038 25.2814 27.3038 25.7309C27.3038 26.1723 27.6489 26.5254 28.0823 26.5415H28.1706C28.3764 26.5291 28.5695 26.438 28.71 26.2871C28.8504 26.1362 28.9274 25.937 28.925 25.7309C28.9261 25.6241 28.9058 25.5182 28.8655 25.4194C28.8251 25.3206 28.7655 25.2308 28.69 25.1553C28.6145 25.0798 28.5247 25.0202 28.4259 24.9798C28.327 24.9394 28.2212 24.9192 28.1144 24.9203ZM28.1706 32.2959C27.4804 32.2959 26.7822 32.1113 26.2444 31.7501C25.7067 31.397 25.4017 30.8761 25.4017 30.3224C25.4017 29.7686 25.7067 29.2469 26.2444 28.8858C27.3279 28.1635 29.0213 28.1715 30.0968 28.8858C30.6345 29.2389 30.9395 29.7606 30.9395 30.3143C30.9395 30.8681 30.6345 31.3898 30.0968 31.7509C29.559 32.1121 28.8608 32.2959 28.1706 32.2959ZM26.9106 29.8802C26.7099 30.0086 26.5976 30.1691 26.6056 30.3135C26.6056 30.458 26.7179 30.6185 26.9106 30.7469C27.5847 31.1964 28.7565 31.1964 29.4306 30.7469C29.6313 30.6185 29.7436 30.458 29.7436 30.3135C29.7436 30.1691 29.6313 30.0086 29.4387 29.8802C28.7645 29.4387 27.5847 29.4387 26.9106 29.8802Z" fill="#0F71EF" />
                      </svg>
                    </div>
                    <div className="stat-card-content">
                      <div className="stat-card-title">تعداد کاربران</div>
                      <div className="stat-card-value">{isLoadingDashboardSummary ? '...' : formatNumberFa(dashboardSummary.totalUsers)}</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-icon">
                      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="4" width="48" height="48" rx="24" fill="#0F71EF" />
                        <rect x="4" y="4" width="48" height="48" rx="24" stroke="#F5F6FF" strokeWidth="8" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M33.417 29.6667C31.8062 29.6667 30.5003 30.882 30.5003 32.3811C30.5003 33.8685 31.4312 35.6042 32.8836 36.2248C33.2222 36.3695 33.6118 36.3695 33.9504 36.2248C35.4028 35.6042 36.3337 33.8685 36.3337 32.3811C36.3337 30.882 35.0278 29.6667 33.417 29.6667ZM33.417 33.4167C33.8772 33.4167 34.2503 33.0436 34.2503 32.5834C34.2503 32.1231 33.8772 31.75 33.417 31.75C32.9568 31.75 32.5837 32.1231 32.5837 32.5834C32.5837 33.0436 32.9568 33.4167 33.417 33.4167Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M22.5837 19.6667C20.9728 19.6667 19.667 20.882 19.667 22.3811C19.667 23.8685 20.5979 25.6042 22.0503 26.2248C22.3889 26.3695 22.7784 26.3695 23.117 26.2248C24.5694 25.6042 25.5003 23.8685 25.5003 22.3811C25.5003 20.882 24.1945 19.6667 22.5837 19.6667ZM22.5837 23.4167C23.0439 23.4167 23.417 23.0436 23.417 22.5834C23.417 22.1231 23.0439 21.75 22.5837 21.75C22.1234 21.75 21.7503 22.1231 21.7503 22.5834C21.7503 23.0436 22.1234 23.4167 22.5837 23.4167Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M27.3748 22.1667C27.3748 21.8215 27.6546 21.5417 27.9998 21.5417H31.443C33.7357 21.5417 34.6076 24.5359 32.6733 25.7667L23.9973 31.2879C23.1181 31.8474 23.5144 33.2084 24.5565 33.2084H26.4909L26.3078 33.0253C26.0637 32.7812 26.0637 32.3855 26.3078 32.1414C26.5519 31.8973 26.9476 31.8973 27.1917 32.1414L28.4417 33.3914C28.6858 33.6355 28.6858 34.0312 28.4417 34.2753L27.1917 35.5253C26.9476 35.7694 26.5519 35.7694 26.3078 35.5253C26.0637 35.2812 26.0637 34.8855 26.3078 34.6414L26.4909 34.4584H24.5565C22.2638 34.4584 21.3919 31.4642 23.3262 30.2333L32.0022 24.7122C32.8814 24.1527 32.4851 22.7917 31.443 22.7917H27.9998C27.6546 22.7917 27.3748 22.5119 27.3748 22.1667Z" fill="white" />
                      </svg>

                    </div>
                    <div className="stat-card-content">
                      <div className="stat-card-title">مسیریابی های موفق</div>
                      <div className="stat-card-value">{isLoadingDashboardSummary ? '...' : formatNumberFa(dashboardSummary.successfulNavigations)}</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-icon">
                      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="4" width="48" height="48" rx="24" fill="#0F71EF" />
                        <rect x="4" y="4" width="48" height="48" rx="24" stroke="#F5F6FF" strokeWidth="8" />
                        <path d="M28.0003 36.3336C32.6027 36.3336 36.3337 34.6546 36.3337 32.5836C36.3337 31.528 35.3645 30.5744 33.8048 29.8929C32.8531 31.6394 31.4018 33.1448 29.5583 33.9326C28.5673 34.3561 27.4333 34.3561 26.4424 33.9326C24.5989 33.1448 23.1475 31.6394 22.1958 29.8929C20.6361 30.5744 19.667 31.528 19.667 32.5836C19.667 34.6546 23.398 36.3336 28.0003 36.3336Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M22.167 25.0955C22.167 22.0973 24.7787 19.6667 28.0003 19.6667C31.222 19.6667 33.8337 22.0973 33.8337 25.0955C33.8337 28.0703 31.9719 31.5416 29.067 32.783C28.3899 33.0724 27.6108 33.0724 26.9336 32.783C24.0288 31.5416 22.167 28.0703 22.167 25.0955ZM28.0003 27.1667C28.9208 27.1667 29.667 26.4205 29.667 25.5C29.667 24.5795 28.9208 23.8334 28.0003 23.8334C27.0799 23.8334 26.3337 24.5795 26.3337 25.5C26.3337 26.4205 27.0799 27.1667 28.0003 27.1667Z" fill="white" />
                      </svg>


                    </div>
                    <div className="stat-card-content">
                      <div className="stat-card-title">مراکز فرهنگی موجود</div>
                      <div className="stat-card-value">{isLoadingDashboardSummary ? '...' : formatNumberFa(dashboardSummary.culturalCenters)}</div>
                    </div>
                  </div>
                </div>

                {/* Chart section */}
                <div className="middle-chart-content">
                  <div className="chart-header">
                    <div className="chart-title">
                      <h3>آمار بازدید {barChartTimeFilter} کاربران</h3>
                      <p>تعداد بازدید کاربران فعال از اپلیکیشن در {barChartTimeFilter}</p>
                    </div>
                    <div className="chart-filter" onClick={() => setIsBarChartFilterOpen(!isBarChartFilterOpen)}>
                      <span>{barChartTimeFilter}</span>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M3.69213 7.09327C3.91677 6.83119 4.31133 6.80084 4.57341 7.02548L10 11.6768L15.4266 7.02548C15.6887 6.80084 16.0832 6.83119 16.3079 7.09327C16.5325 7.35535 16.5022 7.74991 16.2401 7.97455L10.4067 12.9745C10.1727 13.1752 9.82731 13.1752 9.59326 12.9745L3.75992 7.97455C3.49784 7.74991 3.46749 7.35535 3.69213 7.09327Z" fill="#1E2023" />
                      </svg>

                      {isBarChartFilterOpen && (
                        <div className="time-filter-dropdown show">
                          <div className="time-filter-option" onClick={() => {
                            setBarChartTimeFilter('هفته اخیر');
                          }}>هفته اخیر</div>
                          <div className="time-filter-option" onClick={() => {
                            setBarChartTimeFilter('ماه اخیر');
                          }}>ماه اخیر</div>
                          <div className="time-filter-option" onClick={() => {
                            setBarChartTimeFilter('سه ماه اخیر');
                          }}>سه ماه اخیر</div>
                          <div className="time-filter-option" onClick={() => {
                            setBarChartTimeFilter('سال اخیر');
                          }}>سال اخیر</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bar-chart-container">
                    <div className="chart-area">
                      {/* Horizontal grid lines - dynamically generated based on Y-axis labels */}
                      {getYAxisLabels(barChartTimeFilter).map((label, index) => (
                        <div key={`grid-${index}`} className="grid-line"></div>
                      ))}

                      {/* Bars */}
                      <div className={`bars-container ${barChartTimeFilter === 'سال اخیر' ? 'year-view' : ''}`}>
                        {barData.map((bar, index) => {
                          // Calculate percentage height based on Y-axis max value
                          const yLabels = getYAxisLabels(barChartTimeFilter);
                          const maxValue = yLabels[0] || 0; // First label is the max value
                          const heightPercentage = maxValue ? (bar.count / maxValue) * 100 : 0;

                          return (
                            <div
                              key={index}
                              className="bar-wrapper"
                              onClick={() => setSelectedBar(selectedBar === index ? null : index)}
                            >
                              <div
                                className={`bar ${selectedBar === index ? 'selected' : ''} ${selectedBar !== null && selectedBar !== index ? 'dimmed' : ''}`}
                                style={{
                                  height: `${heightPercentage}%`,
                                  width: barChartTimeFilter === 'سال اخیر' ? '30px' : '40px'
                                }}
                              >
                                {selectedBar === index && (
                                  <div className="bar-value">{bar.count.toLocaleString('fa-IR')} نفر</div>
                                )}
                              </div>
                              <div className="x-label">{bar.label || bar.day}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="y-axis">
                      {getYAxisLabels(barChartTimeFilter).map((label, index) => (
                        <div key={index} className="y-label">{label.toLocaleString('fa-IR')}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Left Chart Container - Pie Chart */}
              <div className="chart-container-left">
                <div className="chart-header-with-filter">
                  <h3>نظرات ثبت شده</h3>
                  <div className="time-filter" onClick={() => setIsPieChartFilterOpen(!isPieChartFilterOpen)}>
                    <span>{pieChartTimeFilter}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" fill="#1E2023" />
                    </svg>

                    {isPieChartFilterOpen && (
                      <div className="time-filter-dropdown show">
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('امروز')}>امروز</div>
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('هفته اخیر')}>هفته اخیر</div>
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('ماه اخیر')}>ماه اخیر</div>
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('سه ماه اخیر')}>سه ماه اخیر</div>
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('سال اخیر')}>سال اخیر</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pie-chart-wrapper">
                  <div className="pie-chart-main">
                    <div className="pie-chart-visual" style={{
                      background: `conic-gradient(#0F71EF 0deg ${approvedDegrees}deg, white ${approvedDegrees}deg ${approvedDegrees + 2}deg, #F44336 ${approvedDegrees + 2}deg ${approvedDegrees + rejectedDegrees + 2}deg, white ${approvedDegrees + rejectedDegrees + 2}deg ${approvedDegrees + rejectedDegrees + 4}deg, #F2F2F2 ${approvedDegrees + rejectedDegrees + 4}deg 360deg)`
                    }}>
                      <div className="pie-center"></div>
                    </div>
                  </div>
                </div>

                <div className="table-header">
                  <span>نظرات و حالت ها</span>
                  <span>تعداد</span>
                </div>
                <div className="comments-table">
                  <div className="table-row2">
                    <span>کل نظرات ثبت شده (
                      {pieChartTimeFilter === 'ماه اخیر'
                        ? getJalaliMonthName(currentJalaliDate.jm)
                        : pieChartTimeFilter === 'سال اخیر'
                          ? currentJalaliDate.jy
                          : pieChartTimeFilter
                      }
                      )</span>
                    <span className="count-value">{isLoadingCommentStats ? '...' : commentStats.total}</span>
                  </div>

                  <div className="table-row">
                    <div className="stat-info">
                      <div className="stat-color approved"></div>
                      <span>تایید و انتشار</span>
                    </div>
                    <div className="count-value">{isLoadingCommentStats ? '...' : commentStats.approved}</div>
                  </div>
                  <div className="table-row">
                    <div className="stat-info">
                      <div className="stat-color rejected"></div>
                      <span>رد شده</span>
                    </div>
                    <div className="count-value">{isLoadingCommentStats ? '...' : commentStats.rejected}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Search and Table */}
          {currentReportView !== 'مدیریت اطلاعات فرهنگی' &&
            currentReportView !== 'مدیریت دسته بندی‌ها' &&
            currentReportView !== 'مدیریت صفحات' &&
            currentReportView !== 'دیدگاه ها' &&
            currentReportView !== 'بازخورد ها' &&
            currentReportView !== 'مدیریت ادمین‌ها' &&
            currentReportView !== 'کاربران ثبت نام کرده' &&
            currentReportView !== 'لاگ های مسیریابی کاربران' &&
            activeMenu !== 'mapmanage' && (
              <div className="users-section">
                <div className="section-header">
                  <div className="section-header-top">
                    <div className="title-container">
                      <div className="title-cell">
                        <h3>آخرین کاربران ثبت نام شده در اپلیکیشن</h3>
                        <button
                          className="refresh-btn"
                          onClick={handleRefreshMainTable}
                          disabled={isRefreshingMainTable || isLoadingRecentUsers}
                          type="button"
                          style={{ cursor: (isRefreshingMainTable || isLoadingRecentUsers) ? 'wait' : 'pointer' }}
                          title={(isRefreshingMainTable || isLoadingRecentUsers) ? 'در حال به‌روزرسانی...' : 'به‌روزرسانی جدول'}
                        >
                          {isRefreshingMainTable ? (
                            <div style={{
                              width: '18px',
                              height: '18px',
                              border: '2px solid #f3f3f3',
                              borderTop: '2px solid #1E2023',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }}></div>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M11.047 5.99994C11.047 8.73518 8.8271 10.9551 6.09186 10.9551C3.35662 10.9551 1.68674 8.20002 1.68674 8.20002M1.68674 8.20002H3.92646M1.68674 8.20002V10.6776M1.13672 5.99994C1.13672 3.2647 3.3368 1.0448 6.09186 1.0448C9.39694 1.0448 11.047 3.79986 11.047 3.79986M11.047 3.79986V1.32229M11.047 3.79986H8.84692" stroke="#1E2023" strokeWidth="1.08112" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <p></p>
                    </div>
                    <div className="left-container">
                      <div className="search-box-with-icon">
                        <svg className="search-icon7" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
                        </svg>
                        <input
                          type="text"
                          placeholder="جستجوی نام، نام خانوادگی و.."
                          value={searchTerm}
                          onChange={handleSearch}
                          className="search-input7"
                        />
                      </div>

                      {currentReportView !== 'کاربران ثبت نام کرده' && (
                        <button className="seeInfo-btn" onClick={handleExportAllUsers}>
                          مشاهده همه گزارش
                        </button>
                      )}
                    </div>
                  </div>
                </div>


                <div className="users-table-container">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>نام و نام خانوادگی</th>
                        <th>شماره تماس</th>
                        <th>تاریخ ثبت نام</th>
                        <th>جنسیت</th>
                        <th>مسیریابی موفق</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentUsers.map(user => (
                        <tr key={user.id}>
                          <td>
                            <div className="user-profile-cell">
                              <div className="user-profile-cell">
                                <div className="profile-image-small3">
                                  <svg fill="#ffffff" width="40px" height="40px" viewBox="0 0 36 36" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M30.61,24.52a17.16,17.16,0,0,0-25.22,0,1.51,1.51,0,0,0-.39,1v6A1.5,1.5,0,0,0,6.5,33h23A1.5,1.5,0,0,0,31,31.5v-6A1.51,1.51,0,0,0,30.61,24.52Z" className="clr-i-solid clr-i-solid-path-1"></path>
                                    <circle cx="18" cy="10" r="7" className="clr-i-solid clr-i-solid-path-2"></circle>
                                    <rect x="0" y="0" width="36" height="36" fillOpacity="0" />
                                  </svg>
                                </div>
                                <strong>{user.fullName}</strong>
                              </div>
                            </div>
                          </td>
                          <td>{user.phone}</td>
                          <td>{user.registerDate}</td>
                          <td>{user.gender}</td>
                          <td>
                            <span className="success-count-userssigned">
                              {user.successCount} بار
                            </span>
                          </td>
                          <td>
                            <div>
                              <button className="details-btn" onClick={() => handleDetailsClick(user)}>
                                جزئیات بیشتر
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" clipRule="evenodd" d="M11.0176 3.63828C11.2404 3.82922 11.2662 4.1646 11.0752 4.38737L7.12156 8.99997L11.0752 13.6126C11.2662 13.8353 11.2404 14.1707 11.0176 14.3617C10.7948 14.5526 10.4595 14.5268 10.2685 14.304L6.01851 9.3457C5.84798 9.14675 5.84798 8.85318 6.01851 8.65424L10.2685 3.6959C10.4595 3.47314 10.7948 3.44734 11.0176 3.63828Z" fill="#1E2023" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Add pagination controls */}
                  <div className="pagination-container">
                    {/* <div className="pagination-info">
                  <span>نمایش</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(e.target.value)}
                    className="items-per-page-select"
                  >
                    <option value="5">۵</option>
                    <option value="10">۱۰</option>
                    <option value="15">۱۵</option>
                    <option value="20">۲۰</option>
                  </select>
                  <span>از {totalItems} مورد</span>
                </div> */}

                    <div className="pagination-controls">
                      <div className="btc">
                        <button
                          className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                          onClick={() => handlePageChange(1)}
                          disabled={currentPage === 1}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                            <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                          </svg>
                        </button>

                        <button
                          className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                            <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                          </svg>
                        </button>
                      </div>

                      <div className="page-numbers">
                        {getPageNumbers().map(page => (
                          <button
                            key={page}
                            className={`page-number ${currentPage === page ? 'active' : ''}`}
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <div className="btc">
                        <button
                          className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === totalPages ? "#C5C5C5" : "#0F71EF"} />
                          </svg>
                        </button>

                        <button
                          className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                          onClick={() => handlePageChange(totalPages)}
                          disabled={currentPage === totalPages}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === totalPages ? "#C5C5C5" : "#0F71EF"} />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
      {isTempAreaEditModalOpen && (
        <div className="modal-overlay">
          <div className="add-place-modal temp-area-edit-modal">
            <div className="modal-header">
              <div className="step-text">
                {tempAreaFormMode === 'create' ? 'ثبت محدوده موقت' : 'ویرایش محدوده موقت'}
              </div>
              <button className="close-modal" onClick={handleCloseTempAreaModal} aria-label="بستن" disabled={isTempAreaFormDisabled}>
                ×
              </button>
            </div>

            <div className="modal-content">
              {isLoadingTempAreaDetails && (
                <div className="form-group">
                  <div className="info-message">در حال دریافت اطلاعات محدوده موقت از سرور...</div>
                </div>
              )}

              <div className="form-section">
                <div className="form-group">
                  <label className="form-label">نام محدوده</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="نام محدوده موقت"
                    value={tempAreaName}
                    onChange={(e) => setTempAreaName(e.target.value)}
                    disabled={isTempAreaFormDisabled}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">توضیحات</label>
                  <textarea
                    className="form-textarea"
                    placeholder="توضیحات تکمیلی درباره علت ایجاد این محدوده"
                    value={tempAreaDescription}
                    onChange={(e) => setTempAreaDescription(e.target.value)}
                    disabled={isTempAreaFormDisabled}
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">محدوده زمانی</label>
                  <div className="dual-input">
                    <div className="input-wrapper">
                      <span className="input-label">شروع</span>
                      <button
                        type="button"
                        className="date-input-display"
                        onClick={() => {
                          if (isTempAreaFormDisabled) return;
                          if (tempAreaSelectedStartDate) {
                            setTempAreaCalendarDate({
                              year: tempAreaSelectedStartDate.year,
                              month: tempAreaSelectedStartDate.month
                            });
                          }
                          setActiveTempAreaDateField('start');
                        }}
                        disabled={isTempAreaFormDisabled}
                      >
                        {formatTempAreaDateLabel(tempAreaSelectedStartDate, tempAreaStartTime)}
                      </button>
                      <input
                        type="time"
                        className="form-input"
                        value={tempAreaStartTime}
                        onChange={(e) => setTempAreaStartTime(e.target.value)}
                        disabled={isTempAreaFormDisabled}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-label">پایان</span>
                      <button
                        type="button"
                        className="date-input-display"
                        onClick={() => {
                          if (isTempAreaFormDisabled) return;
                          if (tempAreaSelectedEndDate) {
                            setTempAreaCalendarDate({
                              year: tempAreaSelectedEndDate.year,
                              month: tempAreaSelectedEndDate.month
                            });
                          }
                          setActiveTempAreaDateField('end');
                        }}
                        disabled={isTempAreaFormDisabled}
                      >
                        {formatTempAreaDateLabel(tempAreaSelectedEndDate, tempAreaEndTime)}
                      </button>
                      <input
                        type="time"
                        className="form-input"
                        value={tempAreaEndTime}
                        onChange={(e) => setTempAreaEndTime(e.target.value)}
                        disabled={isTempAreaFormDisabled}
                      />
                    </div>
                  </div>
                  {activeTempAreaDateField && (
                    <div className="jalali-calendar temp-area-calendar">
                      <div className="calendar-header">
                        <div className="month-year-selector">
                          <select
                            value={tempAreaCalendarDate.month}
                            onChange={(e) => setTempAreaCalendarDate(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                            className="month-select"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                              <option key={month} value={month}>
                                {getJalaliMonthName(month)}
                              </option>
                            ))}
                          </select>
                          <select
                            value={tempAreaCalendarDate.year}
                            onChange={(e) => setTempAreaCalendarDate(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                            className="year-select"
                          >
                            {jalaliYearOptions.map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                        </div>
                        <div className="calendar-nav">
                          <button className="nav-btn prev" onClick={handleTempAreaPrevMonth}>
                            ‹
                          </button>
                          <button className="nav-btn next" onClick={handleTempAreaNextMonth}>
                            ›
                          </button>
                        </div>
                      </div>
                      <div className="day-names">
                        <div className="day-name">ش</div>
                        <div className="day-name">ی</div>
                        <div className="day-name">د</div>
                        <div className="day-name">س</div>
                        <div className="day-name">چ</div>
                        <div className="day-name">پ</div>
                        <div className="day-name">ج</div>
                      </div>
                      <div className="calendar-days">
                        {renderTempAreaJalaliCalendarDays()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">محدودیت بر اساس اوقات شرعی</label>
                  <div className="prayer-restrictions">
                    <div className="checkbox-group">
                      {PRAYER_EVENT_OPTIONS.map((option) => (
                        <label key={option.value} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={tempAreaPrayerEvents.includes(option.value)}
                            onChange={(e) => {
                              const { checked } = e.target;

                              setTempAreaPrayerEvents((current) => {
                                if (checked) {
                                  return Array.from(new Set([...current, option.value]));
                                }

                                return current.filter((event) => event !== option.value);
                              });
                            }}
                            disabled={isTempAreaFormDisabled}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="dual-input">
                      <div className="input-wrapper">
                        <span className="input-label">دقایق قبل</span>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          value={tempAreaPrayerBefore}
                          onChange={(e) => setTempAreaPrayerBefore(e.target.value)}
                          disabled={isTempAreaFormDisabled}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-label">دقایق بعد</span>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          value={tempAreaPrayerAfter}
                          onChange={(e) => setTempAreaPrayerAfter(e.target.value)}
                          disabled={isTempAreaFormDisabled}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group inline-group">
                  <label className="form-label">وضعیت محدوده</label>
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={tempAreaIsActive}
                      onChange={(e) => setTempAreaIsActive(e.target.checked)}
                      disabled={isTempAreaFormDisabled}
                    />
                    <span>این محدوده فعال باشد</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="secondary-btn" onClick={handleCloseTempAreaModal} disabled={isTempAreaFormDisabled}>
                انصراف
              </button>
              {tempAreaFormMode === 'edit' && (
                <>
                  <button className="secondary-btn" onClick={handleExtendTempArea} disabled={isTempAreaFormDisabled}>
                    تمدید با بازه زمانی فعلی
                  </button>
                  <button className="secondary-btn" onClick={handleStopTempArea} disabled={isTempAreaFormDisabled}>
                    توقف فوری
                  </button>
                </>
              )}
              <button className="primary-btn" onClick={handleSaveTempAreaDetails} disabled={isTempAreaFormDisabled}>
                {isSavingTempAreaDetails
                  ? 'در حال ذخیره...'
                  : tempAreaFormMode === 'create'
                    ? 'ثبت محدوده'
                    : 'ثبت تغییرات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Place Modal */}
      {isAddPlaceModalOpen && (
        <div className="modal-overlay">
          <div className="add-place-modal">
            {/* Modal Header - UNCHANGED */}
            <div className="modal-header">
              <div className="step-text">
                مرحله {currentStep} از ۳ :
                <span className="step-title">
                  {currentStep === 1 && 'اطلاعات اولیه و کلی مکان'}
                  {currentStep === 2 && 'اطلاعات و جزئیات تکمیلی مکان'}
                  {currentStep === 3 && 'افزودن محدودیت های زمانی'}
                </span>
              </div>
              <div className="step-progress">
                <div
                  className={`step-circle ${currentStep >= 1 ? 'active' : ''} ${isEditingDoorInfo ? 'clickable' : ''}`}
                  onClick={() => handleStepCircleClick(1)}
                >
                  {currentStep > 1 ? '✓' : '۱'}
                </div>
                <div className={`step-line ${currentStep >= 2 ? 'active' : ''}`}></div>
                <div
                  className={`step-circle ${currentStep >= 2 ? 'active' : ''} ${isEditingDoorInfo ? 'clickable' : ''}`}
                  onClick={() => handleStepCircleClick(2)}
                >
                  {currentStep > 2 ? '✓' : '۲'}
                </div>
                <div className={`step-line ${currentStep >= 3 ? 'active' : ''}`}></div>
                <div
                  className={`step-circle ${currentStep >= 3 ? 'active' : ''} ${isEditingDoorInfo ? 'clickable' : ''}`}
                  onClick={() => handleStepCircleClick(3)}
                >
                  {currentStep > 3 ? '✓' : '۳'}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="modal-content">
              {currentStep === 1 && (
                <div className="step-content">
                  <div className="step-intro">
                    <h3>{isEditingDoorInfo ? `فرم ویرایش لایه (${activeLayerTitle})` : 'فرم و فرایند ایجاد و افزودن یک نقطه و مکان جدید'}</h3>
                  </div>

                  <div className="form-section">
                    <div className="form-group">
                      <label className="form-label">نام و توضیحات این مکان</label>

                      <div className="title-input-with-language8">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="نام نقطه و مکان (فارسی)"
                          value={placeName}
                          onChange={(e) => setPlaceName(e.target.value)}
                        />
                        <button
                          className="language-input-btn"
                          type="button"
                          onClick={() => openTitleLanguageModal('placeName')}
                          title="ورود عنوان به زبان‌های دیگر"
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>

                      <textarea
                        className="form-textarea"
                        placeholder="توضیحات بیشتر درباره این نقطه و مکان ..."
                        value={fullDescription}
                        onChange={(e) => setFullDescription(e.target.value)}
                        rows="3"
                      />
                    </div>

                    {!isAreaLayerActive && (
                      <div className="form-group">
                        <label className="form-label">تعیین گروه این مکان </label>
                        <div className="dropdown-group">
                          {!isDoorAccessLayerActive && (
                            <>
                              <div className="dropdown-field">
                                <select
                                  className="form-input"
                                  value={placeCategory}
                                  onChange={(e) => {
                                    setPlaceCategory(e.target.value);
                                    setPlaceSubcategory('');
                                  }}
                                  disabled={isLoadingGroups}
                                >
                                  <option value="" disabled>گروه اصلی</option>
                                  {groupOptions.map((group, index) => (
                                    <option key={`group-${group.value}-${index}`} value={group.value}>
                                      {group.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="dropdown-field">
                                <select
                                  className="form-input"
                                  value={placeSubcategory}
                                  onChange={(e) => setPlaceSubcategory(e.target.value)}
                                  disabled={!placeCategory || isLoadingSubGroups}
                                >
                                  <option value="" disabled>زیرگروه</option>
                                  {subGroupOptions.map((subGroup, index) => (
                                    <option key={`subgroup-${subGroup.value}-${index}`} value={subGroup.value}>
                                      {subGroup.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </>
                          )}

                          <div className="dropdown-field">
                            <select
                              className="form-input"
                              value={placeFunction}
                              onChange={(e) => setPlaceFunction(e.target.value)}
                              disabled={!placeSubcategory && !isDoorAccessLayerActive}
                            >
                              <option value="" disabled>کارکرد گروه</option>
                              <option value="door">درب</option>
                              <option value="connection">نقطه اتصال</option>
                              <option value="elevator">آسانسور</option>
                              <option value="escalator">پله برقی</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="step-content step2-content">
                  <div className="step-intro">
                    <h3>{isEditingDoorInfo ? `فرم ویرایش لایه (${activeLayerTitle})` : 'فرم و فرایند ایجاد و افزودن یک نقطه و مکان جدید'}</h3>
                  </div>

                  <div className="form-section">
                    {/* Place Type Section */}
                    <div className="form-group">
                      <label className="form-label">نوع و موقعیت این مکان </label>
                      <div className="location-type-grid">
                        {/* Status */}
                        <div className="location-type-section">
                          <div className="location-type-label">وضعیت</div>
                          <div className="location-type-options">
                            <div
                              className={`location-type-option ${locationStatus === 'فعال' ? 'selected' : ''}`}
                              onClick={() => setLocationStatus('فعال')}
                            >
                              <div className="location-type-radio">
                                {locationStatus === 'فعال' && <div className="location-type-radio-dot"></div>}
                              </div>
                              <span>فعال</span>
                            </div>
                            <div
                              className={`location-type-option ${locationStatus === 'غیر فعال' ? 'selected' : ''}`}
                              onClick={() => setLocationStatus('غیر فعال')}
                            >
                              <div className="location-type-radio">
                                {locationStatus === 'غیر فعال' && <div className="location-type-radio-dot"></div>}
                              </div>
                              <span>غیر فعال</span>
                            </div>
                          </div>
                        </div>

                        {!isActiveLayerPointBased && (
                          <div className="location-type-section">
                            <div className="location-type-label">مسقف بودن محدوده</div>
                            <div className="location-type-options">
                              <div
                                className={`location-type-option ${isPlaceCovered === true ? 'selected' : ''}`}
                                onClick={() => setIsPlaceCovered(true)}
                              >
                                <div className="location-type-radio">
                                  {isPlaceCovered === true && <div className="location-type-radio-dot"></div>}
                                </div>
                                <span>مسقف</span>
                              </div>
                              <div
                                className={`location-type-option ${isPlaceCovered === false ? 'selected' : ''}`}
                                onClick={() => setIsPlaceCovered(false)}
                              >
                                <div className="location-type-radio">
                                  {isPlaceCovered === false && <div className="location-type-radio-dot"></div>}
                                </div>
                                <span>غیر مسقف</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>



                    {/* Transportation Type Section - Multi-select */}
                    <div className="form-group">
                      <label className="form-label">نوع تردد زائرین محترم از این مکان</label>
                      <div className="radio-options-grid2"> {/* Keep original class */}
                        {TRANSPORT_OPTIONS.map((transport) => (
                          <div
                            key={transport.value}
                            className={`radio-option2 ${selectedTransport.includes(transport.value) ? 'selected' : ''}`}
                            onClick={() => {
                              if (selectedTransport.includes(transport.value)) {
                                setSelectedTransport(selectedTransport.filter(t => t !== transport.value));
                              } else {
                                setSelectedTransport([...selectedTransport, transport.value]);
                              }
                            }}
                          >
                            <div className="option-content">
                              <div className="icon-text">
                                {transport.icon === 'electric' && (
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    {/* SVG paths remain same */}
                                  </svg>
                                )}
                                {transport.icon === 'wheelchair' && (
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    {/* SVG paths remain same */}
                                  </svg>
                                )}
                                {transport.icon === 'walking' && (
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    {/* SVG paths remain same */}
                                  </svg>
                                )}
                                <span>{transport.label}</span>
                              </div>
                              <div className="checkbox-container">
                                {selectedTransport.includes(transport.value) ? (
                                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M10 20C5.28595 20 2.92893 20 1.46447 18.5355C0 17.0711 0 14.714 0 10C0 5.28595 0 2.92893 1.46447 1.46447C2.92893 0 5.28595 0 10 0C14.714 0 17.0711 0 18.5355 1.46447C20 2.92893 20 5.28595 20 10C20 14.714 20 17.0711 18.5355 18.5355C17.0711 20 14.714 20 10 20ZM14.0303 6.96967C14.3232 7.26256 14.3232 7.73744 14.0303 8.03033L9.03033 13.0303C8.73744 13.3232 8.26256 13.3232 7.96967 13.0303L5.96967 11.0303C5.67678 10.7374 5.67678 10.2626 5.96967 9.96967C6.26256 9.67678 6.73744 9.67678 7.03033 9.96967L8.5 11.4393L12.9697 6.96967C13.2626 6.67678 13.7374 6.67678 14.0303 6.96967Z" fill="#0F71EF" />
                                  </svg>
                                ) : (
                                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" stroke="#D9D9D9" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Gender Access Section - Multi-select */}
                    <div className="form-group">
                      <label className="form-label">جنسیت تردد زائرین محترم از این مکان</label>
                      <div className="radio-options-grid3"> {/* Keep original class */}
                        {GENDER_OPTIONS.map((genderOption) => (
                          <div
                            key={genderOption.value}
                            className={`radio-option3 ${selectedGenderAccess.includes(genderOption.value) ? 'selected' : ''}`}
                            onClick={() => {
                              if (selectedGenderAccess.includes(genderOption.value)) {
                                // setSelectedGenderAccess(selectedGenderAccess.filter(g => g !== genderOption.value));
                                setSelectedGenderAccess([]);
                              } else {
                                // setSelectedGenderAccess([...selectedGenderAccess, genderOption.value]);
                                setSelectedGenderAccess([genderOption.value]);
                              }
                            }}
                          >
                            <div className="option-content5">
                              <div className="radio-container">
                                {selectedGenderAccess.includes(genderOption.value) ? (
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <rect x="0.5" y="0.5" width="15" height="15" rx="7.5" stroke="white" />
                                    <circle cx="8.00065" cy="8.00004" r="4.00065" fill="white" />
                                  </svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <rect x="0.5" y="0.5" width="15" height="15" rx="7.5" stroke="#858585" />
                                  </svg>
                                )}
                              </div>
                              <span>مسیر مناسب {genderOption.label}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="step-content step3-content">
                  <div className="step-intro3">
                    <h3>فرم و فرایند ایجاد و افزودن یک نقطه و مکان جدید</h3>
                  </div>

                  <div className="form-section">
                    {/* Time-based Restrictions Section */}
                    <div className="restriction-section">
                      <div className="restriction-header">
                        <span className="restriction-title">محدودیت بر اساس روز، ساعت و جنسیت</span>
                        <button
                          className="add-restriction-btn"
                          onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                        >
                          افزودن محدودیت
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                            <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                          </svg>
                        </button>
                      </div>

                      {/* Display existing restrictions */}
                      {timeRestrictions.length > 0 && (
                        <div className="restrictions-display">
                          {timeRestrictions.map((restriction, index) => (
                            <div key={index} className="restriction-display-item">
                              <div className="restriction-info">
                                <span className="restriction-date">محدودیت های {restriction.date} ،</span>
                                <span className="restriction-gender">{restriction.gender.map(getGenderLabel).join('، ')} ،</span>
                                <span className="restriction-time">
                                  {restriction.timePairs.map((pair, idx) => (
                                    <span key={idx}>
                                      {pair.start} الی {pair.end}
                                      {idx < restriction.timePairs.length - 1 && '، '}
                                    </span>
                                  ))}
                                </span>
                              </div>
                              <button
                                className="remove-restriction-display-btn"
                                onClick={() => removeRestriction(index)}
                              >
                                <svg width="75" height="32" viewBox="0 0 75 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="0.5" y="0.5" width="74" height="31" rx="5.5" stroke="#EA4335" />
                                  <path fillRule="evenodd" clipRule="evenodd" d="M15.4099 13.1678C15.6855 13.1494 15.9237 13.3579 15.9421 13.6334L16.2487 18.2328C16.3086 19.1314 16.3513 19.7566 16.445 20.227C16.5359 20.6833 16.6628 20.9249 16.8451 21.0954C17.0274 21.2659 17.2768 21.3765 17.7381 21.4368C18.2137 21.499 18.8404 21.5 19.741 21.5H20.2565C21.1571 21.5 21.7838 21.499 22.2594 21.4368C22.7207 21.3765 22.9701 21.2659 23.1524 21.0954C23.3347 20.9249 23.4616 20.6833 23.5525 20.227C23.6462 19.7566 23.6889 19.1314 23.7488 18.2328L24.0554 13.6334C24.0738 13.3579 24.312 13.1494 24.5876 13.1678C24.8631 13.1862 25.0716 13.4244 25.0532 13.7L24.7442 18.3345C24.6872 19.1896 24.6412 19.8804 24.5332 20.4224C24.421 20.986 24.23 21.4567 23.8356 21.8256C23.4412 22.1946 22.9588 22.3538 22.3891 22.4284C21.8411 22.5001 21.1488 22.5 20.2917 22.5H19.7058C18.8488 22.5 18.1565 22.5001 17.6084 22.4284C17.0387 22.3538 16.5563 22.1946 16.1619 21.8256C15.7675 21.4567 15.5766 20.986 15.4643 20.4224C15.3563 19.8804 15.3103 19.1896 15.2533 18.3344L14.9443 13.7C14.9259 13.4244 15.1344 13.1862 15.4099 13.1678Z" fill="#EA4335" />
                                  <path fillRule="evenodd" clipRule="evenodd" d="M18.9023 9.50003L18.8716 9.50001C18.7273 9.49992 18.6017 9.49984 18.483 9.51879C18.0141 9.59366 17.6084 9.8861 17.3891 10.3072C17.3336 10.4138 17.2939 10.5331 17.2484 10.67L17.2387 10.6991L17.174 10.8932C17.1613 10.9312 17.1578 10.9417 17.1547 10.9502C17.038 11.2729 16.7353 11.4911 16.3922 11.4998C16.3832 11.5 16.3721 11.5 16.3321 11.5H14.332C14.0559 11.5 13.832 11.7239 13.832 12C13.832 12.2762 14.0559 12.5 14.332 12.5L16.3378 12.5L16.349 12.5H23.6486L23.6597 12.5L25.6654 12.5C25.9416 12.5 26.1654 12.2762 26.1654 12C26.1654 11.7239 25.9416 11.5 25.6654 11.5H23.6654C23.6254 11.5 23.6143 11.5 23.6053 11.4998C23.2622 11.4911 22.9595 11.2729 22.8428 10.9501C22.8397 10.9417 22.8361 10.931 22.8235 10.8932L22.7588 10.6991L22.7491 10.67C22.7036 10.5331 22.6639 10.4138 22.6084 10.3072C22.3891 9.8861 21.9834 9.59366 21.5145 9.51879C21.3958 9.49984 21.2702 9.49992 21.1259 9.50001L21.0952 9.50003H18.9023ZM18.0951 11.2903C18.0689 11.3627 18.0385 11.4327 18.0041 11.5H21.9934C21.959 11.4327 21.9286 11.3627 21.9024 11.2903L21.8766 11.2148L21.8101 11.0153C21.7493 10.8329 21.7354 10.7958 21.7215 10.7691C21.6484 10.6287 21.5131 10.5312 21.3568 10.5063C21.3272 10.5015 21.2875 10.5 21.0952 10.5H18.9023C18.7101 10.5 18.6704 10.5015 18.6407 10.5063C18.4844 10.5312 18.3491 10.6287 18.276 10.7691C18.2622 10.7958 18.2482 10.8329 18.1874 11.0153L18.1208 11.2149C18.1108 11.2449 18.103 11.2683 18.0951 11.2903Z" fill="#EA4335" />
                                  <path d="M38.7759 20C37.7026 20 36.8953 19.9907 36.3539 19.972C35.8219 19.944 35.4253 19.9067 35.1639 19.86C34.9119 19.8133 34.6646 19.734 34.4219 19.622C33.9926 19.4353 33.6659 19.1647 33.4419 18.81C33.2273 18.4553 33.1199 18.04 33.1199 17.564C33.1199 17.2747 33.1619 16.9713 33.2459 16.654L33.7639 14.68L34.7859 14.988L34.2679 17.004C34.2119 17.228 34.1839 17.424 34.1839 17.592C34.1839 17.816 34.2353 18.0073 34.3379 18.166C34.4499 18.3153 34.6179 18.4413 34.8419 18.544C35.0006 18.6187 35.1826 18.6747 35.3879 18.712C35.6026 18.7493 35.9713 18.7773 36.4939 18.796C37.0166 18.8147 37.8006 18.824 38.8459 18.824H41.6319C42.1826 18.824 42.5933 18.8007 42.8639 18.754C43.1346 18.7073 43.3213 18.628 43.4239 18.516C43.5266 18.3947 43.5779 18.2173 43.5779 17.984C43.5779 17.844 43.5733 17.732 43.5639 17.648C43.0226 17.732 42.4346 17.774 41.7999 17.774C41.1186 17.774 40.5726 17.578 40.1619 17.186C39.7606 16.7847 39.5599 16.2387 39.5599 15.548C39.5599 15.0627 39.6486 14.61 39.8259 14.19C40.0126 13.77 40.2833 13.434 40.6379 13.182C41.0019 12.9207 41.4359 12.79 41.9399 12.79C42.6119 12.79 43.1719 13.042 43.6199 13.546C44.0773 14.05 44.3433 14.722 44.4179 15.562L44.5719 17.48C44.5906 17.76 44.5999 17.9513 44.5999 18.054C44.5999 18.53 44.5113 18.908 44.3339 19.188C44.1659 19.468 43.8626 19.6733 43.4239 19.804C42.9946 19.9347 42.3879 20 41.6039 20H38.8459H38.7759ZM40.5399 15.408C40.5399 15.8 40.6519 16.1127 40.8759 16.346C41.0999 16.57 41.4079 16.682 41.7999 16.682C42.3786 16.682 42.9339 16.6353 43.4659 16.542L43.3959 15.66C43.3306 15.0907 43.1626 14.652 42.8919 14.344C42.6306 14.0267 42.2993 14.868 41.8979 13.868C41.4779 13.868 41.1466 14.022 40.9039 14.33C40.6613 14.6287 40.5399 14.988 40.5399 15.408ZM41.2959 10.088H42.7099V11.488H41.2959V10.088ZM48.5068 20C47.8161 20 47.2655 19.8647 46.8548 19.594C46.4535 19.314 46.2295 18.95 46.1828 18.502C46.1361 18.306 46.1128 17.998 46.1128 17.578H47.0928C47.0928 17.8673 47.1115 18.1007 47.1488 18.278C47.1861 18.474 47.2981 18.614 47.4848 18.698C47.6808 18.782 47.9655 18.824 48.3388 18.824H49.1928C50.1728 18.824 50.6628 18.53 50.6628 17.942C50.6628 17.8767 50.6441 17.76 50.6068 17.592V17.564L49.5568 13.448L50.5928 13.168L51.6428 17.298C51.7361 17.662 51.8201 17.9467 51.8948 18.152C51.9788 18.348 52.0908 18.5113 52.2308 18.642C52.3708 18.7633 52.5575 18.824 52.7908 18.824H53.4768L53.5468 19.412L53.4768 20H52.7908C52.1655 20 51.6615 19.7387 51.2788 19.216C50.8308 19.7387 50.0888 20 49.0528 20H48.5068ZM49.1788 10.704H50.5788V12.104H49.1788V10.704ZM53.3362 18.824H53.5323C54.3629 18.824 55.0583 18.8053 55.6183 18.768C56.1783 18.7213 56.7523 18.614 57.3403 18.446L60.6303 17.564L57.7883 15.94C57.5083 15.772 57.2189 15.688 56.9203 15.688C56.6309 15.688 56.3556 15.772 56.0943 15.94C55.8329 16.0987 55.6229 16.3227 55.4642 16.612L55.2123 17.046L54.2883 16.472L54.5543 15.996C54.8156 15.52 55.1516 15.1513 55.5623 14.89C55.9823 14.6287 56.4303 14.498 56.9062 14.498C57.3916 14.498 57.8583 14.6333 58.3063 14.904L61.8763 17.06L61.7083 18.432L57.6063 19.594C56.9529 19.7713 56.3229 19.8833 55.7163 19.93C55.1096 19.9767 54.3769 20 53.5183 20H53.3362V18.824Z" fill="#EA4335" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Date Filter Popup */}
                      {isDateFilterOpen && !restrictionFormOpen && (
                        <div className={`date-filter-popup ${selectedDateFilter.includes('انتخاب از تقویم') ? 'calendar-selectable' : ''}`}>
                          <div className="date-filter-content">
                            {/* Filter by Date Section */}
                            <div className="filter-section">
                              <div className="date-filter-option2">
                                <div className="filter-title">فیلتر بر اساس تاریخ</div>
                                <div
                                  className={`date-filter-option ${selectedDateFilter.includes('کل روز') ? 'selected' : ''}`}
                                  onClick={() => handleDateFilterToggle('کل روز')}
                                >
                                  همه روزه
                                </div>
                                <div
                                  className={`date-filter-option ${selectedDateFilter.includes('تمام این ماه') ? 'selected' : ''}`}
                                  onClick={() => handleDateFilterToggle('تمام این ماه')}
                                >
                                  تمام این ماه
                                </div>
                                <div
                                  className={`date-filter-option ${selectedDateFilter.includes('کل این هفته') ? 'selected' : ''}`}
                                  onClick={() => handleDateFilterToggle('کل این هفته')}
                                >
                                  کل این هفته
                                </div>
                              </div>
                              <div
                                className={`calendar-select-option ${selectedDateFilter.includes('انتخاب از تقویم') ? 'selected' : ''}`}
                                onClick={() => handleDateFilterToggle('انتخاب از تقویم')}
                              >
                                انتخاب از تقویم
                              </div>
                            </div>

                            {/* Select from Calendar Section */}
                            <div className="filter-section">
                              <div className="jalali-calendar">
                                {/* Calendar Header with Month/Year Selection */}
                                <div className="calendar-header">
                                  <div className="month-year-selector">
                                    <select
                                      value={calendarDate.month}
                                      onChange={(e) => setCalendarDate(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                                      className="month-select"
                                    >
                                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                        <option key={month} value={month}>
                                          {getJalaliMonthName(month)}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={calendarDate.year}
                                      onChange={(e) => setCalendarDate(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                                      className="year-select"
                                    >
                                      {jalaliYearOptions.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="calendar-nav">
                                    <button
                                      className="nav-btn prev"
                                      onClick={handlePrevMonth}
                                    >
                                      ‹
                                    </button>
                                    <button
                                      className="nav-btn next"
                                      onClick={handleNextMonth}
                                    >
                                      ›
                                    </button>
                                  </div>
                                </div>

                                {/* Day Names */}
                                <div className="day-names">
                                  <div className="day-name">ش</div>
                                  <div className="day-name">یک</div>
                                  <div className="day-name">دو</div>
                                  <div className="day-name">سه</div>
                                  <div className="day-name">چهار</div>
                                  <div className="day-name">پنج</div>
                                  <div className="day-name">ج</div>
                                </div>

                                {/* Calendar Days Grid */}
                                <div className="calendar-days">
                                  {renderJalaliCalendarDays()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Restriction Form (shown after selection) */}
                      {restrictionFormOpen && selectedRestrictionType && (
                        <div className="restriction-form-container">
                          {/* Black header with title and close button */}
                          <div className="restriction-form-header">
                            <div className="restriction-title-black">
                              <span className="restriction-label">محدودیت‌های</span>
                              <span className="restriction-value">{getRestrictionTitle()}</span>
                            </div>
                            <button
                              className="close-restriction-btn"
                              onClick={handleCloseRestrictionForm}
                            >
                              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="0.5" y="0.5" width="31" height="31" rx="5.5" stroke="#EA4335" />
                                <path fillRule="evenodd" clipRule="evenodd" d="M22.6654 16C22.6654 19.6819 19.6806 22.6666 15.9987 22.6666C12.3168 22.6666 9.33203 19.6819 9.33203 16C9.33203 12.3181 12.3168 9.33331 15.9987 9.33331C19.6806 9.33331 22.6654 12.3181 22.6654 16ZM13.9784 13.9797C14.1737 13.7845 14.4903 13.7845 14.6856 13.9797L15.9987 15.2929L17.3118 13.9798C17.507 13.7845 17.8236 13.7845 18.0189 13.9798C18.2142 14.175 18.2142 14.4916 18.0189 14.6869L16.7058 16L18.0189 17.3131C18.2141 17.5083 18.2141 17.8249 18.0189 18.0202C17.8236 18.2154 17.507 18.2154 17.3118 18.0202L15.9987 16.7071L14.6856 18.0202C14.4903 18.2154 14.1737 18.2154 13.9785 18.0202C13.7832 17.8249 13.7832 17.5083 13.9785 17.3131L15.2916 16L13.9784 14.6869C13.7832 14.4916 13.7832 14.175 13.9784 13.9797Z" fill="#EA4335" />
                              </svg>
                            </button>
                          </div>

                          {/* Gender Restrictions */}
                          <div className="gender-restrictions-section">
                            <div className="section-title3">محدودسازی جنسیتی برای تردد</div>
                            <div className="gender-options">
                              {GENDER_OPTIONS.map((genderOption) => (
                                <div
                                  key={genderOption.value}
                                  className={`gender-option ${selectedGenderRestrictions.includes(genderOption.value) ? 'selected' : ''}`}
                                  onClick={() => handleGenderRestrictionToggle(genderOption.value)}
                                >
                                  <div className="gender-checkbox">
                                    {selectedGenderRestrictions.includes(genderOption.value) ? (
                                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" fill="#0F71EF" stroke="#0F71EF" />
                                        <path fillRule="evenodd" clipRule="evenodd" d="M14.0303 6.96967C14.3232 7.26256 14.3232 7.73744 14.0303 8.03033L9.03033 13.0303C8.73744 13.3232 8.26256 13.3232 7.96967 13.0303L5.96967 11.0303C5.67678 10.7374 5.67678 10.2626 5.96967 9.96967C6.26256 9.67678 6.73744 9.67678 7.03033 9.96967L8.5 11.4393L12.9697 6.96967C13.2626 6.67678 13.7374 6.67678 14.0303 6.96967Z" fill="white" />
                                      </svg>
                                    ) : (
                                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" stroke="#D9D9D9" />
                                      </svg>
                                    )}
                                  </div>
                                  <span>{genderOption.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Time Restrictions */}
                          <div className="time-restrictions-section">
                            <div className="section-title5">محدودسازی زمانی برای تردد
                              <button
                                className="add-time-btn"
                                onClick={handleAddTimeRestriction}
                                disabled={limitAllHours || timeRestrictionPairs.length >= 4}
                              >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" clipRule="evenodd" d="M10.0013 18.3333C14.6037 18.3333 18.3346 14.6023 18.3346 9.99996C18.3346 5.39759 14.6037 1.66663 10.0013 1.66663C5.39893 1.66663 1.66797 5.39759 1.66797 9.99996C1.66797 14.6023 5.39893 18.3333 10.0013 18.3333ZM10.6263 7.49996C10.6263 7.15478 10.3465 6.87496 10.0013 6.87496C9.65612 6.87496 9.3763 7.15478 9.3763 7.49996L9.3763 9.37498H7.5013C7.15612 9.37498 6.8763 9.6548 6.8763 9.99998C6.8763 10.3452 7.15612 10.625 7.5013 10.625H9.3763V12.5C9.3763 12.8451 9.65612 13.125 10.0013 13.125C10.3465 13.125 10.6263 12.8451 10.6263 12.5L10.6263 10.625H12.5013C12.8465 10.625 13.1263 10.3452 13.1263 9.99998C13.1263 9.6548 12.8465 9.37498 12.5013 9.37498H10.6263V7.49996Z" fill="#14C472" />
                                </svg>
                              </button>
                            </div>

                            {/* Time Restriction Pairs Grid with scrollable container when many items */}
                            <div className={`time-pairs-scrollable-container ${timeRestrictionPairs.length > 2 ? 'scrollable' : ''}`}>
                              <div className={`time-pairs-grid ${timeRestrictionPairs.length > 2 ? 'multi-row' : ''}`}>
                                {timeRestrictionPairs.map((pair, index) => (
                                  <div key={index} className="time-pair">
                                    <div className="time-inputs">
                                      <div className="time-input-group">
                                        <label>شروع:</label>
                                        <input
                                          type="time"
                                          value={pair.start}
                                          onChange={(e) => handleTimeChange(index, 'start', e.target.value)}
                                          disabled={limitAllHours}
                                          className="time-input"
                                          style={{
                                            /* Inline style to ensure Firefox works */
                                            WebkitAppearance: 'none',
                                            MozAppearance: 'textfield'
                                          }}
                                        />
                                      </div>
                                      <div className="time-input-group">
                                        <label>پایان :</label>
                                        <input
                                          type="time"
                                          value={pair.end}
                                          onChange={(e) => handleTimeChange(index, 'end', e.target.value)}
                                          disabled={limitAllHours}
                                          className="time-input"
                                        />
                                      </div>
                                    </div>
                                    {timeRestrictionPairs.length > 1 && (
                                      <button
                                        className="remove-time-btn"
                                        onClick={() => handleRemoveTimeRestriction(index)}
                                        disabled={limitAllHours}
                                      >
                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M9.45597 18.3333H10.13C12.4489 18.3333 13.6084 18.3333 14.3622 17.578C15.1161 16.8227 15.1932 15.5837 15.3475 13.1058L15.5697 9.53534C15.6534 8.19086 15.6953 7.51861 15.3171 7.09262C14.9389 6.66663 14.3002 6.66663 13.0229 6.66663H6.56301C5.28569 6.66663 4.64704 6.66663 4.26885 7.09262C3.89065 7.51861 3.9325 8.19086 4.0162 9.53535L4.23846 13.1058C4.39272 15.5837 4.46984 16.8227 5.22371 17.578C5.97758 18.3333 7.13704 18.3333 9.45597 18.3333Z" fill="#EA4335" />
                                          <path d="M2.29297 5.13885C2.29297 4.75533 2.58079 4.44442 2.93583 4.44442L5.15603 4.44404C5.59716 4.43197 5.98632 4.12897 6.13642 3.68072C6.14037 3.66893 6.1449 3.6544 6.16118 3.60165L6.25685 3.29157C6.31539 3.10145 6.36639 2.93581 6.43776 2.78776C6.71971 2.20287 7.24137 1.79671 7.84419 1.69273C7.99678 1.6664 8.15837 1.66652 8.34385 1.66664H11.2422C11.4277 1.66652 11.5893 1.6664 11.7419 1.69273C12.3447 1.79671 12.8664 2.20287 13.1483 2.78776C13.2197 2.93581 13.2707 3.10145 13.3292 3.29157L13.4249 3.60165C13.4412 3.6544 13.4457 3.66893 13.4497 3.68072C13.5998 4.12897 14.0661 4.43234 14.5073 4.44442H16.6501C17.0052 4.44442 17.293 4.75533 17.293 5.13885C17.293 5.52238 17.0052 5.83329 16.6501 5.83329H2.93583C2.58079 5.83329 2.29297 5.52238 2.29297 5.13885Z" fill="#EA4335" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="time-restrictions-footer">
                              <div
                                className="all-hours-option"
                                onClick={() => {
                                  setLimitAllHours(!limitAllHours);
                                  if (!limitAllHours) {
                                    setTimeRestrictionPairs([{ start: '', end: '' }]);
                                  }
                                }}
                              >
                                <div className="all-hours-checkbox">
                                  {limitAllHours ? (
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" fill="#0F71EF" stroke="#0F71EF" />
                                      <path fillRule="evenodd" clipRule="evenodd" d="M14.0303 6.96967C14.3232 7.26256 14.3232 7.73744 14.0303 8.03033L9.03033 13.0303C8.73744 13.3232 8.26256 13.3232 7.96967 13.0303L5.96967 11.0303C5.67678 10.7374 5.67678 10.2626 5.96967 9.96967C6.26256 9.67678 6.73744 9.67678 7.03033 9.96967L8.5 11.4393L12.9697 6.96967C13.2626 6.67678 13.7374 6.67678 14.0303 6.96967Z" fill="white" />
                                    </svg>
                                  ) : (
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" stroke="#D9D9D9" />
                                    </svg>
                                  )}
                                </div>
                                <span>محدودیت برای تمام ساعات روز</span>
                              </div>
                              <button
                                className="confirm-restriction-btn"
                                onClick={handleConfirmRestriction}
                                disabled={!isRestrictionFormValid()}
                              >
                                تایید و افزودن محدودیت زمانی
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Prayer Time Restrictions Section (unchanged) */}
                    <div className="restriction-section">
                      <div className="restriction-header">
                        <span className="restriction-title">محدودیت بر اساس اوقات شرعی (برای همه روزها)</span>
                        <button
                          className="add-restriction-btn"
                          onClick={() => {
                            // open prayer calendar popup (independent)
                            setIsPrayerDateFilterOpen(prev => !prev);
                            // ensure other popups are closed (avoid conflicts)
                            setIsDateFilterOpen(false);
                            setRestrictionFormOpen(false);
                          }}
                        >
                          افزودن محدودیت
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                            <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                          </svg>
                        </button>
                      </div>
                      {prayerRestrictionFormOpen && (
                        <div className="prayer-form">
                          <div className="prayer-form-grid">
                            <div className="form-column">
                              <label className="form-label">انتخاب رویداد</label>
                              <div className="prayer-event-grid">
                                {PRAYER_EVENT_OPTIONS.map((option) => (
                                  <div
                                    key={option.value}
                                    className={`prayer-event-option ${selectedPrayerEvents.includes(option.value) ? 'selected' : ''}`}
                                    onClick={() => togglePrayerEvent(option.value)}
                                  >
                                    {selectedPrayerEvents.includes(option.value) ? (
                                      <svg width="22" height="22" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#0F71EF" /></svg>
                                    ) : (
                                      <svg width="22" height="22" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#fff" stroke="#D9D9D9" /></svg>
                                    )}
                                    <span className="event-label">{option.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="form-column">
                              <label className="form-label">محدودسازی زمانی برای تردد</label>
                              <div className="minutes-inputs-grid">
                                <input
                                  type="number"
                                  min="0"
                                  className="minute-input"
                                  placeholder="دقیقه قبل از شروع: --"
                                  value={prayerBeforeMinutes}
                                  onChange={(e) => setPrayerBeforeMinutes(e.target.value)}
                                />
                                <input
                                  type="number"
                                  min="0"
                                  className="minute-input"
                                  placeholder="دقیقه قبل از پایان: --"
                                  value={prayerAfterMinutes}
                                  onChange={(e) => setPrayerAfterMinutes(e.target.value)}
                                />
                              </div>

                              <div className="prayer-form-actions">
                                <button
                                  className="confirm-prayer-btn"
                                  onClick={() => {
                                    // Validation (simple)
                                    if (selectedPrayerEvents.length === 0 || prayerBeforeMinutes === '' || prayerAfterMinutes === '') {
                                      alert('لطفا همه فیلدها را تکمیل کنید');
                                      return;
                                    }
                                    // Create new item
                                    const eventLabels = selectedPrayerEvents.map(prayerEventValueToLabel);
                                    const title = eventLabels.join(' و ') + ` : ${prayerBeforeMinutes} دقیقه قبل الی ${prayerAfterMinutes} دقیقه بعد`;
                                    const dateLabel = getPrayerDateLabel();
                                    const newItem = {
                                      id: Date.now(),
                                      events: [...selectedPrayerEvents],
                                      before: String(prayerBeforeMinutes),
                                      after: String(prayerAfterMinutes),
                                      date: dateLabel,
                                      isoDateScope: buildDateScopeIso(
                                        dateLabel,
                                        prayerSelectedJalaliDate,
                                        prayerSelectedJalaliEndDate
                                      ),
                                      title
                                    };
                                    const { dedupKey: newKey } = getPrayerRestrictionParts(newItem);
                                    setPrayerTimeRestrictionsList((prev) => {
                                      const filtered = prev.filter((item) => {
                                        const { dedupKey } = getPrayerRestrictionParts(item);
                                        return dedupKey !== newKey;
                                      });
                                      return [...filtered, newItem];
                                    });
                                    // reset form
                                    setSelectedPrayerEvents([]);
                                    setPrayerBeforeMinutes('');
                                    setPrayerAfterMinutes('');
                                    setPrayerSelectedJalaliDate(null);
                                    setPrayerSelectedJalaliEndDate(null);
                                    setPrayerRestrictionFormOpen(false);
                                  }}
                                >
                                  تایید و افزودن محدودیت اوقات شرعی
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {isPrayerDateFilterOpen && !prayerRestrictionFormOpen && (
                        <div className="prayer-date-filter-popup">
                          <div className="date-filter-content">
                            {/* Filter by Date Section (same options as first calendar) */}
                            <div className="filter-section">
                              <div className="date-filter-option2">
                                <div className="filter-title">فیلتر بر اساس تاریخ</div>
                                <div
                                  className={`date-filter-option`}
                                  onClick={() => {
                                    // if admin wants "همه روزها" for prayer, we can set directly; keeping same behavior as original
                                    setPrayerSelectedJalaliDate(null);
                                    setPrayerRestrictionFormOpen(true);
                                    setIsPrayerDateFilterOpen(false);
                                  }}
                                >
                                  همه روزه
                                </div>
                                <div
                                  className="date-filter-option"
                                  onClick={() => {
                                    // full month
                                    setPrayerSelectedJalaliDate(null);
                                    setPrayerRestrictionFormOpen(true);
                                    setIsPrayerDateFilterOpen(false);
                                  }}
                                >
                                  تمام این ماه
                                </div>
                                <div
                                  className="date-filter-option"
                                  onClick={() => {
                                    setPrayerSelectedJalaliDate(null);
                                    setPrayerRestrictionFormOpen(true);
                                    setIsPrayerDateFilterOpen(false);
                                  }}
                                >
                                  کل این هفته
                                </div>
                              </div>

                              <div
                                className="calendar-select-option selected"
                              // ensure same look/feel; clicking stays in calendar mode below
                              >
                                انتخاب از تقویم
                              </div>
                            </div>

                            {/* Calendar (Jalali) - uses prayerCalendarDate and renderPrayerJalaliCalendarDays */}
                            <div className="filter-section">
                              <div className="jalali-calendar">
                                <div className="calendar-header">
                                  <div className="month-year-selector">
                                    <select
                                      value={prayerCalendarDate.month}
                                      onChange={(e) => setPrayerCalendarDate(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                                      className="month-select"
                                    >
                                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                        <option key={month} value={month}>
                                          {getJalaliMonthName(month)}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={prayerCalendarDate.year}
                                      onChange={(e) => setPrayerCalendarDate(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                                      className="year-select"
                                    >
                                      {jalaliYearOptions.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="calendar-nav">
                                    <button className="nav-btn" onClick={handlePrayerPrevMonth}>‹</button>
                                    <button className="nav-btn" onClick={handlePrayerNextMonth}>›</button>
                                  </div>
                                </div>

                                <div className="day-names">
                                  <div className="day-name">ش</div>
                                  <div className="day-name">ی</div>
                                  <div className="day-name">د</div>
                                  <div className="day-name">س</div>
                                  <div className="day-name">چ</div>
                                  <div className="day-name">پ</div>
                                  <div className="day-name">ج</div>
                                </div>

                                <div className="calendar-days">
                                  {renderPrayerJalaliCalendarDays()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {prayerTimeRestrictionsList.length > 0 && (
                      <div className="prayer-restrictions-list">
                        {prayerTimeRestrictionsList.map((item, idx) => (
                          <div key={item.id} className="prayer-restriction-row">
                            <div className="prayer-restriction-badge">
                              <span className="prayer-restriction-text">{item.date} ، {item.title}</span>
                            </div>
                            <button className="remove-prayer-btn" onClick={() => {
                              setPrayerTimeRestrictionsList(prev => prev.filter((_, i) => i !== idx));
                            }}>
                              حذف
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M3.40994 5.1678C3.68547 5.14943 3.92372 5.3579 3.94209 5.63343L4.24872 10.2328C4.30862 11.1314 4.35131 11.7566 4.44502 12.227C4.53592 12.6833 4.66281 12.9249 4.84508 13.0954C5.02736 13.2659 5.2768 13.3765 5.73813 13.4368C6.21373 13.499 6.8404 13.5 7.74097 13.5H8.25654C9.1571 13.5 9.78377 13.499 10.2594 13.4368C10.7207 13.3765 10.9701 13.2659 11.1524 13.0954C11.3347 12.9249 11.4616 12.6833 11.5525 12.227C11.6462 11.7566 11.6889 11.1314 11.7488 10.2328L12.0554 5.63343C12.0738 5.3579 12.312 5.14943 12.5876 5.1678C12.8631 5.18617 13.0716 5.42442 13.0532 5.69995L12.7442 10.3345C12.6872 11.1896 12.6412 11.8804 12.5332 12.4224C12.421 12.986 12.23 13.4567 11.8356 13.8256C11.4412 14.1946 10.9588 14.3538 10.3891 14.4284C9.84105 14.5001 9.14876 14.5 8.2917 14.5H7.70581C6.84875 14.5 6.15646 14.5001 5.60843 14.4284C5.03866 14.3538 4.5563 14.1946 4.1619 13.8256C3.7675 13.4567 3.57656 12.986 3.46429 12.4224C3.35631 11.8804 3.31027 11.1896 3.25327 10.3344L2.94431 5.69995C2.92594 5.42442 3.13441 5.18617 3.40994 5.1678Z" fill="#EA4335" />
                                <path fillRule="evenodd" clipRule="evenodd" d="M6.90226 1.50003L6.87161 1.50001C6.72734 1.49992 6.60166 1.49984 6.48298 1.51879C6.01412 1.59366 5.60838 1.8861 5.38909 2.30723C5.33358 2.41382 5.29391 2.53309 5.24838 2.66998L5.2387 2.69905L5.17397 2.89323C5.16131 2.93121 5.15778 2.94168 5.15471 2.95016C5.03797 3.2729 4.73529 3.49106 4.39219 3.49976C4.38317 3.49999 4.37212 3.50003 4.33209 3.50003H2.33203C2.05589 3.50003 1.83203 3.72388 1.83203 4.00003C1.83203 4.27617 2.05589 4.50003 2.33203 4.50003L4.3378 4.50003L4.34896 4.50003H11.6486L11.6597 4.50003L13.6654 4.50003C13.9416 4.50003 14.1654 4.27617 14.1654 4.00003C14.1654 3.72388 13.9416 3.50003 13.6654 3.50003H11.6654C11.6254 3.50003 11.6143 3.49999 11.6053 3.49976C11.2622 3.49106 10.9595 3.27289 10.8428 2.95014C10.8397 2.94172 10.8361 2.93102 10.8235 2.89323L10.7588 2.69905L10.7491 2.66996C10.7036 2.53307 10.6639 2.41382 10.6084 2.30723C10.3891 1.8861 9.98339 1.59366 9.51453 1.51879C9.39585 1.49984 9.27016 1.49992 9.1259 1.50001L9.09525 1.50003H6.90226ZM6.09508 3.29032C6.0689 3.36269 6.03847 3.43268 6.00413 3.50003H9.99338C9.95904 3.43268 9.92861 3.3627 9.90243 3.29033L9.87662 3.21477L9.81013 3.01528C9.74934 2.83294 9.73535 2.79575 9.72147 2.76909C9.64837 2.62872 9.51313 2.53124 9.35684 2.50628C9.32715 2.50154 9.28746 2.50003 9.09525 2.50003H6.90226C6.71005 2.50003 6.67035 2.50154 6.64067 2.50628C6.48438 2.53124 6.34914 2.62872 6.27604 2.76909C6.26216 2.79575 6.24816 2.83294 6.18738 3.01528L6.12085 3.21489C6.11083 3.24495 6.10303 3.26834 6.09508 3.29032Z" fill="#EA4335" />
                              </svg>

                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - UNCHANGED */}
            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => {
                  setIsAddPlaceModalOpen(false);
                  resetForm();
                }}
              >
                لغو و بازگشت
              </button>
              {(!isEditingDoorInfo || currentStep === 3) && (
                <button
                  className="confirm-btn"
                  onClick={handleAddPlaceConfirm}
                  disabled={isSavingPlaceInfo || isLoadingPlaceInfo}
                >
                  {isSavingPlaceInfo
                    ? 'در حال ذخیره اطلاعات...'
                    : isLoadingPlaceInfo
                      ? 'در حال بارگذاری اطلاعات...'
                      : currentStep === 3
                        ? 'تایید اطلاعات و ثبت این مکان '
                        : 'تایید اطلاعات و مرحله بعد'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Edit Category Modal */}
      {isEditCategoryModalOpen && (
        <div className="modal-overlay">
          <div className="edit-category-modal">
            <div className="modal-header">
              <h3>ویرایش دسته بندی <span className="category-name-highlight">{editCategoryData.title}</span></h3>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label className="form-label">اطلاعات اولیه دسته بندی</label>

                {/* Title with language button */}
                <div className="section-title8">عنوان</div>
                <div className="title-input-with-language7">
                  <input
                    type="text"
                    className="form-input"
                    value={editCategoryData.title}
                    onChange={(e) => setEditCategoryData({ ...editCategoryData, title: e.target.value })}
                    placeholder="عنوان دسته بندی (فارسی)"
                  />
                  <button
                    className="language-input-btn12"
                    type="button"
                    onClick={() => setIsEditCategoryTitleLanguageModalOpen(true)}
                    title="ورود عنوان به زبان‌های دیگر"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                <div className="section-title8">توضیحات دسته بندی</div>
                <textarea
                  className="form-textarea"
                  value={editCategoryData.description}
                  onChange={(e) => setEditCategoryData({ ...editCategoryData, description: e.target.value })}
                  placeholder=" توضیحات خودتان را وارد کنید"
                  rows="4"
                />

                {/* Icon upload with preview */}
                <div className="icon-upload-section">
                  <div className="section-title8"> نماد و تصویر</div>
                  <div className="icon-upload-container">
                    <div className="icon-preview">
                      {editCategoryData.icon ? (
                        <div className="icon-preview-image">
                          <img
                            src={editCategoryData.icon instanceof File ? URL.createObjectURL(editCategoryData.icon) : buildIconUrl(editCategoryData.icon)}
                            alt="آیکون دسته بندی"
                            className="icon-preview-img"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const parent = e.target.parentElement;
                              const fallback = parent.querySelector('.icon-preview-fallback');
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="icon-preview-fallback" style={{ display: 'none' }}>
                            <span>تصویر آپلود شده</span>
                          </div>
                        </div>
                      ) : (
                        <div className="icon-placeholder">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" fill="#858585" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="icon-upload-actions">
                      <button
                        type="button"
                        className="upload-icon-btn"
                        onClick={() => openIconPicker('edit')}
                      >
                        {editCategoryData.icon ? 'تغییر نماد' : 'ایجاد نماد'}
                      </button>
                      {editCategoryData.icon && (
                        <button
                          className="remove-icon-btn"
                          onClick={() => {
                            setEditCategoryData({ ...editCategoryData, icon: null });
                            setIsIconUploaded(false);
                          }}
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* NEW Subgroup section with count and buttons */}
              <div className="subcategory-management-section">
                <div className="section-title8">زیرگروه‌های دسته بندی</div>

                <div className="subgroup-stats-container">
                  <div className="subgroup-count-display">
                    <div className="subgroup-count-label">تعداد زیرگروه‌ها : </div>
                    <div className="subgroup-count-number">
                      {categories.find(cat => cat.id === editingCategoryId)?.numSubcategories || 0}
                    </div>
                  </div>

                  <div className="subgroup-actions-container">
                    {/* + Button for adding new subcategory */}
                    <button
                      className="add-subgroup-btn-small"
                      onClick={handleAddSubcategoryInModal}
                      title="افزودن زیرگروه جدید"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M10.0003 18.3334C14.6027 18.3334 18.3337 14.6024 18.3337 10C18.3337 5.39765 14.6027 1.66669 10.0003 1.66669C5.39795 1.66669 1.66699 5.39765 1.66699 10C1.66699 14.6024 5.39795 18.3334 10.0003 18.3334ZM10.6253 7.50002C10.6253 7.15484 10.3455 6.87502 10.0003 6.87502C9.65515 6.87502 9.37533 7.15484 9.37533 7.50002L9.37532 9.37504H7.50033C7.15515 9.37504 6.87533 9.65486 6.87533 10C6.87533 10.3452 7.15515 10.625 7.50033 10.625H9.37532V12.5C9.37532 12.8452 9.65515 13.125 10.0003 13.125C10.3455 13.125 10.6253 12.8452 10.6253 12.5L10.6253 10.625H12.5003C12.8455 10.625 13.1253 10.3452 13.1253 10C13.1253 9.65486 12.8455 9.37504 12.5003 9.37504H10.6253V7.50002Z" fill="#139B3C" />
                      </svg>
                    </button>

                    {/* Button to view all subcategories */}
                    <button
                      className="view-all-subgroups-btn"
                      onClick={() => setShowSubcategoriesModal(true)}
                    >
                      <span>مشاهده همه</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="divider"></div>

              <div className="form-group">وضعیت دسته بندی</div>

              <div className="status-section">
                <div className="status-options-horizontal">
                  <div
                    className={`status-option-horizontal ${editCategoryData.status === 'active' ? 'selected' : ''}`}
                    onClick={() => setEditCategoryData({ ...editCategoryData, status: 'active' })}
                  >
                    <div className="status-radio-horizontal">
                      {editCategoryData.status === 'active' && <div className="status-radio-dot"></div>}
                    </div>
                    <span>فعال می‌باشد</span>
                  </div>
                  <div
                    className={`status-option-horizontal ${editCategoryData.status === 'inactive' ? 'selected' : ''}`}
                    onClick={() => setEditCategoryData({ ...editCategoryData, status: 'inactive' })}
                  >
                    <div className="status-radio-horizontal">
                      {editCategoryData.status === 'inactive' && <div className="status-radio-dot"></div>}
                    </div>
                    <span>غیرفعال سازی</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setIsEditCategoryModalOpen(false)}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={handleUpdateCategory}
              >
                تایید و ویرایش
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="delete-confirmation-modal">
            <div className="modal-header">
              <p>آیا از حذف این اطلاعات فرهنگی اطمینان دارید؟</p>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                لغو
              </button>
              <button
                className="confirm-btn delete-confirm-btn"
                onClick={confirmDeleteCategory}
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateCategoryModalOpen && (
        <div className="modal-overlay">
          <div className="create-category-modal">
            <div className="modal-header">
              <h3>ایجاد دسته بندی جدید</h3>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label className="form-label">اطلاعات اولیه دسته بندی</label>

                {/* Title input with language button */}
                <div className="title-input-with-language">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="عنوان دسته بندی را بنویسید (فارسی)"
                    value={newCategory.title}
                    onChange={(e) => setNewCategory({ ...newCategory, title: e.target.value })}
                  />
                  <button
                    className="language-input-btn3"
                    type="button"
                    onClick={() => setIsCategoryTitleLanguageModalOpen(true)}
                    title="ورود عنوان به زبان‌های دیگر"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                <textarea
                  className="form-textarea"
                  placeholder="توضیحات دسته بندی را بنویسید"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  rows="3"
                />

                {/* Icon upload section with preview */}
                <div className="icon-upload-section-simple">
                  <div className="icon-upload-preview-container">
                    {newCategory.image ? (
                      <div className="icon-preview-wrapper">
                        <img
                          src={newCategory.image instanceof File ? URL.createObjectURL(newCategory.image) : buildIconUrl(newCategory.image)}
                          alt="آیکون دسته بندی"
                          className="icon-preview"
                        />
                        <button
                          className="remove-icon-btn"
                          onClick={() => setNewCategory({ ...newCategory, image: null })}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 4L4 12M4 4L12 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="select-icon-btn"
                          onClick={() => openIconPicker('new')}
                        >
                          انتخاب نماد
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16.6667 11.6667H11.6667V16.6667H8.33333V11.6667H3.33333V8.33333H8.33333V3.33333H11.6667V8.33333H16.6667V11.6667Z" fill="white" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Subcategory input field with plus button */}
              <div className="subcategory-input-section">
                <div className="subcategory-input-with-add">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="برای دسته بندی زیر گروه ایجاد کنید"
                    value={newCategory.subcategoryInput || ''}
                    onChange={(e) => setNewCategory({ ...newCategory, subcategoryInput: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newCategory.subcategoryInput?.trim()) {
                        handleAddSubcategoryToNew();
                      }
                    }}
                  />
                  <button
                    className="add-subcategory-btn2"
                    onClick={() => newCategory.subcategoryInput?.trim() && handleAddSubcategoryToNew()}
                    disabled={!newCategory.subcategoryInput?.trim()}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M10.0003 18.3334C14.6027 18.3334 18.3337 14.6024 18.3337 10C18.3337 5.39765 14.6027 1.66669 10.0003 1.66669C5.39795 1.66669 1.66699 5.39765 1.66699 10C1.66699 14.6024 5.39795 18.3334 10.0003 18.3334ZM10.6253 7.50002C10.6253 7.15484 10.3455 6.87502 10.0003 6.87502C9.65515 6.87502 9.37533 7.15484 9.37533 7.50002L9.37532 9.37504H7.50033C7.15515 9.37504 6.87533 9.65486 6.87533 10C6.87533 10.3452 7.15515 10.625 7.50033 10.625H9.37532V12.5C9.37532 12.8452 9.65515 13.125 10.0003 13.125C10.3455 13.125 10.6253 12.8452 10.6253 12.5L10.6253 10.625H12.5003C12.8455 10.625 13.1253 10.3452 13.1253 10C13.1253 9.65486 12.8455 9.37504 12.5003 9.37504H10.6253V7.50002Z" fill="#139B3C" />
                    </svg>
                  </button>
                </div>

                {/* Display added subcategories */}
                {newCategory.subcategories && newCategory.subcategories.length > 0 && (
                  <div className="subcategories-list">
                    <div className="subcategories-label">زیرگروه‌های اضافه شده : </div>
                    {newCategory.subcategories.map((subcat, index) => (
                      <div key={index} className="subcategory-item">
                        <span>{subcat.title}</span>
                        <button
                          className="remove-subcategory-btn"
                          onClick={() => handleRemoveSubcategoryFromNew(index)}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 4L12 12M4 12L12 4" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => {
                  setIsCreateCategoryModalOpen(false);
                  resetCategoryForm();
                }}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={handleCreateCategory}
                disabled={!newCategory.title.trim()}
              >
                تایید و ایجاد
              </button>
            </div>
          </div>
        </div>
      )}

      {isIconPickerOpen && (
        <div className="modal-overlay">
          <div className="icon-picker-modal">
            <div className="modal-header">
              <h3>انتخاب نماد</h3>
              <button className="modal-close-btn" onClick={closeIconPicker} type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6L18 18M6 18L18 6" stroke="#333" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="icon-picker-body">
              <div className="icon-picker-search">
                <input
                  type="text"
                  className="form-input"
                  placeholder="جستجوی آیکون..."
                  value={iconSearchTerm}
                  onChange={(event) => setIconSearchTerm(event.target.value)}
                />
              </div>
              {isIconListLoading ? (
                <div className="icon-picker-status">در حال بارگذاری...</div>
              ) : iconListError ? (
                <div className="icon-picker-status error">{iconListError}</div>
              ) : (
                <div className="icon-picker-grid">
                  {filteredIconOptions.map((icon) => (
                    <button
                      type="button"
                      key={icon}
                      className="icon-picker-item"
                      onClick={() => handleIconSelect(icon)}
                    >
                      <img src={buildIconUrl(icon)} alt={icon} />
                      <span>{icon}</span>
                    </button>
                  ))}
                  {filteredIconOptions.length === 0 && (
                    <div className="icon-picker-empty">آیکونی یافت نشد.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isDeleteCulturalModalOpen && (
        <div className="modal-overlay">
          <div className="delete-confirmation-modal">
            <div className="modal-header">
              <p>آیا از حذف این اطلاعات فرهنگی اطمینان دارید؟</p>
            </div>


            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => setIsDeleteCulturalModalOpen(false)}
              >
                لغو
              </button>
              <button
                className="confirm-btn delete-confirm-btn"
                onClick={confirmDeleteCultural}
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Cultural Information Modal */}
      {isAddCulturalModalOpen && (
        <div className="modal-overlay">
          <div className="add-cultural-modal">
            {/* Modal Header - SAME as map manage modal */}
            <div className="modal-header">
              <div className="step-text">
                مرحله {culturalStep} از ۴ :
                <span className="step-title">
                  {culturalStep === 1 && 'اطلاعات کلی و نمایش اطلاعات'}
                  {culturalStep === 2 && 'اطلاعات و جزئیات تکمیلی مکان'}
                  {culturalStep === 3 && 'مرحله سوم اطلاعات'}
                  {culturalStep === 4 && 'مرحله چهارم اطلاعات'}
                </span>
              </div>
              <div className="step-progress">
                <div className={`step-circle ${culturalStep >= 1 ? 'active' : ''}`}>
                  {culturalStep > 1 ? '✓' : '۱'}
                </div>
                <div className={`step-line ${culturalStep >= 2 ? 'active' : ''}`}></div>
                <div className={`step-circle ${culturalStep >= 2 ? 'active' : ''}`}>
                  {culturalStep > 2 ? '✓' : '۲'}
                </div>
                <div className={`step-line ${culturalStep >= 3 ? 'active' : ''}`}></div>
                <div className={`step-circle ${culturalStep >= 3 ? 'active' : ''}`}>
                  {culturalStep > 3 ? '✓' : '۳'}
                </div>
                <div className={`step-line ${culturalStep >= 4 ? 'active' : ''}`}></div>
                <div className={`step-circle ${culturalStep >= 4 ? 'active' : ''}`}>
                  {culturalStep > 4 ? '✓' : '۴'}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="modal-content">
              {culturalStep === 1 && (
                <div className="step-content">
                  <div className="step-intro">
                    <h3>فرم ایجاد و افزودن اطلاعات فرهنگی جدید</h3>
                  </div>

                  <div className="form-section">
                    <div className="form-group">
                      <label className="form-label">عنوان و جزئیات</label>

                      <div className="title-input-with-language">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="عنوان اطلاعات فرهنگی را بنویسید"
                          value={culturalTitle}
                          onChange={(e) => setCulturalTitle(e.target.value)}
                        // Removed readOnly and onClick
                        />
                        <button
                          className="language-input-btn"
                          type="button"
                          onClick={() => openTitleLanguageModal('culturalTitle')}
                          title="ورود عنوان به زبان‌های دیگر"
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>

                      {/* <div className="title-input-with-language">
                        <input
                          type="number"
                          className="form-input"
                          placeholder="شناسه POI را وارد کنید"
                          value={culturalPoiId}
                          onChange={(e) => setCulturalPoiId(e.target.value)}
                        />
                      </div> */}

                      <div className="description-input-with-language">
                        <textarea
                          className="form-textarea"
                          placeholder="درباره این مکان اطلاعات فرهنگی بنویسید"
                          value={culturalDescription}
                          onChange={(e) => setCulturalDescription(e.target.value)}
                          // Removed readOnly and onClick
                          rows="3"
                        />
                        <button
                          className="language-input-btn15"
                          type="button"
                          onClick={() => openTitleLanguageModal('description')}
                          title="ورود توضیحات به زبان‌های دیگر"
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Display Settings Section */}
                    <div className="form-group">
                      <label className="form-label">نمایش و عدم نمایش اطلاعات به کاربر</label>

                      <div className="display-section">

                        {/* دیدگاه‌های کاربران */}
                        <div className="display-option">
                          <span className="option-label">دیدگاه‌های کاربران</span>
                          <div className="display-toggle">
                            <div
                              className={`toggle-option2 ${showUserFeedbacks ? 'selected' : ''}`}
                              onClick={() => setShowUserFeedbacks(true)}
                            >
                              نمایش
                            </div>
                            <div
                              className={`toggle-option ${!showUserFeedbacks ? 'selected' : ''}`}
                              onClick={() => setShowUserFeedbacks(false)}
                            >
                              عدم نمایش
                            </div>
                          </div>
                        </div>

                        {/* چند رسانه‌ای‌ها */}
                        <div className="display-option">
                          <span className="option-label">چند رسانه‌ای‌ها</span>
                          <div className="display-toggle">
                            <div
                              className={`toggle-option2 ${showMediaGallery ? 'selected' : ''}`}
                              onClick={() => setShowMediaGallery(true)}
                            >
                              نمایش
                            </div>
                            <div
                              className={`toggle-option ${!showMediaGallery ? 'selected' : ''}`}
                              onClick={() => setShowMediaGallery(false)}
                            >
                              عدم نمایش
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cultural Type Selection (New Section) */}
                    <div className="form-group">
                      <label className="form-label">نوع این مکان </label>
                      <div className="cultural-type-grid10">
                        {PLACE_TYPE_OPTIONS.map((typeOption) => {
                          const isSelected = selectedCulturalTypes.includes(typeOption.label);
                          return (
                            <div
                              key={typeOption.value}
                              className={`cultural-type-option10 ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleCulturalTypeToggle(typeOption.label)}
                            >
                              <div className="cultural-type-checkbox10">
                                {isSelected ? (
                                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" fill="#0F71EF" stroke="#0F71EF" />
                                    <path fillRule="evenodd" clipRule="evenodd" d="M14.0303 6.96967C14.3232 7.26256 14.3232 7.73744 14.0303 8.03033L9.03033 13.0303C8.73744 13.3232 8.26256 13.3232 7.96967 13.0303L5.96967 11.0303C5.67678 10.7374 5.67678 10.2626 5.96967 9.96967C6.26256 9.67678 6.73744 9.67678 7.03033 9.96967L8.5 11.4393L12.9697 6.96967C13.2626 6.67678 13.7374 6.67678 14.0303 6.96967Z" fill="white" />
                                  </svg>
                                ) : (
                                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" stroke="#D9D9D9" />
                                  </svg>
                                )}
                              </div>
                              <span>{typeOption.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">تعیین گروه این مکان فرهنگی</label>
                      <div className="dropdown-group-cultural">
                        <div className="dropdown-field-cultural">
                          <select
                            className="form-input-cultural"
                            value={culturalPlaceCategory}
                            onChange={(e) => {
                              setCulturalPlaceCategory(e.target.value);
                              setCulturalPlaceSubcategory('');
                            }}
                            disabled={isLoadingCulturalGroups}
                          >
                            <option value="" disabled>گروه اصلی فرهنگی</option>
                            {culturalGroupOptions.map((group) => (
                              <option key={`cultural-group-${group.value}`} value={group.value}>
                                {group.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="dropdown-field-cultural">
                          <select
                            className="form-input-cultural"
                            value={culturalPlaceSubcategory}
                            onChange={(e) => setCulturalPlaceSubcategory(e.target.value)}
                            disabled={!culturalPlaceCategory || isLoadingCulturalSubGroups}
                          >
                            <option value="" disabled>زیرگروه فرهنگی</option>
                            {culturalSubGroupOptions.map((subGroup, index) => (
                              <option key={`cultural-subgroup-${subGroup.value}-${index}`} value={subGroup.value}>
                                {subGroup.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {culturalStep === 2 && (
                <div className="step-content">
                  <div className="step-intro">
                    <h3> فرم ایجاد و افزودن اطلاعات فرهنگی جدید </h3>
                  </div>

                  <div className="form-section">
                    <div className="form-group">
                      <label className="form-label"> آدرس و موقعیت جغرافیایی در حرم </label>

                      {/* Address field with language button */}
                      <div className="address-input-with-language3">
                        <textarea
                          className="form-textarea"
                          placeholder="آدرس اطلاعات فرهنگی را بنویسید"
                          value={placeAddress}
                          onChange={(e) => setPlaceAddress(e.target.value)}
                          rows="2"
                        />
                        <button
                          className="language-input-btn"
                          type="button"
                          onClick={() => openAddressLanguageModal('culturalAddress')}
                          title="ورود آدرس به زبان‌های دیگر"
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>

                      <div className="map-instruction">
                        <span>برای انتخاب موقعیت دقیق، روی نقشه کلیک کنید</span>
                        {selectedLocation && (
                          <div className="selected-coordinates">
                            <span>موقعیت انتخاب شده:</span>
                            <span className="coordinates-value">
                              {selectedLocation.lat.toFixed(6)}°N, {selectedLocation.lng.toFixed(6)}°E
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="cultural-map-container">
                        <div id="cultural-map-container" className="cultural-map-instance"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {culturalStep === 3 && (
                <div className="step-content step3-content">
                  <div className="step-intro3">
                    <h3>فرم ایجاد و افزودن اطلاعات فرهنگی جدید</h3>
                  </div>

                  <div className="form-section">
                    {/* Time-based Restrictions Section */}
                    <div className="restriction-section">
                      <div className="restriction-header">
                        <span className="restriction-title">محدودیت بر اساس روز، ساعت و جنسیت</span>
                        <button
                          className="add-restriction-btn"
                          onClick={() => setIsCulturalDateFilterOpen(!isCulturalDateFilterOpen)}
                        >
                          افزودن محدودیت
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                            <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                          </svg>
                        </button>
                      </div>

                      {/* Display existing restrictions */}
                      {culturalTimeRestrictions.length > 0 && (
                        <div className="restrictions-display">
                          {culturalTimeRestrictions.map((restriction, index) => (
                            <div key={index} className="restriction-display-item">
                              <div className="restriction-info">
                                <span className="restriction-date">محدودیت های {restriction.date} ،</span>
                                <span className="restriction-gender">{restriction.gender.join('، ')} ،</span>
                                <span className="restriction-time">
                                  {restriction.timePairs.map((pair, idx) => (
                                    <span key={idx}>
                                      {pair.start} الی {pair.end}
                                      {idx < restriction.timePairs.length - 1 && '، '}
                                    </span>
                                  ))}
                                </span>
                              </div>
                              <button
                                className="remove-restriction-display-btn"
                                onClick={() => removeCulturalRestriction(index)}
                              >
                                <svg width="75" height="32" viewBox="0 0 75 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="0.5" y="0.5" width="74" height="31" rx="5.5" stroke="#EA4335" />
                                  <path fillRule="evenodd" clipRule="evenodd" d="M15.4099 13.1678C15.6855 13.1494 15.9237 13.3579 15.9421 13.6334L16.2487 18.2328C16.3086 19.1314 16.3513 19.7566 16.445 20.227C16.5359 20.6833 16.6628 20.9249 16.8451 21.0954C17.0274 21.2659 17.2768 21.3765 17.7381 21.4368C18.2137 21.499 18.8404 21.5 19.741 21.5H20.2565C21.1571 21.5 21.7838 21.499 22.2594 21.4368C22.7207 21.3765 22.9701 21.2659 23.1524 21.0954C23.3347 20.9249 23.4616 20.6833 23.5525 20.227C23.6462 19.7566 23.6889 19.1314 23.7488 18.2328L24.0554 13.6334C24.0738 13.3579 24.312 13.1494 24.5876 13.1678C24.8631 13.1862 25.0716 13.4244 25.0532 13.7L24.7442 18.3345C24.6872 19.1896 24.6412 19.8804 24.5332 20.4224C24.421 20.986 24.23 21.4567 23.8356 21.8256C23.4412 22.1946 22.9588 22.3538 22.3891 22.4284C21.8411 22.5001 21.1488 22.5 20.2917 22.5H19.7058C18.8488 22.5 18.1565 22.5001 17.6084 22.4284C17.0387 22.3538 16.5563 22.1946 16.1619 21.8256C15.7675 21.4567 15.5766 20.986 15.4643 20.4224C15.3563 19.8804 15.3103 19.1896 15.2533 18.3344L14.9443 13.7C14.9259 13.4244 15.1344 13.1862 15.4099 13.1678Z" fill="#EA4335" />
                                  <path fillRule="evenodd" clipRule="evenodd" d="M18.9023 9.50003L18.8716 9.50001C18.7273 9.49992 18.6017 9.49984 18.483 9.51879C18.0141 9.59366 17.6084 9.8861 17.3891 10.3072C17.3336 10.4138 17.2939 10.5331 17.2484 10.67L17.2387 10.6991L17.174 10.8932C17.1613 10.9312 17.1578 10.9417 17.1547 10.9502C17.038 11.2729 16.7353 11.4911 16.3922 11.4998C16.3832 11.5 16.3721 11.5 16.3321 11.5H14.332C14.0559 11.5 13.832 11.7239 13.832 12C13.832 12.2762 14.0559 12.5 14.332 12.5L16.3378 12.5L16.349 12.5H23.6486L23.6597 12.5L25.6654 12.5C25.9416 12.5 26.1654 12.2762 26.1654 12C26.1654 11.7239 25.9416 11.5 25.6654 11.5H23.6654C23.6254 11.5 23.6143 11.5 23.6053 11.4998C23.2622 11.4911 22.9595 11.2729 22.8428 10.9501C22.8397 10.9417 22.8361 10.931 22.8235 10.8932L22.7588 10.6991L22.7491 10.67C22.7036 10.5331 22.6639 10.4138 22.6084 10.3072C22.3891 9.8861 21.9834 9.59366 21.5145 9.51879C21.3958 9.49984 21.2702 9.49992 21.1259 9.50001L21.0952 9.50003H18.9023ZM18.0951 11.2903C18.0689 11.3627 18.0385 11.4327 18.0041 11.5H21.9934C21.959 11.4327 21.9286 11.3627 21.9024 11.2903L21.8766 11.2148L21.8101 11.0153C21.7493 10.8329 21.7354 10.7958 21.7215 10.7691C21.6484 10.6287 21.5131 10.5312 21.3568 10.5063C21.3272 10.5015 21.2875 10.5 21.0952 10.5H18.9023C18.7101 10.5 18.6704 10.5015 18.6407 10.5063C18.4844 10.5312 18.3491 10.6287 18.276 10.7691C18.2622 10.7958 18.2482 10.8329 18.1874 11.0153L18.1208 11.2149C18.1108 11.2449 18.103 11.2683 18.0951 11.2903Z" fill="#EA4335" />
                                  <path d="M38.7759 20C37.7026 20 36.8953 19.9907 36.3539 19.972C35.8219 19.944 35.4253 19.9067 35.1639 19.86C34.9119 19.8133 34.6646 19.734 34.4219 19.622C33.9926 19.4353 33.6659 19.1647 33.4419 18.81C33.2273 18.4553 33.1199 18.04 33.1199 17.564C33.1199 17.2747 33.1619 16.9713 33.2459 16.654L33.7639 14.68L34.7859 14.988L34.2679 17.004C34.2119 17.228 34.1839 17.424 34.1839 17.592C34.1839 17.816 34.2353 18.0073 34.3379 18.166C34.4499 18.3153 34.6179 18.4413 34.8419 18.544C35.0006 18.6187 35.1826 18.6747 35.3879 18.712C35.6026 18.7493 35.9713 18.7773 36.4939 18.796C37.0166 18.8147 37.8006 18.824 38.8459 18.824H41.6319C42.1826 18.824 42.5933 18.8007 42.8639 18.754C43.1346 18.7073 43.3213 18.628 43.4239 18.516C43.5266 18.3947 43.5779 18.2173 43.5779 17.984C43.5779 17.844 43.5733 17.732 43.5639 17.648C43.0226 17.732 42.4346 17.774 41.7999 17.774C41.1186 17.774 40.5726 17.578 40.1619 17.186C39.7606 16.7847 39.5599 16.2387 39.5599 15.548C39.5599 15.0627 39.6486 14.61 39.8259 14.19C40.0126 13.77 40.2833 13.434 40.6379 13.182C41.0019 12.9207 41.4359 12.79 41.9399 12.79C42.6119 12.79 43.1719 13.042 43.6199 13.546C44.0773 14.05 44.3433 14.722 44.4179 15.562L44.5719 17.48C44.5906 17.76 44.5999 17.9513 44.5999 18.054C44.5999 18.53 44.5113 18.908 44.3339 19.188C44.1659 19.468 43.8626 19.6733 43.4239 19.804C42.9946 19.9347 42.3879 20 41.6039 20H38.8459H38.7759ZM40.5399 15.408C40.5399 15.8 40.6519 16.1127 40.8759 16.346C41.0999 16.57 41.4079 16.682 41.7999 16.682C42.3786 16.682 42.9339 16.6353 43.4659 16.542L43.3959 15.66C43.3306 15.0907 43.1626 14.652 42.8919 14.344C42.6306 14.0267 42.2993 14.868 41.8979 13.868C41.4779 13.868 41.1466 14.022 40.9039 14.33C40.6613 14.6287 40.5399 14.988 40.5399 15.408ZM41.2959 10.088H42.7099V11.488H41.2959V10.088ZM48.5068 20C47.8161 20 47.2655 19.8647 46.8548 19.594C46.4535 19.314 46.2295 18.95 46.1828 18.502C46.1361 18.306 46.1128 17.998 46.1128 17.578H47.0928C47.0928 17.8673 47.1115 18.1007 47.1488 18.278C47.1861 18.474 47.2981 18.614 47.4848 18.698C47.6808 18.782 47.9655 18.824 48.3388 18.824H49.1928C50.1728 18.824 50.6628 18.53 50.6628 17.942C50.6628 17.8767 50.6441 17.76 50.6068 17.592V17.564L49.5568 13.448L50.5928 13.168L51.6428 17.298C51.7361 17.662 51.8201 17.9467 51.8948 18.152C51.9788 18.348 52.0908 18.5113 52.2308 18.642C52.3708 18.7633 52.5575 18.824 52.7908 18.824H53.4768L53.5468 19.412L53.4768 20H52.7908C52.1655 20 51.6615 19.7387 51.2788 19.216C50.8308 19.7387 50.0888 20 49.0528 20H48.5068ZM49.1788 10.704H50.5788V12.104H49.1788V10.704ZM53.3362 18.824H53.5323C54.3629 18.824 55.0583 18.8053 55.6183 18.768C56.1783 18.7213 56.7523 18.614 57.3403 18.446L60.6303 17.564L57.7883 15.94C57.5083 15.772 57.2189 15.688 56.9203 15.688C56.6309 15.688 56.3556 15.772 56.0943 15.94C55.8329 16.0987 55.6229 16.3227 55.4642 16.612L55.2123 17.046L54.2883 16.472L54.5543 15.996C54.8156 15.52 55.1516 15.1513 55.5623 14.89C55.9823 14.6287 56.4303 14.498 56.9062 14.498C57.3916 14.498 57.8583 14.6333 58.3063 14.904L61.8763 17.06L61.7083 18.432L57.6063 19.594C56.9529 19.7713 56.3229 19.8833 55.7163 19.93C55.1096 19.9767 54.3769 20 53.5183 20H53.3362V18.824Z" fill="#EA4335" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Date Filter Popup */}
                      {isCulturalDateFilterOpen && !culturalRestrictionFormOpen && (
                        <div className={`date-filter-popup ${culturalSelectedDateFilter.includes('انتخاب از تقویم') ? 'calendar-selectable' : ''}`}>
                          <div className="date-filter-content">
                            {/* Filter by Date Section */}
                            <div className="filter-section">
                              <div className="date-filter-option2">
                                <div className="filter-title">فیلتر بر اساس تاریخ</div>
                                <div
                                  className={`date-filter-option ${culturalSelectedDateFilter.includes('همه روزه') ? 'selected' : ''}`}
                                  onClick={() => handleCulturalDateFilterToggle('همه روزه')}
                                >
                                  همه روزه
                                </div>
                                <div
                                  className={`date-filter-option ${culturalSelectedDateFilter.includes('تمام این ماه') ? 'selected' : ''}`}
                                  onClick={() => handleCulturalDateFilterToggle('تمام این ماه')}
                                >
                                  تمام این ماه
                                </div>
                                <div
                                  className={`date-filter-option ${culturalSelectedDateFilter.includes('کل این هفته') ? 'selected' : ''}`}
                                  onClick={() => handleCulturalDateFilterToggle('کل این هفته')}
                                >
                                  کل این هفته
                                </div>
                              </div>
                              <div
                                className={`calendar-select-option ${culturalSelectedDateFilter.includes('انتخاب از تقویم') ? 'selected' : ''}`}
                                onClick={() => handleCulturalDateFilterToggle('انتخاب از تقویم')}
                              >
                                انتخاب از تقویم
                              </div>
                            </div>

                            {/* Select from Calendar Section */}
                            <div className="filter-section">
                              <div className="jalali-calendar">
                                {/* Calendar Header with Month/Year Selection */}
                                <div className="calendar-header">
                                  <div className="month-year-selector">
                                    <select
                                      value={culturalCalendarDate.month}
                                      onChange={(e) => setCulturalCalendarDate(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                                      className="month-select"
                                    >
                                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                        <option key={month} value={month}>
                                          {getJalaliMonthName(month)}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={culturalCalendarDate.year}
                                      onChange={(e) => setCulturalCalendarDate(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                                      className="year-select"
                                    >
                                      {Array.from({ length: 10 }, (_, i) => 1400 + i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="calendar-nav">
                                    <button
                                      className="nav-btn prev"
                                      onClick={handleCulturalPrevMonth}
                                    >
                                      ‹
                                    </button>
                                    <button
                                      className="nav-btn next"
                                      onClick={handleCulturalNextMonth}
                                    >
                                      ›
                                    </button>
                                  </div>
                                </div>

                                {/* Day Names */}
                                <div className="day-names">
                                  <div className="day-name">ش</div>
                                  <div className="day-name">یک</div>
                                  <div className="day-name">دو</div>
                                  <div className="day-name">سه</div>
                                  <div className="day-name">چهار</div>
                                  <div className="day-name">پنج</div>
                                  <div className="day-name">ج</div>
                                </div>

                                {/* Calendar Days Grid */}
                                <div className="calendar-days">
                                  {renderCulturalJalaliCalendarDays()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Restriction Form (shown after selection) */}
                      {culturalRestrictionFormOpen && culturalSelectedRestrictionType && (
                        <div className="restriction-form-container">
                          {/* Black header with title and close button */}
                          <div className="restriction-form-header">
                            <div className="restriction-title-black">
                              <span className="restriction-label">محدودیت‌های</span>
                              <span className="restriction-value">{getCulturalRestrictionTitle()}</span>
                            </div>
                            <button
                              className="close-restriction-btn"
                              onClick={handleCulturalCloseRestrictionForm}
                            >
                              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="0.5" y="0.5" width="31" height="31" rx="5.5" stroke="#EA4335" />
                                <path fillRule="evenodd" clipRule="evenodd" d="M22.6654 16C22.6654 19.6819 19.6806 22.6666 15.9987 22.6666C12.3168 22.6666 9.33203 19.6819 9.33203 16C9.33203 12.3181 12.3168 9.33331 15.9987 9.33331C19.6806 9.33331 22.6654 12.3181 22.6654 16ZM13.9784 13.9797C14.1737 13.7845 14.4903 13.7845 14.6856 13.9797L15.9987 15.2929L17.3118 13.9798C17.507 13.7845 17.8236 13.7845 18.0189 13.9798C18.2142 14.175 18.2142 14.4916 18.0189 14.6869L16.7058 16L18.0189 17.3131C18.2141 17.5083 18.2141 17.8249 18.0189 18.0202C17.8236 18.2154 17.507 18.2154 17.3118 18.0202L15.9987 16.7071L14.6856 18.0202C14.4903 18.2154 14.1737 18.2154 13.9785 18.0202C13.7832 17.8249 13.7832 17.5083 13.9785 17.3131L15.2916 16L13.9784 14.6869C13.7832 14.4916 13.7832 14.175 13.9784 13.9797Z" fill="#EA4335" />
                              </svg>
                            </button>
                          </div>

                          {/* Gender Restrictions */}
                          <div className="gender-restrictions-section">
                            <div className="section-title3">محدودسازی جنسیتی برای تردد</div>
                            <div className="gender-options">
                              {['زنانه', 'مردانه', 'خانوادگی'].map((gender) => (
                                <div
                                  key={gender}
                                  className={`gender-option ${culturalSelectedGenderRestrictions.includes(gender) ? 'selected' : ''}`}
                                  onClick={() => handleCulturalGenderRestrictionToggle(gender)}
                                >
                                  <div className="gender-checkbox">
                                    {culturalSelectedGenderRestrictions.includes(gender) ? (
                                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" fill="#0F71EF" stroke="#0F71EF" />
                                        <path fillRule="evenodd" clipRule="evenodd" d="M14.0303 6.96967C14.3232 7.26256 14.3232 7.73744 14.0303 8.03033L9.03033 13.0303C8.73744 13.3232 8.26256 13.3232 7.96967 13.0303L5.96967 11.0303C5.67678 10.7374 5.67678 10.2626 5.96967 9.96967C6.26256 9.67678 6.73744 9.67678 7.03033 9.96967L8.5 11.4393L12.9697 6.96967C13.2626 6.67678 13.7374 6.67678 14.0303 6.96967Z" fill="white" />
                                      </svg>
                                    ) : (
                                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" stroke="#D9D9D9" />
                                      </svg>
                                    )}
                                  </div>
                                  <span>{gender}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Time Restrictions */}
                          <div className="time-restrictions-section">
                            <div className="section-title5">محدودسازی زمانی برای تردد
                              <button
                                className="add-time-btn"
                                onClick={handleCulturalAddTimeRestriction}
                                disabled={culturalLimitAllHours || culturalTimeRestrictionPairs.length >= 4}
                              >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" clipRule="evenodd" d="M10.0013 18.3333C14.6037 18.3333 18.3346 14.6023 18.3346 9.99996C18.3346 5.39759 14.6037 1.66663 10.0013 1.66663C5.39893 1.66663 1.66797 5.39759 1.66797 9.99996C1.66797 14.6023 5.39893 18.3333 10.0013 18.3333ZM10.6263 7.49996C10.6263 7.15478 10.3465 6.87496 10.0013 6.87496C9.65612 6.87496 9.3763 7.15478 9.3763 7.49996L9.3763 9.37498H7.5013C7.15612 9.37498 6.8763 9.6548 6.8763 9.99998C6.8763 10.3452 7.15612 10.625 7.5013 10.625H9.3763V12.5C9.3763 12.8451 9.65612 13.125 10.0013 13.125C10.3465 13.125 10.6263 12.8451 10.6263 12.5L10.6263 10.625H12.5013C12.8465 10.625 13.1263 10.3452 13.1263 9.99998C13.1263 9.6548 12.8465 9.37498 12.5013 9.37498H10.6263V7.49996Z" fill="#14C472" />
                                </svg>
                              </button>
                            </div>

                            {/* Time Restriction Pairs Grid with scrollable container when many items */}
                            <div className={`time-pairs-scrollable-container ${culturalTimeRestrictionPairs.length > 2 ? 'scrollable' : ''}`}>
                              <div className={`time-pairs-grid ${culturalTimeRestrictionPairs.length > 2 ? 'multi-row' : ''}`}>
                                {culturalTimeRestrictionPairs.map((pair, index) => (
                                  <div key={index} className="time-pair">
                                    <div className="time-inputs">
                                      <div className="time-input-group">
                                        <label>شروع:</label>
                                        <input
                                          type="time"
                                          value={pair.start}
                                          onChange={(e) => handleCulturalTimeChange(index, 'start', e.target.value)}
                                          disabled={culturalLimitAllHours}
                                          className="time-input"
                                          style={{
                                            WebkitAppearance: 'none',
                                            MozAppearance: 'textfield'
                                          }}
                                        />
                                      </div>
                                      <div className="time-input-group">
                                        <label>پایان :</label>
                                        <input
                                          type="time"
                                          value={pair.end}
                                          onChange={(e) => handleCulturalTimeChange(index, 'end', e.target.value)}
                                          disabled={culturalLimitAllHours}
                                          className="time-input"
                                        />
                                      </div>
                                    </div>
                                    {culturalTimeRestrictionPairs.length > 1 && (
                                      <button
                                        className="remove-time-btn"
                                        onClick={() => handleCulturalRemoveTimeRestriction(index)}
                                        disabled={culturalLimitAllHours}
                                      >
                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M9.45597 18.3333H10.13C12.4489 18.3333 13.6084 18.3333 14.3622 17.578C15.1161 16.8227 15.1932 15.5837 15.3475 13.1058L15.5697 9.53534C15.6534 8.19086 15.6953 7.51861 15.3171 7.09262C14.9389 6.66663 14.3002 6.66663 13.0229 6.66663H6.56301C5.28569 6.66663 4.64704 6.66663 4.26885 7.09262C3.89065 7.51861 3.9325 8.19086 4.0162 9.53535L4.23846 13.1058C4.39272 15.5837 4.46984 16.8227 5.22371 17.578C5.97758 18.3333 7.13704 18.3333 9.45597 18.3333Z" fill="#EA4335" />
                                          <path d="M2.29297 5.13885C2.29297 4.75533 2.58079 4.44442 2.93583 4.44442L5.15603 4.44404C5.59716 4.43197 5.98632 4.12897 6.13642 3.68072C6.14037 3.66893 6.1449 3.6544 6.16118 3.60165L6.25685 3.29157C6.31539 3.10145 6.36639 2.93581 6.43776 2.78776C6.71971 2.20287 7.24137 1.79671 7.84419 1.69273C7.99678 1.6664 8.15837 1.66652 8.34385 1.66664H11.2422C11.4277 1.66652 11.5893 1.6664 11.7419 1.69273C12.3447 1.79671 12.8664 2.20287 13.1483 2.78776C13.2197 2.93581 13.2707 3.10145 13.3292 3.29157L13.4249 3.60165C13.4412 3.6544 13.4457 3.66893 13.4497 3.68072C13.5998 4.12897 14.0661 4.43234 14.5073 4.44442H16.6501C17.0052 4.44442 17.293 4.75533 17.293 5.13885C17.293 5.52238 17.0052 5.83329 16.6501 5.83329H2.93583C2.58079 5.83329 2.29297 5.52238 2.29297 5.13885Z" fill="#EA4335" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="time-restrictions-footer">
                              <div
                                className="all-hours-option"
                                onClick={() => {
                                  setCulturalLimitAllHours(!culturalLimitAllHours);
                                  if (!culturalLimitAllHours) {
                                    setCulturalTimeRestrictionPairs([{ start: '', end: '' }]);
                                  }
                                }}
                              >
                                <div className="all-hours-checkbox">
                                  {culturalLimitAllHours ? (
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" fill="#0F71EF" stroke="#0F71EF" />
                                      <path fillRule="evenodd" clipRule="evenodd" d="M14.0303 6.96967C14.3232 7.26256 14.3232 7.73744 14.0303 8.03033L9.03033 13.0303C8.73744 13.3232 8.26256 13.3232 7.96967 13.0303L5.96967 11.0303C5.67678 10.7374 5.67678 10.2626 5.96967 9.96967C6.26256 9.67678 6.73744 9.67678 7.03033 9.96967L8.5 11.4393L12.9697 6.96967C13.2626 6.67678 13.7374 6.67678 14.0303 6.96967Z" fill="white" />
                                    </svg>
                                  ) : (
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" stroke="#D9D9D9" />
                                    </svg>
                                  )}
                                </div>
                                <span>محدودیت برای تمام ساعات روز</span>
                              </div>
                              <button
                                className="confirm-restriction-btn"
                                onClick={handleCulturalConfirmRestriction}
                                disabled={!isCulturalRestrictionFormValid()}
                              >
                                تایید و افزودن محدودیت زمانی
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Prayer Time Restrictions Section */}
                    <div className="restriction-section">
                      <div className="restriction-header">
                        <span className="restriction-title">محدودیت بر اساس اوقات شرعی (برای همه روزها)</span>
                        <button
                          className="add-restriction-btn"
                          onClick={() => {
                            setIsCulturalPrayerDateFilterOpen(prev => !prev);
                            setIsCulturalDateFilterOpen(false);
                            setCulturalRestrictionFormOpen(false);
                          }}
                        >
                          افزودن محدودیت
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                            <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                          </svg>
                        </button>
                      </div>

                      {culturalPrayerRestrictionFormOpen && (
                        <div className="prayer-form">
                          {/* Prayer form content - same as in map manage modal */}
                          <div className="prayer-form-grid">
                            <div className="form-column">
                              <label className="form-label">انتخاب رویداد</label>
                              <div className="prayer-event-grid">
                                {PRAYER_EVENT_OPTIONS.map((option) => (
                                  <div
                                    key={option.value}
                                    className={`prayer-event-option ${culturalSelectedPrayerEvents.includes(option.value) ? 'selected' : ''}`}
                                    onClick={() => toggleCulturalPrayerEvent(option.value)}
                                  >
                                    {culturalSelectedPrayerEvents.includes(option.value) ? (
                                      <svg width="22" height="22" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#0F71EF" /></svg>
                                    ) : (
                                      <svg width="22" height="22" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#fff" stroke="#D9D9D9" /></svg>
                                    )}
                                    <span className="event-label">{option.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="form-column">
                              <label className="form-label">محدودسازی زمانی برای تردد</label>
                              <div className="minutes-inputs-grid">
                                <input
                                  type="number"
                                  min="0"
                                  className="minute-input"
                                  placeholder="دقیقه قبل از شروع: --"
                                  value={culturalPrayerBeforeMinutes}
                                  onChange={(e) => setCulturalPrayerBeforeMinutes(e.target.value)}
                                />
                                <input
                                  type="number"
                                  min="0"
                                  className="minute-input"
                                  placeholder="دقیقه قبل از پایان: --"
                                  value={culturalPrayerAfterMinutes}
                                  onChange={(e) => setCulturalPrayerAfterMinutes(e.target.value)}
                                />
                              </div>

                              <div className="prayer-form-actions">
                                <button
                                  className="confirm-prayer-btn"
                                  onClick={() => {
                                    if (culturalSelectedPrayerEvents.length === 0 || culturalPrayerBeforeMinutes === '' || culturalPrayerAfterMinutes === '') {
                                      alert('لطفا همه فیلدها را تکمیل کنید');
                                      return;
                                    }
                                    const eventLabels = culturalSelectedPrayerEvents.map(prayerEventValueToLabel);
                                    const title = eventLabels.join(' و ') + ` : ${culturalPrayerBeforeMinutes} دقیقه قبل الی ${culturalPrayerAfterMinutes} دقیقه بعد`;
                                    const newItem = {
                                      id: Date.now(),
                                      events: [...culturalSelectedPrayerEvents],
                                      before: String(culturalPrayerBeforeMinutes),
                                      after: String(culturalPrayerAfterMinutes),
                                      date: culturalPrayerSelectedJalaliDate ? `روز ${culturalPrayerSelectedJalaliDate.day} ${getJalaliMonthName(culturalPrayerSelectedJalaliDate.month)} ${culturalPrayerSelectedJalaliDate.year}` : 'همه روزها',
                                      isoDateScope: buildDateScopeIso(
                                        culturalPrayerSelectedJalaliDate
                                          ? `روز ${culturalPrayerSelectedJalaliDate.day} ${getJalaliMonthName(culturalPrayerSelectedJalaliDate.month)} ${culturalPrayerSelectedJalaliDate.year}`
                                          : 'همه روزها',
                                        culturalPrayerSelectedJalaliDate
                                      ),
                                      title
                                    };
                                    const { dedupKey: newKey } = getPrayerRestrictionParts(newItem);
                                    setCulturalPrayerTimeRestrictionsList((prev) => {
                                      const filtered = prev.filter((item) => {
                                        const { dedupKey } = getPrayerRestrictionParts(item);
                                        return dedupKey !== newKey;
                                      });
                                      return [...filtered, newItem];
                                    });
                                    setCulturalSelectedPrayerEvents([]);
                                    setCulturalPrayerBeforeMinutes('');
                                    setCulturalPrayerAfterMinutes('');
                                    setCulturalPrayerSelectedJalaliDate(null);
                                    setCulturalPrayerRestrictionFormOpen(false);
                                  }}
                                >
                                  تایید و افزودن محدودیت اوقات شرعی
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {isCulturalPrayerDateFilterOpen && !culturalPrayerRestrictionFormOpen && (
                        <div className="prayer-date-filter-popup">
                          <div className="date-filter-content">
                            {/* Filter by Date Section */}
                            <div className="filter-section">
                              <div className="date-filter-option2">
                                <div className="filter-title">فیلتر بر اساس تاریخ</div>
                                <div
                                  className={`date-filter-option`}
                                  onClick={() => {
                                    setCulturalPrayerSelectedJalaliDate(null);
                                    setCulturalPrayerRestrictionFormOpen(true);
                                    setIsCulturalPrayerDateFilterOpen(false);
                                  }}
                                >
                                  همه روزه
                                </div>
                                <div
                                  className="date-filter-option"
                                  onClick={() => {
                                    setCulturalPrayerSelectedJalaliDate(null);
                                    setCulturalPrayerRestrictionFormOpen(true);
                                    setIsCulturalPrayerDateFilterOpen(false);
                                  }}
                                >
                                  تمام این ماه
                                </div>
                                <div
                                  className="date-filter-option"
                                  onClick={() => {
                                    setCulturalPrayerSelectedJalaliDate(null);
                                    setCulturalPrayerRestrictionFormOpen(true);
                                    setIsCulturalPrayerDateFilterOpen(false);
                                  }}
                                >
                                  کل این هفته
                                </div>
                              </div>

                              <div
                                className="calendar-select-option selected"
                              >
                                انتخاب از تقویم
                              </div>
                            </div>

                            {/* Calendar (Jalali) */}
                            <div className="filter-section">
                              <div className="jalali-calendar">
                                <div className="calendar-header">
                                  <div className="month-year-selector">
                                    <select
                                      value={culturalPrayerCalendarDate.month}
                                      onChange={(e) => setCulturalPrayerCalendarDate(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                                      className="month-select"
                                    >
                                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                        <option key={month} value={month}>
                                          {getJalaliMonthName(month)}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={culturalPrayerCalendarDate.year}
                                      onChange={(e) => setCulturalPrayerCalendarDate(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                                      className="year-select"
                                    >
                                      {Array.from({ length: 10 }, (_, i) => 1400 + i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="calendar-nav">
                                    <button className="nav-btn" onClick={handleCulturalPrayerPrevMonth}>‹</button>
                                    <button className="nav-btn" onClick={handleCulturalPrayerNextMonth}>›</button>
                                  </div>
                                </div>

                                <div className="day-names">
                                  <div className="day-name">ش</div>
                                  <div className="day-name">ی</div>
                                  <div className="day-name">د</div>
                                  <div className="day-name">س</div>
                                  <div className="day-name">چ</div>
                                  <div className="day-name">پ</div>
                                  <div className="day-name">ج</div>
                                </div>

                                <div className="calendar-days">
                                  {renderCulturalPrayerJalaliCalendarDays()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {culturalPrayerTimeRestrictionsList.length > 0 && (
                        <div className="prayer-restrictions-list">
                          {culturalPrayerTimeRestrictionsList.map((item, idx) => (
                            <div key={item.id} className="prayer-restriction-row">
                              <div className="prayer-restriction-badge">
                                <span className="prayer-restriction-text">{item.date} ، {item.title}</span>
                              </div>
                              <button className="remove-prayer-btn" onClick={() => {
                                setCulturalPrayerTimeRestrictionsList(prev => prev.filter((_, i) => i !== idx));
                              }}>
                                حذف
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" clipRule="evenodd" d="M3.40994 5.1678C3.68547 5.14943 3.92372 5.3579 3.94209 5.63343L4.24872 10.2328C4.30862 11.1314 4.35131 11.7566 4.44502 12.227C4.53592 12.6833 4.66281 12.9249 4.84508 13.0954C5.02736 13.2659 5.2768 13.3765 5.73813 13.4368C6.21373 13.499 6.8404 13.5 7.74097 13.5H8.25654C9.1571 13.5 9.78377 13.499 10.2594 13.4368C10.7207 13.3765 10.9701 13.2659 11.1524 13.0954C11.3347 12.9249 11.4616 12.6833 11.5525 12.227C11.6462 11.7566 11.6889 11.1314 11.7488 10.2328L12.0554 5.63343C12.0738 5.3579 12.312 5.14943 12.5876 5.1678C12.8631 5.18617 13.0716 5.42442 13.0532 5.69995L12.7442 10.3345C12.6872 11.1896 12.6412 11.8804 12.5332 12.4224C12.421 12.986 12.23 13.4567 11.8356 13.8256C11.4412 14.1946 10.9588 14.3538 10.3891 14.4284C9.84105 14.5001 9.14876 14.5 8.2917 14.5H7.70581C6.84875 14.5 6.15646 14.5001 5.60843 14.4284C5.03866 14.3538 4.5563 14.1946 4.1619 13.8256C3.7675 13.4567 3.57656 12.986 3.46429 12.4224C3.35631 11.8804 3.31027 11.1896 3.25327 10.3344L2.94431 5.69995C2.92594 5.42442 3.13441 5.18617 3.40994 5.1678Z" fill="#EA4335" />
                                  <path fillRule="evenodd" clipRule="evenodd" d="M6.90226 1.50003L6.87161 1.50001C6.72734 1.49992 6.60166 1.49984 6.48298 1.51879C6.01412 1.59366 5.60838 1.8861 5.38909 2.30723C5.33358 2.41382 5.29391 2.53309 5.24838 2.66998L5.2387 2.69905L5.17397 2.89323C5.16131 2.93121 5.15778 2.94168 5.15471 2.95016C5.03797 3.2729 4.73529 3.49106 4.39219 3.49976C4.38317 3.49999 4.37212 3.50003 4.33209 3.50003H2.33203C2.05589 3.50003 1.83203 3.72388 1.83203 4.00003C1.83203 4.27617 2.05589 4.50003 2.33203 4.50003L4.3378 4.50003L4.34896 4.50003H11.6486L11.6597 4.50003L13.6654 4.50003C13.9416 4.50003 14.1654 4.27617 14.1654 4.00003C14.1654 3.72388 13.9416 3.50003 13.6654 3.50003H11.6654C11.6254 3.50003 11.6143 3.49999 11.6053 3.49976C11.2622 3.49106 10.9595 3.27289 10.8428 2.95014C10.8397 2.94172 10.8361 2.93102 10.8235 2.89323L10.7588 2.69905L10.7491 2.66996C10.7036 2.53307 10.6639 2.41382 10.6084 2.30723C10.3891 1.8861 9.98339 1.59366 9.51453 1.51879C9.39585 1.49984 9.27016 1.49992 9.1259 1.50001L9.09525 1.50003H6.90226ZM6.09508 3.29032C6.0689 3.36269 6.03847 3.43268 6.00413 3.50003H9.99338C9.95904 3.43268 9.92861 3.3627 9.90243 3.29033L9.87662 3.21477L9.81013 3.01528C9.74934 2.83294 9.73535 2.79575 9.72147 2.76909C9.64837 2.62872 9.51313 2.53124 9.35684 2.50628C9.32715 2.50154 9.28746 2.50003 9.09525 2.50003H6.90226C6.71005 2.50003 6.67035 2.50154 6.64067 2.50628C6.48438 2.53124 6.34914 2.62872 6.27604 2.76909C6.26216 2.79575 6.24816 2.83294 6.18738 3.01528L6.12085 3.21489C6.11083 3.24495 6.10303 3.26834 6.09508 3.29032Z" fill="#EA4335" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {culturalStep === 4 && (
                <div className="step-content">
                  <div className="step-intro">
                    <h3>مرحله چهارم - آپلود تصاویر و فایل‌های اطلاعات فرهنگی</h3>
                  </div>

                  <div className="form-section">
                    {/* Profile Images and Videos Section */}
                    <div className="file-upload-section">
                      <div className="file-section-header">
                        <label className="add-file-btn">
                          <input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={(e) => handleFileUploadWithModal(e, 'image')} // Changed to handleFileUploadWithModal
                            className="file-input-hidden"
                          />
                          افزودن فایل
                          <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.2824 0H18.8284C17.8063 0 17.0544 0.42296 16.7137 1.17489C16.5257 1.51561 16.4435 1.91507 16.4435 2.38502V5.8392C16.4435 7.33131 17.3363 8.22422 18.8284 8.22422H22.2824C22.7523 8.22422 23.1517 8.14198 23.4924 7.954C24.2443 7.61328 24.6672 6.86135 24.6672 5.8392V2.38502C24.6672 0.892916 23.7744 0 22.2824 0ZM23.3867 4.61731C23.2692 4.7348 23.093 4.81705 22.905 4.82879H21.2485V5.42799L21.2603 6.46189C21.2485 6.66162 21.178 6.82611 21.037 6.96709C20.9196 7.08458 20.7433 7.16682 20.5554 7.16682C20.1677 7.16682 19.8505 6.8496 19.8505 6.46189V4.81705L18.2057 4.82879C18.0177 4.82571 17.8384 4.74885 17.7065 4.61477C17.5747 4.4807 17.5008 4.30017 17.5008 4.11211C17.5008 3.7244 17.818 3.40718 18.2057 3.40718L19.2396 3.41893H19.8505V1.77408C19.8505 1.38637 20.1677 1.0574 20.5554 1.0574C20.9431 1.0574 21.2603 1.38637 21.2603 1.77408L21.2485 2.60825V3.40718H22.905C23.2927 3.40718 23.6099 3.7244 23.6099 4.11211C23.5979 4.3017 23.5188 4.48081 23.3867 4.61731ZM8.22089 11.0216C8.96245 11.0216 9.67365 10.727 10.198 10.2026C10.7224 9.67824 11.017 8.96701 11.017 8.2254C11.017 7.48379 10.7224 6.77256 10.198 6.24816C9.67365 5.72376 8.96245 5.42916 8.22089 5.42916C7.47932 5.42916 6.76812 5.72376 6.24376 6.24816C5.71939 6.77256 5.4248 7.48379 5.4248 8.2254C5.4248 8.96701 5.71939 9.67824 6.24376 10.2026C6.76812 10.727 7.47932 11.0216 8.22089 11.0216Z" fill="#0F71EF" />
                            <path d="M22.2864 8.2209H21.7342V13.6371L21.5815 13.5079C20.6652 12.7207 19.1849 12.7207 18.2685 13.5079L13.3812 17.7023C12.4649 18.4894 10.9846 18.4894 10.0682 17.7023L9.6688 17.3733C8.83467 16.6449 7.50712 16.5744 6.56727 17.2088L2.17342 20.1578C1.91496 19.4998 1.76224 18.7362 1.76224 17.8432V7.99767C1.76224 4.68449 3.51272 2.9339 6.82573 2.9339H16.4475V2.38171C16.4475 1.91175 16.5298 1.51229 16.7177 1.17157H6.82573C2.54937 1.17157 0 3.72108 0 7.99767V17.8432C0 19.1239 0.223216 20.24 0.657901 21.1799C1.66825 23.4122 3.82993 24.6693 6.82573 24.6693H16.6708C20.9471 24.6693 23.4965 22.1198 23.4965 17.8432V7.95068C23.1558 8.13866 22.7563 8.2209 22.2864 8.2209Z" fill="#0F71EF" />
                          </svg>
                        </label>
                      </div>

                      {/* Primary Image Display */}
                      {primaryImage && (
                        <div className="primary-image-section">
                          <div className="primary-image-label">تصویر اصلی</div>
                          <div className="primary-image-container">
                            {primaryImage.type.startsWith('image/') ? (
                              <img
                                src={primaryImage.url}
                                alt={primaryImage.name}
                                className="primary-image"
                              />
                            ) : primaryImage.type.startsWith('video/') ? (
                              <video controls className="primary-image">
                                <source src={primaryImage.url} type={primaryImage.type} />
                              </video>
                            ) : null}
                            <button
                              className="remove-file-btn"
                              onClick={() => handleRemoveFile(primaryImage.id, 'image')}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="red"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="icon icon-tabler icons-tabler-outline icon-tabler-x"
                              >
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M18 6l-12 12" />
                                <path d="M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Profile Images Grid */}
                      {profileImages.length > 0 && (
                        <div className="profile-images-grid">
                          {profileImages.map((file) => (
                            <div
                              key={file.id}
                              className={`profile-image-item ${file.id === primaryImage?.id ? 'primary' : ''}`}
                            >
                              {file.type.startsWith('image/') ? (
                                <div className="image-container-with-badge">
                                  <img
                                    src={file.url}
                                    alt={file.name}
                                    className="media-preview"
                                  />
                                  {file.orientation && (
                                    <div className="orientation-badge">
                                      {file.orientation === 'north' && 'شمال'}
                                      {file.orientation === 'south' && 'جنوب'}
                                      {file.orientation === 'east' && 'شرق'}
                                      {file.orientation === 'west' && 'غرب'}
                                    </div>
                                  )}
                                </div>
                              ) : file.type.startsWith('video/') ? (
                                <video className="media-preview">
                                  <source src={file.url} type={file.type} />
                                </video>
                              ) : null}

                              <div className="profile-image-actions">
                                {file.type.startsWith('image/') && file.id !== primaryImage?.id && (
                                  <button
                                    className="set-primary-btn"
                                    onClick={() => handleSetPrimaryImage(file.id)}
                                  >
                                    اصلی
                                  </button>
                                )}
                                <button
                                  className="remove-file-btn-small"
                                  onClick={() => handleRemoveFile(file.id, 'image')}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="red"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="icon icon-tabler icons-tabler-outline icon-tabler-x"
                                  >
                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                    <path d="M18 6l-12 12" />
                                    <path d="M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Audio Files Section */}
                    <div className="file-upload-section">
                      <div className="file-section-header">
                        <span className="file-section-title">فایل‌های صوتی مربوط به اطلاعات فرهنگی</span>
                        <label className="add-file-btn">
                          <input
                            type="file"
                            accept="audio/*"
                            multiple
                            onChange={(e) => handleFileUploadWithModal(e, 'audio')} // Changed to handleFileUploadWithModal
                            className="file-input-hidden"
                          />
                          افزودن فایل صوتی
                        </label>
                      </div>

                      {/* Audio Files List */}
                      {audioFiles.length > 0 && (
                        <div className="audio-files-list">
                          {audioFiles.map((audio) => (
                            <div key={audio.id} className="audio-file-item">
                              <div className="audio-file-info">
                                <div className="audio-icon">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#0F71EF" />
                                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C9.79086 2 8 3.79086 8 6V12C8 14.2091 9.79086 16 12 16C14.2091 16 16 14.2091 16 12V6C16 3.79086 14.2091 2 12 2ZM14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z" fill="#0F71EF" />
                                    <path fillRule="evenodd" clipRule="evenodd" d="M19 10C19.5523 10 20 10.4477 20 11V12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12V11C4 10.4477 4.44772 10 5 10C5.55228 10 6 10.4477 6 11V12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12V11C18 10.4477 18.4477 10 19 10Z" fill="#0F71EF" />
                                  </svg>
                                </div>
                                <span className="audio-file-name">{audio.name}</span>
                              </div>
                              <button
                                className="remove-audio-btn"
                                onClick={() => handleRemoveFile(audio.id, 'audio')}
                              >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#EA4335" />
                                  <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#EA4335" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Text Files Section */}
                    <div className="file-upload-section">
                      <div className="file-section-header">
                        <span className="file-section-title">فایل‌های متنی مربوط اطلاعات فرهنگی</span>
                        <label className="add-file-btn">
                          <input
                            type="file"
                            accept=".pdf,.txt,.doc,.docx,.xls,.xlsx"
                            multiple
                            onChange={(e) => handleFileUploadWithModal(e, 'text')} // Changed to handleFileUploadWithModal
                            className="file-input-hidden"
                          />
                          افزودن فایل متنی
                        </label>
                      </div>

                      {/* Text Files List */}
                      {textFiles.length > 0 && (
                        <div className="text-files-list">
                          {textFiles.map((textFile) => (
                            <div key={textFile.id} className="text-file-item">
                              <div className="text-file-info">
                                <div className="pdf-icon">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6 2C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2H6Z" fill="#EA4335" />
                                    <path d="M14 2V8H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M9 12H15M9 16H15M7 8H8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </div>
                                <span className="text-file-name">{textFile.name}</span>
                              </div>
                              <button
                                className="remove-text-btn"
                                onClick={() => handleRemoveFile(textFile.id, 'text')}
                              >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                                  <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                className="cancel-btn11"
                onClick={closeAddCulturalModal}
              >
                انصراف و بستن
              </button>
              <button
                className="confirm-btn"
                onClick={culturalStep === 4 ? handleSaveCulturalData : handleCulturalNextStep}
              >
                {culturalStep === 4 ? 'تایید و ثبت اطلاعات' : 'تایید و مرحله بعد'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isTitleLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="language-modal">
            <div className="modal-header">
              <h3>ورود عنوان به زبان‌های دیگر</h3>
            </div>

            <div className="modal-content">
              <div className="language-fields">
                <div className="language-field">
                  <label className="language-label">انگلیسی</label>
                  <input
                    type="text"
                    className="language-input"
                    value={languageTitles.english}
                    onChange={(e) => handleLanguageTitleChange('english', e.target.value)}
                    placeholder="Title in English"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">عربی</label>
                  <input
                    type="text"
                    className="language-input"
                    value={languageTitles.arabic}
                    onChange={(e) => handleLanguageTitleChange('arabic', e.target.value)}
                    placeholder="العنوان باللغة العربية"
                    dir="rtl"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">اردو</label>
                  <input
                    type="text"
                    className="language-input"
                    value={languageTitles.urdu}
                    onChange={(e) => handleLanguageTitleChange('urdu', e.target.value)}
                    placeholder="عنوان اردو میں"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => setIsTitleLanguageModalOpen(false)}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={() => setIsTitleLanguageModalOpen(false)}
              >
                ذخیره زبان‌های دیگر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Description Language Modal */}
      {isDescriptionLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="language-modal">
            <div className="modal-header">
              <h3>ورود توضیحات به زبان‌های دیگر</h3>
            </div>

            <div className="modal-content">
              <div className="language-fields">
                <div className="language-field">
                  <label className="language-label">انگلیسی</label>
                  <textarea
                    className="language-textarea"
                    value={languageDescriptions.english}
                    onChange={(e) => handleLanguageDescriptionChange('english', e.target.value)}
                    placeholder="Description in English"
                    rows="2"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">عربی</label>
                  <textarea
                    className="language-textarea"
                    value={languageDescriptions.arabic}
                    onChange={(e) => handleLanguageDescriptionChange('arabic', e.target.value)}
                    placeholder="الوصف باللغة العربية"
                    dir="rtl"
                    rows="2"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">اردو</label>
                  <textarea
                    className="language-textarea"
                    value={languageDescriptions.urdu}
                    onChange={(e) => handleLanguageDescriptionChange('urdu', e.target.value)}
                    placeholder="تفصیل اردو میں"
                    dir="rtl"
                    rows="2"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => setIsDescriptionLanguageModalOpen(false)}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={() => setIsDescriptionLanguageModalOpen(false)}
              >
                ذخیره زبان‌های دیگر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language Description Modal (for cultural info) */}
      {isDescriptionLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="language-modal">
            <div className="modal-header">
              <h3>ورود توضیحات به سایر زبان ها </h3>
            </div>

            <div className="modal-content">
              <div className="language-fields">

                <div className="language-field">
                  <label className="language-label">انگلیسی</label>
                  <textarea
                    className="language-textarea"
                    value={languageDescriptions.english}
                    onChange={(e) => handleLanguageDescriptionChange('english', e.target.value)}
                    placeholder="Description in English"
                    rows="3"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">عربی</label>
                  <textarea
                    className="language-textarea"
                    value={languageDescriptions.arabic}
                    onChange={(e) => handleLanguageDescriptionChange('arabic', e.target.value)}
                    placeholder="الوصف باللغة العربية"
                    dir="rtl"
                    rows="3"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">اردو</label>
                  <textarea
                    className="language-textarea"
                    value={languageDescriptions.urdu}
                    onChange={(e) => handleLanguageDescriptionChange('urdu', e.target.value)}
                    placeholder="تفصیل اردو میں"
                    dir="rtl"
                    rows="3"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => setIsDescriptionLanguageModalOpen(false)}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={handleSaveLanguageDescriptions}
              >
                تایید و ثبت
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddressLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="language-modal">
            <div className="modal-header">
              <h3>ورود آدرس به سایر زبان‌ها</h3>
            </div>

            <div className="modal-content">
              <div className="language-fields">
                <div className="language-field">
                  <label className="language-label">انگلیسی</label>
                  <textarea
                    className="language-textarea"
                    value={languageAddresses.english}
                    onChange={(e) => handleLanguageAddressChange('english', e.target.value)}
                    placeholder="Address in English"
                    rows="2"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">عربی</label>
                  <textarea
                    className="language-textarea"
                    value={languageAddresses.arabic}
                    onChange={(e) => handleLanguageAddressChange('arabic', e.target.value)}
                    placeholder="العنوان باللغة العربية"
                    dir="rtl"
                    rows="2"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">اردو</label>
                  <textarea
                    className="language-textarea"
                    value={languageAddresses.urdu}
                    onChange={(e) => handleLanguageAddressChange('urdu', e.target.value)}
                    placeholder="پتہ اردو میں"
                    dir="rtl"
                    rows="2"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => setIsAddressLanguageModalOpen(false)}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={handleSaveLanguageAddresses}
              >
                ذخیره زبان‌های دیگر
              </button>
            </div>
          </div>
        </div>
      )}
      {isAvatarModalOpen && (
        <div className="modal-overlay">
          <div className="avatar-upload-modal">
            <div className="modal-header">
              <h3>تغییر تصویر پروفایل</h3>
            </div>

            <div className="modal-content">
              <div className="avatar-upload-area">
                <div className="avatar-preview">
                  {(avatarPreview || adminAvatar) ? (
                    <img
                      src={avatarPreview || adminAvatar}
                      alt="Avatar Preview"
                      className="avatar-preview-img"
                    />
                  ) : (
                    <div className="avatar-preview-placeholder">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
                        <path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
                      </svg>
                      <span>تصویر پروفایل</span>
                    </div>
                  )}
                </div>

                <div className="upload-actions">
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                    onChange={handleAvatarFileSelect}
                    className="hidden-file-input"
                  />
                  <label htmlFor="avatar-upload" className="upload-btn">
                    {avatarPreview ? 'تغییر تصویر' : 'انتخاب تصویر'}
                  </label>

                  {(avatarPreview || adminAvatar) && (
                    <button
                      className="remove-btn"
                      onClick={handleRemoveAvatar}
                    >
                      حذف تصویر
                    </button>
                  )}
                </div>

                <div className="upload-instructions">
                  <p>• فرمت‌های مجاز: JPEG, PNG, GIF, WebP</p>
                  <p>• حداکثر حجم: ۵ مگابایت</p>
                  <p>• سایز توصیه شده: ۴۰۰×۴۰۰ پیکسل</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => setIsAvatarModalOpen(false)}
                disabled={isUploadingAvatar}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={handleSaveAvatar}
                disabled={!avatarPreview || isUploadingAvatar}
              >
                {isUploadingAvatar ? 'در حال آپلود...' : 'ذخیره تصویر'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Orientation Modal */}
      {showOrientationModal && pendingImageFile && (
        <div className="modal-overlay">
          <div className="orientation-modal">
            <div className="modal-header">
              <h3>انتخاب زاویه عکس</h3>
            </div>

            <div className="modal-content">
              <div className="image-preview-container">
                <img
                  src={pendingImageFile.url}
                  alt="Preview"
                  className="image-preview"
                />
              </div>

              <div className="orientation-options-grid">
                <button
                  className={`orientation-option ${selectedOrientation === 'north' ? 'selected' : ''}`}
                  onClick={() => setSelectedOrientation('north')}
                >
                  <span>جهت شمالی</span>
                </button>

                <button
                  className={`orientation-option ${selectedOrientation === 'south' ? 'selected' : ''}`}
                  onClick={() => setSelectedOrientation('south')}
                >
                  <span>جهت جنوبی</span>
                </button>

                <button
                  className={`orientation-option ${selectedOrientation === 'east' ? 'selected' : ''}`}
                  onClick={() => setSelectedOrientation('east')}
                >
                  <span>جهت شرقی</span>
                </button>

                <button
                  className={`orientation-option ${selectedOrientation === 'west' ? 'selected' : ''}`}
                  onClick={() => setSelectedOrientation('west')}
                >
                  <span>جهت غربی</span>
                </button>
              </div>
            </div>

            <div className="modal-footer">
              {/* <button
                className="cancel-btn5"
                onClick={handleSkipOrientation}
              >
                رد کردن
              </button> */}
              <button
                className="confirm-btn"
                onClick={() => selectedOrientation ? handleOrientationSelect(selectedOrientation) : handleSkipOrientation()}
              >
                تایید و ادامه
              </button>
            </div>
          </div>
        </div>
      )}
      {/* File Upload Modal */}
      {/* File Upload Modal */}
      {isFileUploadModalOpen && pendingFileInfo && (
        <div className="modal-overlay">
          <div className="language-modal">
            <div className="modal-header">
              <h3>ورود اطلاعات فایل</h3>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label className="form-label">عنوان فایل (الزامی)</label>
                <div className="title-input-with-language">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="عنوان فایل را وارد کنید"
                    value={fileUploadTitle}
                    onChange={(e) => setFileUploadTitle(e.target.value)}
                    required
                  />
                  <button
                    className="language-input-btn"
                    type="button"
                    onClick={openFileTitleLanguageModal}  // Changed to title-specific modal
                    title="ورود عنوان به زبان‌های دیگر"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">توضیحات فایل (الزامی)</label>
                <div className="description-input-with-language">
                  <textarea
                    className="form-textarea"
                    placeholder="توضیحات فایل را وارد کنید"
                    value={fileUploadDescription}
                    onChange={(e) => setFileUploadDescription(e.target.value)}
                    rows="3"
                    required
                  />
                  <button
                    className="language-input-btn15"
                    type="button"
                    onClick={openFileDescriptionLanguageModal}  // Changed to description-specific modal
                    title="ورود توضیحات به زبان‌های دیگر"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* ... rest of file info preview ... */}
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => {
                  setIsFileUploadModalOpen(false);
                  setPendingFileInfo(null);
                }}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={handleSaveFileWithDetails}
                disabled={!fileUploadTitle.trim() || !fileUploadDescription.trim()}
              >
                ذخیره و آپلود فایل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Title Language Modal */}
      {isFileTitleLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="language-modal">
            <div className="modal-header">
              <h3>ورود عنوان فایل به زبان‌های دیگر</h3>
            </div>

            <div className="modal-content">
              <div className="language-fields">
                <div className="language-field">
                  <label className="language-label">انگلیسی</label>
                  <input
                    type="text"
                    className="language-input"
                    value={fileLanguageTitles.english}
                    onChange={(e) => handleFileLanguageTitleChange('english', e.target.value)}
                    placeholder="Title in English"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">عربی</label>
                  <input
                    type="text"
                    className="language-input"
                    value={fileLanguageTitles.arabic}
                    onChange={(e) => handleFileLanguageTitleChange('arabic', e.target.value)}
                    placeholder="العنوان باللغة العربية"
                    dir="rtl"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">اردو</label>
                  <input
                    type="text"
                    className="language-input"
                    value={fileLanguageTitles.urdu}
                    onChange={(e) => handleFileLanguageTitleChange('urdu', e.target.value)}
                    placeholder="عنوان اردو میں"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => setIsFileTitleLanguageModalOpen(false)}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={() => setIsFileTitleLanguageModalOpen(false)}
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Description Language Modal */}
      {isFileDescriptionLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="language-modal">
            <div className="modal-header">
              <h3>ورود توضیحات فایل به زبان‌های دیگر</h3>
            </div>

            <div className="modal-content">
              <div className="language-fields">
                <div className="language-field">
                  <label className="language-label">انگلیسی</label>
                  <textarea
                    className="language-textarea"
                    value={fileLanguageDescriptions.english}
                    onChange={(e) => handleFileLanguageDescriptionChange('english', e.target.value)}
                    placeholder="Description in English"
                    rows="2"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">عربی</label>
                  <textarea
                    className="language-textarea"
                    value={fileLanguageDescriptions.arabic}
                    onChange={(e) => handleFileLanguageDescriptionChange('arabic', e.target.value)}
                    placeholder="الوصف باللغة العربية"
                    dir="rtl"
                    rows="2"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">اردو</label>
                  <textarea
                    className="language-textarea"
                    value={fileLanguageDescriptions.urdu}
                    onChange={(e) => handleFileLanguageDescriptionChange('urdu', e.target.value)}
                    placeholder="تفصیل اردو میں"
                    dir="rtl"
                    rows="2"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => setIsFileDescriptionLanguageModalOpen(false)}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={() => setIsFileDescriptionLanguageModalOpen(false)}
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Language Modal */}
      {isFileLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="language-modal">
            <div className="modal-header">
              <h3>ورود اطلاعات فایل به زبان‌های دیگر</h3>
            </div>

            <div className="modal-content">
              <div className="language-fields">
                <div className="language-field">
                  <label className="language-label">عنوان انگلیسی</label>
                  <input
                    type="text"
                    className="language-input"
                    value={fileLanguageTitles.english}
                    onChange={(e) => handleFileLanguageTitleChange('english', e.target.value)}
                    placeholder="Title in English"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">عنوان عربی</label>
                  <input
                    type="text"
                    className="language-input"
                    value={fileLanguageTitles.arabic}
                    onChange={(e) => handleFileLanguageTitleChange('arabic', e.target.value)}
                    placeholder="العنوان باللغة العربية"
                    dir="rtl"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">عنوان اردو</label>
                  <input
                    type="text"
                    className="language-input"
                    value={fileLanguageTitles.urdu}
                    onChange={(e) => handleFileLanguageTitleChange('urdu', e.target.value)}
                    placeholder="عنوان اردو میں"
                    dir="rtl"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">توضیحات انگلیسی</label>
                  <textarea
                    className="language-textarea"
                    value={fileLanguageDescriptions.english}
                    onChange={(e) => handleFileLanguageDescriptionChange('english', e.target.value)}
                    placeholder="Description in English"
                    rows="2"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">توضیحات عربی</label>
                  <textarea
                    className="language-textarea"
                    value={fileLanguageDescriptions.arabic}
                    onChange={(e) => handleFileLanguageDescriptionChange('arabic', e.target.value)}
                    placeholder="الوصف باللغة العربية"
                    dir="rtl"
                    rows="2"
                  />
                </div>

                <div className="language-field">
                  <label className="language-label">توضیحات اردو</label>
                  <textarea
                    className="language-textarea"
                    value={fileLanguageDescriptions.urdu}
                    onChange={(e) => handleFileLanguageDescriptionChange('urdu', e.target.value)}
                    placeholder="تفصیل اردو میں"
                    dir="rtl"
                    rows="2"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => setIsFileLanguageModalOpen(false)}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={handleSaveFileLanguageInfo}
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restriction Modal for Edit Page */}
      {isRestrictionModalOpen && (
        <div className="modal-overlay">
          <div className="add-place-modal restriction-modal-edit">
            {/* Modal Header */}
            <div className="modal-header">
              <div className="step-text">
                <span className="step-title" >افزودن محدودیت</span>
              </div>
            </div>

            {/* Modal Content */}
            <div className="modal-content">
              <div className="step-content step3-content">
                <div className="step-intro3">
                  <h3>افزودن محدودیت جدید</h3>
                </div>

                <div className="form-section">
                  {/* Time-based Restrictions Section */}
                  <div className="restriction-section">
                    <div className="restriction-header">
                      <span className="restriction-title">محدودیت بر اساس روز، ساعت و جنسیت</span>
                      <button
                        className="add-restriction-btn"
                        onClick={() => {
                          setEditIsDateFilterOpen(!editIsDateFilterOpen);
                          setEditIsPrayerDateFilterOpen(false);
                        }}
                      >
                        افزودن محدودیت
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                          <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                        </svg>
                      </button>
                    </div>

                    {/* Date Filter Popup */}
                    {editIsDateFilterOpen && !editRestrictionFormOpen && (
                      <div className={`date-filter-popup ${editSelectedDateFilter.includes('انتخاب از تقویم') ? 'calendar-selectable' : ''}`}>
                        <div className="date-filter-content">
                          {/* Filter by Date Section */}
                          <div className="filter-section">
                            <div className="date-filter-option2">
                              <div className="filter-title">فیلتر بر اساس تاریخ</div>
                              <div
                                className={`date-filter-option ${editSelectedDateFilter.includes('همه روزه') ? 'selected' : ''}`}
                                onClick={() => handleEditDateFilterToggle('همه روزه')}
                              >
                                همه روزه
                              </div>
                              <div
                                className={`date-filter-option ${editSelectedDateFilter.includes('تمام این ماه') ? 'selected' : ''}`}
                                onClick={() => handleEditDateFilterToggle('تمام این ماه')}
                              >
                                تمام این ماه
                              </div>
                              <div
                                className={`date-filter-option ${editSelectedDateFilter.includes('کل این هفته') ? 'selected' : ''}`}
                                onClick={() => handleEditDateFilterToggle('کل این هفته')}
                              >
                                کل این هفته
                              </div>
                            </div>
                            <div
                              className={`calendar-select-option ${editSelectedDateFilter.includes('انتخاب از تقویم') ? 'selected' : ''}`}
                              onClick={() => handleEditDateFilterToggle('انتخاب از تقویم')}
                            >
                              انتخاب از تقویم
                            </div>
                          </div>

                          {/* Select from Calendar Section */}
                          <div className="filter-section">
                            <div className="jalali-calendar">
                              {/* Calendar Header with Month/Year Selection */}
                              <div className="calendar-header">
                                <div className="month-year-selector">
                                  <select
                                    value={editCalendarDate.month}
                                    onChange={(e) => setEditCalendarDate(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                                    className="month-select"
                                  >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                      <option key={month} value={month}>
                                        {getJalaliMonthName(month)}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={editCalendarDate.year}
                                    onChange={(e) => setEditCalendarDate(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                                    className="year-select"
                                  >
                                    {Array.from({ length: 10 }, (_, i) => 1400 + i).map(year => (
                                      <option key={year} value={year}>{year}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="calendar-nav">
                                  <button
                                    className="nav-btn prev"
                                    onClick={handleEditPrevMonth}
                                  >
                                    ‹
                                  </button>
                                  <button
                                    className="nav-btn next"
                                    onClick={handleEditNextMonth}
                                  >
                                    ›
                                  </button>
                                </div>
                              </div>

                              {/* Day Names */}
                              <div className="day-names">
                                <div className="day-name">ش</div>
                                <div className="day-name">یک</div>
                                <div className="day-name">دو</div>
                                <div className="day-name">سه</div>
                                <div className="day-name">چهار</div>
                                <div className="day-name">پنج</div>
                                <div className="day-name">ج</div>
                              </div>

                              {/* Calendar Days Grid */}
                              <div className="calendar-days">
                                {renderEditJalaliCalendarDays()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Restriction Form */}
                    {editRestrictionFormOpen && editSelectedRestrictionType && (
                      <div className="restriction-form-container2">
                        {/* Black header with title and close button */}
                        <div className="restriction-form-header">
                          <div className="restriction-title-black">
                            <span className="restriction-label">محدودیت‌های</span>
                            <span className="restriction-value">{getEditRestrictionTitle()}</span>
                          </div>
                          <button
                            className="close-restriction-btn"
                            onClick={() => {
                              setEditRestrictionFormOpen(false);
                              setEditSelectedRestrictionType(null);
                            }}
                          >
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="0.5" y="0.5" width="31" height="31" rx="5.5" stroke="#EA4335" />
                              <path fillRule="evenodd" clipRule="evenodd" d="M22.6654 16C22.6654 19.6819 19.6806 22.6666 15.9987 22.6666C12.3168 22.6666 9.33203 19.6819 9.33203 16C9.33203 12.3181 12.3168 9.33331 15.9987 9.33331C19.6806 9.33331 22.6654 12.3181 22.6654 16ZM13.9784 13.9797C14.1737 13.7845 14.4903 13.7845 14.6856 13.9797L15.9987 15.2929L17.3118 13.9798C17.507 13.7845 17.8236 13.7845 18.0189 13.9798C18.2142 14.175 18.2142 14.4916 18.0189 14.6869L16.7058 16L18.0189 17.3131C18.2141 17.5083 18.2141 17.8249 18.0189 18.0202C17.8236 18.2154 17.507 18.2154 17.3118 18.0202L15.9987 16.7071L14.6856 18.0202C14.4903 18.2154 14.1737 18.2154 13.9785 18.0202C13.7832 17.8249 13.7832 17.5083 13.9785 17.3131L15.2916 16L13.9784 14.6869C13.7832 14.4916 13.7832 14.175 13.9784 13.9797Z" fill="#EA4335" />
                            </svg>
                          </button>
                        </div>

                        {/* Gender Restrictions */}
                        <div className="gender-restrictions-section">
                          <div className="section-title3">محدودسازی جنسیتی برای تردد</div>
                          <div className="gender-options">
                            {['زنانه', 'مردانه', 'خانوادگی'].map((gender) => (
                              <div
                                key={gender}
                                className={`gender-option ${editSelectedGenderRestrictions.includes(gender) ? 'selected' : ''}`}
                                onClick={() => handleEditGenderRestrictionToggle(gender)}
                              >
                                <div className="gender-checkbox">
                                  {editSelectedGenderRestrictions.includes(gender) ? (
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" fill="#0F71EF" stroke="#0F71EF" />
                                      <path fillRule="evenodd" clipRule="evenodd" d="M14.0303 6.96967C14.3232 7.26256 14.3232 7.73744 14.0303 8.03033L9.03033 13.0303C8.73744 13.3232 8.26256 13.3232 7.96967 13.0303L5.96967 11.0303C5.67678 10.7374 5.67678 10.2626 5.96967 9.96967C6.26256 9.67678 6.73744 9.67678 7.03033 9.96967L8.5 11.4393L12.9697 6.96967C13.2626 6.67678 13.7374 6.67678 14.0303 6.96967Z" fill="white" />
                                    </svg>
                                  ) : (
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" stroke="#D9D9D9" />
                                    </svg>
                                  )}
                                </div>
                                <span>{gender}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Time Restrictions */}
                        <div className="time-restrictions-section">
                          <div className="section-title5">محدودسازی زمانی برای تردد
                            <button
                              className="add-time-btn"
                              onClick={handleEditAddTimeRestriction}
                              disabled={editLimitAllHours || editTimeRestrictionPairs.length >= 4}
                            >
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M10.0013 18.3333C14.6037 18.3333 18.3346 14.6023 18.3346 9.99996C18.3346 5.39759 14.6037 1.66663 10.0013 1.66663C5.39893 1.66663 1.66797 5.39759 1.66797 9.99996C1.66797 14.6023 5.39893 18.3333 10.0013 18.3333ZM10.6263 7.49996C10.6263 7.15478 10.3465 6.87496 10.0013 6.87496C9.65612 6.87496 9.3763 7.15478 9.3763 7.49996L9.3763 9.37498H7.5013C7.15612 9.37498 6.8763 9.6548 6.8763 9.99998C6.8763 10.3452 7.15612 10.625 7.5013 10.625H9.3763V12.5C9.3763 12.8451 9.65612 13.125 10.0013 13.125C10.3465 13.125 10.6263 12.8451 10.6263 12.5L10.6263 10.625H12.5013C12.8465 10.625 13.1263 10.3452 13.1263 9.99998C13.1263 9.6548 12.8465 9.37498 12.5013 9.37498H10.6263V7.49996Z" fill="#14C472" />
                              </svg>
                            </button>
                          </div>

                          {/* Time Restriction Pairs Grid */}
                          <div className={`time-pairs-scrollable-container ${editTimeRestrictionPairs.length > 2 ? 'scrollable' : ''}`}>
                            <div className={`time-pairs-grid ${editTimeRestrictionPairs.length > 2 ? 'multi-row' : ''}`}>
                              {editTimeRestrictionPairs.map((pair, index) => (
                                <div key={index} className="time-pair">
                                  <div className="time-inputs">
                                    <div className="time-input-group">
                                      <label>شروع:</label>
                                      <input
                                        type="time"
                                        value={pair.start}
                                        onChange={(e) => handleEditTimeChange(index, 'start', e.target.value)}
                                        disabled={editLimitAllHours}
                                        className="time-input"
                                      />
                                    </div>
                                    <div className="time-input-group">
                                      <label>پایان :</label>
                                      <input
                                        type="time"
                                        value={pair.end}
                                        onChange={(e) => handleEditTimeChange(index, 'end', e.target.value)}
                                        disabled={editLimitAllHours}
                                        className="time-input"
                                      />
                                    </div>
                                  </div>
                                  {editTimeRestrictionPairs.length > 1 && (
                                    <button
                                      className="remove-time-btn"
                                      onClick={() => handleEditRemoveTimeRestriction(index)}
                                      disabled={editLimitAllHours}
                                    >
                                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9.45597 18.3333H10.13C12.4489 18.3333 13.6084 18.3333 14.3622 17.578C15.1161 16.8227 15.1932 15.5837 15.3475 13.1058L15.5697 9.53534C15.6534 8.19086 15.6953 7.51861 15.3171 7.09262C14.9389 6.66663 14.3002 6.66663 13.0229 6.66663H6.56301C5.28569 6.66663 4.64704 6.66663 4.26885 7.09262C3.89065 7.51861 3.9325 8.19086 4.0162 9.53535L4.23846 13.1058C4.39272 15.5837 4.46984 16.8227 5.22371 17.578C5.97758 18.3333 7.13704 18.3333 9.45597 18.3333Z" fill="#EA4335" />
                                        <path d="M2.29297 5.13885C2.29297 4.75533 2.58079 4.44442 2.93583 4.44442L5.15603 4.44404C5.59716 4.43197 5.98632 4.12897 6.13642 3.68072C6.14037 3.66893 6.1449 3.6544 6.16118 3.60165L6.25685 3.29157C6.31539 3.10145 6.36639 2.93581 6.43776 2.78776C6.71971 2.20287 7.24137 1.79671 7.84419 1.69273C7.99678 1.6664 8.15837 1.66652 8.34385 1.66664H11.2422C11.4277 1.66652 11.5893 1.6664 11.7419 1.69273C12.3447 1.79671 12.8664 2.20287 13.1483 2.78776C13.2197 2.93581 13.2707 3.10145 13.3292 3.29157L13.4249 3.60165C13.4412 3.6544 13.4457 3.66893 13.4497 3.68072C13.5998 4.12897 14.0661 4.43234 14.5073 4.44442H16.6501C17.0052 4.44442 17.293 4.75533 17.293 5.13885C17.293 5.52238 17.0052 5.83329 16.6501 5.83329H2.93583C2.58079 5.83329 2.29297 5.52238 2.29297 5.13885Z" fill="#EA4335" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="time-restrictions-footer">
                            <div
                              className="all-hours-option"
                              onClick={() => {
                                setEditLimitAllHours(!editLimitAllHours);
                                if (!editLimitAllHours) {
                                  setEditTimeRestrictionPairs([{ start: '', end: '' }]);
                                }
                              }}
                            >
                              <div className="all-hours-checkbox">
                                {editLimitAllHours ? (
                                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" fill="#0F71EF" stroke="#0F71EF" />
                                    <path fillRule="evenodd" clipRule="evenodd" d="M14.0303 6.96967C14.3232 7.26256 14.3232 7.73744 14.0303 8.03033L9.03033 13.0303C8.73744 13.3232 8.26256 13.3232 7.96967 13.0303L5.96967 11.0303C5.67678 10.7374 5.67678 10.2626 5.96967 9.96967C6.26256 9.67678 6.73744 9.67678 7.03033 9.96967L8.5 11.4393L12.9697 6.96967C13.2626 6.67678 13.7374 6.67678 14.0303 6.96967Z" fill="white" />
                                  </svg>
                                ) : (
                                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" stroke="#D9D9D9" />
                                  </svg>
                                )}
                              </div>
                              <span>محدودیت برای تمام ساعات روز</span>
                            </div>
                            {/* <button
                              className="confirm-restriction-btn"
                              onClick={handleEditConfirmRestriction}
                              disabled={!isEditRestrictionFormValid()}
                            >
                              تایید و افزودن محدودیت زمانی
                            </button> */}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Prayer Time Restrictions Section */}
                  <div className="restriction-section">
                    <div className="restriction-header">
                      <span className="restriction-title">محدودیت بر اساس اوقات شرعی (برای همه روزها)</span>
                      <button
                        className="add-restriction-btn"
                        onClick={() => {
                          setEditIsPrayerDateFilterOpen(prev => !prev);
                          setEditIsDateFilterOpen(false);
                          setEditRestrictionFormOpen(false);
                        }}
                      >
                        افزودن محدودیت
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                          <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                        </svg>
                      </button>
                    </div>

                    {editPrayerRestrictionFormOpen && (
                      <div className="prayer-form">
                        <div className="prayer-form-grid">
                          <div className="form-column">
                            <label className="form-label">انتخاب رویداد</label>
                            <div className="prayer-event-grid">
                              {PRAYER_EVENT_OPTIONS.map((option) => (
                                <div
                                  key={option.value}
                                  className={`prayer-event-option ${editSelectedPrayerEvents.includes(option.value) ? 'selected' : ''}`}
                                  onClick={() => toggleEditPrayerEvent(option.value)}
                                >
                                  {editSelectedPrayerEvents.includes(option.value) ? (
                                    <svg width="22" height="22" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#0F71EF" /></svg>
                                  ) : (
                                    <svg width="22" height="22" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#fff" stroke="#D9D9D9" /></svg>
                                  )}
                                  <span className="event-label">{option.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="form-column">
                            <label className="form-label">محدودسازی زمانی برای تردد</label>
                            <div className="minutes-inputs-grid">
                              <input
                                type="number"
                                min="0"
                                className="minute-input"
                                placeholder="دقیقه قبل از شروع: --"
                                value={editPrayerBeforeMinutes}
                                onChange={(e) => setEditPrayerBeforeMinutes(e.target.value)}
                              />
                              <input
                                type="number"
                                min="0"
                                className="minute-input"
                                placeholder="دقیقه قبل از پایان: --"
                                value={editPrayerAfterMinutes}
                                onChange={(e) => setEditPrayerAfterMinutes(e.target.value)}
                              />
                            </div>

                            {/* <div className="prayer-form-actions">
                              <button
                                className="confirm-prayer-btn"
                                onClick={handleEditConfirmPrayerRestriction}
                              >
                                تایید و افزودن محدودیت اوقات شرعی
                              </button>
                            </div> */}
                          </div>
                        </div>
                      </div>
                    )}

                    {editIsPrayerDateFilterOpen && !editPrayerRestrictionFormOpen && (
                      <div className="prayer-date-filter-popup">
                        <div className="date-filter-content">
                          {/* Filter by Date Section */}
                          <div className="filter-section">
                            <div className="date-filter-option2">
                              <div className="filter-title">فیلتر بر اساس تاریخ</div>
                              <div
                                className={`date-filter-option`}
                                onClick={() => {
                                  setEditPrayerSelectedJalaliDate(null);
                                  setEditPrayerRestrictionFormOpen(true);
                                  setEditIsPrayerDateFilterOpen(false);
                                }}
                              >
                                همه روزه
                              </div>
                              <div
                                className="date-filter-option"
                                onClick={() => {
                                  setEditPrayerSelectedJalaliDate(null);
                                  setEditPrayerRestrictionFormOpen(true);
                                  setEditIsPrayerDateFilterOpen(false);
                                }}
                              >
                                تمام این ماه
                              </div>
                              <div
                                className="date-filter-option"
                                onClick={() => {
                                  setEditPrayerSelectedJalaliDate(null);
                                  setEditPrayerRestrictionFormOpen(true);
                                  setEditIsPrayerDateFilterOpen(false);
                                }}
                              >
                                کل این هفته
                              </div>
                            </div>

                            <div
                              className="calendar-select-option selected"
                            >
                              انتخاب از تقویم
                            </div>
                          </div>

                          {/* Calendar (Jalali) */}
                          <div className="filter-section">
                            <div className="jalali-calendar">
                              <div className="calendar-header">
                                <div className="month-year-selector">
                                  <select
                                    value={editPrayerCalendarDate.month}
                                    onChange={(e) => setEditPrayerCalendarDate(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                                    className="month-select"
                                  >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                      <option key={month} value={month}>
                                        {getJalaliMonthName(month)}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={editPrayerCalendarDate.year}
                                    onChange={(e) => setEditPrayerCalendarDate(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                                    className="year-select"
                                  >
                                    {Array.from({ length: 10 }, (_, i) => 1400 + i).map(year => (
                                      <option key={year} value={year}>{year}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="calendar-nav">
                                  <button className="nav-btn" onClick={handleEditPrayerPrevMonth}>‹</button>
                                  <button className="nav-btn" onClick={handleEditPrayerNextMonth}>›</button>
                                </div>
                              </div>

                              <div className="day-names">
                                <div className="day-name">ش</div>
                                <div className="day-name">ی</div>
                                <div className="day-name">د</div>
                                <div className="day-name">س</div>
                                <div className="day-name">چ</div>
                                <div className="day-name">پ</div>
                                <div className="day-name">ج</div>
                              </div>

                              <div className="calendar-days">
                                {renderEditPrayerJalaliCalendarDays()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                className="cancel-btn11"
                onClick={handleCloseRestrictionModal}
              >
                انصراف و بستن
              </button>
              <button
                className="confirm-btn"
                onClick={() => {
                  // If time restriction form is open, handle it
                  if (editRestrictionFormOpen) {
                    handleEditConfirmRestriction();
                    handleCloseRestrictionModal();
                  }
                  // If prayer restriction form is open, handle it
                  else if (editPrayerRestrictionFormOpen) {
                    handleEditConfirmPrayerRestriction();
                    handleCloseRestrictionModal();
                  }
                  // Otherwise just close
                  else {
                    handleCloseRestrictionModal();
                  }
                }}
                disabled={
                  (editRestrictionFormOpen && !isEditRestrictionFormValid()) ||
                  (editPrayerRestrictionFormOpen && (editSelectedPrayerEvents.length === 0 || editPrayerBeforeMinutes === '' || editPrayerAfterMinutes === ''))
                }
              >
                تایید و افزودن محدودیت
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Language Titles Modal for Category */}
      {isCategoryTitleLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="language-titles-modal">
            <div className="modal-header">
              <h3>ورود عنوان دسته بندی به زبان‌های دیگر</h3>
            </div>

            <div className="modal-content">
              <div className="language-input-group">
                <label>انگلیسی</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Title in English"
                  value={categoryLanguageTitles.english}
                  onChange={(e) => setCategoryLanguageTitles(prev => ({
                    ...prev,
                    english: e.target.value
                  }))}
                />
              </div>

              <div className="language-input-group">
                <label>عربی</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="العنوان بالعربیة"
                  value={categoryLanguageTitles.arabic}
                  onChange={(e) => setCategoryLanguageTitles(prev => ({
                    ...prev,
                    arabic: e.target.value
                  }))}
                />
              </div>

              <div className="language-input-group">
                <label>اردو</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="اردو میں عنوان"
                  value={categoryLanguageTitles.urdu}
                  onChange={(e) => setCategoryLanguageTitles(prev => ({
                    ...prev,
                    urdu: e.target.value
                  }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setIsCategoryTitleLanguageModalOpen(false)}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={() => setIsCategoryTitleLanguageModalOpen(false)}
              >
                تایید
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Language Titles Modal for Edit Category */}
      {isEditCategoryTitleLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="language-titles-modal">
            <div className="modal-header">
              <h3>ویرایش عنوان دسته بندی به زبان‌های دیگر</h3>
            </div>

            <div className="modal-content">
              <div className="language-input-group">
                <label>انگلیسی</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Title in English"
                  value={editCategoryLanguageTitles.english}
                  onChange={(e) => setEditCategoryLanguageTitles(prev => ({
                    ...prev,
                    english: e.target.value
                  }))}
                />
              </div>

              <div className="language-input-group">
                <label>عربی</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="العنوان بالعربیة"
                  value={editCategoryLanguageTitles.arabic}
                  onChange={(e) => setEditCategoryLanguageTitles(prev => ({
                    ...prev,
                    arabic: e.target.value
                  }))}
                />
              </div>

              <div className="language-input-group">
                <label>اردو</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="اردو میں عنوان"
                  value={editCategoryLanguageTitles.urdu}
                  onChange={(e) => setEditCategoryLanguageTitles(prev => ({
                    ...prev,
                    urdu: e.target.value
                  }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setIsEditCategoryTitleLanguageModalOpen(false)}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={() => setIsEditCategoryTitleLanguageModalOpen(false)}
              >
                تایید
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Subcategories List Modal */}
      {showSubcategoriesModal && (
        <div className="modal-overlay">
          <div className="subcategories-list-modal">
            <div className="modal-header">
              <h3>لیست زیرگروه‌های دسته بندی</h3>
            </div>

            <div className="modal-content">
              <div className="subcategories-table-container">
                <table className="subcategories-table">
                  <thead>
                    <tr>
                      <th>عنوان زیرگروه</th>
                      <th>تاریخ ایجاد</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.find(cat => cat.id === editingCategoryId)?.subcategories?.map(subcategory => (
                      <tr key={subcategory.id}>
                        <td>
                          <div className="subcategory-title-cell5">
                            <span>{subcategory.title}</span>
                          </div>
                        </td>
                        <td>{subcategory.createdAt}</td>
                        <td>
                          <div className="subcategory-actions">
                            <button
                              className="edit-subcategory-btn"
                              onClick={() => handleEditSubcategory(subcategory)}
                            >
                              ویرایش
                            </button>
                            <button
                              className="delete-subcategory-btn"
                              onClick={() => handleDeleteSubcategory(subcategory)}
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) || (
                        <tr>
                          <td colSpan="4" className="no-subcategories">
                            هیچ زیرگروهی برای این دسته بندی وجود ندارد.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowSubcategoriesModal(false)}
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
      {showUserModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div
            className="user-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="user-details-modal-header">
              <h3>جزئیات کاربر</h3>
            </div>

            <div className="modal-content">
              {/* User Profile Section */}
              <div className="user-profile-section">
                <div className="profile-image-large3">
                  <svg fill="#ffffff" width="40px" height="40px" viewBox="0 0 36 36" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                    <path d="M30.61,24.52a17.16,17.16,0,0,0-25.22,0,1.51,1.51,0,0,0-.39,1v6A1.5,1.5,0,0,0,6.5,33h23A1.5,1.5,0,0,0,31,31.5v-6A1.51,1.51,0,0,0,30.61,24.52Z" className="clr-i-solid clr-i-solid-path-1"></path>
                    <circle cx="18" cy="10" r="7" className="clr-i-solid clr-i-solid-path-2"></circle>
                    <rect x="0" y="0" width="36" height="36" fillOpacity="0" />
                  </svg>
                </div>
                <div className="user-basic-info">
                  <h4>{selectedUser.fullName}</h4>
                  <span className="detail-label">تاریخ ثبت نام: </span>
                  <span className="detail-value">{selectedUser.registerDate}</span>
                </div>
              </div>

              {/* User Details Grid */}
              <div className="user-details-grid">
                <div className="detail-item">
                  <span className="detail-label">شماره تماس:</span>
                  <span className="detail-value">{selectedUser.phone}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">آخرین ورود:</span>
                  <span className="detail-value">{selectedUser.lastLogin}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">جنسیت:</span>
                  <span className="detail-value">{selectedUser.gender}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">مسیریابی موفق:</span>
                  <span className="detail-value success-badge">
                    {selectedUser.successCount} بار
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">تاریخ تولد:</span>
                  <span className="detail-value">{selectedUser.birthDate || 'ثبت نشده'}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">آدرس ایمیل:</span>
                  <span className="detail-value">
                    {selectedUser.email || <span className="empty-field">ثبت نشده</span>}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">استان:</span>
                  <span className="detail-value">
                    {selectedUser.province || <span className="empty-field">ثبت نشده</span>}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">شهر:</span>
                  <span className="detail-value">
                    {selectedUser.city || <span className="empty-field">ثبت نشده</span>}
                  </span>
                </div>
              </div>

              {/* Additional Info Section */}
              <div className="additional-info-section">
                <h4>اطلاعات تکمیلی</h4>
                <div className="info-cards">
                  <div className="info-card">
                    <span className="info-label">تعداد مسیرهای ذخیره شده:</span>
                    <span className="info-value3">{Math.floor(Math.random() * 10) + 1}</span>
                  </div>
                  <div className="info-card">
                    <span className="info-label">تعداد بازدید از مکان‌ها:</span>
                    <span className="info-value3">{Math.floor(Math.random() * 50) + 10}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-close-button-usersigned"
                onClick={() => setShowUserModal(false)}
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="modal-overlay">
          <div className="settings-modal-container">
            <div className="settings-modal-header">
              <h3 className="modal-title">تنظیمات</h3>
            </div>
            <div className="settings-modal-body">
              <div className="settings-content">
                <p className="settings-message">
                  بخش تنظیمات در حال توسعه می‌باشد. به زودی تنظیمات پیشرفته‌تری در این بخش ارائه خواهد شد.
                </p>
                <div className="settings-actions">
                  <button className="btn-primary" onClick={handleCloseSettingsModal}>
                    متوجه شدم
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isChangePasswordModalOpen && (
        <div className="modal-overlay">
          <div className="changepass-modal-container">
            <div className="changepass-modal-header">
              <h3 className="modal-title">تغییر رمز عبور</h3>
              <button className="modal-close-btn" onClick={handleCloseChangePasswordModal}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="#858585" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="changepass-modal-body">
              <div className="change-password-form">
                <div className="form-group">
                  <label className="form-label">رمز عبور فعلی</label>
                  <input
                    type="password"
                    className="form-input-changepass"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="رمز عبور فعلی را وارد کنید"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">رمز عبور جدید</label>
                  <input
                    type="password"
                    className="form-input-changepass"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="رمز عبور جدید را وارد کنید"
                  />
                  <div className="form-hint">رمز عبور باید حداقل ۶ کاراکتر باشد</div>
                </div>

                <div className="form-group">
                  <label className="form-label">تأیید رمز عبور جدید</label>
                  <input
                    type="password"
                    className="form-input-changepass"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="رمز عبور جدید را مجدداً وارد کنید"
                  />
                </div>

                <div className="form-actions">
                  <button
                    className="btn-secondary"
                    onClick={handleCloseChangePasswordModal}
                    disabled={isChangingPassword}
                  >
                    انصراف
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? 'در حال تغییر...' : 'تغییر رمز عبور'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showNotifications && (
        <div className="notifications-popup" style={{
          position: 'fixed',
          top: '80px',
          left: '20px',
          zIndex: 9999,
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          maxHeight: '500px',
          overflow: 'hidden',
          border: '1px solid #e5e7eb'
        }}>
          <div className="notifications-header">
            <h3>اعلان‌ها</h3>
            <div className="notifications-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {hasUnreadInLast12Hours && (
                <button
                  className="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.3334 4L6.00008 11.3333L2.66675 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  خواندن همه
                </button>
              )}
            </div>
          </div>

          <div className="notifications-list">
            {categorizedDisplayData.length === 0 ? (
              <div className="empty-notifications" style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF' }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 16H32M16 24H28M16 32H24M38 16C38 22.6274 32.6274 28 26 28C19.3726 28 14 22.6274 14 16C14 9.37258 19.3726 4 26 4C32.6274 4 38 9.37258 38 16Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p style={{ marginTop: '12px', fontSize: '14px' }}>هیچ اعلانی وجود ندارد</p>
              </div>
            ) : (
              categorizedDisplayData.map((item, index) => (
                <div
                  key={index}
                  className={`notification-item ${item.unreadCount > 0 ? 'unread' : ''}`}
                >
                  <div className="notification-icon" style={{ flexShrink: 0, marginTop: '2px' }}>
                    {item.type === 'comment' && (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 11.1738 2.29295 12.2813 2.81097 13.2545L2.08301 17.0736C1.97617 17.6419 2.48913 18.1009 3.04886 17.996L6.703 17.2293C7.65491 17.7074 8.73668 18 9.87898 18H10Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinejoin="round" />
                      </svg>
                    )}
                    {item.type === 'user' && (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.3334 5.83333C13.3334 7.67428 11.841 9.16667 10 9.16667C8.15907 9.16667 6.66669 7.67428 6.66669 5.83333C6.66669 3.99238 8.15907 2.5 10 2.5C11.841 2.5 13.3334 3.99238 13.3334 5.83333Z" stroke="#8B5CF6" strokeWidth="1.5" />
                        <path d="M10 11.6667C6.77837 11.6667 4.16669 14.2783 4.16669 17.5H15.8334C15.8334 14.2783 13.2217 11.6667 10 11.6667Z" stroke="#8B5CF6" strokeWidth="1.5" />
                      </svg>
                    )}
                    {item.type === 'feedback' && (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 11.1578 2.82733 12.241 3.40266 13.1667L2.5 17.5L6.83333 16.5973C7.75904 17.1727 8.84221 17.5 10 17.5Z" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round" />
                        <circle cx="7.5" cy="10" r="1" fill="#F59E0B" />
                        <circle cx="10" cy="10" r="1" fill="#F59E0B" />
                        <circle cx="12.5" cy="10" r="1" fill="#F59E0B" />
                      </svg>
                    )}
                  </div>

                  <div className="notification-content" style={{ flex: 1, minWidth: 0 }}>
                    <div className="notification-title" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                        {item.type === 'comment' ? 'دیدگاه جدید' :
                          item.type === 'feedback' ? 'بازخورد جدید' :
                            'کاربر جدید'}
                      </h4>
                      {item.unreadCount > 0 && (
                        <span className="unread-dot" style={{
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#0F71EF',
                          borderRadius: '50%'
                        }}></span>
                      )}
                    </div>
                    <p className="notification-message" style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6B7280' }}>
                      {`${item.count} ${item.type === 'comment' ? 'کامنت' : item.type === 'feedback' ? 'بازخورد' : 'کاربر'} جدید در ${item.timeText} ثبت ${item.type === 'user' ? 'نام کرده‌اند' : 'شد'}`}
                    </p>
                    <div className="notification-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="notification-time" style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        {item.timeText}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {categorizedDisplayData.length > 0 && (
            <div className="notifications-footer" style={{ padding: '16px 16px', borderTop: '1px solid #e5e7eb' }}>
              {/* <button
                className="view-all-btn"
                onClick={() => {
                  setShowNotifications(false);
                  // Add navigation logic here if needed
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#4B5563',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                مشاهده همه اعلان‌ها
              </button> */}
            </div>
          )}
        </div>
      )}

      {/* Support Modal
      {isSupportModalOpen && (
        <div className="modal-overlay">
          <div className="support-modal-container">
            <div className="support-modal-header">
              <h3 className="modal-title">اطلاعات تماس</h3>
              <button className="modal-close-btn" onClick={handleCloseSupportModal}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="#858585" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="support-modal-body">
              <div className="support-content2">
                <div className="contact-info2">
                  <div className="contact-item">
                    <span className="contact-icon">📞</span>
                    <span className="contact-text">
                      تلفن پشتیبانی : <span style={{ direction: 'ltr', display: 'inline-block', unicodeBidi: 'plaintext' }}>021-12345678</span>
                    </span>
                  </div>
                  <div className="contact-item">
                    <span className="contact-icon">✉️</span>
                    <span className="contact-text"> ایمیل : support@masirbani.com</span>
                  </div>
                </div>

                <div className="support-form">
                  <h4 className="section-title-support">ارسال پیام</h4>
                  <div className="form-group">
                    <label className="form-label">نام و نام خانوادگی</label>
                    <input
                      type="text"
                      className="form-input-support"
                      value={supportName}
                      onChange={(e) => setSupportName(e.target.value)}
                      placeholder="نام خود را وارد کنید"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">ایمیل</label>
                      <input
                        type="email"
                        className="form-input-support"
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">شماره تلفن</label>
                      <input
                        type="tel"
                        className="form-input-support"
                        value={supportPhone}
                        onChange={(e) => setSupportPhone(e.target.value)}
                        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">پیام شما</label>
                    <textarea
                      className="form-textarea-support"
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="پیام خود را بنویسید..."
                      rows="4"
                    />
                  </div>

                  <div className="form-actions-support">
                    <button
                      className="btn-primary-support"
                      onClick={handleSendSupportMessage}
                      disabled={isSendingSupport}
                    >
                      {isSendingSupport ? 'در حال ارسال...' : 'ارسال پیام'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )} */}
    </div >

  );
};

export default Amain;
