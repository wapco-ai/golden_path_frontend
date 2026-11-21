import { useEffect, useRef, useState } from 'react';
import { getAreaInfo, updateAreaInfo } from '../services/adminAreasService';

const areaLabels = {
  stair_area: 'پله', elevator_area: 'آسانسور', ramp_area: 'رمپ', functional_area: 'فضای عملکردی',
  courtyard: 'صحن', riwaq: 'رواق', iwan: 'ایوان', mosque: 'مسجد', admin_zone: 'اداری',
  storage_area: 'انبار', warehouse_area: 'انبار کالا', facility_area: 'تأسیسات',
  technical_area: 'فضای فنی', service_room: 'اتاق خدمات',
};

export default function AreaCorridorDialog({ areaId, language, onCancel, onSaved }) {
  const [area, setArea] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getAreaInfo(areaId, { language }, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setArea(data); })
      .catch(() => { if (!controller.signal.aborted) setError('دریافت اطلاعات محدوده ناموفق بود.'); });
    return () => controller.abort();
  }, [areaId, language]);

  const type = area?.meta?.area_type || area?.area_type;
  const role = area?.attrs_raw?.routing_role || area?.default_routing_role;
  const alreadyWalkable = type === 'functional_area' && role === 'routable';

  async function save() {
    if (!type || alreadyWalkable || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      const response = await updateAreaInfo(areaId, {
        meta: { area_type: 'functional_area' },
        routing_role: 'routable',
      });
      onSaved(response.area_graph);
    } catch (cause) {
      setError(cause.response?.data?.errors?.routing_role?.[0] || cause.response?.data?.message || 'ثبت تغییر نوع محدوده ناموفق بود.');
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className="area-corridor-dialog" dir="rtl" aria-labelledby="area-corridor-title"
      onCancel={(event) => { event.preventDefault(); if (!pending.current) onCancel(); }}>
      <h3 id="area-corridor-title">تبدیل محدوده به راهرو</h3>
      {area ? <>
        <p>{area.title || area.basic_info?.title?.fa || 'محدوده'} ({areaId}) · طبقه {area.meta?.floor ?? area.floor}</p>
        <p>نوع فعلی: {areaLabels[type] || type}</p>
        <p>{alreadyWalkable ? 'عبور از داخل این فضای عملکردی مجاز است.' : 'با ثبت این تغییر، عبور از داخل محدوده برای مسیریابی مجاز می‌شود.'}</p>
      </> : !error && <p role="status">در حال دریافت اطلاعات محدوده…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="modal-footer">
        <button className="cancel-btn5" disabled={saving} onClick={onCancel}>بستن</button>
        <button className="primary-btn" disabled={!type || saving || alreadyWalkable} onClick={save}>
          {saving ? 'در حال ثبت…' : 'ثبت به‌عنوان راهرو'}
        </button>
      </div>
    </dialog>
  );
}
