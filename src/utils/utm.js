const WGS84_A = 6378137.0; // Semi-major axis
const WGS84_F = 1 / 298.257223563; // Flattening
const K0 = 0.9996; // UTM scale factor

const ZONE_NUMBER = 40;
const CENTRAL_MERIDIAN = -183 + (ZONE_NUMBER * 6); // Degrees

const degToRad = (degrees) => degrees * (Math.PI / 180);

export const convertLngLatToUtm32640 = ({ lng, lat }) => {
  if (typeof lng !== 'number' || typeof lat !== 'number') {
    throw new Error('مختصات طول و عرض جغرافیایی نامعتبر است');
  }

  const eccentricitySquared = 2 * WGS84_F - (WGS84_F ** 2);
  const eccentricityPrimeSquared = eccentricitySquared / (1 - eccentricitySquared);

  const latRad = degToRad(lat);
  const lonRad = degToRad(lng);
  const lonOriginRad = degToRad(CENTRAL_MERIDIAN);

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const N = WGS84_A / Math.sqrt(1 - eccentricitySquared * (sinLat ** 2));
  const T = tanLat ** 2;
  const C = eccentricityPrimeSquared * (cosLat ** 2);
  const A = cosLat * (lonRad - lonOriginRad);

  const M = WGS84_A * (
    (1 - (eccentricitySquared / 4) - (3 * eccentricitySquared ** 2 / 64) - (5 * eccentricitySquared ** 3 / 256)) * latRad
    - ((3 * eccentricitySquared / 8) + (3 * eccentricitySquared ** 2 / 32) + (45 * eccentricitySquared ** 3 / 1024)) * Math.sin(2 * latRad)
    + ((15 * eccentricitySquared ** 2 / 256) + (45 * eccentricitySquared ** 3 / 1024)) * Math.sin(4 * latRad)
    - ((35 * eccentricitySquared ** 3 / 3072) * Math.sin(6 * latRad))
  );

  const easting = (
    K0
    * N
    * (
      A
      + ((1 - T + C) * (A ** 3) / 6)
      + ((5 - 18 * T + T * T + 72 * C - 58 * eccentricityPrimeSquared) * (A ** 5) / 120)
    )
    + 500000.0
  );

  const northing = K0 * (
    M
    + N * tanLat * (
      (A ** 2) / 2
      + ((5 - T + 9 * C + 4 * (C ** 2)) * (A ** 4) / 24)
      + ((61 - 58 * T + T * T + 600 * C - 330 * eccentricityPrimeSquared) * (A ** 6) / 720)
    )
  );

  return {
    x: Number(easting.toFixed(3)),
    y: Number(northing.toFixed(3))
  };
};

export default convertLngLatToUtm32640;
