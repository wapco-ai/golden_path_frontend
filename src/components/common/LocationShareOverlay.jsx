import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const ACTIVE_PATHS = new Set(['/mpr', '/fs']);

const LocationShareOverlay = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const language = useLangStore((state) => state.language);
  const { accessToken } = useUserAuthStore();
  const setDestination = useRouteStore((state) => state.setDestination);
  const t = useMemo(() => getLocationShareText(language), [language]);

  const hasToken = Boolean(
    accessToken ||
    (typeof window !== 'undefined' && window.sessionStorage?.getItem?.(USER_ACCESS_TOKEN_KEY))
  );
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

  const refreshShares = useCallback(async () => {
    if (!hasToken) return;
    setIsLoadingShares(true);
    try {
      const [nextIncoming, nextOutgoing] = await Promise.all([
        listIncomingLocationShares(),
        listOutgoingLocationShares()
      ]);
      setIncoming(nextIncoming);
      setOutgoing(nextOutgoing);
    } catch (error) {
      if (error?.status !== 401) {
        console.warn('location share refresh failed', error);
      }
    } finally {
      setIsLoadingShares(false);
    }
  }, [hasToken]);

  useEffect(() => {
    if (!shouldRender) return;
    refreshShares();
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

  const openShare = () => {
    setMode('share');
    setIsOpen(true);
    setPosition(null);
    requestFreshLocation();
  };

  const openIncoming = () => {
    setMode('incoming');
    setIsOpen(true);
    refreshShares();
  };

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
    setDestination({
      name: t('sharedFrom', { name: senderName }),
      coordinates: [lat, lng],
      floor,
      source: 'shared_location',
      sourceId: String(share.id)
    });
    setIsOpen(false);
    navigate('/fs');
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
      <div className="location-share-overlay" aria-label={t('shareMyLocation')}>
        <button
          type="button"
          className="location-share-fab"
          onClick={openShare}
          title={t('shareMyLocation')}
          aria-label={t('shareMyLocation')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
            <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
            <path d="M8.7 10.6 15.3 6.4M8.7 13.4l6.6 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {incoming.length > 0 && (
          <button
            type="button"
            className="location-share-inbox"
            onClick={openIncoming}
            aria-label={t('incomingTitle')}
            title={t('incomingTitle')}
          >
            <span aria-hidden="true">⌖</span>
            <span>{incoming.length}</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="location-share-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            className="location-share-modal"
            role="dialog"
            aria-modal="true"
            aria-label={mode === 'incoming' ? t('incomingTitle') : t('shareMyLocation')}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="location-share-header">
              <strong>{mode === 'incoming' ? t('incomingTitle') : t('shareMyLocation')}</strong>
              <button type="button" className="location-share-close" onClick={() => setIsOpen(false)} aria-label={t('close')}>×</button>
            </div>

            {mode === 'share' ? (
              <>
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
