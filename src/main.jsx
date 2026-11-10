// main.jsx  
import React from 'react';
import ReactDOM from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import App from './App.jsx';
import IntlProviderWrapper from './IntlProviderWrapper.jsx';
import './index.css';
import { DEFAULT_TILE_FLOOR } from './config/vectorTiles.js';
import { initializeSessionFloor } from './utils/sessionFloor.js';
import { captureQrLocation, resolveQrPoint } from './services/qrLocationService.js';
import { registerLegacyMapStyles } from './services/legacyMapStyles.js';
// main.jsx
// import maplibregl from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';

// const rtlUrl = "/rtl/mapbox-gl-rtl-text.js";

// // فقط یکبار در کل اپ
// if (!window.__RTL_PLUGIN_SET__) {
//   window.__RTL_PLUGIN_SET__ = true;
//   maplibregl.setRTLTextPlugin(rtlUrl, true);
// }

function ensureRtlOnce() {
  if (window.__RTL_PLUGIN_SET__) return;
  window.__RTL_PLUGIN_SET__ = true;
  maplibregl.setRTLTextPlugin("/rtl/mapbox-gl-rtl-text.js", undefined, true);
}


registerLegacyMapStyles(maplibregl);
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
captureQrLocation(params);
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.PROD) {
  // Use the plugin's registration method instead of manual registration
  registerSW({
    onNeedRefresh() {
      console.log('New content is available; please refresh.');
      // You can show a UI prompt to refresh here
    },
    onOfflineReady() {
      console.log('Content is cached for offline use.');
      // You can show a "ready for offline use" message here
    }
  });
} else if ('serviceWorker' in navigator) {
  // Ensure stale production service workers do not interfere with the dev server
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

// Resolve registered QR coordinates before any page can route from the URL.
async function mountApp() {
  await resolveQrPoint();
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IntlProviderWrapper>
      <App />
    </IntlProviderWrapper>
  </React.StrictMode>,
);

}
mountApp();
