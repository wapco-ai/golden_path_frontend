import React from 'react';
import { floorLabel, newStop } from '../utils/connectorForm';

// Reuse the existing modal's controls and layout classes; no new modal or wizard.
export default function ConnectorStops({ value, onChange, kind, floors, groups, onJoin, onPick, Select }) {
  const patch = (i, changes) => onChange({ ...value, stops: value.stops.map((s, n) => n === i ? { ...s, ...changes } : s) });
  const move = (i, offset) => {
    const stops = [...value.stops];
    [stops[i], stops[i + offset]] = [stops[i + offset], stops[i]];
    onChange({ ...value, stops });
  };
  const availableFloors = floors.filter(f => !value.stops.some(s => Number(s.floor) === Number(f.floor)));
  return <div className="form-group routing-direction-section" data-testid="connector-stops">
    <label className="form-label">اتصال و توقف‌های آن</label>
    {!value.id && <div className="form-group">
      <Select value="" onChange={onJoin} placeholder="اتصال جدید؛ یا انتخاب اتصال موجود" options={groups.filter(g => g.kind === kind).map(g => ({ value: String(g.id), label: g.title || `اتصال ${g.id}` }))} />
    </div>}
    {value.id && <p>ویرایش اتصال شماره {value.id} برای همهٔ توقف‌های زیر اعمال می‌شود.</p>}
    <div className="routing-direction-switches">
      {[['both', 'دوطرفه'], ['forward', 'از اولین توقف به آخرین'], ['reverse', 'از آخرین توقف به اولین']].map(([id, label]) =>
        <button type="button" key={id} className={`routing-direction-btn ${value.direction === id ? 'active' : ''}`}
          onClick={() => onChange({ ...value, direction: id })}>{label}</button>)}
    </div>
    {kind === 'elevator' && <div className="form-group">
      <label className="form-label" htmlFor="connector-wait">زمان متوسط انتظار آسانسور (ثانیه، یک‌بار در هر سوار شدن)</label>
      <input id="connector-wait" className="form-input" type="number" min="0" max="3600" value={value.wait_seconds}
        onChange={e => onChange({ ...value, wait_seconds: e.target.value })} />
    </div>}
    {value.stops.map((stop, i) => <div className="form-group" key={`${i}-${stop.floor}`} data-testid="connector-stop">
      <label className="form-label">توقف {i + 1} ـ {floorLabel(stop.floor)}</label>
      <div className="routing-area-grid">
        <div className="routing-field">
          <Select value={String(stop.floor)} disabled={Boolean(stop.access_id)} onChange={floor => patch(i, { ...newStop(floor, kind), access_id: null, area_id: null, lat: null, lon: null, areas: [], error: '' })}
            options={floors.filter(f => Number(f.floor) === Number(stop.floor) || !value.stops.some(s => Number(s.floor) === Number(f.floor))).map(f => ({ value: String(f.floor), label: f.label || floorLabel(f.floor) }))} placeholder="طبقه" />
        </div>
        <button type="button" className="routing-direction-btn" disabled={stop.resolving} onClick={() => onPick(i)}>
          {stop.access_id || stop.lat != null ? 'تغییر نقطه روی نقشه' : 'انتخاب نقطه روی نقشه'}
        </button>
      </div>
      {stop.resolving ? <p role="status">در حال تشخیص فضای دسترسی…</p> : stop.error ? <p role="alert">{stop.error}</p> : null}
      {stop.areas?.length > 1 ? <div className="routing-field">
        <label>فضای قابل‌تردد کنار این توقف</label>
        <Select value={stop.area_id ? String(stop.area_id) : ''} onChange={id => patch(i, { area_id: Number(id) })}
          options={stop.areas.map(a => ({ value: String(a.id), label: a.name }))} placeholder="یکی از فضاهای کنار نقطه را انتخاب کنید" />
      </div> : stop.area_id ? <p>فضای دسترسی: {stop.area_name || stop.areas?.[0]?.name || `محدوده ${stop.area_id}`}</p> : null}
      {i < value.stops.length - 1 && <div className="form-group">
        <label htmlFor={`stop-time-${i}`}>زمان عبور تا توقف بعدی (ثانیه)</label>
        <input id={`stop-time-${i}`} className="form-input" type="number" min="1" max="3600" value={stop.travel_seconds} onChange={e => patch(i, { travel_seconds: e.target.value })} />
        {value.direction === 'both' && <>
          <label><input type="checkbox" checked={stop.reverse_seconds != null} onChange={e => patch(i, { reverse_seconds: e.target.checked ? stop.travel_seconds : null })} /> زمان برگشت متفاوت است</label>
          {stop.reverse_seconds != null && <input aria-label={`زمان برگشت از توقف ${i + 2}`} className="form-input" type="number" min="1" max="3600" value={stop.reverse_seconds} onChange={e => patch(i, { reverse_seconds: e.target.value })} />}
        </>}
      </div>}
      <div className="routing-direction-switches">
        <button type="button" className="routing-direction-btn" disabled={!i} onClick={() => move(i, -1)}>جابه‌جایی به قبل</button>
        <button type="button" className="routing-direction-btn" disabled={i === value.stops.length - 1} onClick={() => move(i, 1)}>جابه‌جایی به بعد</button>
        <button type="button" className="routing-direction-btn" disabled={value.stops.length < 2} onClick={() => onChange({ ...value, stops: value.stops.filter((_, n) => n !== i) })}>حذف توقف</button>
      </div>
    </div>)}
    <button type="button" className="routing-direction-btn" disabled={!availableFloors.length} onClick={() => onChange({ ...value, stops: [...value.stops, newStop(availableFloors[0].floor, kind)] })}>افزودن توقف در طبقه دیگر</button>
    <p>{kind === 'elevator' ? 'همهٔ توقف‌های قابل‌استفاده به یک آسانسور متصل می‌شوند.' : 'توقف‌ها را به ترتیب پیوستگی مسیر وارد کنید؛ عبور فقط بین دو توقف پیاپی انجام می‌شود.'}</p>
  </div>;
}
