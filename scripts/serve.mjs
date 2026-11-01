// Serves the built site (dist/client) the way GitHub Pages does: /practice -> practice.html.
// Usage: node scripts/serve.mjs   (PORT=4173 by default)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve('dist/client');
const port = Number(process.env.PORT) || 4173;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
  '.rsc': 'text/x-component',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error('No build found in dist/client. Run `pnpm build` first (or just `pnpm start`).');
  process.exit(1);
}

function resolveFile(pathname) {
  const path = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const target = join(root, path);
  if (!target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isDirectory()) return join(target, 'index.html');
  if (existsSync(target)) return target;
  if (existsSync(`${target}.html`)) return `${target}.html`;
  return null;
}

createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const file = resolveFile(pathname);
  const status = file && existsSync(file) ? 200 : 404;
  const served = status === 200 ? file : join(root, '404.html');
  response.writeHead(status, { 'Content-Type': types[extname(served)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(served).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Dictaloop is running at http://localhost:${port}/`);
});
