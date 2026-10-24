import { z } from 'zod';
import { EntityIdSchema } from './a2ui.schemas';
import { INTENTS } from './constants';

/**
 * User actions dispatched by A2UI surfaces (the A2UI v0.9 client `action`
 * message: name, surfaceId, sourceComponentId, timestamp, resolved context).
 *
 * The dispatcher only forwards actions that parse against this discriminated
 * union; the context of each action has its own strict shape. Field-level
 * domain validation (lengths, dates, record existence) happens in the agent.
 */

const envelope = {
  surfaceId: z.string().regex(/^[a-z][a-z0-9-]{2,60}$/),
  sourceComponentId: z.string().max(60),
  timestamp: z.string().datetime({ offset: true }),
  catalogId: z.string().optional(),
};

const Str = (max = 200) => z.string().max(max);
const StageOrAll = z.enum(['all', 'new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);
const OpenStage = z.enum(['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);

export const AssistantActionSchema = z.discriminatedUnion('name', [
  z.object({ ...envelope, name: z.literal('prompt.run'), context: z.object({ intent: z.enum(INTENTS) }).strict() }).strict(),
  z.object({ ...envelope, name: z.literal('dealList.scope'), context: z.object({ scope: z.enum(['mine', 'team']) }).strict() }).strict(),
  z
    .object({
      ...envelope,
      name: z.literal('dealList.filter'),
      context: z.object({ ownerId: z.union([z.literal('all'), EntityIdSchema]), stage: StageOrAll }).strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      name: z.literal('followUp.submit'),
      context: z
        .object({
          subject: Str(300),
          dueDate: Str(20),
          dueTime: Str(10),
          priority: Str(20),
          ownerId: Str(40),
          contactId: Str(40),
          dealId: Str(40),
        })
        .strict(),
    })
    .strict(),
  z.object({ ...envelope, name: z.literal('followUp.cancel'), context: z.object({}).strict() }).strict(),
  z.object({ ...envelope, name: z.literal('deal.startMove'), context: z.object({ dealId: EntityIdSchema }).strict() }).strict(),
  z.object({ ...envelope, name: z.literal('deal.reviewMove'), context: z.object({ dealId: Str(40), stage: Str(20) }).strict() }).strict(),
  z.object({ ...envelope, name: z.literal('deal.confirmMove'), context: z.object({ dealId: EntityIdSchema, stage: OpenStage }).strict() }).strict(),
  z.object({ ...envelope, name: z.literal('deal.cancelMove'), context: z.object({}).strict() }).strict(),
  z.object({ ...envelope, name: z.literal('deal.undoMove'), context: z.object({ receiptId: z.string().regex(/^rc_[a-z0-9]{1,32}$/) }).strict() }).strict(),
]);

export type AssistantAction = z.infer<typeof AssistantActionSchema>;
export type AssistantActionOf<N extends AssistantAction['name']> = Extract<AssistantAction, { name: N }>;
