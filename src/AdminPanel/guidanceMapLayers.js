import maplibregl from 'maplibre-gl';
import { circle } from '@turf/turf';

export const GUIDANCE_CENTER = [59.6157, 36.288];
const pointsSource = 'guidance-saved-points';
const pinsLayer = 'guidance-saved-pins';
const clustersLayer = 'guidance-saved-clusters';
const countLayer = 'guidance-saved-cluster-count';
const coverageSource = 'guidance-saved-coverage';

export const hasMarkLocation = ({ location }) => Boolean(location)
  && Number.isFinite(location.lng) && Math.abs(location.lng) <= 180
  && Number.isFinite(location.lat) && Math.abs(location.lat) <= 90;

export function ensureGuidanceRtl() {
  if (window.__RTL_PLUGIN_SET__) return;
  window.__RTL_PLUGIN_SET__ = true;
  maplibregl.setRTLTextPlugin('/rtl/mapbox-gl-rtl-text.js', null, true);
}

export function showGuidancePoints(map, marks, { clustered = false, coverage = false } = {}) {
  const points = marks.map(({ id, location: { lng, lat } }) => ({
    type: 'Feature', properties: { id: String(id) },
    geometry: { type: 'Point', coordinates: [lng, lat] }
  }));
  const data = { type: 'FeatureCollection', features: points };

  if (clustered) {
    const areas = marks.flatMap(({ location: { lng, lat }, coverage_radius_m: radius }) =>
      coverage && Number(radius) > 0
        ? [circle([lng, lat], Number(radius) / 1000, { steps: 48 })]
        : []);
    const coverageData = { type: 'FeatureCollection', features: areas };
    const source = map.getSource(coverageSource);
    if (source) source.setData(coverageData);
    else {
      map.addSource(coverageSource, { type: 'geojson', data: coverageData });
      map.addLayer({
        id: coverageSource, type: 'fill', source: coverageSource,
        paint: { 'fill-color': '#0f71ef', 'fill-opacity': 0.12, 'fill-outline-color': '#3886e9' }
      });
    }
  }

  const source = map.getSource(pointsSource);
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(pointsSource, {
    type: 'geojson', data, cluster: clustered, clusterRadius: 35, clusterMaxZoom: 18
  });
  if (clustered) {
    map.addLayer({
      id: clustersLayer, type: 'circle', source: pointsSource, filter: ['has', 'point_count'],
      paint: { 'circle-color': '#164a9e', 'circle-radius': 15, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }
    });
    map.addLayer({
      id: countLayer, type: 'symbol', source: pointsSource, filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Vazirmatn Regular'], 'text-size': 12, 'text-allow-overlap': true },
      paint: { 'text-color': '#fff' }
    });
  }
  map.addLayer({
    id: pinsLayer, type: 'circle', source: pointsSource, filter: ['!', ['has', 'point_count']],
    paint: { 'circle-color': '#0f71ef', 'circle-radius': clustered ? 7 : 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }
  });
}

export function guidanceFeaturesAt(map, point) {
  if (!map.getLayer(pinsLayer)) return [];
  return map.queryRenderedFeatures(point, { layers: [pinsLayer, clustersLayer] });
}

export function readGuidanceCluster(map, cluster, onResult) {
  const { cluster_id, point_count } = cluster.properties;
  map.getSource(pointsSource).getClusterLeaves(cluster_id, point_count, 0, (error, leaves) => {
    onResult(error, leaves?.map(leaf => String(leaf.properties.id)));
  });
}

export function expandGuidanceCluster(map, cluster) {
  map.getSource(pointsSource).getClusterExpansionZoom(cluster.properties.cluster_id, (error, zoom) => {
    if (!error && map.getSource(pointsSource)) map.easeTo({ center: cluster.geometry.coordinates, zoom });
  });
}

const routeSource = 'guidance-route-check';
const routeLine = 'guidance-route-check-line';
const endpointsSource = 'guidance-route-endpoints';

export function showGuidanceRoute(map, sections, endpoints) {
  const lines = {
    type: 'FeatureCollection',
    features: sections.map(section => ({
      type: 'Feature', properties: { id: section.id, status: section.status },
      geometry: { type: 'LineString', coordinates: section.coordinates }
    }))
  };
  const points = {
    type: 'FeatureCollection',
    features: endpoints.map(({ lng, lat, label }) => ({
      type: 'Feature', properties: { label },
      geometry: { type: 'Point', coordinates: [lng, lat] }
    }))
  };
  if (map.getSource(routeSource)) {
    map.getSource(routeSource).setData(lines);
    map.getSource(endpointsSource).setData(points);
    return;
  }

  map.addSource(routeSource, { type: 'geojson', data: lines });
  const before = map.getLayer(clustersLayer) ? clustersLayer : undefined;
  map.addLayer({
    id: 'guidance-route-outline', source: routeSource, type: 'line',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#fff', 'line-width': 9 }
  }, before);
  map.addLayer({
    id: routeLine, source: routeSource, type: 'line',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['match', ['get', 'status'], 'covered', '#13775a', 'gap', '#b54708', '#64748b'],
      'line-width': 6
    }
  }, before);

  map.addSource(endpointsSource, { type: 'geojson', data: points });
  map.addLayer({
    id: endpointsSource, source: endpointsSource, type: 'circle',
    paint: { 'circle-radius': 13, 'circle-color': '#302650', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }
  });
  map.addLayer({
    id: 'guidance-route-endpoint-labels', source: endpointsSource, type: 'symbol',
    layout: { 'text-field': ['get', 'label'], 'text-font': ['Vazirmatn Regular'], 'text-size': 12, 'text-allow-overlap': true },
    paint: { 'text-color': '#fff' }
  });
}

export function guidanceRouteSectionsAt(map, point) {
  if (!map.getLayer(routeLine)) return [];
  const bounds = [[point.x - 5, point.y - 5], [point.x + 5, point.y + 5]];
  return map.queryRenderedFeatures(bounds, { layers: [routeLine] }).map(feature => feature.properties.id);
}
