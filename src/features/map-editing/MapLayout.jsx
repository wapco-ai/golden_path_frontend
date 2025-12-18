import React, { createContext, useContext, useMemo } from 'react';
import { useMapInstance } from './hooks/useMapInstance';
import { useEditableLayers } from './hooks/useEditableLayers';
import { useTempAreaDrawing } from './hooks/useTempAreaDrawing';
import { useVanRouting } from './hooks/useVanRouting';

const MapEditingContext = createContext(null);

export const useMapEditingContext = () => useContext(MapEditingContext);

export const MapLayout = ({
  children,
  mapProps,
  editableLayerProps,
  tempAreaProps,
  vanRoutingProps,
  value,
}) => {
  const mapState = value?.map || useMapInstance(mapProps);
  const tempAreaState = value?.tempArea || useTempAreaDrawing({ ...tempAreaProps, mapRef: mapState.mapRef });
  const vanRoutingState = value?.vanRouting || useVanRouting(vanRoutingProps);
  const editableLayersState = value?.editableLayers || useEditableLayers({
    ...editableLayerProps,
    refreshLayerTiles: mapState.refreshLayerTiles,
    isVanDrawingMode: vanRoutingState.isVanDrawingMode,
    setIsVanDrawingMode: vanRoutingState.setIsVanDrawingMode,
    setVanLineCoordinates: vanRoutingState.setVanLineCoordinates,
    setIsTempAreaDrawingMode: tempAreaState.setIsTempAreaDrawingMode,
    setTempAreaFlowState: tempAreaState.setTempAreaFlowState,
    setTempAreaVertices: tempAreaState.setTempAreaVertices,
    tempAreaFlowStates: tempAreaProps?.tempAreaFlowStates,
    clearTempAreaVertexMarkers: tempAreaState.clearTempAreaVertexMarkers,
    resetMapCursor: tempAreaState.resetMapCursor,
  });

  const contextValue = useMemo(() => ({
    map: mapState,
    tempArea: tempAreaState,
    vanRouting: vanRoutingState,
    editableLayers: editableLayersState,
  }), [editableLayersState, mapState, tempAreaState, vanRoutingState]);

  return (
    <MapEditingContext.Provider value={contextValue}>
      {typeof children === 'function' ? children(contextValue) : children}
    </MapEditingContext.Provider>
  );
};
