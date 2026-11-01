// Shared by the theme store and the root layout, which is a server component and
// so cannot import the store's React hooks.

export const THEME_STORAGE_KEY = 'dictaloop-theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';
// Browser chrome colour per theme; matches --background in app/globals.css.
export const THEME_COLORS = { light: '#ffffff', dark: '#1b1b1b' };

// Runs in <head> before the first paint so a dark page never flashes white.
export const THEME_SCRIPT = `var t;try{t=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}var d=t==='dark'||(t!=='light'&&matchMedia('${DARK_QUERY}').matches);document.documentElement.dataset.theme=d?'dark':'light'`;
