/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import BioPage from './components/BioPage';
import AdminPanel from './components/AdminPanel';
import {
  getPlatformDomainConfig,
  parseShortPathSlug,
  parseSubdomainSlug,
  type PlatformDomainConfig,
} from './platformDomain';
import { setClientMediaCdnUrl } from './utils/cdn';

const DEFAULT_PLATFORM: PlatformDomainConfig = getPlatformDomainConfig({
  requestHost: typeof window !== 'undefined' ? window.location.host : undefined,
});

export default function App() {
  const [view, setView] = useState<'landing' | 'dashboard' | 'bio' | 'admin'>('landing');
  const [username, setUsername] = useState('');
  type PublicConfig = PlatformDomainConfig & { hideAdminPanelLink?: boolean; mediaCdnUrl?: string | null };

  const [platform, setPlatform] = useState<PublicConfig>(DEFAULT_PLATFORM);

  useEffect(() => {
    fetch('/api/public-config')
      .then(res => (res.ok ? res.json() : null))
      .then((data: PublicConfig | null) => {
        if (data) {
          setClientMediaCdnUrl(data.mediaCdnUrl);
          setPlatform(prev => ({
            ...prev,
            ...data,
            appUrl: data.appUrl || prev.appUrl,
            baseDomain: data.baseDomain || prev.baseDomain,
          }));
        }
      })
      .catch(() => {
        /* use client-derived defaults */
      });
  }, []);

  useEffect(() => {
    const handleRoute = () => {
      const path = window.location.pathname;
      const hostname = window.location.hostname.toLowerCase();

      const runtimePlatform = getPlatformDomainConfig({
        appUrl: platform.appUrl,
        bioBaseDomain: platform.baseDomain,
        requestHost: window.location.host,
      });
      const baseDomain = runtimePlatform.baseDomain;

      const subSlug = baseDomain ? parseSubdomainSlug(hostname, baseDomain) : null;

      if (subSlug && !path.startsWith('/dashboard') && !path.startsWith('/admin') && !path.startsWith('/u/')) {
        window.location.replace(`${runtimePlatform.appUrl}/${subSlug}`);
        return;
      }

      if (path.startsWith('/u/')) {
        const parts = path.split('/');
        if (parts[2]) {
          setUsername(parts[2].toLowerCase());
          setView('bio');
        }
        return;
      }

      if (path === '/dashboard') {
        setView('dashboard');
        return;
      }

      if (path === '/admin') {
        setView('admin');
        return;
      }

      const shortSlug =
        !subSlug && baseDomain && (hostname === baseDomain || hostname === `www.${baseDomain}`)
          ? parseShortPathSlug(path)
          : null;
      if (shortSlug) {
        setUsername(shortSlug);
        setView('bio');
        return;
      }

      const hash = window.location.hash;
      if (hash.startsWith('#/u/')) {
        const parts = hash.split('/');
        if (parts[2]) {
          setUsername(parts[2].toLowerCase());
          setView('bio');
        }
        return;
      }

      if (hash === '#dashboard') {
        setView('dashboard');
        return;
      }

      if (hash === '#admin') {
        setView('admin');
        return;
      }

      setView('landing');
    };

    handleRoute();
    window.addEventListener('popstate', handleRoute);
    window.addEventListener('hashchange', handleRoute);

    return () => {
      window.removeEventListener('popstate', handleRoute);
      window.removeEventListener('hashchange', handleRoute);
    };
  }, [platform.appUrl, platform.baseDomain]);

  const navigateToDashboard = () => {
    window.history.pushState({}, '', '/dashboard');
    setView('dashboard');
  };

  const navigateToLanding = () => {
    window.history.pushState({}, '', '/');
    setView('landing');
  };

  const navigateToBio = (slug: string) => {
    const normalized = slug.toLowerCase();
    window.history.pushState({}, '', `/${normalized}`);
    setUsername(normalized);
    setView('bio');
  };

  if (view === 'admin') {
    return <AdminPanel onExit={navigateToLanding} />;
  }

  if (view === 'dashboard') {
    return (
      <Dashboard
        onExit={navigateToLanding}
        onViewProfile={navigateToBio}
        platformConfig={platform}
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
      platformConfig={platform}
    />
  );
}
