import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLangStore } from '../../store/langStore';
import {
  ROUTING_ACTIVITY_EVENT,
  getPendingRoutingRequests
} from '../../utils/routingRequestActivity';
import './RouteRequestLoader.css';

const MIN_VISIBLE_MS = 500;

const COPY = {
  fa: {
    title: 'در حال محاسبه بهترین مسیر…',
    description: 'مسیرها و محدودیت‌های عبور در حال بررسی هستند'
  },
  en: {
    title: 'Calculating the best route…',
    description: 'Checking available paths and access restrictions'
  },
  ar: {
    title: 'جارٍ حساب أفضل مسار…',
    description: 'يتم التحقق من المسارات المتاحة وقيود المرور'
  },
  ur: {
    title: 'بہترین راستہ شمار کیا جا رہا ہے…',
    description: 'دستیاب راستوں اور گزرنے کی پابندیوں کی جانچ ہو رہی ہے'
  }
};

const RouteRequestLoader = () => {
  const location = useLocation();
  const language = useLangStore((state) => state.language);
  const initialBusy = getPendingRoutingRequests() > 0;
  const [isVisible, setIsVisible] = useState(initialBusy);
  const visibleRef = useRef(initialBusy);
  const visibleSinceRef = useRef(initialBusy ? Date.now() : 0);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const show = () => {
      clearHideTimer();
      if (visibleRef.current) return;

      visibleRef.current = true;
      visibleSinceRef.current = Date.now();
      setIsVisible(true);
    };

    const hide = () => {
      if (!visibleRef.current) return;

      clearHideTimer();
      const elapsed = Date.now() - visibleSinceRef.current;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

      hideTimerRef.current = window.setTimeout(() => {
        visibleRef.current = false;
        visibleSinceRef.current = 0;
        hideTimerRef.current = null;
        setIsVisible(false);
      }, remaining);
    };

    const syncWithRoutingActivity = () => {
      if (getPendingRoutingRequests() > 0) {
        show();
      } else {
        hide();
      }
    };

    syncWithRoutingActivity();
    window.addEventListener(ROUTING_ACTIVITY_EVENT, syncWithRoutingActivity);

    return () => {
      window.removeEventListener(ROUTING_ACTIVITY_EVENT, syncWithRoutingActivity);
      clearHideTimer();
    };
  }, []);

  if (!isVisible || location.pathname !== '/fs') {
    return null;
  }

  const copy = COPY[language] || COPY.en;
  const direction = language === 'en' ? 'ltr' : 'rtl';

  return (
    <div
      className="route-request-loader"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      dir={direction}
    >
      <div className="route-request-loader__card">
        <div className="route-request-loader__visual" aria-hidden="true">
          <span className="route-request-loader__endpoint route-request-loader__endpoint--start" />
          <span className="route-request-loader__track">
            <span className="route-request-loader__traveler" />
          </span>
          <span className="route-request-loader__endpoint route-request-loader__endpoint--end" />
        </div>

        <div className="route-request-loader__title">{copy.title}</div>
        <div className="route-request-loader__description">{copy.description}</div>

        <div className="route-request-loader__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
};

export default RouteRequestLoader;
