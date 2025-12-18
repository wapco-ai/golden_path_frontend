import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

export const useEditableLayers = ({
  editableLayerOptions,
  canUserEditLayer,
  editableLayerActionMenuMap,
  setOpenSubMenu,
  refreshLayerTiles,
  isVanDrawingMode,
  setIsVanDrawingMode,
  setVanLineCoordinates,
  setIsTempAreaDrawingMode,
  setTempAreaFlowState,
  setTempAreaVertices,
  tempAreaFlowStates,
  clearTempAreaVertexMarkers,
  resetMapCursor,
  tempAreaDraftGeometryRef,
  setIsTempAreaVertexEditMode,
  setIsTempAreaGeometryDirty,
  tempAreaVertexOriginalGeometryRef,
  tempAreaVertexWorkingGeometryRef,
  tempAreaVertexEditIdRef,
  tempAreaVertexSelectionRef,
}) => {
  const [activeEditableLayerId, setActiveEditableLayerId] = useState('');
  const hasUserClearedEditableLayer = useRef(false);
  const [selectedEditableFeature, setSelectedEditableFeature] = useState(null);

  const activeEditableLayer = useMemo(() => {
    const selectedLayer = editableLayerOptions.find((layer) => layer.id === activeEditableLayerId);

    if (!canUserEditLayer(selectedLayer)) {
      return null;
    }

    return selectedLayer;
  }, [activeEditableLayerId, editableLayerOptions, canUserEditLayer]);

  const isVanNodesLayerActive = activeEditableLayer?.id === 'van-nodes';
  const isVanDrawingLayerActive = isVanNodesLayerActive;
  const isTempAreaLayerActive = activeEditableLayer?.id === 'temp-areas-outline';

  const refreshActiveEditableLayerTiles = useCallback((layerIdOverride) => {
    const targetLayerId = layerIdOverride || activeEditableLayer?.id;
    if (!targetLayerId) return;

    const layerIdsToRefresh = new Set([targetLayerId]);

    if (targetLayerId === 'van-nodes') {
      layerIdsToRefresh.add('van-edges');
    }

    layerIdsToRefresh.forEach((layerId) => refreshLayerTiles(layerId));
  }, [activeEditableLayer?.id, refreshLayerTiles]);

  useEffect(() => {
    const mappedSubMenu = editableLayerActionMenuMap[activeEditableLayer?.id];
    if (typeof mappedSubMenu === 'number') {
      setOpenSubMenu(mappedSubMenu);
      return;
    }

    setOpenSubMenu((current) => {
      const mappedValues = Object.values(editableLayerActionMenuMap);
      if (mappedValues.includes(current)) {
        return null;
      }

      return current;
    });
  }, [activeEditableLayer?.id, editableLayerActionMenuMap, setOpenSubMenu]);

  useEffect(() => {
    if (!isVanDrawingLayerActive && isVanDrawingMode) {
      setIsVanDrawingMode(false);
      setVanLineCoordinates([]);
    }
  }, [isVanDrawingMode, isVanDrawingLayerActive, setIsVanDrawingMode, setVanLineCoordinates]);

  useEffect(() => {
    if (!isTempAreaLayerActive) {
      setIsTempAreaDrawingMode(false);
      setTempAreaFlowState(tempAreaFlowStates.idle);
      setTempAreaVertices([]);
      if (tempAreaDraftGeometryRef) {
        tempAreaDraftGeometryRef.current = null;
      }
      setIsTempAreaVertexEditMode?.(false);
      setIsTempAreaGeometryDirty?.(false);
      if (tempAreaVertexOriginalGeometryRef) {
        tempAreaVertexOriginalGeometryRef.current = null;
      }
      if (tempAreaVertexWorkingGeometryRef) {
        tempAreaVertexWorkingGeometryRef.current = null;
      }
      if (tempAreaVertexEditIdRef) {
        tempAreaVertexEditIdRef.current = null;
      }
      if (tempAreaVertexSelectionRef) {
        tempAreaVertexSelectionRef.current = null;
      }
      clearTempAreaVertexMarkers();
    }
    resetMapCursor();
  }, [
    isTempAreaLayerActive,
    resetMapCursor,
    setIsTempAreaDrawingMode,
    setTempAreaFlowState,
    setTempAreaVertices,
    tempAreaFlowStates?.idle,
    clearTempAreaVertexMarkers,
  ]);

  return useMemo(() => ({
    activeEditableLayerId,
    setActiveEditableLayerId,
    hasUserClearedEditableLayer,
    selectedEditableFeature,
    setSelectedEditableFeature,
    activeEditableLayer,
    isVanNodesLayerActive,
    isTempAreaLayerActive,
    refreshActiveEditableLayerTiles,
  }), [
    activeEditableLayerId,
    selectedEditableFeature,
    activeEditableLayer,
    isVanNodesLayerActive,
    isTempAreaLayerActive,
    refreshActiveEditableLayerTiles,
  ]);
};
