import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Profile from './pages/Profile';
import FinalSearch from './pages/FinalSearch';
import LangPage from './pages/LangPage';
import LoginPage from './pages/LoginPage';
import MapRouting from './pages/MapRouting';
import Routing from './pages/Routing';
import MapBegin from './pages/MapBegin';
import RouteOverview from './pages/RouteOverview';
import Location from './pages/Location';
import Plang from './pages/Plang';
import ProfileInfo from './pages/ProfileInfo';
import Proutes from './pages/Proutes';
import Pfp from './pages/Pfp';
import Pmap from './pages/Pmap';
import Support from './pages/Support';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { ToastContainer, toast } from 'react-toastify';
import adminRoutes from './routes/adminRoutes';

const useAppStyles = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.pathname.startsWith('/admin')) {
      import('./App.css');
    }
  }, [location.pathname]);
};


const AppContent = () => {
  const location = useLocation();
  const intl = useIntl();
  const hideHeaderFooter = location.pathname === '/login' || location.pathname === '/profile'|| location.pathname === '/lang'
    || location.pathname === '/location' || location.pathname === '/' || location.pathname === '/mpr'|| location.pathname === '/fs'
    || location.pathname === '/rop' || location.pathname === '/rng'|| location.pathname === '/mpb'
    || location.pathname === '/plang' || location.pathname === '/pinfo' || location.pathname === '/proutes'
    || location.pathname === '/Pfp' || location.pathname === '/Pmap' || location.pathname.startsWith('/admin') || location.pathname.startsWith('/Support');

  useAppStyles();

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    document.title = intl.formatMessage({ id: 'appTitle' });
  }, [intl.locale]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(() => {
        setDeferredPrompt(null);
        setShowInstall(false);
      });
    }
  };
  const handleClosePrompt = () => {
    setShowInstall(false);
  };

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className={`app ${isAdminRoute ? 'no-app-styles' : ''}`}>
      {!hideHeaderFooter && <Header />}
      <main className={`main-content ${hideHeaderFooter ? 'no-header-footer-layout' : ''}`}>
        {/* Stylish PWA Install Modal Prompt */}
        {showInstall && (
          <div className="pwa-install-overlay">
            <div className="pwa-install-dialog">
              <h3>
                <FormattedMessage id="pwaInstallTitle" />
              </h3>
              <p>
                <FormattedMessage id="pwaInstallPrompt" />
              </p>
              <button className="pwa-install-btn" onClick={handleInstallClick}>
                <FormattedMessage id="pwaInstallButton" />
              </button>
              <br />
              <button className="pwa-install-close" onClick={handleClosePrompt}>
                <FormattedMessage id="pwaCloseButton" />
              </button>
            </div>
          </div>
        )}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/fs" element={<FinalSearch />} />
          <Route path="/rop" element={<RouteOverview />} />
          <Route path="/" element={<LangPage />} />
          <Route path="/mpr" element={<MapRouting/>} />
          <Route path="/rng" element={<Routing/>} />
          <Route path="/location" element={<Location />} />
          <Route path="/mpb" element={<MapBegin />} />
          <Route path="/pinfo" element={<ProfileInfo />} />
          <Route path="/pmap" element={<Pmap />} />
          <Route path="/plang" element={<Plang />} />
          <Route path="/support" element={<Support />} />
          <Route path="/proutes" element={<Proutes />} />
          <Route path="/Pfp" element={<Pfp />} />
          {adminRoutes}
        </Routes>
      </main>
      {!hideHeaderFooter && <Footer />}
    </div>
  );
};

function App() {
  const [isRTL, setIsRTL] = useState(document.documentElement.dir === 'rtl');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsRTL(document.documentElement.dir === 'rtl');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir']
    });
    return () => observer.disconnect();
  }, []);

  return (
    <Router>
      <ToastContainer
        position={isRTL ? toast.POSITION.TOP_LEFT : toast.POSITION.TOP_RIGHT}
        rtl={isRTL}
        toastClassName="custom-toast"
      />
      <AppContent />
    </Router>
  );
}

export default App;