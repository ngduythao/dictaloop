'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Only the built site: in dev a worker caches unhashed modules and serves stale
    // code, so also remove one left from earlier runs on the same port.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(registration => void registration.unregister()));
      return;
    }
    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' });
    };
    // The page has usually finished loading by the time this effect runs.
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
