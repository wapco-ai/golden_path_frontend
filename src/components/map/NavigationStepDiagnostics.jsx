import React from 'react';
import '../../styles/NavigationStepDiagnostics.css';

const labels = {
  fa: {
    title: 'آزمایش قدم‌شمار', samples: 'نمونه‌های حرکت', steps: 'قدم‌های ثبت‌شده',
    signal: 'بیشینهٔ سیگنال / حد تشخیص', heading: 'جهت معتبر', anchor: 'مبدأ معتبر',
    distance: 'مسافت حسگر (متر)', progress: 'پیشروی روی خط (متر)',
    length: 'طول خط مسیر (متر)', routeDistance: 'فاصلهٔ تخمینی از خط مسیر (متر)',
    state: 'وضعیت سفر', yes: 'بله', no: 'خیر',
    modes: { live: 'فعال', paused: 'متوقف', arrived: 'رسیدن تأیید شد', preview: 'پیش‌نمایش', demo: 'دمو' },
  },
  en: {
    title: 'Step detector test', samples: 'Motion samples', steps: 'Detected steps',
    signal: 'Peak signal / detection threshold', heading: 'Valid heading', anchor: 'Valid anchor',
    distance: 'Sensor distance (m)', progress: 'Progress on route (m)',
    length: 'Route geometry length (m)', routeDistance: 'Estimated distance from route (m)',
    state: 'Trip status', yes: 'Yes', no: 'No',
    modes: { live: 'Active', paused: 'Paused', arrived: 'Arrival confirmed', preview: 'Preview', demo: 'Demo' },
  },
};

const decimal = value => Number.isFinite(value) ? value.toFixed(1) : '—';

export default function NavigationStepDiagnostics({ service, tracker, mode, stage, routeLength, language, routeDistance }) {
  const text = labels[language] ?? labels.en;
  const reading = service.getStepDiagnostics();
  const values = [
    ['samples', reading.samples],
    ['steps', reading.steps],
    ['signal', reading.signal.toFixed(2) + ' / ' + reading.threshold.toFixed(2)],
    ['heading', reading.headingAvailable ? text.yes : text.no],
    ['anchor', reading.anchorAvailable ? text.yes : text.no],
    ['distance', decimal(reading.distance)],
    ['progress', decimal(tracker.along ?? 0)],
    ['length', decimal(routeLength)],
    ['routeDistance', decimal(routeDistance)],
    ['state', [text.modes[mode], stage].filter(Boolean).join(' · ')],
  ];

  return (
    <aside className="navigation-step-diagnostics" aria-label={text.title} data-testid="step-diagnostics">
      <strong>{text.title}</strong>
      <dl>
        {values.map(([key, value]) => (
          <React.Fragment key={key}>
            <dt>{text[key]}</dt>
            <dd data-testid={`step-diagnostic-${key}`}>{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </aside>
  );
}
