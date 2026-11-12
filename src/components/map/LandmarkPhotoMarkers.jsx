import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, useMap } from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import { pointIsOnFloor } from '../../utils/floors';
import './LandmarkPhotoMarkers.css';

// Offset from the bottom-center of the 50×67 marker to align the SVG pin tip.
const LANDMARK_TIP_OFFSET_RTL = [-5.175, 20.706];
const LANDMARK_TIP_OFFSET_LTR = [4.825, 20.706];
const NAME_GAP = 4;

function positionLandmarkNames(map, tipOffsetX) {
  const container = map.getContainer();
  const bounds = container.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;

  const names = [...container.querySelectorAll('.rng-photo-landmark-name')].map(name => ({
    name,
    visual: name.parentElement.getBoundingClientRect(),
    size: name.getBoundingClientRect(),
    scale: Number(name.dataset.scale),
    priority: Number(name.closest('.maplibregl-marker').style.zIndex)
  })).sort((a, b) => b.priority - a.priority);
  const occupied = [...container.querySelectorAll('.maplibregl-marker')]
    .filter(marker => !marker.querySelector('.landmark-photo-marker-visual'))
    .map(marker => marker.getBoundingClientRect());

  for (const { name, visual, size, scale } of names) {
    const onScreen = visual.left < bounds.right && visual.right > bounds.left
      && visual.top < bounds.bottom && visual.bottom > bounds.top;
    const centerX = visual.left + visual.width / 2 - tipOffsetX * scale;
    const naturalLeft = centerX - size.width / 2;
    const naturalBottom = visual.top - NAME_GAP * scale;
    const rowHeight = size.height + NAME_GAP;
    const sideways = Math.min(20, size.width / 3);
    const position = onScreen && [0, rowHeight, 2 * rowHeight].flatMap(lift => (
      [0, -sideways, sideways].map(shift => {
        const left = Math.max(bounds.left + NAME_GAP,
          Math.min(naturalLeft + shift, bounds.right - NAME_GAP - size.width));
        const bottom = naturalBottom - lift;
        return { left, right: left + size.width, top: bottom - size.height, bottom };
      })
    )).find(({ left, right, top, bottom }) => (
      top >= bounds.top + NAME_GAP && bottom <= bounds.bottom
      && !occupied.some(box => left < box.right + NAME_GAP && right + NAME_GAP > box.left
        && top < box.bottom + NAME_GAP && bottom + NAME_GAP > box.top)
    ));

    name.style.visibility = position ? '' : 'hidden';
    if (!position) continue;
    name.style.setProperty('--name-shift-x', `${(position.left - naturalLeft) / scale}px`);
    name.style.setProperty('--name-shift-y', `${(position.bottom - naturalBottom) / scale}px`);
    occupied.push(position);
  }
}

function LandmarkMarkerImage({ url, title }) {
  const image = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    if (!window.IntersectionObserver) {
      setInView(true);
      return;
    }
    const element = image.current;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setInView(true);
    }, { root: element.closest('.maplibregl-map') });
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView]);

  return (
    <img
      ref={image}
      className="image-marker-content"
      src={inView ? url : undefined}
      alt=""
      aria-label={title || 'landmark'}
      fetchpriority="low"
      style={{ objectFit: 'cover' }}
    />
  );
}

function getCoordinates(place) {
  const lat = place.lat ?? place.latitude ?? place.location?.lat ?? place.geo?.lat
    ?? place.coordinates?.[0] ?? place.geometry?.coordinates?.[1];
  const lng = place.lng ?? place.longitude ?? place.location?.lng ?? place.geo?.lng
    ?? place.coordinates?.[1] ?? place.geometry?.coordinates?.[0];
  if (lat == null || lng == null) return null;

  const coords = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(coords.lat) && Number.isFinite(coords.lng) && Math.abs(coords.lat) <= 90
    ? coords : null;
}

function getImages(place) {
  const images = [place.image, place.images]
    .flat()
    .filter(image => typeof image === 'string' && image.trim());
  return [...new Set(images)];
}

export function getLandmarkId(place) {
  return place.id || place.poi_id || place.poiId || place.value || place.subGroupValue;
}

