#!/usr/bin/env node
/**
 * Translation quality gate:
 *  1. Key parity — en, ar and fr expose the same keys.
 *  2. Plural entries — every plural object has `other` (en/fr also `one`).
 *  3. Placeholder parity — {{params}} match the English source.
 *  4. Usage — every literal key referenced in src/ exists; unused keys are reported.
 * Exits with code 1 on errors (warnings never fail the run).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const LANGS = ['en', 'ar', 'fr'];
const PLURAL = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
/** Keys built dynamically in code (`'enums.stage.' + stage`) — their children count as used. */
const DYNAMIC_PREFIXES = [
  'enums.',
  'ranges.',
  'events.',
  'theme.',
  'pipeline.sort.',
  'activities.groups.',
  'activities.status.',
  'activities.dateFilter.',
  'search.groups.',
  'settings.counts.',
  'contacts.tabs.',
  'validation.',
  'charts.bands.',
];

const dicts = Object.fromEntries(
  LANGS.map((lang) => [lang, JSON.parse(readFileSync(join(root, 'public/i18n', `${lang}.json`), 'utf8'))]),
);

const isPluralObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0 &&
  Object.keys(value).every((k) => PLURAL.has(k));

function flatten(obj, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPluralObject(value) || typeof value === 'string') out.set(path, value);
    else if (value && typeof value === 'object') flatten(value, path, out);
    else out.set(path, value);
  }
  return out;
}

const placeholders = (value) => {
  const text = typeof value === 'string' ? value : Object.values(value ?? {}).join(' ');
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))].sort().join(',');
};

const errors = [];
const warnings = [];
const flat = Object.fromEntries(LANGS.map((l) => [l, flatten(dicts[l])]));
const source = flat.en;

for (const lang of LANGS) {
  const keys = flat[lang];
  for (const key of source.keys()) if (!keys.has(key)) errors.push(`[${lang}] missing key: ${key}`);
  for (const key of keys.keys()) if (!source.has(key)) errors.push(`[${lang}] extra key not in en: ${key}`);

  for (const [key, value] of keys) {
    if (typeof value !== 'string' && !isPluralObject(value)) {
      errors.push(`[${lang}] invalid value at ${key}`);
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') errors.push(`[${lang}] empty string at ${key}`);
    if (isPluralObject(value)) {
      if (!('other' in value)) errors.push(`[${lang}] plural without "other": ${key}`);
      if (lang !== 'ar' && !('one' in value)) errors.push(`[${lang}] plural without "one": ${key}`);
    }
    if (source.has(key) && typeof source.get(key) !== typeof value && !(isPluralObject(value) && isPluralObject(source.get(key)))) {
      errors.push(`[${lang}] type mismatch at ${key}`);
    }
    if (source.has(key) && placeholders(value) !== placeholders(source.get(key))) {
      errors.push(`[${lang}] placeholder mismatch at ${key}: {${placeholders(value)}} vs en {${placeholders(source.get(key))}}`);
    }
    if (lang !== 'en' && typeof value === 'string' && value === source.get(key) && /[a-z]{4,}/i.test(value) && !/^[\p{Lu}][\w .&+-]*$/u.test(value)) {
      warnings.push(`[${lang}] identical to English (untranslated?): ${key} = "${value}"`);
    }
  }
}

// ── Usage scan ───────────────────────────────────────────────────────────
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) files.push(path);
  }
})(join(root, 'src/app'));

const namespaces = Object.keys(dicts.en);
const literal = new RegExp(`['"\`]((?:${namespaces.join('|')})\\.[\\w.-]*[\\w-])['"\`]`, 'g');
const used = new Set();
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(literal)) {
    const key = match[1];
    used.add(key);
    const known = source.has(key) || [...source.keys()].some((k) => k.startsWith(`${key}.`));
    if (!known) errors.push(`[src] unknown key "${key}" in ${relative(root, file)}`);
  }
}
for (const key of source.keys()) {
  const dynamic = DYNAMIC_PREFIXES.some((p) => key.startsWith(p));
  if (!dynamic && !used.has(key)) warnings.push(`[en] possibly unused key: ${key}`);
}

const summary = `${source.size} keys × ${LANGS.length} languages, ${files.length} source files scanned`;
for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(errors.length ? `\n✗ i18n check failed: ${errors.length} error(s). ${summary}` : `\n✓ i18n check passed. ${summary}`);
process.exit(errors.length ? 1 : 0);
