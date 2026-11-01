// Links between pages. The static build exports one `<page>.html` per route, and
// the host serves /practice from practice.html (Vercel's cleanUrls, scripts/serve.mjs).

export type Page = '/' | '/practice' | '/import' | '/settings';

export function appHref(page: Page, query?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) params.set(key, String(value));
  const search = params.toString();
  return `${page}${search ? `?${search}` : ''}`;
}

// Which page a browser path belongs to, ignoring a trailing slash.
export function pageOf(pathname: string): Page {
  const path = pathname.replace(/\/+$/, '') || '/';
  return (['/practice', '/import', '/settings'] as const).find(page => path === page) ?? '/';
}
