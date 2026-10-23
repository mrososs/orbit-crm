#!/usr/bin/env node
/**
 * Minimal static server for the production build with SPA fallback — mirrors the
 * Vercel rewrite so E2E tests and media capture run against real production output.
 * Usage: node scripts/serve-dist.mjs [port]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/orbit-crm/browser/', import.meta.url));
const port = Number(process.argv[2] ?? process.env.PORT ?? 4310);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error('dist/orbit-crm/browser/index.html not found — run `npm run build` first.');
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, safe);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, 'index.html');
  }
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  const immutable = /\.(js|css|woff2?)$/.test(file) && !file.endsWith('index.html');
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Orbit CRM (production build) → http://localhost:${port}`));
