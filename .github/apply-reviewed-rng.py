import subprocess
from pathlib import Path

def check_blobs(expected):
    for path, sha in expected.items():
        actual = subprocess.check_output(["git", "hash-object", path], text=True).strip()
        if actual != sha:
            raise SystemExit(f"Unexpected content: {path}: {actual}, expected {sha}")

check_blobs({'src/pages/Routing.jsx': '5ccb5a1a66b8a4f233d5b4035a69114e15ff03a2', 'src/components/map/RouteMap.jsx': '23caa7d02418efa0dce70991a9930e6c652e70c1'})

from pathlib import Path
root=Path.cwd()
p=root/'src/pages/Routing.jsx'; s=p.read_text()
s=s.replace("import '../styles/Routing.css';", "import '../styles/Routing.css';\nimport '../styles/RngNavigation.css';")
s=s.replace("import { fetchLandmarkViewImage } from '../services/landmarkViewImageService';", "import useGuidanceImage from '../hooks/useGuidanceImage.js';\nimport { getLiveNavigationGeo, getNavigationProgress, nextDemoStep, resolveNavigationFrame } from '../utils/rngNavigation.js';\nimport { rngMessages } from '../utils/rngMessages.js';")
s=s.replace("import { getSessionFloor } from '../utils/sessionFloor';", "import { getSessionFloor, subscribeToSessionFloor } from '../utils/sessionFloor';")
s=s[:s.index('const haversineDistanceMeters')] + s[s.index('const RoutingPage ='):]
s=s.replace('  haversineMeters,\n','')
s=s.replace("  const [liveLandmarkImage, setLiveLandmarkImage] = useState(null);\n  const [isLiveImageLoading, setIsLiveImageLoading] = useState(false);\n  const [recentLandmarkImages, setRecentLandmarkImages] = useState([]);", "  const [isDemoMode, setIsDemoMode] = useState(false);\n  const [hasArrived, setHasArrived] = useState(false);\n  const [failedImageUrl, setFailedImageUrl] = useState(null);\n  const [sessionFloor, setCurrentFloor] = useState(getSessionFloor);\n  useEffect(() => subscribeToSessionFloor(setCurrentFloor), []);")
s=s.replace("  const language = useLangStore(state => state.language);", "  const language = useLangStore(state => state.language);\n  const rngText = rngMessages[language] || rngMessages.fa;\n  const previousRoute = useRef(routeGeo);\n  useEffect(() => {\n    if (previousRoute.current === routeGeo) return;\n    previousRoute.current = routeGeo;\n    setCurrentStep(0);\n    setIsDemoMode(false);\n    setHasArrived(false);\n    setIsRoutingActive(false);\n    advancedDeadReckoningService.stop();\n  }, [routeGeo]);")
s=s.replace("  const normalizeHeading = useCallback((value) => ((value % 360) + 360) % 360, []);\n",'')
a=s.index('  const resolveStepHeading ='); b=s.index('\n  useEffect(() => {\n    const coords = routeGeo?',a)
s=s[:a]+'''  // One navigation frame feeds the image and map in both open/closed panel states.
  // Demo/preview uses the selected segment; live navigation uses actual DR/GPS.
  const navigationFrame = useMemo(() => resolveNavigationFrame({
    step: routeData?.steps?.[currentStep],
    stepIndex: currentStep,
    routeCoordinates: routeGeo?.geometry?.coordinates || [],
    isRoutingActive, isDemoMode, hasArrived, isDrActive,
    drPosition, userLocation, userHeading, sessionFloor
  }), [routeData?.steps, currentStep, routeGeo, isRoutingActive, isDemoMode,
    hasArrived, isDrActive, drPosition, userLocation, userHeading, sessionFloor]);
  const effectiveHeading = navigationFrame.heading;
  const navigationLocation = useMemo(() => navigationFrame.geo
    ? [navigationFrame.geo.lat, navigationFrame.geo.lng] : userLocation,
  [navigationFrame.geo?.lat, navigationFrame.geo?.lng, userLocation]);
  const routeImageKey = useMemo(() => JSON.stringify(routeGeo?.geometry || null), [routeGeo]);
  const guidanceContextKey = JSON.stringify([
    routeImageKey, currentStep, navigationFrame.mode, navigationFrame.floor, language, effectiveHeading
  ]);
  const guidanceImage = useGuidanceImage({
    language, geo: navigationFrame.geo, heading: effectiveHeading,
    floor: navigationFrame.floor, fov: 45, maxDistance: 250
  }, guidanceContextKey);
  const liveLandmarkImage = guidanceImage.data;
  const isLiveImageLoading = guidanceImage.loading;
''' +s[b:]
a=s.index('  // Advance step by route progress'); b=s.index('\n  const toggleMapModal',a)
s=s[:a]+'''  // fromM is the real segment boundary, including unequal two-step routes.
  useEffect(() => {
    if (!isRoutingActive || isDemoMode) return;
    const geo = getLiveNavigationGeo({ isDrActive, drPosition, userLocation });
    const progress = getNavigationProgress(
      geo, routeData?.steps, currentStep, routeGeo?.geometry?.coordinates || []
    );
    if (progress.nextStep !== currentStep) setCurrentStep(progress.nextStep);
    if (progress.arrived) {
      setHasArrived(true);
      setIsRoutingActive(false);
      setIs3DView(false);
      advancedDeadReckoningService.stop();
    }
  }, [routeData?.steps, routeGeo, isRoutingActive, isDemoMode, currentStep,
    isDrActive, drPosition, userLocation]);
''' + s[b:]
a=s.index('  const toggleRouting ='); b=s.index('\n  const handleEmergencySelect',a)
s=s[:a]+'''  const toggleRouting = () => {
    if (isRoutingActive) {
      setIsRoutingActive(false);
      advancedDeadReckoningService.stop();
      setIs3DView(false);
      return;
    }
    if (!routeData?.steps?.length || !routeGeo) return;
    // A real start must not resume a simulated step with a real origin position.
    setIsDemoMode(false);
    setHasArrived(false);
    setCurrentStep(0);
    const routeStart = getNavigationStartLocation();
    const [lat, lng] = routeStart || userLocation;
    setUserLocation([lat, lng]);
    setDrPosition({ lat, lng });
    setIsRoutingActive(true);
    advancedDeadReckoningService.start({ lat, lng }).catch((error) => {
      console.warn('Unable to start navigation sensors', error);
      advancedDeadReckoningService.stop();
      setIsRoutingActive(false);
      setIs3DView(false);
    });
    if (!showAllRoutesView && !showAlternativeRoutes) setIs3DView(true);
  };

  const handleDirectionIconClick = (event) => {
    event.stopPropagation();
    const count = routeData?.steps?.length || 0;
    if (!count || !routeGeo) return;
    advancedDeadReckoningService.stop();
    setIsRoutingActive(false);
    setHasArrived(false);
    setIsDemoMode(true);
    setCurrentStep((previous) => nextDemoStep(previous, count));
  };

  const exitDemo = () => {
    setIsDemoMode(false);
    setHasArrived(false);
    setCurrentStep(0);
  };
''' + s[b:]
# Retain segment metadata for legacy display steps too.
s=s.replace('        coordinates: stepCoords,\n        landmark: landmarkName,', '        coordinates: stepCoords,\n        fromM: s.fromM,\n        toM: s.toM,\n        routeM: s.routeM,\n        floor: s.floor,\n        landmark: landmarkName,',1)
s=s.replace('    setCurrentStep(0);\n    setIsRoutingActive(false);\n    setShowAlternativeRoutes(false);', '    setCurrentStep(0);\n    setIsDemoMode(false);\n    setHasArrived(false);\n    advancedDeadReckoningService.stop();\n    setIsRoutingActive(false);\n    setShowAlternativeRoutes(false);')
s=s.replace('<div className="routing-page">','<div className="routing-page" data-navigation-mode={navigationFrame.mode} data-current-step={currentStep}>')
s=s.replace('{liveLandmarkImage?.image?.url ? (', '{liveLandmarkImage?.image?.url && failedImageUrl !== liveLandmarkImage.image.url ? (')
s=s.replace("alt={liveLandmarkImage?.content?.title || 'landmark'}", "alt={liveLandmarkImage?.content?.title || rngText.imageAlt}\n                onError={() => setFailedImageUrl(liveLandmarkImage.image.url)}")
s=s.replace("{isLiveImageLoading ? <FormattedMessage id=\"liveLandmarkLoading\" /> : <FormattedMessage id=\"liveLandmarkWaiting\" />}", "{guidanceImage.error ? rngText.error\n                : liveLandmarkImage?.image?.url && failedImageUrl === liveLandmarkImage.image.url ? rngText.imageError\n                : isLiveImageLoading ? <FormattedMessage id=\"liveLandmarkLoading\" /> : rngText.waiting}")
a=s.index('        {/* {recentLandmarkImages.length'); b=s.index('        <div className="map-fade-rng">',a)
s=s[:a]+s[b:]
s=s.replace('            userLocation={userLocation}\n            userHeading={effectiveHeading}', '            userLocation={navigationLocation}\n            userHeading={effectiveHeading}\n            navigationControlled={true}\n            progressRouteM={navigationFrame.routeM}\n            showDrTrace={isRoutingActive && !isDemoMode}')
s=s.replace('''                <div className="current-guide">
''', '''                <div className="current-guide">
                  {isDemoMode && (
                    <div className="rng-demo-status" role="status">
                      <span>{rngText.demo} — {formatDigits(currentStep + 1)}/{formatDigits(routeData.steps.length)}</span>
                      <button type="button" onClick={exitDemo}>{rngText.exit}</button>
                    </div>
                  )}
''')
s=s.replace('''                        <span className="direction-icon-rng">
                          {renderDirectionArrow(routeData.steps[currentStep].direction)}
                        </span>''', '''                        <button
                          type="button"
                          className="direction-icon-rng"
                          onClick={handleDirectionIconClick}
                          onPointerDown={(event) => event.stopPropagation()}
                          aria-label={rngText.next}
                          title={rngText.next}
                          disabled={!routeGeo || !routeData.steps.length}
                        >
                          {renderDirectionArrow(routeData.steps[currentStep].direction)}
                        </button>''')
