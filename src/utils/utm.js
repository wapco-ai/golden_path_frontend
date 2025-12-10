const WGS84_A = 6378137.0; // Semi-major axis
const WGS84_F = 1 / 298.257223563; // Flattening
const K0 = 0.9996; // UTM scale factor

const ZONE_NUMBER = 40;
const CENTRAL_MERIDIAN = -183 + (ZONE_NUMBER * 6); // Degrees

const degToRad = (degrees) => degrees * (Math.PI / 180);
const radToDeg = (radians) => radians * (180 / Math.PI);

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

export const convertUtm32640ToLngLat = ({ x, y }) => {
  if (typeof x !== 'number' || typeof y !== 'number') {
    throw new Error('مختصات UTM نامعتبر است');
  }

  const eccentricitySquared = 2 * WGS84_F - (WGS84_F ** 2);
  const eccentricityPrimeSquared = eccentricitySquared / (1 - eccentricitySquared);
  const e1 = (1 - Math.sqrt(1 - eccentricitySquared)) / (1 + Math.sqrt(1 - eccentricitySquared));

  const M = y / K0;
  const mu = M / (
    WGS84_A
    * (1 - (eccentricitySquared / 4) - (3 * eccentricitySquared ** 2 / 64) - (5 * eccentricitySquared ** 3 / 256))
  );

  const phi1Rad = mu
    + (3 * e1 / 2 - 27 * (e1 ** 3) / 32) * Math.sin(2 * mu)
    + (21 * (e1 ** 2) / 16 - 55 * (e1 ** 4) / 32) * Math.sin(4 * mu)
    + (151 * (e1 ** 3) / 96) * Math.sin(6 * mu)
    + (1097 * (e1 ** 4) / 512) * Math.sin(8 * mu);

  const N1 = WGS84_A / Math.sqrt(1 - eccentricitySquared * (Math.sin(phi1Rad) ** 2));
  const T1 = Math.tan(phi1Rad) ** 2;
  const C1 = eccentricityPrimeSquared * (Math.cos(phi1Rad) ** 2);
  const R1 = (WGS84_A * (1 - eccentricitySquared))
    / ((1 - eccentricitySquared * (Math.sin(phi1Rad) ** 2)) ** 1.5);
  const D = (x - 500000.0) / (N1 * K0);

  const lat = phi1Rad - (N1 * Math.tan(phi1Rad) / R1)
    * (
      (D ** 2) / 2
      - (5 + 3 * T1 + 10 * C1 - 4 * (C1 ** 2) - 9 * eccentricityPrimeSquared) * (D ** 4) / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * (T1 ** 2) - 252 * eccentricityPrimeSquared - 3 * (C1 ** 2)) * (D ** 6) / 720
    );

  const lon = degToRad(CENTRAL_MERIDIAN) + (
    D
    - (1 + 2 * T1 + C1) * (D ** 3) / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * (C1 ** 2) + 8 * eccentricityPrimeSquared + 24 * (T1 ** 2)) * (D ** 5) / 120
  ) / Math.cos(phi1Rad);

  return {
    lng: Number(radToDeg(lon).toFixed(6)),
    lat: Number(radToDeg(lat).toFixed(6))
  };
};

export default convertLngLatToUtm32640;
