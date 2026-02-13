import React from 'react';
import ArrowMarker from '../map/ArrowMarker';

const UserMarker = ({ fusedPosition }) => {
  if (!fusedPosition?.snapped) return null;

  return (
    <>
      <ArrowMarker />
      <span style={{ display: 'none' }}>
        {`accuracy:${Math.round(fusedPosition.accuracy_m || 0)}m source:${fusedPosition.source}`}
      </span>
    </>
  );
};

export default UserMarker;
