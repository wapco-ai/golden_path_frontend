import { useEffect, useMemo, useState } from 'react';
import { floorLabel } from '../utils/connectorForm';
import { checkRouteCoverage, groupRouteCoverage, requestGuidanceRoute } from '../services/guidanceRouteCoverage';
import GuidancePointsMap from './GuidancePointsMap';

const number = (value) => value.toLocaleString('fa-IR', { maximumFractionDigits: 0 });

export default function GuidanceRouteCheck({ floor, onFloorChange, version, onAdd, ...mapProps }) {
  const [enabled, setEnabled] = useState(false);
  const [pick, setPick] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [samples, setSamples] = useState([]);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState('');

  useEffect(() => {
    if (!submitted) return;
    const controller = new AbortController();
    const { signal } = controller;
    async function analyse() {
      setSamples([]);
      setStatus('routing');
      setProgress('');
      try {
        const route = await requestGuidanceRoute(submitted.origin, submitted.destination, signal);
        if (signal.aborted) return;
        if (!route.length) {
          setStatus('empty');
          return;
        }
        setSamples(route);
        setStatus('checking');
        const checked = await checkRouteCoverage(route, signal, (done, total) => {
          setProgress(`${number(done)} از ${number(total)}`);
        });
        if (signal.aborted) return;
        setSamples(checked);
        setStatus('ready');
      } catch (error) {
        if (!signal.aborted) setStatus(error.status === 404 ? 'no-route' : 'error');
      }
    }
    analyse();
    return () => controller.abort();
  }, [submitted, version]);

  const groups = useMemo(() => groupRouteCoverage(samples), [samples]);
  const gaps = groups.filter(section => section.status === 'gap');
  const unknown = groups.some(section => section.status === 'unknown');
  const ready = status === 'ready';

  function pickPoint(location) {
    if (pick === 'origin') {
      setOrigin({ ...location, floor });
      setPick(destination ? null : 'destination');
    } else {
      setDestination({ ...location, floor });
      setPick(null);
    }
    setSubmitted(null);
    setSamples([]);
    setStatus('');
  }

  function toggle() {
    if (enabled) {
      setPick(null);
      setOrigin(null);
      setDestination(null);
      setSubmitted(null);
      setSamples([]);
      setStatus('');
    } else {
      setPick('origin');
    }
    setEnabled(!enabled);
  }

  return (
    <>
      <div className="guidance-route-check">
        <button type="button" className="guidance-route-check__action" aria-expanded={enabled} onClick={toggle}>
          {enabled ? 'بستن بررسی پوشش مسیر' : 'بررسی پوشش مسیر'}
        </button>
        {enabled && (
          <>
            <div className="guidance-route-check__controls">
              <button type="button" aria-pressed={pick === 'origin'} onClick={() => setPick('origin')}>
                {origin ? `مبدأ · ${floorLabel(origin.floor)}` : 'انتخاب مبدأ'}
              </button>
              <button type="button" aria-pressed={pick === 'destination'} onClick={() => setPick('destination')}>
                {destination ? `مقصد · ${floorLabel(destination.floor)}` : 'انتخاب مقصد'}
              </button>
              <button type="button" className="guidance-route-check__action"
                disabled={!origin || !destination || Boolean(pick) || status === 'routing' || status === 'checking'}
                onClick={() => {
                  onFloorChange(origin.floor);
                  setSubmitted({ origin, destination });
                }}>
                {ready ? 'بررسی دوباره' : 'بررسی مسیر پیاده'}
              </button>
            </div>
            <p role="status" className="guidance-route-check__status">
              {pick === 'origin' ? 'مبدأ را روی نقشه انتخاب کنید.' : pick === 'destination' ? 'مقصد را روی نقشه انتخاب کنید.'
                : status === 'routing' ? 'در حال محاسبهٔ مسیر…'
                  : status === 'checking' ? `در حال بررسی تصویر راهنما… ${progress}`
                    : status === 'no-route' ? 'مسیر پیاده‌ای بین این دو نقطه پیدا نشد.'
                      : status === 'empty' ? 'این مسیر بخش پیادهٔ قابل بررسی ندارد.'
                        : status === 'error' ? 'بررسی مسیر ناموفق بود. دوباره تلاش کنید.'
                          : ready ? `${number(gaps.length)} بخش بدون راهنما${unknown ? ' · پوشش بخش‌های خاکستری مشخص نشد.' : ''}`
                            : 'مسیر پیاده را بررسی کنید.'}
            </p>
            {groups.length > 0 && <p className="guidance-route-check__hint">برای پیش‌نمایش تصویر، روی خط مسیر کلیک کنید.</p>}
            {groups.length > 0 && (
              <ul className="guidance-route-check__legend" aria-label="رنگ‌بندی پوشش مسیر">
                <li data-status="covered">دارای راهنما</li>
                <li data-status="gap">بدون راهنما</li>
                {unknown && <li data-status="unknown">پوشش نامشخص</li>}
              </ul>
            )}
          </>
        )}
      </div>
      <GuidancePointsMap key={floor} floor={floor} {...mapProps} onAdd={onAdd}
        onPick={pick ? pickPoint : null}
        routeSections={groups} routeRun={submitted} routeVersion={version}
        routeOrigin={origin} routeDestination={destination} />
      {ready && gaps.length > 0 && (
        <ul className="guidance-route-check__gaps" aria-label="بخش‌های بدون راهنما">
          {gaps.map((gap, index) => (
            <li key={gap.id}>
              <span>{`بخش ${number(index + 1)} · ${floorLabel(gap.floor)} · ${number(gap.length)} متر`}</span>
              <button type="button" onClick={() => {
                onFloorChange(gap.floor);
                onAdd(gap.geo, gap.floor);
              }}>افزودن نقطه راهنما</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
