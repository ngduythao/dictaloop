// vinext nests the exported assets under the base path (dist/client/<base>/_next);
// GitHub Pages serves dist/client itself as /<base>/, so move them up a level.
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const basePath = process.env.BASE_PATH ?? (repository && !repository.endsWith('.github.io') ? `/${repository}` : '');
const folder = basePath.replace(/^\/+|\/+$/g, '');
if (!folder) process.exit(0);

const outputDirectory = resolve('dist/client');
const nextDirectory = resolve(outputDirectory, '_next');
await rm(nextDirectory, { recursive: true, force: true });
await mkdir(nextDirectory, { recursive: true });
await cp(resolve(outputDirectory, folder, '_next'), nextDirectory, { recursive: true });
await rm(resolve(outputDirectory, folder), { recursive: true, force: true });
