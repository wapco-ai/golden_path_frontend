import { useCallback, useMemo, useRef, useState } from 'react';

export const useTempAreaDrawing = ({ mapRef, initialCalendarDate }) => {
  const tempAreaPreviousCursorRef = useRef(null);
  const tempAreaVertexMarkersRef = useRef([]);
  const tempAreaVertexOriginalGeometryRef = useRef(null);
  const tempAreaVertexWorkingGeometryRef = useRef(null);
  const tempAreaVertexEditIdRef = useRef(null);
  const tempAreaVertexDirtyRef = useRef(false);
  const tempAreaVertexSelectionRef = useRef(null);
  const tempAreaDraftGeometryRef = useRef(null);
  const vertexMarkersRef = useRef([]);
  const areaOriginalGeometryRef = useRef(null);

  const setMapCursorForTempAreaDrawing = useCallback(() => {
    const mapInstance = mapRef?.current;
    if (!mapInstance?.getCanvas) return;

    const canvas = mapInstance.getCanvas();
    if (!canvas) return;

    if (tempAreaPreviousCursorRef.current === null) {
      tempAreaPreviousCursorRef.current = canvas.style.cursor;
    }

    canvas.style.cursor = 'crosshair';
  }, [mapRef]);

  const resetMapCursor = useCallback(() => {
    const mapInstance = mapRef?.current;
    if (!mapInstance?.getCanvas) return;

    const canvas = mapInstance.getCanvas();
    if (!canvas) return;

    const previousCursor = tempAreaPreviousCursorRef.current;
    canvas.style.cursor = previousCursor ?? 'grab';
    tempAreaPreviousCursorRef.current = null;
  }, [mapRef]);

  const clearVertexMarkers = useCallback(() => {
    vertexMarkersRef.current.forEach((marker) => marker?.remove());
    vertexMarkersRef.current = [];
  }, []);

  const clearTempAreaVertexMarkers = useCallback(() => {
    tempAreaVertexMarkersRef.current.forEach((marker) => marker?.remove());
    tempAreaVertexMarkersRef.current = [];
  }, []);

  const [tempAreaFlowState, setTempAreaFlowState] = useState('idle');
  const [tempAreaFormMode, setTempAreaFormMode] = useState('edit');
  const [isTempAreaDrawingMode, setIsTempAreaDrawingMode] = useState(false);
  const [tempAreaVertices, setTempAreaVertices] = useState([]);
  const [isTempAreaMoveMode, setIsTempAreaMoveMode] = useState(false);
  const [tempAreaMoveGeometry, setTempAreaMoveGeometry] = useState(null);
  const [isTempAreaVertexEditMode, setIsTempAreaVertexEditMode] = useState(false);
  const [isTempAreaGeometryDirty, setIsTempAreaGeometryDirty] = useState(false);
  const [isSavingTempAreaGeometry, setIsSavingTempAreaGeometry] = useState(false);
  const [isTempAreaEditModalOpen, setIsTempAreaEditModalOpen] = useState(false);
  const [tempAreaName, setTempAreaName] = useState('');
  const [tempAreaDescription, setTempAreaDescription] = useState('');
  const [tempAreaValidFrom, setTempAreaValidFrom] = useState('');
  const [tempAreaValidTo, setTempAreaValidTo] = useState('');
  const [tempAreaStartTime, setTempAreaStartTime] = useState('');
  const [tempAreaEndTime, setTempAreaEndTime] = useState('');
  const [tempAreaSelectedStartDate, setTempAreaSelectedStartDate] = useState(null);
  const [tempAreaSelectedEndDate, setTempAreaSelectedEndDate] = useState(null);
  const [tempAreaCalendarDate, setTempAreaCalendarDate] = useState(initialCalendarDate || null);
  const [activeTempAreaDateField, setActiveTempAreaDateField] = useState(null);
  const [tempAreaPrayerEvents, setTempAreaPrayerEvents] = useState([]);
  const [tempAreaPrayerBefore, setTempAreaPrayerBefore] = useState('');
  const [tempAreaPrayerAfter, setTempAreaPrayerAfter] = useState('');
  const [tempAreaIsActive, setTempAreaIsActive] = useState(true);
  const [isLoadingTempAreaDetails, setIsLoadingTempAreaDetails] = useState(false);
  const [isSavingTempAreaDetails, setIsSavingTempAreaDetails] = useState(false);

  return useMemo(() => ({
    areaOriginalGeometryRef,
    tempAreaPreviousCursorRef,
    tempAreaVertexMarkersRef,
    tempAreaVertexOriginalGeometryRef,
    tempAreaVertexWorkingGeometryRef,
    tempAreaVertexEditIdRef,
    tempAreaVertexDirtyRef,
    tempAreaVertexSelectionRef,
    tempAreaDraftGeometryRef,
    vertexMarkersRef,
    setMapCursorForTempAreaDrawing,
    resetMapCursor,
    clearTempAreaVertexMarkers,
    clearVertexMarkers,
    tempAreaFlowState,
    setTempAreaFlowState,
    tempAreaFormMode,
    setTempAreaFormMode,
    isTempAreaDrawingMode,
    setIsTempAreaDrawingMode,
    tempAreaVertices,
    setTempAreaVertices,
    isTempAreaMoveMode,
    setIsTempAreaMoveMode,
    tempAreaMoveGeometry,
    setTempAreaMoveGeometry,
    isTempAreaVertexEditMode,
    setIsTempAreaVertexEditMode,
    isTempAreaGeometryDirty,
    setIsTempAreaGeometryDirty,
    isSavingTempAreaGeometry,
    setIsSavingTempAreaGeometry,
    isTempAreaEditModalOpen,
    setIsTempAreaEditModalOpen,
    tempAreaName,
    setTempAreaName,
    tempAreaDescription,
    setTempAreaDescription,
    tempAreaValidFrom,
    setTempAreaValidFrom,
    tempAreaValidTo,
    setTempAreaValidTo,
    tempAreaStartTime,
    setTempAreaStartTime,
    tempAreaEndTime,
    setTempAreaEndTime,
    tempAreaSelectedStartDate,
    setTempAreaSelectedStartDate,
    tempAreaSelectedEndDate,
    setTempAreaSelectedEndDate,
    tempAreaCalendarDate,
    setTempAreaCalendarDate,
    activeTempAreaDateField,
    setActiveTempAreaDateField,
    tempAreaPrayerEvents,
    setTempAreaPrayerEvents,
    tempAreaPrayerBefore,
    setTempAreaPrayerBefore,
    tempAreaPrayerAfter,
    setTempAreaPrayerAfter,
    tempAreaIsActive,
    setTempAreaIsActive,
    isLoadingTempAreaDetails,
    setIsLoadingTempAreaDetails,
    isSavingTempAreaDetails,
    setIsSavingTempAreaDetails,
  }), [
    resetMapCursor,
    setMapCursorForTempAreaDrawing,
    clearTempAreaVertexMarkers,
    clearVertexMarkers,
    tempAreaFlowState,
    tempAreaFormMode,
    isTempAreaDrawingMode,
    tempAreaVertices,
    isTempAreaMoveMode,
    tempAreaMoveGeometry,
    isTempAreaVertexEditMode,
    isTempAreaGeometryDirty,
    isSavingTempAreaGeometry,
    isTempAreaEditModalOpen,
    tempAreaName,
    tempAreaDescription,
    tempAreaValidFrom,
    tempAreaValidTo,
    tempAreaStartTime,
    tempAreaEndTime,
    tempAreaSelectedStartDate,
    tempAreaSelectedEndDate,
    tempAreaCalendarDate,
    activeTempAreaDateField,
    tempAreaPrayerEvents,
    tempAreaPrayerBefore,
    tempAreaPrayerAfter,
    tempAreaIsActive,
    isLoadingTempAreaDetails,
    isSavingTempAreaDetails,
  ]);
};
