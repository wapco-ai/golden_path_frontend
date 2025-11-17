const TILE_BASE_URL = 'http://localhost:8080/tiles';

export const haramVectorTileConfig = [
  {
    id: 'areas-fill',
    titleFa: 'محدوده‌ها (ساده‌شده)',
    table: 'public.areas_simplified',
    sourceId: 'areas-simplified',
    sourceLayer: 'public.areas_simplified',
    tileUrl: `${TILE_BASE_URL}/public.areas_simplified/{z}/{x}/{y}.pbf`,
    type: 'fill',
    minzoom: 14,
    maxzoom: 20,
    visibleByDefault: true,
    paint: {
      'fill-color': '#0f71ef',
      'fill-opacity': 0.2
    }
  },
  {
    id: 'areas-outline',
    titleFa: 'مرز محدوده‌ها',
    table: 'public.areas_simplified',
    sourceId: 'areas-simplified',
    sourceLayer: 'public.areas_simplified',
    tileUrl: `${TILE_BASE_URL}/public.areas_simplified/{z}/{x}/{y}.pbf`,
    type: 'line',
    minzoom: 14,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'line-color': '#0f71ef',
      'line-width': 1.5
    }
  },
  {
    id: 'doors',
    titleFa: 'درب‌ها',
    table: 'public.doors',
    sourceId: 'doors',
    sourceLayer: 'public.doors',
    tileUrl: `${TILE_BASE_URL}/public.doors/{z}/{x}/{y}.pbf`,
    type: 'symbol',
    minzoom: 17,
    maxzoom: 22,
    visibleByDefault: true,
    layout: {
      'icon-image': 'marker-15',
      'icon-size': 1.2
    }
  },
  {
    id: 'poi-points',
    titleFa: 'نقاط علاقه (POI)',
    table: 'public.poi_points',
    sourceId: 'poi-points',
    sourceLayer: 'public.poi_points',
    tileUrl: `${TILE_BASE_URL}/public.poi_points/{z}/{x}/{y}.pbf`,
    type: 'symbol',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: true,
    layout: {
      'icon-image': 'marker-15',
      'icon-size': 1.1
    }
  },
  {
    id: 'qrcodes',
    titleFa: 'مکان‌های QR',
    table: 'public.qrcodes',
    sourceId: 'qrcodes',
    sourceLayer: 'public.qrcodes',
    tileUrl: `${TILE_BASE_URL}/public.qrcodes/{z}/{x}/{y}.pbf`,
    type: 'symbol',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false,
    layout: {
      'icon-image': 'marker-15',
      'icon-size': 1
    }
  },
  {
    id: 'admin-restrictions',
    titleFa: 'محدودیت‌های مدیریتی',
    table: 'public.admin_restrictions',
    sourceId: 'admin-restrictions',
    sourceLayer: 'public.admin_restrictions',
    tileUrl: `${TILE_BASE_URL}/public.admin_restrictions/{z}/{x}/{y}.pbf`,
    type: 'fill',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false,
    paint: {
      'fill-color': '#ef4444',
      'fill-opacity': 0.25
    }
  },
  {
    id: 'van-edges',
    titleFa: 'مسیر ون‌ها (خطوط)',
    table: 'public.van_edges',
    sourceId: 'van-edges',
    sourceLayer: 'public.van_edges',
    tileUrl: `${TILE_BASE_URL}/public.van_edges/{z}/{x}/{y}.pbf`,
    type: 'line',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false,
    paint: {
      'line-color': '#22c55e',
      'line-width': 2,
      'line-dasharray': [1.5, 1.5]
    }
  },
  {
    id: 'van-nodes',
    titleFa: 'گره‌های ون',
    table: 'public.van_nodes',
    sourceId: 'van-nodes',
    sourceLayer: 'public.van_nodes',
    tileUrl: `${TILE_BASE_URL}/public.van_nodes/{z}/{x}/{y}.pbf`,
    type: 'symbol',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false,
    layout: {
      'icon-image': 'marker-15',
      'icon-size': 0.9
    }
  },
  {
    id: 'mesh-triangles',
    titleFa: 'شبکه مسیریابی (Mesh)',
    table: 'public.mesh_triangles',
    sourceId: 'mesh-triangles',
    sourceLayer: 'public.mesh_triangles',
    tileUrl: `${TILE_BASE_URL}/public.mesh_triangles/{z}/{x}/{y}.pbf`,
    type: 'fill',
    minzoom: 18,
    maxzoom: 22,
    visibleByDefault: false,
    paint: {
      'fill-color': '#f97316',
      'fill-opacity': 0.15
    }
  }
];

export default haramVectorTileConfig;
