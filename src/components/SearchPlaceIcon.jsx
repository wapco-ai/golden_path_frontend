import { useIntl } from 'react-intl';
import { TbMapPin, TbPolygon } from 'react-icons/tb';

export default function SearchPlaceIcon({ area = false, size = 16 }) {
  const intl = useIntl();
  const Icon = area ? TbPolygon : TbMapPin;
  const label = intl.formatMessage({ id: area ? 'searchAreaType' : 'searchPointType' });
  return <Icon size={size} color="#686868" role="img" aria-label={label} />;
}
