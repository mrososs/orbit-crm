/**
 * Agent text is generated in the active language, and the message also carries
 * its translation key (as AG-UI event metadata) so the chat can re-localize it
 * after a language switch instead of mixing languages.
 */

/** A parameter value; `{ t: key }` is itself translated (e.g. a stage name). */
export type TextParam = string | number | { t: string };

export interface AgentText {
  key: string;
  params?: Record<string, TextParam>;
  /** When set, the key is a plural entry selected by this count. */
  count?: number;
}

export interface Translator {
  t(key: string, params?: Record<string, unknown>): string;
  plural(key: string, count: number, params?: Record<string, unknown>): string;
}

export function renderText(text: AgentText, translator: Translator): string {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(text.params ?? {})) {
    params[name] = typeof value === 'object' ? translator.t(value.t) : value;
  }
  return text.count === undefined ? translator.t(text.key, params) : translator.plural(text.key, text.count, params);
}

export function isAgentText(value: unknown): value is AgentText {
  return !!value && typeof value === 'object' && typeof (value as AgentText).key === 'string';
}
