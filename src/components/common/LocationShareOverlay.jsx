import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { USER_ACCESS_TOKEN_KEY, useUserAuthStore } from '../../auth/user/userAuthStore';
import { useLangStore } from '../../store/langStore';
import { useRouteStore } from '../../store/routeStore';
import { getSessionFloor } from '../../utils/sessionFloor';
import { getLocationShareText } from '../../utils/locationShareMessages';
import {
  createLocationShare,
  listIncomingLocationShares,
  listOutgoingLocationShares,
  revokeLocationShare
} from '../../services/locationShareService';
import '../../styles/LocationShareOverlay.css';

const ACTIVE_PATHS = new Set(['/mpb', '/fs']);
const REFRESH_INTERVAL_MS = 30000;

const ShareIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M8.7 10.6 15.3 6.4M8.7 13.4l6.6 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const LocationShareOverlay = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const language = useLangStore((state) => state.language);
  const { accessToken, user } = useUserAuthStore();
  const setDestination = useRouteStore((state) => state.setDestination);
  const t = useMemo(() => getLocationShareText(language), [language]);

  const sessionToken = typeof window !== 'undefined'
    ? window.sessionStorage?.getItem?.(USER_ACCESS_TOKEN_KEY)
    : null;
  const effectiveToken = accessToken || sessionToken || null;
  const authIdentity = user?.id != null ? `user:${user.id}` : (effectiveToken ? `token:${effectiveToken}` : 'anonymous');
  const hasToken = Boolean(effectiveToken);
  const shouldRender = ACTIVE_PATHS.has(location.pathname) && hasToken;

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('share');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState(null);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mpbPortalTarget, setMpbPortalTarget] = useState(null);
  const [fsMenuPortalTarget, setFsMenuPortalTarget] = useState(null);

  const identityRef = useRef(authIdentity);
  const refreshAbortRef = useRef(null);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    let frameId = null;
    let boundMapTarget = null;

    setMpbPortalTarget(null);
    setFsMenuPortalTarget(null);

    const bindPortalTarget = () => {
      if (location.pathname === '/mpb') {
        const target = document.querySelector('.map-routing-container');
        if (target) {
          boundMapTarget = target;
          target.classList.add('with-location-share-control');
          setMpbPortalTarget(target);
        }
      } else if (location.pathname === '/fs') {
        const target = document.querySelector('.final-search-page .menu-dropdown');
        if (target) setFsMenuPortalTarget(target);
      }
    };

    bindPortalTarget();
    frameId = window.requestAnimationFrame(bindPortalTarget);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      boundMapTarget?.classList?.remove?.('with-location-share-control');
    };
  }, [location.pathname]);

  useEffect(() => {
    identityRef.current = authIdentity;
    refreshAbortRef.current?.abort?.();
    refreshAbortRef.current = null;
    setIncoming([]);
    setOutgoing([]);
    setIsOpen(false);
    setPhone('');
    setPosition(null);
  }, [authIdentity]);

  useEffect(() => {
    if (!shouldRender && isOpen) setIsOpen(false);
  }, [shouldRender, isOpen]);

  const refreshShares = useCallback(async ({ silent = false } = {}) => {
    if (!hasToken) return;

    const startedIdentity = identityRef.current;
    refreshAbortRef.current?.abort?.();
    const controller = new AbortController();
    refreshAbortRef.current = controller;

    if (!silent) setIsLoadingShares(true);
    try {
      const [nextIncoming, nextOutgoing] = await Promise.all([
        listIncomingLocationShares({ signal: controller.signal }),
        listOutgoingLocationShares({ signal: controller.signal })
      ]);

      if (controller.signal.aborted || identityRef.current !== startedIdentity) return;
      setIncoming(nextIncoming);
      setOutgoing(nextOutgoing);
    } catch (error) {
      if (controller.signal.aborted || error?.code === 'ERR_CANCELED') return;
      if (error?.status !== 401) {
        console.warn('location share refresh failed', error);
      }
    } finally {
      if (!silent && !controller.signal.aborted && identityRef.current === startedIdentity) {
        setIsLoadingShares(false);
      }
      if (refreshAbortRef.current === controller) {
        refreshAbortRef.current = null;
      }
    }
  }, [hasToken]);

  useEffect(() => {
    if (!shouldRender) return undefined;

    refreshShares();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshShares({ silent: true });
      }
    }, REFRESH_INTERVAL_MS);

    const refreshOnFocus = () => refreshShares({ silent: true });
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshOnFocus);
      refreshAbortRef.current?.abort?.();
    };
  }, [shouldRender, refreshShares]);

  const requestFreshLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error(t('unavailable'));
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (geoPosition) => {
        const floor = Number(getSessionFloor());
        if (![0, -1].includes(floor)) {
          setIsLocating(false);
          toast.error(t('generalError'));
          return;
        }

        setPosition({
          lat: geoPosition.coords.latitude,
          lng: geoPosition.coords.longitude,
          accuracyM: geoPosition.coords.accuracy,
          floor
        });
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        if (error?.code === 1) {
          toast.error(t('permissionDenied'));
        } else {
          toast.error(t('unavailable'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [t]);

  const openShare = useCallback(() => {
    setMode('share');
    setPosition(null);
    setIsOpen(true);
    requestFreshLocation();
  }, [requestFreshLocation]);

  const openIncoming = useCallback(() => {
    setMode('incoming');
    setIsOpen(true);
    refreshShares();
  }, [refreshShares]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !shouldRender) return undefined;

    previousFocusRef.current = document.activeElement;
    const modal = modalRef.current;
    const selector = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(modal?.querySelectorAll?.(selector) || []);
    window.setTimeout(() => focusables()[0]?.focus?.(), 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, shouldRender, closeModal]);

  const submitShare = async (event) => {
    event.preventDefault();
    if (!position || !phone.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createLocationShare({
        recipientPhone: phone.trim(),
        ...position
      });
      setPhone('');
      toast.success(t('shareSuccess'));
      await refreshShares();
    } catch (error) {
      if (error?.code === 'CANNOT_SHARE_WITH_SELF') {
        toast.error(t('cannotShareSelf'));
      } else if (error?.code === 'RECIPIENT_UNAVAILABLE' || error?.status === 422) {
        toast.error(t('recipientUnavailable'));
      } else {
        toast.error(t('generalError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const stopShare = async (shareId) => {
    try {
      await revokeLocationShare(shareId);
      await refreshShares();
    } catch (error) {
      console.warn('location share revoke failed', error);
      toast.error(t('generalError'));
    }
  };

  const navigateToShare = (share) => {
    const lat = Number(share?.location?.lat);
    const lng = Number(share?.location?.lng);
    const floor = Number(share?.location?.floor);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || ![0, -1].includes(floor)) {
      toast.error(t('generalError'));
      return;
    }

    const senderName = share?.sender?.displayName || '';
    const destination = {
      name: t('sharedFrom', { name: senderName }),
      coordinates: [lat, lng],
      floor,
      source: 'shared_location',
      sourceId: String(share.id)
    };

    setDestination(destination);
    setIsOpen(false);

    if (location.pathname === '/fs') {
      sessionStorage.setItem('updatedDestination', JSON.stringify(destination));
      window.dispatchEvent(new CustomEvent('goldenpath:destination-updated', { detail: destination }));
      return;
    }

    navigate('/fs');
  };

  const handleFsShareClick = () => {
    openShare();
    document.querySelector('.final-search-page .menu-btn.active')?.click?.();
  };

  const locale = language === 'fa' ? 'fa-IR' : language === 'ar' ? 'ar-SA' : language === 'ur' ? 'ur-PK' : 'en-US';
  const formatTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  if (!shouldRender) return null;

  return (
    <>
      {location.pathname === '/mpb' && mpbPortalTarget && createPortal(
        <div className="map-location-share-slot">
          <button
            type="button"
            className="map-location-share-button"
            onClick={openShare}
            title={t('shareMyLocation')}
            aria-label={t('shareMyLocation')}
          >
            <ShareIcon size={24} />
          </button>
          {incoming.length > 0 && (
            <button
              type="button"
              className="map-location-share-badge"
              onClick={openIncoming}
              title={t('incomingTitle')}
              aria-label={`${t('incomingTitle')}: ${incoming.length}`}
            >
              {incoming.length > 9 ? '9+' : incoming.length}
            </button>
          )}
        </div>,
        mpbPortalTarget
      )}

      {location.pathname === '/fs' && fsMenuPortalTarget && createPortal(
        <button className="menu-item-fs location-share-menu-item" type="button" onClick={handleFsShareClick}>
          <ShareIcon size={24} />
          <span>{t('shareMyLocation')}</span>
          {incoming.length > 0 && <span className="location-share-menu-count">{incoming.length}</span>}
        </button>,
        fsMenuPortalTarget
      )}

      {isOpen && (
        <div className="location-share-backdrop" role="presentation" onMouseDown={closeModal}>
          <section
            ref={modalRef}
            className="location-share-modal"
            role="dialog"
            aria-modal="true"
            aria-label={mode === 'incoming' ? t('incomingTitle') : t('shareMyLocation')}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="location-share-header">
              <strong>{mode === 'incoming' ? t('incomingTitle') : t('shareMyLocation')}</strong>
              <button type="button" className="location-share-close" onClick={closeModal} aria-label={t('close')}>×</button>
            </div>

            {mode === 'share' ? (
              <>
                {incoming.length > 0 && (
                  <button type="button" className="location-share-incoming-link" onClick={openIncoming}>
                    <span>{t('incomingTitle')}</span>
                    <span className="location-share-count">{incoming.length}</span>
                  </button>
                )}

                <p className="location-share-hint">{t('shareLocationDescription')}</p>
                <div className="location-share-current">
                  <strong>{t('currentLocation')}</strong>
                  {isLocating && <span>{t('loading')}</span>}
                  {!isLocating && position && (
                    <>
                      <span>{t('accuracy', { value: Math.round(position.accuracyM || 0) })}</span>
                      <span>{position.floor === -1 ? t('floorMinusOne') : t('floorGround')}</span>
                    </>
                  )}
                  {!isLocating && !position && (
                    <button type="button" className="location-share-retry" onClick={requestFreshLocation}>{t('unavailable')}</button>
                  )}
                </div>

                <form onSubmit={submitShare} className="location-share-form">
                  <label htmlFor="location-share-phone">{t('recipientPhone')}</label>
                  <input
                    id="location-share-phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder={t('recipientPlaceholder')}
                    autoComplete="tel"
                    maxLength={32}
                  />
                  <button type="submit" className="location-share-primary" disabled={!position || !phone.trim() || isSubmitting}>
                    {isSubmitting ? t('loading') : t('shareButton')}
                  </button>
                </form>

                {outgoing.length > 0 && (
                  <div className="location-share-section">
                    <div className="location-share-section-title">{t('outgoingTitle')}</div>
                    {outgoing.map((share) => (
                      <div key={share.id} className="location-share-row">
                        <div>
                          <strong>{share?.recipient?.displayName || share?.recipient?.mobileMasked || ''}</strong>
                          <small>{t('expiresAt', { time: formatTime(share.expiresAt) })}</small>
                        </div>
                        <button type="button" className="location-share-text-button" onClick={() => stopShare(share.id)}>{t('stop')}</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="location-share-section incoming">
                <button type="button" className="location-share-mode-switch" onClick={openShare}>
                  {t('shareMyLocation')}
                </button>
                {isLoadingShares && incoming.length === 0 && <p>{t('loading')}</p>}
                {!isLoadingShares && incoming.length === 0 && <p className="location-share-empty">{t('noIncoming')}</p>}
                {incoming.map((share) => (
                  <div key={share.id} className="location-share-row incoming-row">
                    <div>
                      <strong>{t('sharedFrom', { name: share?.sender?.displayName || '' })}</strong>
                      <small>{share?.location?.floor === -1 ? t('floorMinusOne') : t('floorGround')}</small>
                      <small>{t('expiresAt', { time: formatTime(share.expiresAt) })}</small>
                    </div>
                    <button type="button" className="location-share-route-button" onClick={() => navigateToShare(share)}>{t('routeTo')}</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
};

export default LocationShareOverlay;
