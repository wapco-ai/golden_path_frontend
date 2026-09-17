import { getPointFloor } from './floors.js';

export default function localizeLocationData(data, language = 'fa') {
  const get = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value[language] || value.fa || Object.values(value)[0];
    }
    return value;
  };

  return {
    ...data,
    floor: getPointFloor(data),
    title: get(data.title),
    location: get(data.location),
    openingHours: get(data.openingHours),
    about: {
      short: get(data?.about?.short),
      full: get(data?.about?.full)
    },
    events: Array.isArray(data.events)
      ? data.events.map(ev => ({
          ...ev,
          title: get(ev.title),
          description: get(ev.description)
        }))
      : data.events
  };
}
