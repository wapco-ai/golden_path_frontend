import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './AdminMapTooltip.css';

const HOVER_DELAY_MS = 400;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Tooltips live in a portal so the existing map container / zoom controls
 * (which use overflow: hidden) never clip their text.
 * No wrapper or layout change is made to the existing map buttons.
 */
export default function AdminMapTooltip({ containerRef }) {
  const tooltipId = useId();
  const [tooltip, setTooltip] = useState(null);
  const timerRef = useRef(null);
  const activeRef = useRef(null);
  const previousDescriptionRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const cancelPending = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const restoreDescription = () => {
      if (activeRef.current) {
        if (previousDescriptionRef.current === null) {
          activeRef.current.removeAttribute('aria-describedby');
        } else {
          activeRef.current.setAttribute('aria-describedby', previousDescriptionRef.current);
        }
      }
      activeRef.current = null;
      previousDescriptionRef.current = null;
    };
    const dismiss = () => {
      cancelPending();
      restoreDescription();
      setTooltip(null);
    };
    const findControl = (element) => {
      const control = element?.closest?.('[data-map-tooltip]');
      return control && container.contains(control) ? control : null;
    };
    const display = (control) => {
      if (activeRef.current !== control || !control.isConnected) return;
      const text = control.getAttribute('data-map-tooltip')?.trim();
      if (!text) return;

      const bounds = control.getBoundingClientRect();
      const mapBounds = container.getBoundingClientRect();
      const estimatedWidth = Math.min(275, Math.max(95, [...text].length * 7.5 + 24));
      const half = Math.min(estimatedWidth / 2, (window.innerWidth - 16) / 2);
      const left = clamp(bounds.left + bounds.width / 2, half + 8, window.innerWidth - half - 8);
      const below = bounds.top - mapBounds.top < 70 && bounds.bottom + 54 < window.innerHeight;

      control.setAttribute(
        'aria-describedby',
        [previousDescriptionRef.current, tooltipId].filter(Boolean).join(' ')
      );
      setTooltip({ text, left, top: below ? bounds.bottom + 8 : bounds.top - 8, below });
    };
    const activate = (control, immediate = false) => {
      if (!control || control.matches(':disabled') || control.getAttribute('aria-disabled') === 'true') return;
      if (activeRef.current === control) {
        if (immediate) {
          cancelPending();
          display(control);
        }
        return;
      }
      cancelPending();
      restoreDescription();
      setTooltip(null);
      activeRef.current = control;
      previousDescriptionRef.current = control.getAttribute('aria-describedby');
      if (immediate) display(control);
      else timerRef.current = window.setTimeout(() => display(control), HOVER_DELAY_MS);
    };

    const onPointerOver = (event) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const control = findControl(event.target);
      if (control) activate(control);
    };
    const onPointerOut = (event) => {
      const control = findControl(event.target);
      if (control === activeRef.current && !control.contains(event.relatedTarget)) dismiss();
    };
    const onFocusIn = (event) => {
      const control = findControl(event.target);
      if (control) activate(control, true);
    };
    const onFocusOut = (event) => {
      const control = findControl(event.target);
      if (control === activeRef.current && !control.contains(event.relatedTarget)) dismiss();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') dismiss();
    };

    container.addEventListener('pointerover', onPointerOver);
    container.addEventListener('pointerout', onPointerOut);
    container.addEventListener('focusin', onFocusIn);
    container.addEventListener('focusout', onFocusOut);
    container.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      container.removeEventListener('pointerover', onPointerOver);
      container.removeEventListener('pointerout', onPointerOut);
      container.removeEventListener('focusin', onFocusIn);
      container.removeEventListener('focusout', onFocusOut);
      container.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      cancelPending();
      restoreDescription();
    };
  }, [containerRef, tooltipId]);

  return tooltip && typeof document !== 'undefined'
    ? createPortal(
      <div
        id={tooltipId}
        role="tooltip"
        dir="rtl"
        className="admin-map-tooltip"
        data-placement={tooltip.below ? 'below' : 'above'}
        style={{ left: tooltip.left, top: tooltip.top }}
      >
        {tooltip.text}
      </div>,
      document.body
    )
    : null;
}
