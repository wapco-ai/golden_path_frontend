import React from 'react';

const ArrowMarker = () => (
  <div style={{ position: 'relative', width: '80px', height: '80px' }}>
    <svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="soft-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.3" />
        </filter>
      </defs>
      <g filter="url(#soft-shadow)">
        <path d="M 50 10 L 90 60 A 10 10 0 0 1 80 70 L 20 70 A 10 10 0 0 1 10 60 Z" fill="#6B7280" />
        <path d="M 50 5 L 90 55 A 10 10 0 0 1 80 65 L 20 65 A 10 10 0 0 1 10 55 Z" fill="#4A90E2" />
      </g>
    </svg>
    <div style={{
      position: 'absolute',
      top: '45%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    }}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="28" 
        height="28" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="white" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        <path d="M7 21l3 -4" />
        <path d="M16 21l-2 -4l-3 -3l1 -6" />
        <path d="M6 12l2 -3l4 -1l3 3l3 1" />
      </svg>
    </div>
  </div>
);

export default ArrowMarker;