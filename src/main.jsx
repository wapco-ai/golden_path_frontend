// main.jsx  
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import IntlProviderWrapper from './IntlProviderWrapper.jsx';
import './index.css';
import { useGPSStore } from './store/gpsStore.js';
import { DEFAULT_TILE_FLOOR } from './config/vectorTiles.js';
import { initializeSessionFloor } from './utils/sessionFloor.js';

initializeSessionFloor(DEFAULT_TILE_FLOOR);

// Check URL parameters for QR code location (works with ? before or after #)
let search = window.location.search;
if (!search && window.location.hash.includes('?')) {
  search = window.location.hash.split('?')[1];
  if (search) search = '?' + search;
}
// Handle encoded ampersands from copied HTML links
if (search && search.includes('&amp;')) {
  search = search.replace(/&amp;/g, '&');
}

const params = new URLSearchParams(search);
const lat = params.get('lat');
const lng = params.get('lng');
const qrId = params.get('id');
if (lat && lng) {
  sessionStorage.setItem('qrLat', lat);
  sessionStorage.setItem('qrLng', lng);
  if (qrId) sessionStorage.setItem('qrId', qrId);

  // Also update the GPS store so components can use this location immediately
  const updateCurrentLocation = useGPSStore.getState().updateCurrentLocation;
  updateCurrentLocation({
    coords: { lat: parseFloat(lat), lng: parseFloat(lng), accuracy: 0 },
    timestamp: Date.now()
  });
}

import { registerSW } from 'virtual:pwa-register';

// Use the plugin's registration method instead of manual registration
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('New content is available; please refresh.');
    // You can show a UI prompt to refresh here
  },
  onOfflineReady() {
    console.log('Content is cached for offline use.');
    // You can show a "ready for offline use" message here
  }
}); 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IntlProviderWrapper>
      <App />
    </IntlProviderWrapper>
  </React.StrictMode>,
);