p.write_text(s)

p=root/'src/components/map/RouteMap.jsx'; s=p.read_text()
s=s.replace('  showAlternativeRoutes = false\n', '  showAlternativeRoutes = false,\n  navigationControlled = false,\n  progressRouteM = null,\n  showDrTrace = true\n')
s=s.replace('  const [heading, setHeading]', '  const useDrPosition = isDrActive && !navigationControlled;\n  const [heading, setHeading]')
s=s.replace('if (data.heading !== undefined && data.heading !== null)', 'if (!navigationControlled && data.heading !== undefined && data.heading !== null)')
s=s.replace('    return remove;\n  }, []);','    return remove;\n  }, [navigationControlled]);')
s=s.replace('if (!isDrActive && Number.isFinite(userHeading))', 'if (!useDrPosition && Number.isFinite(userHeading))')
s=s.replace('  }, [isDrActive, userHeading]);','  }, [useDrPosition, userHeading]);')
s=s.replace('''    if (hasRouteM) {
      traveledCoords = sliceLineByFraction(coords, 0, activeSegment.fromM);
      remainingCoords = sliceLineByFraction(coords, activeSegment.fromM, 1);''', '''    if (Number.isFinite(progressRouteM) || hasRouteM) {
      const split = Number.isFinite(progressRouteM) ? progressRouteM : activeSegment.fromM;
      traveledCoords = sliceLineByFraction(coords, 0, split);
      remainingCoords = sliceLineByFraction(coords, split, 1);''')
s=s.replace('  }, [routeGeo, routeSteps, currentStep]);','  }, [routeGeo, routeSteps, currentStep, progressRouteM]);')
s=s.replace('if (isDrActive && drPosition)', 'if (useDrPosition && drPosition)')
s=s.replace('else if (!isDrActive && isValidUserLocation)', 'else if (!useDrPosition && isValidUserLocation)')
s=s.replace('  }, [drPosition, userLocation, isDrActive, isValidUserLocation]);', '  }, [drPosition, userLocation, useDrPosition, isValidUserLocation]);')
s=s.replace('{!isDrActive && isValidUserLocation && (','{!useDrPosition && isValidUserLocation && (')
s=s.replace('{isDrActive && drPosition && Number.isFinite(drPosition.lng)', '{useDrPosition && drPosition && Number.isFinite(drPosition.lng)')
s=s.replace('{isDrActive && drGeoPath.length > 1 && (', '{showDrTrace && isDrActive && drGeoPath.length > 1 && (')
p.write_text(s)


check_blobs({'src/pages/Routing.jsx': '0120a65a051cb08db8929c77f07c2cf5ead21cf2', 'src/components/map/RouteMap.jsx': 'd0a4b93a77c7b2251e76661cac0f40c8738c736f'})
