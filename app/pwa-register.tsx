'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    // Only the built site: in dev the worker would cache unhashed modules and serve stale code.
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
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
