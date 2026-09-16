import React from 'react';
import { floorLabel, isSelectedStop, newStop } from '../utils/connectorForm';
import './ConnectorStops.css';

const digits = new Intl.NumberFormat('fa');
const directions = [['both', 'دوطرفه'], ['forward', 'به ترتیب توقف‌ها'], ['reverse', 'خلاف ترتیب توقف‌ها']];

function Icon({ name }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'up' ? <path d="m6 15 6-6 6 6" /> : name === 'down' ? <path d="m6 9 6 6 6-6" /> : name === 'delete' ? <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></> : name === 'plus' ? <path d="M12 5v14M5 12h14" /> : <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>}
  </svg>;
}

function SecondsInput({ id, label, value, onChange, min = 1 }) {
  return <div className="connector-field">
    <label className="connector-label" htmlFor={id}>{label}</label>
    <div className="connector-seconds">
      <input id={id} className="form-input" type="number" inputMode="numeric" min={min} max="3600" value={value} onChange={e => onChange(e.target.value)} aria-describedby={`${id}-unit`} />
      <span id={`${id}-unit`}>ثانیه</span>
    </div>
  </div>;
}

export default function ConnectorStops({ value, onChange, kind, floors, groups, onJoin, onPick, selectedPoint, Select }) {
  const patch = (i, changes) => onChange({ ...value, stops: value.stops.map((s, n) => n === i ? { ...s, ...changes } : s) });
  const move = (i, offset) => {
    const stops = [...value.stops];
    [stops[i], stops[i + offset]] = [stops[i + offset], stops[i]];
    onChange({ ...value, stops });
  };
  const availableFloors = floors.filter(f => !value.stops.some(s => Number(s.floor) === Number(f.floor)));
  const labelForFloor = floor => floors.find(f => Number(f.floor) === Number(floor))?.label || floorLabel(floor);

  return <section className="form-group connector-editor" data-testid="connector-stops" aria-labelledby="connector-heading">
    <div className="connector-intro">
      <h4 id="connector-heading">توقف‌های اتصال</h4>
      <p className="connector-help">{value.id ? 'اطلاعات این اتصال برای همهٔ توقف‌های آن مشترک است.' : 'نقطهٔ انتخاب‌شده ثابت است؛ توقف‌های طبقات دیگر را به آن اضافه کنید.'}</p>
    </div>
    {!value.id && <Select value="" onChange={onJoin} placeholder="اتصال جدید؛ یا انتخاب اتصال موجود" options={groups.filter(g => g.kind === kind).map(g => ({ value: String(g.id), label: g.title || `اتصال ${g.id}` }))} />}

    <div className={`connector-settings ${kind === 'elevator' ? 'connector-settings--elevator' : ''}`}>
      <div className="connector-field">
        <span className="connector-label" id="connector-direction-label">جهت عبور</span>
        <div className="connector-direction" role="group" aria-labelledby="connector-direction-label">
          {directions.map(([id, label]) => <button type="button" key={id} className={`location-type-option ${value.direction === id ? 'selected' : ''}`}
            aria-pressed={value.direction === id} onClick={() => onChange({ ...value, direction: id })}>
            <span className="location-type-radio" aria-hidden="true">{value.direction === id && <span className="location-type-radio-dot" />}</span>
            <span>{label}</span>
          </button>)}
        </div>
      </div>
      {kind === 'elevator' && <div className="connector-field">
        <SecondsInput id="connector-wait" label="زمان متوسط انتظار آسانسور" min={0} value={value.wait_seconds} onChange={wait_seconds => onChange({ ...value, wait_seconds })} />
        <p className="connector-help">یک‌بار در هر سوار شدن محاسبه می‌شود.</p>
      </div>}
    </div>

    <div className="connector-stop-list">
      {value.stops.map((stop, i) => {
        const selected = isSelectedStop(stop, selectedPoint);
        return <section className={`connector-stop ${selected ? 'connector-stop--current' : ''}`} key={`${i}-${stop.floor}`} data-testid="connector-stop" data-selected-point={selected}>
          <div className="connector-stop-header">
            <div className="connector-stop-heading">
              <h5>توقف {digits.format(i + 1)} <span>ـ {labelForFloor(stop.floor)}</span></h5>
              {selected && <span className="connector-current-label">نقطهٔ انتخاب‌شده</span>}
            </div>
            <div className="connector-stop-actions">
              <button type="button" disabled={!i} onClick={() => move(i, -1)} aria-label="انتقال به قبل در ترتیب توقف‌ها" title="انتقال به قبل در ترتیب توقف‌ها"><Icon name="up" /></button>
              <button type="button" disabled={i === value.stops.length - 1} onClick={() => move(i, 1)} aria-label="انتقال به بعد در ترتیب توقف‌ها" title="انتقال به بعد در ترتیب توقف‌ها"><Icon name="down" /></button>
              {!selected && <button type="button" className="connector-remove" disabled={value.stops.length < 2} onClick={() => onChange({ ...value, stops: value.stops.filter((_, n) => n !== i) })} aria-label="حذف توقف" title="حذف توقف"><Icon name="delete" /></button>}
            </div>
          </div>

          {!selected && <div className="connector-location">
            <div className="connector-field">
              <span className="connector-label">طبقه</span>
              <Select value={String(stop.floor)} disabled={Boolean(stop.access_id)} onChange={floor => patch(i, { ...newStop(floor, kind), access_id: null, door_id: null, area_id: null, area_name: null, lat: null, lon: null, areas: [], error: '' })}
                options={floors.filter(f => Number(f.floor) === Number(stop.floor) || !value.stops.some(s => Number(s.floor) === Number(f.floor))).map(f => ({ value: String(f.floor), label: f.label || floorLabel(f.floor) }))} placeholder="طبقه" />
            </div>
            <button type="button" className="connector-map-button" disabled={stop.resolving} onClick={() => onPick(i)}>
              <Icon name="pin" />{stop.access_id || stop.lat != null ? 'تغییر نقطه روی نقشه' : 'انتخاب نقطه روی نقشه'}
            </button>
          </div>}

          <div className="connector-stop-fields">
            <div className="connector-field">
              <span className="connector-label">فضای دسترسی:</span>
              {stop.resolving ? <p className="connector-help" role="status">در حال تشخیص فضای دسترسی…</p> : stop.error ? <p className="connector-error" role="alert">{stop.error}</p> : stop.areas?.length > 1 ? <>
                <Select value={stop.area_id ? String(stop.area_id) : ''} onChange={id => patch(i, { area_id: Number(id) })}
                  options={stop.areas.map(a => ({ value: String(a.id), label: a.name }))} placeholder="فضای قابل‌تردد کنار نقطه" />
                <p className="connector-help">نقطه کنار چند فضا قرار دارد؛ فضای دسترسی را مشخص کنید.</p>
              </> : stop.area_id ? <p className="connector-area-value" data-testid="connector-area-value">{stop.area_name || stop.areas?.[0]?.name || `محدوده ${stop.area_id}`}</p>
                : <p className="connector-help">پس از انتخاب نقطه، خودکار تشخیص داده می‌شود.</p>}
            </div>
            {i < value.stops.length - 1 && <SecondsInput id={`stop-time-${i}`} label="زمان عبور تا توقف بعدی" value={stop.travel_seconds} onChange={travel_seconds => patch(i, { travel_seconds })} />}
          </div>

          {i < value.stops.length - 1 && value.direction === 'both' && <div className="connector-return">
            <label className="connector-checkbox"><input type="checkbox" checked={stop.reverse_seconds != null} onChange={e => patch(i, { reverse_seconds: e.target.checked ? stop.travel_seconds : null })} />زمان برگشت متفاوت است</label>
            {stop.reverse_seconds != null && <SecondsInput id={`stop-return-${i}`} label={`زمان برگشت از توقف ${digits.format(i + 2)}`} value={stop.reverse_seconds} onChange={reverse_seconds => patch(i, { reverse_seconds })} />}
          </div>}
        </section>;
      })}
    </div>
    <button type="button" className="connector-add-button" disabled={!availableFloors.length} onClick={() => onChange({ ...value, stops: [...value.stops, newStop(availableFloors[0].floor, kind)] })}><Icon name="plus" />افزودن توقف در طبقه دیگر</button>
    <p className="connector-help">{kind === 'elevator' ? 'همهٔ توقف‌های قابل‌استفاده به یک آسانسور متصل می‌شوند.' : 'ترتیب توقف‌ها باید با پیوستگی مسیر مطابقت داشته باشد؛ عبور بین دو توقف پیاپی انجام می‌شود.'}</p>
  </section>;
}
