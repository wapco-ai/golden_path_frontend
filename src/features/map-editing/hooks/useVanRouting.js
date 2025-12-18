import { useMemo, useState } from 'react';

export const useVanRouting = () => {
  const [isVanDrawingMode, setIsVanDrawingMode] = useState(false);
  const [vanLineCoordinates, setVanLineCoordinates] = useState([]);
  const [isSavingVanRoute, setIsSavingVanRoute] = useState(false);
  const [isDeletingVanNode, setIsDeletingVanNode] = useState(false);

  return useMemo(() => ({
    isVanDrawingMode,
    setIsVanDrawingMode,
    vanLineCoordinates,
    setVanLineCoordinates,
    isSavingVanRoute,
    setIsSavingVanRoute,
    isDeletingVanNode,
    setIsDeletingVanNode,
  }), [
    isVanDrawingMode,
    vanLineCoordinates,
    isSavingVanRoute,
    isDeletingVanNode,
  ]);
};
