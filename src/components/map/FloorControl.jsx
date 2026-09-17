import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLangStore } from '../../store/langStore';
import useFloorCatalog from '../../hooks/useFloorCatalog';
import useMapFloor from '../../hooks/useMapFloor';
import { floorLabel, floorMessages, normalizeFloor } from '../../utils/floors';
import { canUserSelectMapFloor } from '../../utils/floorControlPolicy';
import { setSessionFloor } from '../../utils/sessionFloor';
import '../../styles/FloorControl.css';

export default function FloorControl({ otherMenuOpen = false, onOpen, onChange, request = null, routeFloor = null, style, className = '' }) {
  const location = useLocation();
  const language = useLangStore(state => state.language);
  const text = floorMessages[language] || floorMessages.fa;
  const mapFloor = useMapFloor();
  const manualSelectionAllowed = canUserSelectMapFloor(location.pathname);
  const { floors, loading, error, retry } = useFloorCatalog({ enabled: manualSelectionAllowed });
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  const menu = useRef(null);
  const requestRef = useRef(null);
  const id = useId();
  const normalizedRouteFloor = normalizeFloor(routeFloor);
  const current = normalizedRouteFloor ?? mapFloor;
  const title = request ? text[request.target] || text.choose : text.map;
  const locked = normalizedRouteFloor !== null;
  const topMenu = style?.top !== undefined;

  useEffect(() => {
    if (!manualSelectionAllowed && normalizedRouteFloor !== null) {
      setSessionFloor(normalizedRouteFloor);
    }
  }, [manualSelectionAllowed, normalizedRouteFloor]);

  useEffect(() => {
    if (!loading && !error && floors.length === 1 && !request && !locked && manualSelectionAllowed) setSessionFloor(floors[0].floor);
  }, [floors, loading, error, request, locked, manualSelectionAllowed]);

  useLayoutEffect(() => {
    if (!manualSelectionAllowed) return undefined;
    const page = root.current?.closest('.gp-public-map-page');
    const container = root.current?.closest('.map-routing-container');
    if (!page || !container) return undefined;
    let frame;
    const fit = () => {
      const bounds = container.getBoundingClientRect();
      let panelTop = bounds.bottom;
      page.querySelectorAll('.search-bar-container, .map-destination-input-container, .map-subgroups-container').forEach(panel => {
        const rect = panel.getBoundingClientRect();
        if (rect.height && rect.top < bounds.bottom && rect.bottom > bounds.top) panelTop = Math.min(panelTop, rect.top);
      });
      const lift = Math.max(0, Math.round(bounds.bottom - panelTop + 16 - 162));
      container.style.setProperty('--gp-controls-lift', `${lift}px`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    const observe = () => {
      observer.disconnect();
      observer.observe(container);
      page.querySelectorAll('.search-bar-container, .map-destination-input-container, .map-subgroups-container').forEach(panel => observer.observe(panel));
      schedule();
    };
    const mutations = new MutationObserver(observe);
    mutations.observe(page, { childList: true });
    page.addEventListener('transitionend', schedule);
    window.addEventListener('resize', schedule);
    observe();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect(); mutations.disconnect();
      page.removeEventListener('transitionend', schedule);
      window.removeEventListener('resize', schedule);
      container.style.removeProperty('--gp-controls-lift');
    };
  }, [manualSelectionAllowed]);

  useEffect(() => { if (otherMenuOpen) setOpen(false); }, [otherMenuOpen]);
  useEffect(() => {
    if (request && request !== requestRef.current) {
      if (manualSelectionAllowed) {
        setOpen(true);
        onOpen?.();
      } else {
        request.onSelect?.(mapFloor);
      }
    }
    requestRef.current = request;
  }, [request, onOpen, manualSelectionAllowed, mapFloor]);
  useEffect(() => {
    if (!open) return undefined;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => {
      if (event.key === 'Escape') { setOpen(false); button.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  useEffect(() => {
    if (!open || !menu.current) return;
    const fit = () => {
      const rect = root.current?.getBoundingClientRect();
      const containerTop = root.current?.parentElement?.getBoundingClientRect().top || 0;
      if (rect && menu.current) {
        const available = topMenu ? (root.current.parentElement.getBoundingClientRect().bottom - rect.top - 12) : rect.bottom - Math.max(12, containerTop + 12);
        menu.current.style.maxHeight = `${Math.max(80, available)}px`;
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open, topMenu]);

  if (!manualSelectionAllowed) return null;

  // A one-floor catalog needs no map picker. A missing endpoint still needs a choice.
  if (floors.length === 1 && !request && !locked) return null;

  const select = floor => {
    if (locked) return;
    setSessionFloor(floor);
    if (request) request.onSelect(floor);
    else onChange?.(floor);
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div ref={root} className={`gp-floor-control ${className}`} data-menu-edge={topMenu ? 'top' : 'bottom'} style={style} dir={language === 'en' ? 'ltr' : 'rtl'}>
      <button ref={button} type="button" className={`gp-floor-trigger ${open ? 'active' : ''}`}
        aria-label={`${title}: ${floorLabel(current, language, floors)}`} aria-haspopup="dialog"
        aria-expanded={open} aria-controls={id} onClick={() => { if (!open) onOpen?.(); setOpen(value => !value); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 22V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v19M6 12H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1h-3M10 6h4M10 10h4M10 14h4M10 22v-4h4v4" />
        </svg>
        <span>{floorLabel(current, language, floors, true)}</span>
      </button>
      {open && <div ref={menu} id={id} className="gp-floor-menu" role="dialog" aria-label={title}>
        <div className="gp-floor-title">{title}</div>
        {loading && <div className="gp-floor-status" role="status">{text.loading}</div>}
        {error && <div className="gp-floor-status"><span role="status">{text.error}</span><button type="button" onClick={retry}>{text.retry}</button></div>}
        {!loading && !error && floors.map(item => <button type="button" key={item.floor} className="gp-floor-option"
          aria-pressed={item.floor === current} disabled={locked && item.floor !== current} onClick={() => select(item.floor)}>
          <span>{floorLabel(item.floor, language, floors)}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
        </button>)}
      </div>}
    </div>
  );
}
