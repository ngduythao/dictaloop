// Links between pages. The static GitHub Pages build lives under a base path
// (e.g. /dictaloop) and exports one `<page>.html` per route; the dev server serves from /.

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export type Page = '/' | '/practice' | '/import' | '/settings';

export function appHref(page: Page, query?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) params.set(key, String(value));
  const search = params.toString();
  return `${basePath}${page}${search ? `?${search}` : ''}`;
}

// Which page a browser path belongs to, ignoring the base path and trailing slash.
export function pageOf(pathname: string): Page {
  const path = (pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname).replace(/\/+$/, '') || '/';
  return (['/practice', '/import', '/settings'] as const).find(page => path === page) ?? '/';
}
