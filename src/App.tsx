/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import BioPage from './components/BioPage';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [view, setView] = useState<'landing' | 'dashboard' | 'bio' | 'admin'>('landing');
  const [username, setUsername] = useState('');

  useEffect(() => {
    const handleRoute = () => {
      const path = window.location.pathname;
      const hostname = window.location.hostname.toLowerCase();
      
      // Support subdomains for bio.cryteam.ru or cryteam.ru
      // e.g. <username>.bio.cryteam.ru or <username>.cryteam.ru
      let subUsername = '';
      const hostParts = hostname.split('.');
      if (hostParts.length === 4 && hostParts[1] === 'bio' && hostParts[2] === 'cryteam' && hostParts[3] === 'ru') {
        subUsername = hostParts[0];
      } else if (hostParts.length === 3 && hostParts[1] === 'cryteam' && hostParts[2] === 'ru' && hostParts[0] !== 'bio' && hostParts[0] !== 'www') {
        subUsername = hostParts[0];
      }

      // If we are on a custom bio subdomain, default to loading that user's bio (unless they explicitly visit /dashboard or /admin)
      if (subUsername && !path.startsWith('/dashboard') && !path.startsWith('/admin') && !path.startsWith('/u/')) {
        setUsername(subUsername.toLowerCase());
        setView('bio');
        return;
      }

      if (path.startsWith('/u/')) {
        const parts = path.split('/');
        if (parts[2]) {
          setUsername(parts[2].toLowerCase());
          setView('bio');
        }
      } else if (path === '/dashboard') {
        setView('dashboard');
      } else if (path === '/admin') {
        setView('admin');
      } else {
        // Support hash route fallback as well
        const hash = window.location.hash;
        if (hash.startsWith('#/u/')) {
          const parts = hash.split('/');
          if (parts[2]) {
            setUsername(parts[2].toLowerCase());
            setView('bio');
          }
        } else if (hash === '#dashboard') {
          setView('dashboard');
        } else if (hash === '#admin') {
          setView('admin');
        } else {
          setView('landing');
        }
      }
    };

    handleRoute();
    window.addEventListener('popstate', handleRoute);
    window.addEventListener('hashchange', handleRoute);

    return () => {
      window.removeEventListener('popstate', handleRoute);
      window.removeEventListener('hashchange', handleRoute);
    };
  }, []);

  const navigateToDashboard = () => {
    window.history.pushState({}, '', '/dashboard');
    setView('dashboard');
  };

  const navigateToLanding = () => {
    window.history.pushState({}, '', '/');
    setView('landing');
  };

  const navigateToBio = (uname: string) => {
    window.history.pushState({}, '', `/u/${uname}`);
    setUsername(uname.toLowerCase());
    setView('bio');
  };

  if (view === 'admin') {
    return (
      <AdminPanel
        onExit={navigateToLanding}
      />
    );
  }

  if (view === 'dashboard') {
    return (
      <Dashboard
        onExit={navigateToLanding}
        onViewProfile={navigateToBio}
      />
    );
  }

  if (view === 'bio') {
    return (
      <BioPage
        username={username}
        onExit={navigateToLanding}
      />
    );
  }

  return (
    <LandingPage
      onNavigateToDashboard={navigateToDashboard}
      onViewProfile={navigateToBio}
    />
  );
}
