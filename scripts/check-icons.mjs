#!/usr/bin/env node
/** Verifies that every icon name referenced in templates is registered in core/icons.ts. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const kebab = (name) =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase();

const registry = readFileSync(join(root, 'src/app/core/icons.ts'), 'utf8');
const registered = new Set([...registry.matchAll(/^ {8}(\w+),$/gm)].map((m) => kebab(m[1])));

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) files.push(path);
  }
})(join(root, 'src/app'));

const patterns = [
  /lucideIcon="([a-z0-9-]+)"/g,
  /\bicon(?:\(|: )'([a-z0-9-]+)'/g,
  /\bicon="([a-z0-9-]+)"/g,
  /\[icon\]="'([a-z0-9-]+)'"/g,
];

const used = new Map();
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) used.set(match[1], file);
  }
  // Icon lookup tables, e.g. `const ACTIVITY_ICON = { call: 'phone' }`.
  for (const table of text.matchAll(/_ICONS?\b[^=]*=\s*\{([^}]*)\}/g)) {
    for (const value of table[1].matchAll(/: '([a-z0-9-]+)'/g)) used.set(value[1], file);
  }
}

const missing = [...used.keys()].filter((name) => !registered.has(name));
if (missing.length) {
  for (const name of missing) console.error(`error unregistered icon "${name}" (${used.get(name).replace(root, '')})`);
  process.exit(1);
}
console.log(`✓ icons check passed. ${registered.size} registered, ${used.size} referenced.`);
