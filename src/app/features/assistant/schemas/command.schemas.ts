import { z } from 'zod';
import { EntityIdSchema } from './a2ui.schemas';
import { AssistantActionSchema } from './action.schemas';
import { INTENTS } from './constants';

/**
 * A structured request to the demo agent. Typed text is turned into a command
 * by the rules-based intent matcher; suggestion chips send one directly.
 */
export const DemoCommandSchema = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('salesOverview') }).strict(),
  z
    .object({
      intent: z.literal('topDeals'),
      scope: z.enum(['mine', 'team']).default('team'),
      limit: z.number().int().min(1).max(10).default(6),
    })
    .strict(),
  z.object({ intent: z.literal('overdueTasks') }).strict(),
  z.object({ intent: z.literal('createFollowUp'), contactId: EntityIdSchema.optional(), dealId: EntityIdSchema.optional() }).strict(),
  z
    .object({
      intent: z.literal('dealsFilter'),
      ownerId: z.union([z.literal('all'), EntityIdSchema]).default('all'),
      stage: z.enum(['all', 'new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).default('all'),
    })
    .strict(),
  z.object({ intent: z.literal('moveDealStage'), dealId: EntityIdSchema.optional() }).strict(),
  z.object({ intent: z.literal('help') }).strict(),
  z.object({ intent: z.literal('malformedDemo') }).strict(),
]);

export type DemoCommand = z.infer<typeof DemoCommandSchema>;
export type DemoCommandInput = z.input<typeof DemoCommandSchema>;

/**
 * Orbit's use of AG-UI `RunAgentInput.forwardedProps`: either a command from a
 * suggestion chip, or an A2UI user action (the AG-UI A2UI convention
 * `forwardedProps.a2uiAction.userAction`).
 */
export const ForwardedPropsSchema = z
  .object({
    command: DemoCommandSchema.optional(),
    a2uiAction: z.object({ userAction: AssistantActionSchema }).strict().optional(),
  })
  .strict();

export type ForwardedProps = z.infer<typeof ForwardedPropsSchema>;

/** One entry of `engine/intents.json`. */
export const IntentDefinitionSchema = z
  .object({
    id: z.enum(INTENTS),
    /** Exact phrases per language; matching is accent- and case-insensitive. */
    phrases: z.object({ en: z.array(z.string().min(2)), fr: z.array(z.string().min(2)), ar: z.array(z.string().min(2)) }).strict(),
    /** Every group must contribute at least one token for a keyword match. */
    keywords: z.array(z.array(z.string().min(2)).min(1)).max(4),
    /** Higher wins when two intents score the same. */
    priority: z.number().int().min(0).max(10),
  })
  .strict();

export const IntentCatalogSchema = z.array(IntentDefinitionSchema).min(1);
export type IntentDefinition = z.infer<typeof IntentDefinitionSchema>;
