export const routeMode = (mode) => {
  if (mode === 'wheelchair') return 'wheelchair';
  if (mode === 'electric-car' || mode === 'van') return 'van';
  return 'walk';
};

export const doorEndpoint = (point) => {
  const accessId = point?.door?.accessId;
  const areaId = point?.door?.selectedAreaId ?? point?.areaId;
  if (!Number.isSafeInteger(accessId) || accessId <= 0 || !Number.isSafeInteger(areaId) || areaId <= 0) return null;
  return { accessId, areaId };
};

export const doorRouteErrorMessage = (error) => error?.doorUnavailable?.reason === 'closed'
  ? 'routeDoorClosed'
  : 'routeDoorUnavailable';

export const replaceDoorEndpoint = (point, door) => {
  const { entry, ...endpoint } = point;
  return {
    ...endpoint,
    floor: door.floor,
    coordinates: door.coordinates,
    door: { accessId: door.accessId, doorId: door.doorId, selectedAreaId: door.areaId }
  };
};
