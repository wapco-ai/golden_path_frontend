import { validGeo } from '../../utils/locationQuality';
import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useLocaleDigits from '../../utils/useLocaleDigits';
import advancedDeadReckoningService from '../../services/AdvancedDeadReckoningService';
import '../../styles/DeadReckoning.css';

const DeadReckoningControls = ({ currentLocation }) => {
  const intl = useIntl();
  const formatDigits = useLocaleDigits();
  const [isActive, setIsActive] = useState(advancedDeadReckoningService.isActive);
  const [stepCount, setStepCount] = useState(0);

  useEffect(() => {
    const remove = advancedDeadReckoningService.addListener(data => {
      setIsActive(data.isActive);
      if (data.stepCount != null) setStepCount(data.stepCount);
    });
    return () => { remove(); advancedDeadReckoningService.stop(); };
  }, []);

  const toggle = () => {
    if (isActive) {
      advancedDeadReckoningService.stop();
    } else {
      const coords = currentLocation?.coords;
      if (!validGeo(coords)) return;
      advancedDeadReckoningService.start({ lat: coords.lat, lng: coords.lng });
    }
  };

  const reset = () => {
    const coords = currentLocation?.coords;
    advancedDeadReckoningService.reset(coords ? { lat: coords.lat, lng: coords.lng } : null);
  };

  return (
    <div className="dr-controls">
      <button
        className={`dr-toggle-button ${isActive ? 'active' : ''}`}
        onClick={toggle}
      >
        {isActive
          ? intl.formatMessage({ id: 'drStopTracking' })
          : intl.formatMessage({ id: 'drStartTracking' })}
      </button>
      <button className="dr-calibrate-button" disabled={!isActive} onClick={reset}>
        {intl.formatMessage({ id: 'drReset' })}
      </button>
      <div className="step-counter">
        {intl.formatMessage({ id: 'drStepCount' })} {formatDigits(stepCount)}
      </div>
    </div>
  );
};

export default DeadReckoningControls;
