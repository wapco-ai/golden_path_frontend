import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { ADMIN_MAP_MAX_ZOOM } from '../services/legacyMapStyles';
import { projectGuidancePreview } from '../services/guidanceRouteCoverage';
import GuidanceRouteImagePreview from './GuidanceRouteImagePreview';
import {
  ensureGuidanceRtl, expandGuidanceCluster, GUIDANCE_CENTER, guidanceFeaturesAt, guidanceRouteSectionsAt,
  readGuidanceCluster, showGuidancePoints, showGuidanceRoute
} from './guidanceMapLayers';

export default function GuidancePointsMap({
  style, floor, marks, jumpTo, coverage, onAdd, onEdit, onPick,
  routeSections, routeRun, routeVersion, routeOrigin, routeDestination
}) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const fitted = useRef(false);
  const fittedRoute = useRef(null);
  const interaction = useRef(null);
  const previewClick = useRef(0);
  const clusterRequest = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selection, setSelection] = useState([]);
  const [group, setGroup] = useState(null);
  const [draft, setDraft] = useState(null);
  const visibleSections = useMemo(() => routeSections.filter(section => section.floor === floor), [routeSections, floor]);
  const clearGroup = useCallback(() => {
    clusterRequest.current += 1;
    setGroup(null);
  }, []);
  const endpoints = useMemo(() => [
    ...(routeOrigin?.floor === floor ? [{ ...routeOrigin, label: 'م' }] : []),
    ...(routeDestination?.floor === floor ? [{ ...routeDestination, label: 'پ' }] : [])
  ], [floor, routeOrigin, routeDestination]);
  useEffect(() => {
    interaction.current = { onPick, sections: visibleSections };
  }, [onPick, visibleSections]);


  useEffect(() => {
    ensureGuidanceRtl();
    let map;
    try {
      map = new maplibregl.Map({
        container: container.current, style, center: GUIDANCE_CENTER, zoom: 15.5, maxZoom: ADMIN_MAP_MAX_ZOOM
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl());
    const onReady = () => setReady(true);
    map.on('load', onReady);
    map.on('mousemove', ({ point }) => {
      map.getCanvas().style.cursor = !interaction.current?.onPick
        && (guidanceFeaturesAt(map, point).length || guidanceRouteSectionsAt(map, point).length) ? 'pointer' : 'crosshair';
    });
    map.on('click', ({ point, lngLat }) => {
      const location = { lng: lngLat.lng, lat: lngLat.lat };
      const { onPick: pick, sections } = interaction.current;
      clearGroup();
      if (pick) {
        pick(location);
        setSelection([]);
        setDraft(null);
        return;
      }
      const features = guidanceFeaturesAt(map, point);
      const cluster = features.find(({ properties }) => properties.cluster);
      if (cluster) {
        const request = clusterRequest.current;
        setSelection([]);
        setDraft(null);
        setGroup({ cluster, loading: true, ids: [] });
        readGuidanceCluster(map, cluster, (error, ids) => {
          if (clusterRequest.current === request) setGroup({ cluster, error, ids: ids ?? [] });
        });
        return;
      }

      const pins = features.filter(({ properties }) => properties.id != null);
      if (pins.length) {
        setSelection([...new Set(pins.map(({ properties }) => String(properties.id)))]);
        setDraft(null);
        return;
      }

      const hitIds = guidanceRouteSectionsAt(map, point);
      const preview = hitIds.length
        ? projectGuidancePreview(location, sections.filter(section => hitIds.includes(section.id)))
        : null;
      setSelection([]);
      setDraft(preview ? { ...preview, click: ++previewClick.current } : location);
    });
    return () => {
      clusterRequest.current += 1;
      mapRef.current = null;
      map.remove();
    };
  }, [style, clearGroup]);

  useEffect(() => { clearGroup(); }, [marks, clearGroup]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    showGuidancePoints(map, marks, { clustered: true, coverage });
    if (!fitted.current && marks.length) {
      fitted.current = true;
      if (!jumpTo && !routeRun) {
        const bounds = new maplibregl.LngLatBounds();
        for (const { location } of marks) bounds.extend([location.lng, location.lat]);
        map.fitBounds(bounds, { padding: 52, maxZoom: 17, duration: 0 });
      }
    }
  }, [marks, coverage, ready, jumpTo, routeRun]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    showGuidanceRoute(map, visibleSections, endpoints);
    if (routeRun && visibleSections.length && fittedRoute.current !== routeRun) {
      fittedRoute.current = routeRun;
      const bounds = new maplibregl.LngLatBounds();
      for (const section of visibleSections) {
        for (const coordinate of section.coordinates) bounds.extend(coordinate);
      }
      map.fitBounds(bounds, { padding: 60, maxZoom: 19, duration: 0 });
    }
  }, [ready, visibleSections, endpoints, routeRun]);

  useEffect(() => {
    if (onPick) {
      clearGroup();
      setDraft(null);
      setSelection([]);
    }
  }, [onPick, clearGroup]);

  useEffect(() => {
    if (!ready || !jumpTo) return;
    const map = mapRef.current;
    clearGroup();
    map.jumpTo({ center: [jumpTo.location.lng, jumpTo.location.lat], zoom: 19 });
    setSelection([String(jumpTo.id)]);
    setDraft(null);
  }, [jumpTo, ready, clearGroup]);

  useEffect(() => {
    setDraft(current => current?.fromRoute ? null : current);
  }, [routeRun, routeVersion]);

  useEffect(() => {
    if (!ready || !draft) return;
    let options = { color: '#1e2023' };
    if (draft.fromRoute) {
      const arrow = document.createElement('span');
      arrow.className = 'guidance-route-direction';
      arrow.textContent = '↑';
      arrow.setAttribute('aria-hidden', 'true');
      options = { element: arrow, rotation: draft.heading, rotationAlignment: 'map' };
    }
    const marker = new maplibregl.Marker(options).setLngLat([draft.lng, draft.lat]).addTo(mapRef.current);
    marker.getElement().style.pointerEvents = 'none';
    marker.getElement().setAttribute('aria-hidden', 'true');
    return () => marker.remove();
  }, [draft, ready]);

  const selectedIds = new Set(group?.ids ?? selection);
  const selected = marks.filter(mark => selectedIds.has(String(mark.id)));

  return (
    <div className="guidance-overview__map">
      <div ref={container} className="guidance-overview__canvas" role="region" aria-label="نقشه نقاط راهنما" />
      {failed && <p className="guidance-overview__card" role="alert">نقشه بارگذاری نشد.</p>}
      {(group || selected.length > 0 || draft) && (
        <div className="guidance-overview__card">
          <button type="button" className="guidance-overview__dismiss" aria-label="بستن جزئیات"
            onClick={() => { clearGroup(); setSelection([]); setDraft(null); }}>×</button>
          {group && (
            <div className="guidance-overview__group">
              <strong>{group.cluster.properties.point_count.toLocaleString('fa-IR')} نقطه در این گروه</strong>
              <button type="button" onClick={() => expandGuidanceCluster(mapRef.current, group.cluster)}>بزرگ‌نمایی</button>
              {group.loading && <p role="status">در حال دریافت نقاط گروه…</p>}
              {group.error && <p role="status">نقاط گروه دریافت نشدند. دوباره روی عدد گروه کلیک کنید.</p>}
            </div>
          )}
          {selected.map(mark => (
            <div className="guidance-overview__item" key={mark.id}>
              {mark.images[0]?.url && <img src={mark.images[0].url} alt="" />}
              <div><strong>{mark.title}</strong><small>شناسه {mark.id}</small></div>
              <button type="button" aria-label={group ? `ویرایش ${mark.title}، شناسه ${mark.id}` : undefined}
                onClick={() => onEdit(mark)}>ویرایش</button>
            </div>
          ))}
          {draft?.fromRoute && <GuidanceRouteImagePreview point={draft} onAdd={(location, level) => {
            onAdd(location, level);
            setDraft(null);
          }} />}
          {draft && !draft.fromRoute && <button type="button" className="guidance-overview__add"
            onClick={() => { onAdd(draft, floor); setDraft(null); }}>
            افزودن نقطه راهنما در این محل
          </button>}
        </div>
      )}
    </div>
  );
}
