// Shared by the theme store and the root layout, which is a server component and
// so cannot import the store's React hooks.

export const THEME_STORAGE_KEY = 'dictaloop-theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

// Runs in <head> before the first paint so a dark page never flashes white.
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('${DARK_QUERY}').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}`;
