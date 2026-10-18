const culturalDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export const formatCulturalCreatedAt = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '-';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : culturalDateFormatter.format(date);
};
