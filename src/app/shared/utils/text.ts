/** Lowercase, accent-insensitive normalisation for client-side search. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalize(query);
  if (!q) return true;
  return fields.some((f) => !!f && normalize(f).includes(q));
}

/** Splits a translation template into literal text and `{{placeholder}}` parts. */
export function templateParts(template: string): { text?: string; slot?: string }[] {
  const parts: { text?: string; slot?: string }[] = [];
  const re = /\{\{\s*(\w+)\s*\}\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    if (match.index > last) parts.push({ text: template.slice(last, match.index) });
    parts.push({ slot: match[1] });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push({ text: template.slice(last) });
  return parts;
}

export function websiteHost(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
