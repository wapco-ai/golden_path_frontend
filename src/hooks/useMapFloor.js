import { useEffect, useState } from 'react';
import { getSessionFloor, subscribeToSessionFloor } from '../utils/sessionFloor.js';

export default function useMapFloor() {
  const [floor, setFloor] = useState(getSessionFloor);
  useEffect(() => subscribeToSessionFloor(setFloor), []);
  return floor;
}
