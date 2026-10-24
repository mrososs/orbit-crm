import { DEAL_STAGES, DealStage } from '../../../core/models';
import { DemoCommandInput, IntentDefinition } from '../schemas/command.schemas';
import { IntentId } from '../schemas/constants';

/**
 * Rules-based intent matching — deliberately simple and predictable.
 *
 * 1. An exact or contained phrase from `intents.json` (any language) wins.
 * 2. Otherwise every keyword group of an intent must match at least one keyword.
 * 3. Ties go to the intent with the higher priority; no match → honest fallback.
 *
 * It does not pretend to understand arbitrary language: anything outside the
 * catalogue returns `null` and the agent explains what the demo supports.
 */

export interface MatchContext {
  /** Team members, so "Priya's deals" can become an owner filter. */
  members: readonly { id: string; firstName: string; lastName: string }[];
  /** Stage names per stage, for "deals in negotiation" (defaults to {@link STAGE_SYNONYMS}). */
  stageNames?: Readonly<Record<DealStage, readonly string[]>>;
}

export interface IntentMatch {
  command: DemoCommandInput;
  intent: IntentId;
  score: number;
  /** What matched — shown in the event inspector for transparency. */
  reason: string;
}

const DIGITS: Record<string, string> = Object.fromEntries(
  [...'٠١٢٣٤٥٦٧٨٩'].map((d, i) => [d, String(i)]).concat([...'۰۱۲۳۴۵۶۷۸۹'].map((d, i) => [d, String(i)])),
);

/** Stage names in the three UI languages (normalized at match time). */
export const STAGE_SYNONYMS: Readonly<Record<DealStage, readonly string[]>> = {
  new: ['new', 'nouvelle', 'nouveau', 'nouvelles', 'جديدة', 'الجديدة'],
  qualified: ['qualified', 'qualifiée', 'qualifiées', 'qualifié', 'مؤهلة', 'المؤهلة'],
  proposal: ['proposal', 'proposals', 'proposition', 'propositions', 'عرض', 'العروض'],
  negotiation: ['negotiation', 'négociation', 'تفاوض', 'التفاوض'],
  won: ['won', 'gagnée', 'gagnées', 'gagné', 'رابحة', 'الرابحة', 'مكسوبة'],
  lost: ['lost', 'perdue', 'perdues', 'perdu', 'خاسرة', 'الخاسرة'],
};

/** Lower-cases, strips Latin accents and Arabic diacritics, unifies Arabic letter variants and punctuation. */
export function normalizeText(text: string): string {
  return text
    .replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d] ?? d)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface PreparedIntent {
  definition: IntentDefinition;
  phrases: string[];
  keywords: string[][];
}

export class IntentMatcher {
  private readonly intents: PreparedIntent[];

  constructor(definitions: readonly IntentDefinition[]) {
    this.intents = definitions.map((definition) => ({
      definition,
      phrases: [...definition.phrases.en, ...definition.phrases.fr, ...definition.phrases.ar].map(normalizeText),
      // Keywords keep a trailing space when they mean "a whole word followed by…" (e.g. "by ").
      keywords: definition.keywords.map((group) => group.map((k) => normalizeText(k) + (k.endsWith(' ') ? ' ' : ''))),
    }));
  }

  match(text: string, context: MatchContext): IntentMatch | null {
    const input = normalizeText(text);
    if (!input) return null;
    const padded = ` ${input} `;

    let best: { prepared: PreparedIntent; score: number; reason: string } | null = null;
    for (const prepared of this.intents) {
      const scored = this.score(prepared, input, padded);
      if (!scored) continue;
      const better =
        !best ||
        scored.score > best.score ||
        (scored.score === best.score && prepared.definition.priority > best.prepared.definition.priority);
      if (better) best = { prepared, ...scored };
    }

    // "Priya's deals in negotiation" — a deal word plus an owner or stage name means a filtered list.
    const owner = findOwner(input, context);
    const stage = findStage(input, context);
    const mentionsDeals = /deal|affaire|pipeline|صفق/.test(input);
    if (mentionsDeals && (owner || stage) && (!best || best.score < 80) && best?.prepared.definition.id !== 'moveDealStage') {
      return {
        intent: 'dealsFilter',
        score: 70,
        reason: `deal list filtered by ${[owner && 'owner', stage && 'stage'].filter(Boolean).join(' and ')}`,
        command: { intent: 'dealsFilter', ownerId: owner ?? 'all', stage: stage ?? 'all' },
      };
    }

    if (!best) return null;
    const intent = best.prepared.definition.id;
    return { intent, score: best.score, reason: best.reason, command: this.command(intent, input, owner, stage) };
  }

  private score(prepared: PreparedIntent, input: string, padded: string): { score: number; reason: string } | null {
    for (const phrase of prepared.phrases) {
      if (input === phrase) return { score: 100, reason: `phrase "${phrase}"` };
    }
    let contained: string | null = null;
    for (const phrase of prepared.phrases) {
      if (phrase.length >= 6 && padded.includes(` ${phrase} `) && (!contained || phrase.length > contained.length)) contained = phrase;
    }
    if (contained) return { score: 80 + Math.min(contained.length, 19) / 20, reason: `contains "${contained}"` };

    const hits: string[] = [];
    for (const group of prepared.keywords) {
      const hit = group.find((keyword) => (keyword.endsWith(' ') ? padded.includes(` ${keyword}`) : input.includes(keyword)));
      if (!hit) return null;
      hits.push(hit.trim());
    }
    return { score: 50 + prepared.keywords.length * 5, reason: `keywords ${hits.map((h) => `"${h}"`).join(' + ')}` };
  }

  private command(intent: IntentId, input: string, owner: string | null, stage: DealStage | null): DemoCommandInput {
    switch (intent) {
      case 'topDeals':
        return { intent, scope: mentionsMine(input) ? 'mine' : 'team', limit: findLimit(input) };
      case 'dealsFilter':
        return { intent, ownerId: owner ?? 'all', stage: stage ?? 'all' };
      default:
        return { intent } as DemoCommandInput;
    }
  }
}

function mentionsMine(input: string): boolean {
  const words = ` ${input} `;
  return [' my ', ' mine ', ' me ', ' mes ', ' mon ', ' moi ', ' لي ', 'صفقاتي'].some((w) => words.includes(w));
}

function findLimit(input: string): number {
  const match = input.match(/\b(\d{1,2})\b/);
  const n = match ? Number(match[1]) : 6;
  return Math.min(10, Math.max(1, n));
}

function findOwner(input: string, context: MatchContext): string | null {
  const words = ` ${input} `;
  const member = context.members.find(
    (m) => words.includes(` ${normalizeText(m.firstName)} `) || words.includes(` ${normalizeText(m.firstName)}s `),
  );
  return member?.id ?? null;
}

function findStage(input: string, context: MatchContext): DealStage | null {
  const words = ` ${input} `;
  const names = context.stageNames ?? STAGE_SYNONYMS;
  return DEAL_STAGES.find((stage) => names[stage].some((name) => words.includes(` ${normalizeText(name)} `))) ?? null;
}
