import React, { useEffect, useState } from 'react';
import { POLICY_FIELDS, validNavigationPolicy } from '../services/navigationPolicy.js';
import appConfig from '../config/appConfig.js';

export default function NavigationSettings({ adminFetch, onClose }) {
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const url = `${appConfig.apiBaseUrl}/api/v1/admin/navigation-settings`;
  useEffect(() => {
    let active = true;
    adminFetch(url).then(async response => {
      if (!response.ok) throw new Error();
      const value = await response.json();
      if (!validNavigationPolicy(value.policy)) throw new Error();
      if (active) setSettings(value);
    }).catch(() => { if (active) setMessage('دریافت تنظیمات ممکن نشد یا دسترسی ندارید.'); });
    return () => { active = false; };
  }, [adminFetch, url]);
  const save = async event => {
    event.preventDefault();
    if (busy || !validNavigationPolicy(settings?.policy)) return;
    setBusy(true); setMessage('');
    try {
      const response = await adminFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      if (!response.ok) {
        setMessage(response.status === 409 ? 'تنظیمات توسط فرد دیگری تغییر کرده است؛ پنجره را ببندید و دوباره باز کنید.' : 'ذخیره انجام نشد؛ دسترسی و مقادیر را بررسی کنید.');
        return;
      }
      setSettings(await response.json());
      setMessage('ذخیره شد. تنظیمات در بارگذاری بعدی برنامه اعمال می‌شود.');
    } catch { setMessage('ارتباط برقرار نشد؛ تغییرات ذخیره نشده است.'); }
    finally { setBusy(false); }
  };
  return <form onSubmit={save} className="navigation-settings-form">
    {settings && <>
      <p>اطلاعات پایهٔ مسیریابی — در محیط دارای اختلال، GPS خاموش بماند.</p>
      <label className="form-group"><span>استفاده از GPS</span>
        <input type="checkbox" checked={settings.policy.gps_enabled} disabled={busy}
          onChange={e => setSettings({ ...settings, policy: { ...settings.policy, gps_enabled: e.target.checked } })} /></label>
      <label className="form-group"><span className="form-label">سرعت پیاده‌روی (متر بر ثانیه)</span>
        <input className="form-input" type="number" step="0.01" min="0.2" max="3" required disabled={busy}
          value={settings.walk_speed_mps} onChange={e => setSettings({ ...settings, walk_speed_mps: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
      {Object.entries(POLICY_FIELDS).map(([key, [, min, max, label]]) => <label className="form-group" key={key}>
        <span className="form-label">{label}</span>
        <input className="form-input" type="number" min={min} max={max} required disabled={busy}
          step={key === 'arrival_samples' || key.endsWith('_ms') ? 1 : 0.01} value={settings.policy[key]}
          onChange={e => setSettings({ ...settings, policy: { ...settings.policy, [key]: e.target.value === '' ? '' : Number(e.target.value) } })} />
      </label>)}
      {!validNavigationPolicy(settings.policy) && <p role="alert">شعاع رسیدن باید کمتر از حد هشدار و فاصله از مسیر حداکثر برابر حد هشدار باشد؛ حدهای GPS نیز باید به ترتیب افزایشی باشند.</p>}
    </>}
    {message && <p role="status">{message}</p>}
    <div className="settings-actions">
      {settings && <button className="btn-primary" type="submit" disabled={busy || !validNavigationPolicy(settings.policy)}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>}
      <button className="btn-primary" type="button" onClick={onClose}>بستن</button>
    </div>
  </form>;
}
