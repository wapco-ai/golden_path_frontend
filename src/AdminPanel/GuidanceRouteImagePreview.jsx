import useGuidanceImage from '../hooks/useGuidanceImage';
import { NAVIGATION_IMAGE_OPTIONS } from '../services/landmarkViewImageService';
import RngGuidanceImage from '../components/map/RngGuidanceImage';
import { floorLabel } from '../utils/connectorForm';

export default function GuidanceRouteImagePreview({ point, onAdd }) {
  const { lng, lat, heading, floor, click } = point;
  const { data, loading, error } = useGuidanceImage({
    ...NAVIGATION_IMAGE_OPTIONS, language: 'fa', geo: { lng, lat }, heading, floor,
  }, click, { repeat: false });
  const headingLabel = (Math.round(heading) % 360).toLocaleString('fa-IR');

  return (
    <div className="guidance-route-image-preview">
      <strong>پیش‌نمایش تصویر راهنما</strong>
      <small>{floorLabel(floor)} · جهت حرکت {headingLabel}°</small>
      <RngGuidanceImage key={click} lookup={data} loading={loading} error={error} />
      {data?.status === 'NO_MATCH' && (
        <button type="button" className="guidance-overview__add" onClick={() => onAdd({ lng, lat }, floor)}>
          افزودن نقطه راهنما در این محل
        </button>
      )}
    </div>
  );
}