export default function LandmarkPhotoMarkers({
  places, floor, isRtl, isPitched, bearing = 0, matchesPlace, selectedPlace, showName, onSelect
}) {
  const { current: map } = useMap();
  const [scales, setScales] = useState(() => new Map());
  const tipOffset = isRtl ? LANDMARK_TIP_OFFSET_RTL : LANDMARK_TIP_OFFSET_LTR;
  const tipX = `calc(50% - (${tipOffset[0]}px))`;

  const markers = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(places) ? places : []).flatMap(place => {
      if (!pointIsOnFloor(place, floor) || (matchesPlace && !matchesPlace(place))) return [];
      const coords = getCoordinates(place);
      const images = getImages(place);
      if (!coords || images.length === 0) return [];

      const coordKey = `${coords.lng.toFixed(6)}-${coords.lat.toFixed(6)}`;
      if (seen.has(coordKey)) return [];
      seen.add(coordKey);

      return [{
        coords,
        images,
        title: place.title || place.name || place.label || place.subGroup,
        id: getLandmarkId(place) || `landmark-${coords.lat}-${coords.lng}`,
        place,
        world: maplibregl.MercatorCoordinate.fromLngLat(coords)
      }];
    });
  }, [places, floor, matchesPlace]);

  useEffect(() => {
    if (!isPitched || !map || markers.length === 0) return;

    const updateScales = () => {
      const halfHeight = map.getCanvas().clientHeight / 2;
      if (!halfHeight) return;
      const strength = Math.min(1, map.getPitch() / 60);
      const centerY = map.project(map.getCenter()).y;
      const nextScales = new Map(markers.map(({ coords }) => {
        // On the ground plane, points below the projected center are closer.
        const depth = (map.project(coords).y - centerY) / halfHeight;
        const boundedDepth = Math.max(-1, Math.min(1, depth));
        const range = boundedDepth < 0 ? 0.5 : 0.1;
        const scale = Number.isNaN(depth) ? 1 : 1 + boundedDepth * range * strength;
        return [coords, Math.round(scale * 1000) / 1000];
      }));

      setScales(previous => (
        previous.size === nextScales.size && markers.every(({ coords }) => previous.get(coords) === nextScales.get(coords))
          ? previous : nextScales
      ));
    };

    updateScales();
    map.on('move', updateScales);
    map.on('resize', updateScales);
    return () => {
      map.off('move', updateScales);
      map.off('resize', updateScales);
    };
  }, [map, markers, isPitched]);

  const ordered = useMemo(() => {
    if (!isPitched) return markers;
    const angle = bearing * Math.PI / 180;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    // On the map plane, increasing camera-relative Y is closer to the camera.
    return markers.map(marker => ({
      ...marker,
      depth: marker.world.y * cos - marker.world.x * sin
    })).sort((a, b) => a.depth - b.depth);
  }, [markers, bearing, isPitched]);

  useEffect(() => {
    if (map && showName) positionLandmarkNames(map, tipOffset[0]);
  });

  useEffect(() => {
    if (!map || !showName) return;
    const updatePositions = () => positionLandmarkNames(map, tipOffset[0]);
    map.on('moveend', updatePositions);
    map.on('resize', updatePositions);
    return () => {
      map.off('moveend', updatePositions);
      map.off('resize', updatePositions);
    };
  }, [map, showName, tipOffset]);

  return ordered.map(({ id, coords, images, title, place }, index) => {
    const scale = isPitched ? scales.get(coords) ?? 1 : 1;
    const isSelected = selectedPlace &&
      [selectedPlace.id, selectedPlace.value, selectedPlace.subGroupValue].includes(id);
    const select = (event) => {
      event.stopPropagation();
      onSelect({ id, coords, images, title, place });
    };

    return (
      <Marker
        key={`${id}-${coords.lng}-${coords.lat}`}
        longitude={coords.lng}
        latitude={coords.lat}
        anchor="bottom"
        offset={tipOffset}
        style={{ zIndex: isPitched ? index + 1 : '' }}
      >
        <div
          className={`image-marker-container ${isSelected ? 'selected-landmark-container' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={title}
          onClick={select}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              select(event);
            }
          }}
        >
          <div
            className="landmark-photo-marker-visual"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              transform: scale === 1 ? undefined : `scale(${scale})`,
              transformOrigin: `${tipX} calc(100% - ${tipOffset[1]}px)`
            }}
          >
            {title && showName?.(coords) && (
              <span
                className="rng-photo-landmark-name"
                style={{ left: tipX, bottom: `calc(100% + ${NAME_GAP}px)`, fontSize: Math.max(13, 11 / scale) }}
                data-scale={scale}
                aria-hidden="true"
              >
                {title}
              </span>
            )}
            {isSelected && <div className="selected-landmark-effect" />}
            <svg
              width="40"
              height="47"
              viewBox="0 0 55 63"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M54.6562 27.3281C54.6562 39.6299 46.5275 50.0319 35.3486 53.459C35.1079 53.8493 34.8535 54.2605 34.585 54.6924L33.1699 56.9687C30.7353 60.8845 29.5175 62.8418 27.7412 62.8418C25.9651 62.8417 24.7479 60.8842 22.3135 56.9687L20.8975 54.6924C20.6938 54.3648 20.4993 54.0485 20.3115 53.7451C8.61859 50.6476 8.59898e-05 39.9953 -1.19455e-06 27.3281C-5.34814e-07 12.2351 12.2351 -1.85429e-06 27.3281 -1.19455e-06C42.4211 0.000106671 54.6562 12.2352 54.6562 27.3281Z"
                fill="white"
                stroke={isSelected ? "#0F71EF" : "none"}
                strokeWidth={isSelected ? "3" : "2"}
              />
            </svg>
            <LandmarkMarkerImage url={images[0]} title={title} />
          </div>
        </div>
      </Marker>
    );
  });
}
